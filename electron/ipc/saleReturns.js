// electron/ipc/saleReturns.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

function getNextSaleReturnSlNo(licenseId) {
  const seq = db
    .prepare(`SELECT lastSlNo FROM sale_return_sequence WHERE licenseId=?`)
    .get(licenseId);
  const next = seq ? seq.lastSlNo + 1 : 1;
  db.prepare(
    `
    INSERT INTO sale_return_sequence(licenseId, lastSlNo)
    VALUES(?,?)
    ON CONFLICT(licenseId) DO UPDATE SET lastSlNo = excluded.lastSlNo
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

function registerSaleReturnHandlers() {
  // create: stock ↑; ledger sign -1 (reduce receivable / or cash out)
  ipcMain.handle("sale-return:create", (evt, payload) => {
    const { header, items } = payload;
    const id = uuidv4();
    const now = new Date().toISOString();
    const slNo = getNextSaleReturnSlNo(header.licenseId);
    let totalAmount = 0;

    const insHdr = db.prepare(`
      INSERT INTO sale_returns(
        id, slNo, userId, licenseId, customerId, customerName, billNo,
        department, debitAccount, natureOfEntry, returnDate, entryTime,
        totalAmount, discount, saleType, createdAt, updatedAt, isSynced
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const insItem = db.prepare(`
      INSERT INTO sale_return_items(
        id, returnId, productId, batchId, barcode, quantity, unit, rate, mrp, taxPercent,
        taxAmount, discount, discountType, salePrice, profit, totalCost, billedValue,
        effectiveUnitValue, batchNo, mfgDate, expiryDate, lineNo,
        appliedQuantity, overReturnQuantity, overReturnReason,
        createdAt, updatedAt, isSynced
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const trx = db.transaction((header, items) => {
      insHdr.run(
        id,
        slNo,
        header.userId || null,
        header.licenseId,
        header.customerId || null,
        header.customerName || null,
        header.billNo || null,
        header.department || null,
        header.debitAccount || null,
        header.natureOfEntry || null,
        header.returnDate || now,
        header.entryTime || now,
        0,
        header.discount || 0,
        header.saleType || "CREDIT",
        now,
        now,
      );

      items.forEach((it, idx) => {
        const qtyReq = Number(it.quantity || 0);
        const appliedQty = qtyReq;
        const overQty = 0;

        // Resolve batch
        let batchId = null;
        if (it.batchNo || it.barcode || it.mfgDate || it.expiryDate) {
          const batch = db
            .prepare(
              `SELECT id FROM product_batches
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
              it.productId,
              it.batchNo || null,
              it.barcode || null,
              it.mfgDate || null,
              it.expiryDate || null,
            );
          batchId = batch?.id || null;
        }

        const rate = Number(it.rate || 0);
        const taxPct =
          it.taxPercent === "NT"
            ? 0
            : parseInt(String(it.taxPercent).replace("P", "")) || 0;
        const taxAmount = rate * appliedQty * (taxPct / 100);
        const totalCost = rate * appliedQty + taxAmount;

        let salePrice = it.salePrice ?? null;
        if (it.profitPercent) {
          const unitCostWithTax = appliedQty
            ? rate + taxAmount / appliedQty
            : rate;
          salePrice =
            unitCostWithTax * (1 + (Number(it.profitPercent) || 0) / 100);
        }

        const discountAbs =
          it.discountType === "PCT"
            ? totalCost * (Math.max(0, Math.min(100, it.discount)) / 100)
            : Number(it.discount) || 0;

        const billedValue = Math.max(0, totalCost - discountAbs);
        const effUnit = appliedQty > 0 ? billedValue / appliedQty : 0;

        totalAmount += billedValue;

        insItem.run(
          uuidv4(),
          id,
          it.productId,
          batchId,
          it.barcode || it.code || null,
          qtyReq,
          it.unit,
          rate,
          it.mrp ?? null,
          it.taxPercent,
          taxAmount,
          discountAbs,
          it.discountType || "ABS",
          salePrice,
          it.profit ?? null,
          totalCost,
          billedValue,
          effUnit,
          it.batchNo || null,
          it.mfgDate || null,
          it.expiryDate || null,
          it.lineNo || idx + 1,
          appliedQty,
          overQty,
          null,
          now,
          now,
        );

        if (appliedQty > 0) {
          if (batchId) {
            bumpBatchAndProductStock({
              batchId,
              productId: it.productId,
              deltaQty: appliedQty, // positive = add stock back
            });
          } else {
            db.prepare(
              `UPDATE products SET stock = COALESCE(stock,0) + ? WHERE id=?`,
            ).run(appliedQty, it.productId);
          }
        }
      });
      db.prepare(
        `UPDATE sale_returns SET totalAmount=?, discount=? WHERE id=?`,
      ).run(totalAmount, header.discount || 0, id);

      // Customer ledger (credit sale returns reduce receivable)
      if (header.saleType !== "CASH" && header.customerId) {
        const grand = Math.max(0, totalAmount - (header.discount || 0));
        db.prepare(
          `
          INSERT INTO customer_transactions
          (id, licenseId, customerId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES(?, ?, ?, 'RETURN', ?, ?, ?, ?, -1, 'Sale Return', ?, ?, 0)
        `,
        ).run(
          uuidv4(),
          header.licenseId,
          header.customerId,
          id,
          header.billNo || null,
          now,
          grand,
          now,
          now,
        );
      }
    });

    trx(header, items);
    return { success: true, returnId: id, slNo, totalAmount };
  });

  // list
  ipcMain.handle("sale-return:list", (evt, licenseId, filters = {}) => {
    const {
      q = "",
      customerId = null,
      dateFrom = null,
      dateTo = null,
      page = 1,
      pageSize = 50,
    } = filters;

    const where = ["licenseId = @licenseId", "deletedAt IS NULL"];
    const params = { licenseId };

    if (customerId) {
      where.push("customerId = @customerId");
      params.customerId = customerId;
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
        `(COALESCE(billNo,'') LIKE @q OR COALESCE(customerName,'') LIKE @q)`,
      );
      params.q = `%${q.trim()}%`;
    }

    const base = `FROM sale_returns WHERE ${where.join(" AND ")}`;
    const total = db.prepare(`SELECT COUNT(*) AS cnt ${base}`).get(params).cnt;
    const rows = db
      .prepare(
        `SELECT * ${base} ORDER BY slNo DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

    return { returns: rows, total };
  });

  ipcMain.handle("sale-return:get", (evt, id) => {
    const r = db.prepare(`SELECT * FROM sale_returns WHERE id=?`).get(id);
    if (!r) return { success: false, error: "Not found" };
    const items = db
      .prepare(
        `SELECT * FROM sale_return_items WHERE returnId=? ORDER BY COALESCE(lineNo,0)`,
      )
      .all(id);
    return { success: true, saleReturn: r, items };
  });

  ipcMain.handle("sale-return:getFull", (evt, id) => {
    const r = db.prepare(`SELECT * FROM sale_returns WHERE id=?`).get(id);
    if (!r) return { success: false, error: "Not found" };
    const items = db
      .prepare(
        `SELECT * FROM sale_return_items WHERE returnId=? ORDER BY COALESCE(lineNo,0)`,
      )
      .all(id);
    return { success: true, saleReturn: r, items };
  });

  ipcMain.handle("sale-return:delete", (evt, id) => {
    const now = new Date().toISOString();
    const trx = db.transaction(() => {
      const items = db
        .prepare(
          `SELECT productId, batchId, appliedQuantity, quantity
           FROM sale_return_items
           WHERE returnId=? AND COALESCE(deletedAt,'')=''`,
        )
        .all(id);

      for (const it of items) {
        const qty = Number(it.appliedQuantity ?? it.quantity ?? 0);
        if (qty > 0) {
          if (it.batchId) {
            bumpBatchAndProductStock({
              batchId: it.batchId,
              productId: it.productId,
              deltaQty: -qty, // reverse the stock restore
            });
          } else {
            db.prepare(
              `UPDATE products SET stock = COALESCE(stock,0) - ? WHERE id=?`,
            ).run(qty, it.productId);
          }
        }
      }

      db.prepare(
        `UPDATE sale_returns SET deletedAt=?, updatedAt=?, isSynced=0 WHERE id=?`,
      ).run(now, now, id);
      db.prepare(
        `UPDATE sale_return_items SET deletedAt=?, updatedAt=?, isSynced=0 WHERE returnId=?`,
      ).run(now, now, id);

      db.prepare(
        `DELETE FROM customer_transactions WHERE kind='RETURN' AND refId=?`,
      ).run(id);
    });

    try {
      trx();
      return { success: true, deletedAt: now };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  // mark synced
  ipcMain.handle("sale-return:mark-synced", (evt, ids, serverSyncedAt) => {
    const ts = serverSyncedAt || new Date().toISOString();
    const trx = db.transaction((ids) => {
      const stmt = db.prepare(
        `UPDATE sale_returns SET isSynced=1, syncedAt=? WHERE id=?`,
      );
      ids.forEach((id) => stmt.run(ts, id));
    });
    trx(ids);
    return { success: true, syncedAt: ts };
  });

  // peek next slno
  ipcMain.handle("sale-return:peek-next-slno", (evt, licenseId) => {
    const seq = db
      .prepare(`SELECT lastSlNo FROM sale_return_sequence WHERE licenseId=?`)
      .get(licenseId);
    return { nextSlNo: seq ? seq.lastSlNo + 1 : 1 };
  });
}

module.exports = { registerSaleReturnHandlers };
