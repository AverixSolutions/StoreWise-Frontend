// electron/ipc/purchaseReturns.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

function getNextReturnSlNo(licenseId) {
  const seq = db
    .prepare(
      "SELECT lastSlNo FROM purchase_return_sequence WHERE licenseId = ?",
    )
    .get(licenseId);
  const next = seq ? seq.lastSlNo + 1 : 1;
  db.prepare(
    `
    INSERT INTO purchase_return_sequence (licenseId, lastSlNo)
    VALUES (?, ?)
    ON CONFLICT(licenseId) DO UPDATE SET lastSlNo = excluded.lastSlNo
  `,
  ).run(licenseId, next);
  return next;
}

function getNextReturnHoldNo(licenseId) {
  const seq = db
    .prepare(
      "SELECT lastHoldNo FROM purchase_return_hold_sequence WHERE licenseId = ?",
    )
    .get(licenseId);
  const next = seq ? seq.lastHoldNo + 1 : 1;
  db.prepare(
    `
    INSERT INTO purchase_return_hold_sequence (licenseId, lastHoldNo)
    VALUES (?, ?)
    ON CONFLICT(licenseId) DO UPDATE SET lastHoldNo = excluded.lastHoldNo
  `,
  ).run(licenseId, next);
  return next;
}

function rebuildProductStock(productId) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(stock),0) AS qty
       FROM product_batches
       WHERE productId=? AND COALESCE(deletedAt,'')=''`,
    )
    .get(productId);
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE products SET stock=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE id=?`,
  ).run(Number(row?.qty || 0), now, productId);
}

