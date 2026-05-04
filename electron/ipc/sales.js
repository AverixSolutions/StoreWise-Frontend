// electron/ipc/sales.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

// ========== helpers ==========
function getNextSaleSlNo(licenseId) {
  const seq = db
    .prepare(`SELECT lastSlNo FROM sale_sequence WHERE licenseId = ?`)
    .get(licenseId);
  const next = seq ? seq.lastSlNo + 1 : 1;
  db.prepare(
    `
    INSERT INTO sale_sequence (licenseId, lastSlNo)
    VALUES (?, ?)
    ON CONFLICT(licenseId) DO UPDATE SET lastSlNo = excluded.lastSlNo
  `,
  ).run(licenseId, next);
  return next;
}
function getNextSaleHoldNo(licenseId) {
  const seq = db
    .prepare(`SELECT lastHoldNo FROM sale_hold_sequence WHERE licenseId = ?`)
    .get(licenseId);
  const next = seq ? seq.lastHoldNo + 1 : 1;
  db.prepare(
    `
    INSERT INTO sale_hold_sequence (licenseId, lastHoldNo)
    VALUES (?, ?)
    ON CONFLICT(licenseId) DO UPDATE SET lastHoldNo = excluded.lastHoldNo
  `,
  ).run(licenseId, next);
  return next;
}
function getItemsForSale(saleId) {
  return db
    .prepare(
      `
    SELECT productId, quantity, isFree, batchId
    FROM sale_items
    WHERE saleId = ? AND COALESCE(deletedAt,'') = ''
  `,
    )
    .all(saleId);
}
function rebuildProductStock(productId) {
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(stock),0) AS qty
      FROM product_batches
      WHERE productId=? AND COALESCE(deletedAt,'')=''
    `,
    )
    .get(productId);

  const now = new Date().toISOString();

  db.prepare(
    `
    UPDATE products
    SET stock=?, updatedAt=?, isSynced=0, syncedAt=NULL
    WHERE id=?
  `,
  ).run(Number(row?.qty || 0), now, productId);
}

function bumpBatchAndProductStock({ batchId, productId, deltaQty }) {
  const now = new Date().toISOString();

  db.prepare(
    `
    UPDATE product_batches
    SET stock = COALESCE(stock,0) + ?, updatedAt = ?
    WHERE id = ?
  `,
  ).run(Number(deltaQty || 0), now, batchId);

  rebuildProductStock(productId);
}

// ========== register ==========
function registerSaleHandlers() {
  // ---- list (with filters like purchase:list) ----
  ipcMain.handle("sale:list", (evt, licenseId, filters = {}) => {
    const {
      q = "",
      customerId = null,
      dateFrom = null,
      dateTo = null,
      page = 1,
      pageSize = 50,
      includeDeleted = false,
    } = filters;

    const where = ["licenseId = @licenseId"];
    const params = { licenseId };
    if (!includeDeleted) where.push("(deletedAt IS NULL)");
    if (customerId) {
      where.push("customerId = @customerId");
      params.customerId = customerId;
    }
    if (dateFrom) {
      where.push("saleDate >= @dateFrom");
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      where.push("saleDate < @dateTo");
      params.dateTo = dateTo;
    }
    if (q && q.trim()) {
      where.push(
        `(COALESCE(billNo,'') LIKE @q OR COALESCE(customerName,'') LIKE @q)`,
      );
      params.q = `%${q.trim()}%`;
    }

    const base = `FROM sales WHERE ${where.join(" AND ")}`;
    const total = db.prepare(`SELECT COUNT(*) AS cnt ${base}`).get(params).cnt;

    const rows = db
      .prepare(
        `
      SELECT id, slNo, billNo, customerId, customerName, saleDate, entryTime,
             totalAmount, discount, saleType, isSynced, deletedAt, syncedAt
      ${base}
      ORDER BY datetime(saleDate) DESC, slNo DESC
      LIMIT @limit OFFSET @offset
    `,
      )
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

    return { success: true, total, page, pageSize, rows };
  });

  // ---- get / getFull ----
  ipcMain.handle("sale:get", (evt, id) => {
    const s = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(id);
    if (!s) return { success: false, error: "Not found" };
    const items = db
      .prepare(
        `
      SELECT si.*, p.name as productName, p.code as productCode
      FROM sale_items si
      LEFT JOIN products p ON p.id = si.productId
      WHERE si.saleId = ?
      ORDER BY COALESCE(si.lineNo,0), si.createdAt
    `,
      )
      .all(id);
    return { success: true, sale: s, items };
  });

  ipcMain.handle("sale:getFull", (evt, id) => {
    const s = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(id);
    if (!s) return { success: false, error: "Not found" };
    const items = db
      .prepare(
        `
      SELECT si.*, p.name as productName, p.code as productCode
      FROM sale_items si
      LEFT JOIN products p ON p.id = si.productId
      WHERE si.saleId = ?
      ORDER BY COALESCE(si.lineNo,0), si.createdAt
    `,
      )
      .all(id);
    return { success: true, sale: s, items };
  });

  // ---- peek next slno ----
  ipcMain.handle("sale:peek-next-slno", (evt, licenseId) => {
    const seq = db
      .prepare(`SELECT lastSlNo FROM sale_sequence WHERE licenseId = ?`)
      .get(licenseId);
    return { nextSlNo: seq ? seq.lastSlNo + 1 : 1 };
  });

  // ---- create (stock ↓; customer ledger +1 on CREDIT) ----
  ipcMain.handle("create-sale", (evt, header, items) => {
    const newId = header.id || uuidv4();
    const now = new Date().toISOString();
    const slNo = getNextSaleSlNo(header.licenseId);

    let totalAmount = 0;

    const insSale = db.prepare(`
      INSERT INTO sales(
        id, slNo, userId, licenseId, customerId, customerName, billNo,
        department, debitAccount, natureOfEntry, saleDate, entryTime,
        totalAmount, discount, saleType, createdAt, updatedAt, isSynced
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const insItem = db.prepare(`
      INSERT INTO sale_items(
        id, saleId, productId, barcode, quantity, unit, rate, mrp,
        taxPercent, taxAmount, discount, discountType, salePrice, profit,
        totalCost, billedValue, effectiveUnitValue, batchNo, mfgDate, expiryDate,
        lineNo, isFree, batchId, createdAt, updatedAt, isSynced
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const trx = db.transaction((header, items) => {
      insSale.run(
        newId,
        slNo,
        header.userId || null,
        header.licenseId,
        header.customerId || null,
        header.customerName || null,
        header.billNo || null,
        header.department || null,
        header.debitAccount || null,
        header.natureOfEntry || null,
        header.saleDate || now,
        header.entryTime || now,
        0,
        header.discount || 0,
        header.saleType === "CASH" ? "CASH" : "CREDIT",
        now,
        now,
      );

      items.forEach((it, idx) => {
        const qty = Number(it.quantity || 0);
        const rate = Number(it.rate || 0);
        const taxPct =
          it.taxPercent === "NT"
            ? 0
            : parseInt(String(it.taxPercent).replace("P", "")) || 0;
        const taxAmount = it.isFree ? 0 : rate * qty * (taxPct / 100);
        const totalCost = it.isFree ? 0 : rate * qty + taxAmount;

        let salePrice = it.salePrice ?? null;
        if (it.profitPercent) {
          const unitCostWithTax = qty ? rate + taxAmount / qty : rate;
          salePrice =
            unitCostWithTax * (1 + (Number(it.profitPercent) || 0) / 100);
        }
        const discountAbs =
          it.discountType === "PCT"
            ? totalCost * (Math.max(0, Math.min(100, it.discount)) / 100)
            : Number(it.discount) || 0;

        const profit =
          salePrice != null
            ? salePrice - (qty ? rate + taxAmount / qty : rate)
            : null;

        const billedValue = it.isFree
          ? 0
          : Math.max(0, totalCost - discountAbs);
        const effUnit = it.isFree ? 0 : qty > 0 ? billedValue / qty : 0;

        totalAmount += billedValue;

        // Resolve batchId
        let batchId = it.batchId || null;

        if (
          !batchId &&
          (it.batchNo || it.barcode || it.mfgDate || it.expiryDate)
        ) {
          const batch = db
            .prepare(
              `
      SELECT id FROM product_batches
      WHERE licenseId = ?
        AND productId = ?
        AND COALESCE(deletedAt,'') = ''
        AND COALESCE(batchNo,'') = COALESCE(?, '')
        AND COALESCE(barcode,'') = COALESCE(?, '')
        AND COALESCE(mfgDate,'') = COALESCE(?, '')
        AND COALESCE(expiryDate,'') = COALESCE(?, '')
      LIMIT 1
    `,
            )
            .get(
              header.licenseId,
              it.productId,
              it.batchNo || null,
              it.barcode || null,
              it.mfgDate || null,
              it.expiryDate || null,
            );

          batchId = batch?.id || null;
        }

        insItem.run(
          uuidv4(),
          newId,
          it.productId,
          it.barcode || it.code || null,
          qty,
          it.unit,
          rate,
          it.mrp ?? null,
          it.taxPercent,
          taxAmount,
          discountAbs,
          it.discountType || "ABS",
          salePrice,
          profit,
          totalCost,
          billedValue,
          effUnit,
          it.batchNo || null,
          it.mfgDate || null,
          it.expiryDate || null,
          it.lineNo || idx + 1,
          it.isFree ? 1 : 0,
          batchId,
          now,
          now,
        );

        if (!it.isFree && qty > 0) {
          if (batchId) {
            const batchRow = db
              .prepare(`SELECT stock FROM product_batches WHERE id=?`)
              .get(batchId);

            if (!batchRow) {
              throw new Error(`Batch not found for product ${it.productId}`);
            }

            if (Number(batchRow.stock || 0) < qty) {
              throw new Error(
                `Insufficient batch stock for product ${it.productId}. Available: ${Number(
                  batchRow.stock || 0,
                )}, Required: ${qty}`,
              );
            }
            bumpBatchAndProductStock({
              batchId,
              productId: it.productId,
              deltaQty: -qty,
            });
          } else {
            db.prepare(
              `UPDATE products
   SET stock = COALESCE(stock,0) - ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
   WHERE id=?`,
            ).run(qty, now, it.productId);
          }
        }
      });

      db.prepare(`UPDATE sales SET totalAmount=?, discount=? WHERE id=?`).run(
        totalAmount,
        header.discount || 0,
        newId,
      );

      // Customer ledger (CREDIT -> receivable increases)
      if (header.saleType !== "CASH" && header.customerId) {
        const grand = Math.max(0, totalAmount - (header.discount || 0));
        db.prepare(
          `
          INSERT INTO customer_transactions
          (id, licenseId, customerId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES(?, ?, ?, 'SALE', ?, ?, ?, ?, 1, 'Sale', ?, ?, 0)
        `,
        ).run(
          uuidv4(),
          header.licenseId,
          header.customerId,
          newId,
          header.billNo || null,
          header.saleDate || now,
          grand,
          now,
          now,
        );
      }
    });

    trx(header, items);
    return { success: true, saleId: newId, slNo, totalAmount };
  });

  // ---- update (reverse old stock; reinsert; ledger rewrite) ----
  ipcMain.handle("sale:update", (evt, payload) => {
    const { id, header, items } = payload;
    if (!id) return { success: false, error: "id required" };

    const trx = db.transaction(() => {
      const existing = db.prepare(`SELECT * FROM sales WHERE id=?`).get(id);
      if (!existing) throw new Error("Sale not found");
      const now = new Date().toISOString();

      // Reverse stock from old items (add back what we subtracted on sale)
      const oldItems = getItemsForSale(id);
      for (const it of oldItems) {
        if (!it.isFree) {
          if (it.batchId) {
            bumpBatchAndProductStock({
              batchId: it.batchId,
              productId: it.productId,
              deltaQty: Number(it.quantity || 0),
            });
          } else {
            db.prepare(
              `UPDATE products
   SET stock = COALESCE(stock,0) + ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
   WHERE id=?`,
            ).run(it.quantity, now, it.productId);
          }
        }
      }

      // Compute totals
      const totalAmount = items.reduce(
        (s, it) => s + Number(it.billedValue || 0),
        0,
      );
      const grand = Math.max(0, totalAmount - Number(header.discount || 0));

      // Update header
      db.prepare(
        `
        UPDATE sales SET
          billNo=@billNo, customerId=@customerId, customerName=@customerName,
          department=@department, debitAccount=@debitAccount, natureOfEntry=@natureOfEntry,
          saleDate=@saleDate, entryTime=@entryTime, discount=@discount,
          totalAmount=@totalAmount, saleType=@saleType,
          updatedAt=@now, isSynced=0
        WHERE id=@id
      `,
      ).run({
        id,
        billNo: header.billNo || null,
        customerId: header.customerId || null,
        customerName: header.customerName || null,
        department: header.department || null,
        debitAccount: header.debitAccount || null,
        natureOfEntry: header.natureOfEntry || null,
        saleDate: header.saleDate,
        entryTime: header.entryTime || header.saleDate,
        discount: Number(header.discount || 0),
        totalAmount,
        saleType: header.saleType === "CASH" ? "CASH" : "CREDIT",
        now,
      });

      // Replace items
      db.prepare(`DELETE FROM sale_items WHERE saleId = ?`).run(id);
      const insItem = db.prepare(`
  INSERT INTO sale_items(
    id, saleId, productId, quantity, unit, rate, taxPercent, taxAmount,
    discount, discountType, salePrice, profit, totalCost, billedValue,
    barcode, mrp, batchNo, mfgDate, expiryDate, lineNo, isFree,
    batchId, effectiveUnitValue, createdAt, updatedAt, isSynced, syncedAt
  ) VALUES (
    lower(hex(randomblob(16))), @saleId, @productId, @quantity, @unit, @rate, @taxPercent, @taxAmount,
    @discount, @discountType, @salePrice, @profit, @totalCost, @billedValue,
    @barcode, @mrp, @batchNo, @mfgDate, @expiryDate, @lineNo, @isFree,
    @batchId, @effectiveUnitValue, @now, @now, 0, NULL
  )
`);

      items.forEach((it, idx) => {
        const qty = Number(it.quantity || 0);
        const effUnit = qty > 0 ? Number(it.billedValue || 0) / qty : 0;

        let batchId = it.batchId || null;

        if (
          !batchId &&
          (it.batchNo || it.barcode || it.mfgDate || it.expiryDate)
        ) {
          const batch = db
            .prepare(
              `
      SELECT id
      FROM product_batches
      WHERE licenseId = ?
        AND productId = ?
        AND COALESCE(deletedAt,'') = ''
        AND COALESCE(batchNo,'') = COALESCE(?, '')
        AND COALESCE(barcode,'') = COALESCE(?, '')
        AND COALESCE(mfgDate,'') = COALESCE(?, '')
        AND COALESCE(expiryDate,'') = COALESCE(?, '')
      LIMIT 1
    `,
            )
            .get(
              header.licenseId,
              it.productId,
              it.batchNo || null,
              it.barcode || null,
              it.mfgDate || null,
              it.expiryDate || null,
            );

          batchId = batch?.id || null;
        }

        insItem.run({
          saleId: id,
          productId: it.productId,
          quantity: qty,
          unit: it.unit,
          rate: Number(it.rate || 0),
          taxPercent: it.taxPercent,
          taxAmount: Number(it.taxAmount || 0),
          discount: Number(it.discount || 0),
          discountType: it.discountType || "ABS",
          salePrice: it.salePrice ?? null,
          profit: it.profit ?? null,
          totalCost: Number(it.totalCost || 0),
          billedValue: Number(it.billedValue || 0),
          barcode: it.barcode ?? null,
          mrp: it.mrp ?? null,
          batchNo: it.batchNo ?? null,
          mfgDate: it.mfgDate ?? null,
          expiryDate: it.expiryDate ?? null,
          lineNo: it.lineNo ?? idx + 1,
          isFree: it.isFree ? 1 : 0,
          batchId,
          effectiveUnitValue: effUnit,
          now,
        });

        if (!it.isFree && qty > 0) {
          if (batchId) {
            const batchRow = db
              .prepare(`SELECT stock FROM product_batches WHERE id=?`)
              .get(batchId);

            if (!batchRow) {
              throw new Error(`Batch not found for product ${it.productId}`);
            }

            if (Number(batchRow.stock || 0) < qty) {
              throw new Error(
                `Insufficient batch stock for product ${it.productId}. Available: ${Number(
                  batchRow.stock || 0,
                )}, Required: ${qty}`,
              );
            }
            bumpBatchAndProductStock({
              batchId,
              productId: it.productId,
              deltaQty: -qty,
            });
          } else {
            db.prepare(
              `UPDATE products
         SET stock = COALESCE(stock,0) - ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
         WHERE id=?`,
            ).run(qty, now, it.productId);
          }
        }
      });

      // Rewrite customer ledger row for this sale
      db.prepare(
        `
        DELETE FROM customer_transactions
        WHERE licenseId=@licenseId AND kind='SALE' AND refId=@refId
      `,
      ).run({ licenseId: header.licenseId, refId: id });

      if (header.saleType !== "CASH" && header.customerId) {
        db.prepare(
          `
          INSERT INTO customer_transactions
          (id, licenseId, customerId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES (lower(hex(randomblob(16))), ?, ?, 'SALE', ?, ?, ?, ?, 1, 'Sale', ?, ?, 0)
        `,
        ).run(
          header.licenseId,
          header.customerId,
          id,
          header.billNo || null,
          header.saleDate || now,
          grand,
          now,
          now,
        );
      }
    });

    try {
      trx();
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  // ---- delete (add stock back; remove ledger) ----
  ipcMain.handle("sale:delete", (evt, id) => {
    const now = new Date().toISOString();
    const trx = db.transaction(() => {
      const items = getItemsForSale(id);
      for (const it of items) {
        if (!it.isFree) {
          if (it.batchId) {
            bumpBatchAndProductStock({
              batchId: it.batchId,
              productId: it.productId,
              deltaQty: Number(it.quantity || 0),
            });
          } else {
            db.prepare(
              `UPDATE products
   SET stock = COALESCE(stock,0) + ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
   WHERE id=?`,
            ).run(it.quantity, now, it.productId);
          }
        }
      }

      const saleRow = db
        .prepare(`SELECT licenseId FROM sales WHERE id=?`)
        .get(id);
      db.prepare(`UPDATE sales SET deletedAt=?, isSynced=0 WHERE id=?`).run(
        now,
        id,
      );
      db.prepare(
        `UPDATE sale_items SET deletedAt=?, isSynced=0 WHERE saleId=?`,
      ).run(now, id);

      if (saleRow?.licenseId) {
        db.prepare(
          `DELETE FROM customer_transactions WHERE licenseId=? AND kind='SALE' AND refId=?`,
        ).run(saleRow.licenseId, id);
      } else {
        db.prepare(
          `DELETE FROM customer_transactions WHERE kind='SALE' AND refId=?`,
        ).run(id);
      }
    });
    try {
      trx();
      return { success: true, deletedAt: now };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  // ---- mark synced ----
  ipcMain.handle("sale:mark-synced", (evt, ids, serverSyncedAt) => {
    const ts = serverSyncedAt || new Date().toISOString();
    const trx = db.transaction((ids) => {
      const stmt = db.prepare(
        `UPDATE sales SET isSynced=1, syncedAt=? WHERE id=?`,
      );
      ids.forEach((id) => stmt.run(ts, id));
    });
    trx(ids);
    return { success: true, syncedAt: ts };
  });

  ipcMain.handle("sale:mark-items-synced", (evt, ids, serverSyncedAt) => {
    if (!Array.isArray(ids) || ids.length === 0)
      return { success: true, synced: 0 };

    const ts = serverSyncedAt || new Date().toISOString();
    const trx = db.transaction((ids) => {
      const stmt = db.prepare(
        `UPDATE sale_items SET isSynced = 1, syncedAt = ? WHERE id = ?`,
      );
      ids.forEach((id) => stmt.run(ts, id));
    });
    trx(ids);
    return { success: true, synced: ids.length, syncedAt: ts };
  });

  ipcMain.handle("get-dirty-sales", (evt, licenseId, limit = 200) => {
    const rows = db
      .prepare(
        `
    SELECT id, slNo, billNo, userId, licenseId,
           customerId, customerName, department,
           debitAccount, natureOfEntry, saleType,
           saleDate, entryTime,
           totalAmount, discount,
           createdAt, updatedAt, deletedAt,
           isSynced, syncedAt
    FROM sales
    WHERE licenseId = ?
      AND (isSynced = 0 OR isSynced IS NULL)
    ORDER BY updatedAt ASC
    LIMIT ?
  `,
      )
      .all(licenseId, limit);
    return { success: true, records: rows };
  });

  ipcMain.handle("get-dirty-sale-items", (evt, licenseId, limit = 500) => {
    const rows = db
      .prepare(
        `
    SELECT si.id, si.saleId, si.productId, si.barcode,
           si.quantity, si.unit, si.rate, si.mrp,
           si.taxPercent, si.taxAmount,
           si.discount, si.discountType,
           si.salePrice, si.profit, si.totalCost, si.billedValue,
           si.batchNo, si.batchId,
           si.mfgDate, si.expiryDate,
           si.lineNo, si.isFree, si.effectiveUnitValue,
           si.createdAt, si.updatedAt, si.deletedAt,
           si.isSynced, si.syncedAt
    FROM sale_items si
    JOIN sales s ON s.id = si.saleId
    WHERE s.licenseId = ?
      AND (si.isSynced = 0 OR si.isSynced IS NULL)
    ORDER BY si.updatedAt ASC
    LIMIT ?
  `,
      )
      .all(licenseId, limit);
    return { success: true, records: rows };
  });

  // ---- holds ----
  ipcMain.handle("sale-hold:save", (evt, payload) => {
    const now = new Date().toISOString();
    if (payload.id) {
      const ex = db
        .prepare(
          `SELECT title, headerJson, rowsJson FROM sale_holds WHERE id=? AND deletedAt IS NULL`,
        )
        .get(payload.id);
      if (!ex) return { success: false, error: "NOT_FOUND" };
      const newTitle = payload.title !== undefined ? payload.title : ex.title;
      const newHdr =
        payload.header !== undefined
          ? JSON.stringify(payload.header)
          : ex.headerJson;
      const newRows =
        payload.rows !== undefined ? JSON.stringify(payload.rows) : ex.rowsJson;
      db.prepare(
        `UPDATE sale_holds SET title=?, headerJson=?, rowsJson=?, updatedAt=? WHERE id=?`,
      ).run(newTitle || null, newHdr, newRows, now, payload.id);
      return { success: true, id: payload.id, updated: true };
    }
    const id = uuidv4();
    const holdNo = getNextSaleHoldNo(payload.licenseId);
    db.prepare(
      `
      INSERT INTO sale_holds(id, licenseId, userId, holdNo, title, headerJson, rowsJson, createdAt, updatedAt, isSynced)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `,
    ).run(
      id,
      payload.licenseId,
      payload.userId || null,
      holdNo,
      payload.title || null,
      JSON.stringify(payload.header || {}),
      JSON.stringify(payload.rows || []),
      now,
      now,
    );
    return { success: true, id, holdNo };
  });
  ipcMain.handle(
    "sale-hold:list",
    (evt, licenseId, { page = 1, pageSize = 50 } = {}) => {
      const offset = (page - 1) * pageSize;
      const rows = db
        .prepare(
          `
      SELECT id, holdNo, title, createdAt, updatedAt
      FROM sale_holds
      WHERE licenseId=? AND deletedAt IS NULL
      ORDER BY updatedAt DESC
      LIMIT ? OFFSET ?
    `,
        )
        .all(licenseId, pageSize, offset);
      const total = db
        .prepare(
          `
      SELECT COUNT(*) as count FROM sale_holds WHERE licenseId=? AND deletedAt IS NULL
    `,
        )
        .get(licenseId).count;
      return { holds: rows, total };
    },
  );
  ipcMain.handle("sale-hold:get", (evt, id) => {
    const row = db
      .prepare(`SELECT * FROM sale_holds WHERE id=? AND deletedAt IS NULL`)
      .get(id);
    if (!row) return { success: false, error: "NOT_FOUND" };
    return {
      success: true,
      hold: {
        id: row.id,
        holdNo: row.holdNo,
        title: row.title,
        header: JSON.parse(row.headerJson),
        rows: JSON.parse(row.rowsJson),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    };
  });
  ipcMain.handle("sale-hold:delete", (evt, id) => {
    const now = new Date().toISOString();
    db.prepare(`UPDATE sale_holds SET deletedAt=? WHERE id=?`).run(now, id);
    return { success: true };
  });
  ipcMain.handle("sale-hold:peek-next-no", (evt, licenseId) => {
    const seq = db
      .prepare(`SELECT lastHoldNo FROM sale_hold_sequence WHERE licenseId=?`)
      .get(licenseId);
    return { nextHoldNo: seq ? seq.lastHoldNo + 1 : 1 };
  });

  ipcMain.handle("bulk-upsert-sales", (evt, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = new Date().toISOString();
    const upsert = db.prepare(`
    INSERT INTO sales (
      id, slNo, billNo, userId, licenseId,
      customerId, customerName, department,
      debitAccount, natureOfEntry, saleType,
      saleDate, entryTime,
      totalAmount, discount,
      createdAt, updatedAt, deletedAt,
      isSynced, syncedAt
    ) VALUES (
      @id, @slNo, @billNo, @userId, @licenseId,
      @customerId, @customerName, @department,
      @debitAccount, @natureOfEntry, @saleType,
      @saleDate, @entryTime,
      @totalAmount, @discount,
      @createdAt, @updatedAt, @deletedAt,
      1, @syncedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      slNo          = excluded.slNo,
      billNo        = excluded.billNo,
      customerId    = excluded.customerId,
      customerName  = excluded.customerName,
      department    = excluded.department,
      debitAccount  = excluded.debitAccount,
      natureOfEntry = excluded.natureOfEntry,
      saleType      = excluded.saleType,
      saleDate      = excluded.saleDate,
      entryTime     = excluded.entryTime,
      totalAmount   = excluded.totalAmount,
      discount      = excluded.discount,
      updatedAt     = excluded.updatedAt,
      deletedAt     = excluded.deletedAt,
      isSynced      = 1,
      syncedAt      = excluded.syncedAt
    WHERE excluded.updatedAt > sales.updatedAt
      OR sales.updatedAt IS NULL
  `);

    const trx = db.transaction((records) => {
      for (const r of records) {
        upsert.run({
          id: r.id,
          slNo: r.slNo ?? null,
          billNo: r.billNo ?? null,
          userId: r.userId ?? null,
          licenseId: r.licenseId,
          customerId: r.customerId ?? null,
          customerName: r.customerName ?? null,
          department: r.department ?? null,
          debitAccount: r.debitAccount ?? null,
          natureOfEntry: r.natureOfEntry ?? null,
          saleType: r.saleType ?? null,
          saleDate:
            r.saleDate instanceof Date ? r.saleDate.toISOString() : r.saleDate,
          entryTime:
            r.entryTime instanceof Date
              ? r.entryTime.toISOString()
              : (r.entryTime ?? null),
          totalAmount: Number(r.totalAmount || 0),
          discount: Number(r.discount || 0),
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : (r.createdAt ?? now),
          updatedAt:
            r.updatedAt instanceof Date
              ? r.updatedAt.toISOString()
              : (r.updatedAt ?? now),
          deletedAt:
            r.deletedAt instanceof Date
              ? r.deletedAt.toISOString()
              : (r.deletedAt ?? null),
          syncedAt:
            r.syncedAt instanceof Date
              ? r.syncedAt.toISOString()
              : (r.syncedAt ?? now),
        });
      }
    });

    trx(records);

    // Keep sale_sequence in sync (mirrors purchase bulk-upsert pattern)
    const maxRow = db
      .prepare(
        `SELECT MAX(slNo) AS maxSlNo FROM sales WHERE licenseId = ? AND deletedAt IS NULL`,
      )
      .get(records[0]?.licenseId);

    if (maxRow?.maxSlNo) {
      db.prepare(
        `
      INSERT INTO sale_sequence (licenseId, lastSlNo)
      VALUES (?, ?)
      ON CONFLICT(licenseId) DO UPDATE SET
        lastSlNo = MAX(excluded.lastSlNo, sale_sequence.lastSlNo)
    `,
      ).run(records[0].licenseId, maxRow.maxSlNo);
    }

    return { success: true, upserted: records.length };
  });

  ipcMain.handle("bulk-upsert-sale-items", (evt, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = new Date().toISOString();
    const upsert = db.prepare(`
    INSERT INTO sale_items (
      id, saleId, productId, barcode,
      quantity, unit, rate, mrp,
      taxPercent, taxAmount, discount, discountType,
      salePrice, profit, totalCost, billedValue,
      batchNo, batchId,
      mfgDate, expiryDate, lineNo, isFree, effectiveUnitValue,
      createdAt, updatedAt, deletedAt, isSynced, syncedAt
    ) VALUES (
      @id, @saleId, @productId, @barcode,
      @quantity, @unit, @rate, @mrp,
      @taxPercent, @taxAmount, @discount, @discountType,
      @salePrice, @profit, @totalCost, @billedValue,
      @batchNo, @batchId,
      @mfgDate, @expiryDate, @lineNo, @isFree, @effectiveUnitValue,
      @createdAt, @updatedAt, @deletedAt, 1, @syncedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      quantity           = excluded.quantity,
      unit               = excluded.unit,
      rate               = excluded.rate,
      mrp                = excluded.mrp,
      taxPercent         = excluded.taxPercent,
      taxAmount          = excluded.taxAmount,
      discount           = excluded.discount,
      discountType       = excluded.discountType,
      salePrice          = excluded.salePrice,
      profit             = excluded.profit,
      totalCost          = excluded.totalCost,
      billedValue        = excluded.billedValue,
      batchNo            = excluded.batchNo,
      batchId            = excluded.batchId,
      mfgDate            = excluded.mfgDate,
      expiryDate         = excluded.expiryDate,
      lineNo             = excluded.lineNo,
      isFree             = excluded.isFree,
      effectiveUnitValue = excluded.effectiveUnitValue,
      updatedAt          = excluded.updatedAt,
      deletedAt          = excluded.deletedAt,
      isSynced           = 1,
      syncedAt           = excluded.syncedAt
    WHERE excluded.updatedAt > sale_items.updatedAt
      OR sale_items.updatedAt IS NULL
  `);

    const trx = db.transaction((records) => {
      for (const r of records) {
        upsert.run({
          id: r.id,
          saleId: r.saleId,
          productId: r.productId,
          barcode: r.barcode ?? null,
          quantity: Number(r.quantity || 0),
          unit: r.unit,
          rate: Number(r.rate || 0),
          mrp: r.mrp != null ? Number(r.mrp) : null,
          taxPercent: r.taxPercent,
          taxAmount: Number(r.taxAmount || 0),
          discount: Number(r.discount || 0),
          discountType: r.discountType ?? null,
          salePrice: r.salePrice != null ? Number(r.salePrice) : null,
          profit: r.profit != null ? Number(r.profit) : null,
          totalCost: Number(r.totalCost || 0),
          billedValue: r.billedValue != null ? Number(r.billedValue) : null,
          batchNo: r.batchNo ?? null,
          batchId: r.batchId ?? null,
          mfgDate: r.mfgDate ?? null,
          expiryDate: r.expiryDate ?? null,
          lineNo: r.lineNo ?? null,
          isFree: r.isFree ? 1 : 0,
          effectiveUnitValue:
            r.effectiveUnitValue != null ? Number(r.effectiveUnitValue) : null,
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : (r.createdAt ?? now),
          updatedAt:
            r.updatedAt instanceof Date
              ? r.updatedAt.toISOString()
              : (r.updatedAt ?? now),
          deletedAt:
            r.deletedAt instanceof Date
              ? r.deletedAt.toISOString()
              : (r.deletedAt ?? null),
          syncedAt:
            r.syncedAt instanceof Date
              ? r.syncedAt.toISOString()
              : (r.syncedAt ?? now),
        });
      }
    });

    trx(records);
    return { success: true, upserted: records.length };
  });
}

module.exports = { registerSaleHandlers };