function bumpBatchAndProductStock({ batchId, productId, deltaQty }) {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE product_batches SET stock = COALESCE(stock,0) + ?, updatedAt = ? WHERE id = ?`,
  ).run(Number(deltaQty || 0), now, batchId);
  rebuildProductStock(productId);
}

function registerPurchaseReturnHandlers() {
  ipcMain.handle("purchase-return:create", (event, payload) => {
    const { header, items } = payload;
    const newId = uuidv4();
    const now = new Date().toISOString();
    const slNo = getNextReturnSlNo(header.licenseId);

    let totalAmount = 0;

    const insertReturn = db.prepare(`
      INSERT INTO purchase_returns (
        id, slNo, userId, licenseId, supplierId, supplierName, billNo,
        department, debitAccount, natureOfEntry, returnDate, entryTime,
        totalAmount, discount, purchaseType, createdAt, updatedAt, isSynced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const insertItem = db.prepare(`
      INSERT INTO purchase_return_items (
        id, returnId, productId, barcode, quantity, unit, rate, mrp, taxPercent,
        taxAmount, discount, discountType, salePrice, profit, totalCost, billedValue,
        effectiveUnitValue, batchNo, mfgDate, expiryDate, lineNo,
        batchId, appliedQuantity, overReturnQuantity, overReturnReason,
        createdAt, updatedAt, isSynced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const trx = db.transaction(({ header, items }) => {
      insertReturn.run(
        newId,
        slNo,
        header.userId || null,
        header.licenseId,
        header.supplierId || null,
        header.supplierName || null,
        header.billNo || null,
        header.department || null,
        header.debitAccount || null,
        header.natureOfEntry || null,
        header.returnDate || now,
        header.entryTime || now,
        0,
        header.discount || 0,
        header.purchaseType || "CREDIT",
        now,
        now,
      );

      items.forEach((item, index) => {
        // Resolve batch
        let batchId = null;
        let availableStock = 0;

        if (item.batchNo || item.barcode || item.mfgDate || item.expiryDate) {
          const batch = db
            .prepare(
              `SELECT id, stock FROM product_batches
         WHERE licenseId = ?
           AND productId = ?
           AND COALESCE(deletedAt,'') = ''
           AND COALESCE(batchNo,'') = COALESCE(?, '')
           AND COALESCE(barcode,'') = COALESCE(?, '')
           AND COALESCE(mfgDate,'') = COALESCE(?, '')
           AND COALESCE(expiryDate,'') = COALESCE(?, '')
         LIMIT 1`,
            )
            .get(
              header.licenseId,
              item.productId,
              item.batchNo || null,
              item.barcode || null,
              item.mfgDate || null,
              item.expiryDate || null,
            );
          if (batch) {
            batchId = batch.id;
            availableStock = Math.max(0, batch.stock ?? 0);
          }
        }

        // Fallback to product stock if no batch resolved
        if (!batchId) {
          const row = db
            .prepare(`SELECT stock FROM products WHERE id = ?`)
            .get(item.productId);
          availableStock = Math.max(0, row?.stock ?? 0);
        }

        const appliedQty = Math.min(item.quantity, availableStock);
        const overQty = Math.max(0, item.quantity - appliedQty);

        const taxPercentValue =
          item.taxPercent === "NT"
            ? 0
            : parseInt(String(item.taxPercent).replace("P", "")) || 0;

        const taxAmount = item.rate * appliedQty * (taxPercentValue / 100);
        const totalCost = item.rate * appliedQty + taxAmount;

        let salePrice = item.salePrice;
        if (item.profitPercent) {
          const unitCostWithTax = appliedQty
            ? item.rate + taxAmount / appliedQty
            : item.rate;
          salePrice = unitCostWithTax * (1 + item.profitPercent / 100);
        }

        const discountAbs =
          item.discountType === "PCT"
            ? totalCost * (Math.max(0, Math.min(100, item.discount)) / 100)
            : item.discount || 0;

        const billedValue = Math.max(0, totalCost - discountAbs);
        const effectiveUnitValue =
          appliedQty > 0 ? billedValue / appliedQty : 0;

        totalAmount += billedValue;

        // Single insert — no extra UPDATE needed
        insertItem.run(
          uuidv4(),
          newId,
          item.productId,
          item.barcode || item.code || null,
          item.quantity,
          item.unit,
          item.rate,
          item.mrp || null,
          item.taxPercent,
          taxAmount,
          discountAbs,
          item.discountType || "ABS",
          salePrice || null,
          item.profit ?? null,
          totalCost,
          billedValue,
          effectiveUnitValue,
          item.batchNo || null,
          item.mfgDate || null,
          item.expiryDate || null,
          item.lineNo || index + 1,
          batchId,
          appliedQty,
          overQty,
          overQty > 0
            ? item.overReturnReason || "Over return beyond available stock"
            : null,
          now,
          now,
        );

        // Deduct stock
        if (appliedQty > 0) {
          if (batchId) {
            bumpBatchAndProductStock({
              batchId,
              productId: item.productId,
              deltaQty: -appliedQty,
            });
          } else {
            db.prepare(
              `UPDATE products SET stock = COALESCE(stock,0) - ? WHERE id = ?`,
            ).run(appliedQty, item.productId);
          }
        }
      });

      db.prepare(
        `UPDATE purchase_returns SET totalAmount = ?, discount = ? WHERE id = ?`,
      ).run(totalAmount, header.discount || 0, newId);

      const grandAmount = Math.max(0, totalAmount - (header.discount || 0));

      // CREDIT: supplier balance reduces
      if (header.purchaseType === "CREDIT" && header.supplierId) {
        db.prepare(
          `
          INSERT INTO supplier_transactions
          (id, licenseId, supplierId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES (?, ?, ?, 'RETURN', ?, ?, ?, ?, -1, ?, ?, ?, 0)
        `,
        ).run(
          uuidv4(),
          header.licenseId,
          header.supplierId,
          newId,
          header.billNo || null,
          header.returnDate || now,
          grandAmount,
          "Purchase Return",
          now,
          now,
        );
      }

      // CASH: record a cash-in (refund) in cash ledger
      if (header.purchaseType === "CASH") {
        db.prepare(
          `
          INSERT INTO cash_transactions
          (id, licenseId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES (?, ?, 'RECEIPT', ?, ?, ?, ?, +1, 'Purchase Return (Cash)', ?, ?, 0)
        `,
        ).run(
          uuidv4(),
          header.licenseId,
          newId,
          header.billNo || null,
          header.returnDate || now,
          grandAmount,
          now,
          now,
        );
      }
    });

    trx({ header, items });

    return { success: true, returnId: newId, slNo, totalAmount };
  });

  // List returns
  ipcMain.handle("purchase-return:list", (event, licenseId, filters = {}) => {
    const {
      q = "",
      supplierId = null,
      dateFrom = null,
      dateTo = null,
      page = 1,
      pageSize = 10,
    } = filters;

    const where = ["licenseId = @licenseId", "deletedAt IS NULL"];
    const params = { licenseId };

    if (supplierId) {
      where.push("supplierId = @supplierId");
      params.supplierId = supplierId;
    }
    if (dateFrom) {
      where.push("returnDate >= @dateFrom");
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      where.push("returnDate < @dateTo");
      params.dateTo = dateTo;
    }
    if (q && q.trim()) {
      where.push(
        `(COALESCE(billNo,'') LIKE @q OR COALESCE(supplierName,'') LIKE @q)`,
      );
      params.q = `%${q.trim()}%`;
    }

    const base = `FROM purchase_returns WHERE ${where.join(" AND ")}`;
    const total = db.prepare(`SELECT COUNT(*) AS cnt ${base}`).get(params).cnt;

    const rows = db
      .prepare(
        `SELECT * ${base} ORDER BY slNo DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

    return { returns: rows, total };
  });

  ipcMain.handle("purchase-return:get", (event, id) => {
    const r = db.prepare(`SELECT * FROM purchase_returns WHERE id = ?`).get(id);
    if (!r) return { success: false, error: "Not found" };
    const items = db
      .prepare(
        `SELECT * FROM purchase_return_items WHERE returnId = ? ORDER BY COALESCE(lineNo,0)`,
      )
      .all(id);
    return { success: true, purchaseReturn: r, items };
  });

  ipcMain.handle("purchase-return:getFull", (event, id) => {
    const r = db.prepare(`SELECT * FROM purchase_returns WHERE id = ?`).get(id);
    if (!r) return { success: false, error: "Not found" };
    const items = db
      .prepare(
        `SELECT * FROM purchase_return_items WHERE returnId = ? ORDER BY COALESCE(lineNo,0)`,
      )
      .all(id);
    return { success: true, purchaseReturn: r, items };
  });

  ipcMain.handle("purchase-return:delete", (event, id) => {
    const now = new Date().toISOString();
    const trx = db.transaction(() => {
      const items = db
        .prepare(
          `SELECT productId, batchId, appliedQuantity, quantity
           FROM purchase_return_items
           WHERE returnId = ? AND COALESCE(deletedAt,'') = ''`,
        )
        .all(id);

      for (const it of items) {
        const qty = Number(it.appliedQuantity ?? it.quantity ?? 0);
        if (qty > 0) {
          if (it.batchId) {
            bumpBatchAndProductStock({
              batchId: it.batchId,
              productId: it.productId,
              deltaQty: qty, // restore stock on delete
            });
          } else {
            db.prepare(
              `UPDATE products SET stock = COALESCE(stock,0) + ? WHERE id = ?`,
            ).run(qty, it.productId);
          }
        }
      }

      db.prepare(
        `UPDATE purchase_returns SET deletedAt=?, updatedAt=?, isSynced=0 WHERE id=?`,
      ).run(now, now, id);
      db.prepare(
        `UPDATE purchase_return_items SET deletedAt=?, updatedAt=?, isSynced=0 WHERE returnId=?`,
      ).run(now, now, id);

      // Reverse supplier ledger entry
      const ret = db
        .prepare(`SELECT licenseId FROM purchase_returns WHERE id=?`)
        .get(id);
      if (ret) {
        db.prepare(
          `DELETE FROM supplier_transactions WHERE kind='RETURN' AND refId=?`,
        ).run(id);
        db.prepare(
          `DELETE FROM cash_transactions WHERE kind='RECEIPT' AND refId=?`,
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

  // Mark returns synced
  ipcMain.handle(
    "purchase-return:mark-synced",
    (event, ids, serverSyncedAt) => {
      const ts = serverSyncedAt || new Date().toISOString();
      const trx = db.transaction((ids) => {
        const stmt = db.prepare(`
        UPDATE purchase_returns
        SET isSynced = 1, syncedAt = ?
        WHERE id = ?
      `);
        ids.forEach((id) => stmt.run(ts, id));
      });
      trx(ids);
      return { success: true, syncedAt: ts };
    },
  );

  // Peek next sl no
  ipcMain.handle("purchase-return:peek-next-slno", (event, licenseId) => {
    const seq = db
      .prepare(
        "SELECT lastSlNo FROM purchase_return_sequence WHERE licenseId = ?",
      )
      .get(licenseId);
    return { nextSlNo: seq ? seq.lastSlNo + 1 : 1 };
  });

  // ---- RETURN HOLD: create/update ----
  ipcMain.handle("purchase-return-hold:save", (event, payload) => {
    const now = new Date().toISOString();

    if (payload.id) {
      const existing = db
        .prepare(
          `SELECT title, headerJson, rowsJson FROM purchase_return_holds WHERE id = ? AND deletedAt IS NULL`,
        )
        .get(payload.id);

      if (!existing) return { success: false, error: "NOT_FOUND" };

      const newTitle =
        payload.title !== undefined ? payload.title : existing.title;
      const newHeaderJson =
        payload.header !== undefined
          ? JSON.stringify(payload.header)
          : existing.headerJson;
      const newRowsJson =
        payload.rows !== undefined
          ? JSON.stringify(payload.rows)
          : existing.rowsJson;

      db.prepare(
        `
        UPDATE purchase_return_holds
        SET title = ?, headerJson = ?, rowsJson = ?, updatedAt = ?
        WHERE id = ?
      `,
      ).run(newTitle || null, newHeaderJson, newRowsJson, now, payload.id);

      return { success: true, id: payload.id, holdNo: null, updated: true };
    }

    const id = uuidv4();
    const holdNo = getNextReturnHoldNo(payload.licenseId);

    db.prepare(
      `
      INSERT INTO purchase_return_holds
      (id, licenseId, userId, holdNo, title, headerJson, rowsJson, createdAt, updatedAt, isSynced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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

  // ---- RETURN HOLD: list ----
  ipcMain.handle(
    "purchase-return-hold:list",
    (event, licenseId, { page = 1, pageSize = 50 } = {}) => {
      const offset = (page - 1) * pageSize;
      const rows = db
        .prepare(
          `
          SELECT id, holdNo, title, createdAt, updatedAt
          FROM purchase_return_holds
          WHERE licenseId = ? AND deletedAt IS NULL
          ORDER BY updatedAt DESC
          LIMIT ? OFFSET ?
        `,
        )
        .all(licenseId, pageSize, offset);

      const total = db
        .prepare(
          `
          SELECT COUNT(*) as count FROM purchase_return_holds
          WHERE licenseId = ? AND deletedAt IS NULL
        `,
        )
        .get(licenseId).count;

      return { holds: rows, total };
    },
  );

  // ---- RETURN HOLD: get one ----
  ipcMain.handle("purchase-return-hold:get", (event, id) => {
    const row = db
      .prepare(
        `
        SELECT * FROM purchase_return_holds WHERE id = ? AND deletedAt IS NULL
      `,
      )
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

  // ---- RETURN HOLD: delete ----
  ipcMain.handle("purchase-return-hold:delete", (event, id) => {
    const now = new Date().toISOString();
    db.prepare(
      `
      UPDATE purchase_return_holds SET deletedAt = ? WHERE id = ?
    `,
    ).run(now, id);
    return { success: true };
  });

  // ---- RETURN HOLD: peek next no ----
  ipcMain.handle("purchase-return-hold:peek-next-no", (event, licenseId) => {
    const seq = db
      .prepare(
        "SELECT lastHoldNo FROM purchase_return_hold_sequence WHERE licenseId = ?",
      )
      .get(licenseId);
    return { nextHoldNo: seq ? seq.lastHoldNo + 1 : 1 };
  });
}

module.exports = { registerPurchaseReturnHandlers };
