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
  `
  ).run(licenseId, next);
  return next;
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
        id, returnId, productId, barcode, quantity, unit, rate, mrp, taxPercent,
        taxAmount, discount, discountType, salePrice, profit, totalCost, billedValue,
        effectiveUnitValue, batchNo, mfgDate, expiryDate, lineNo,
        appliedQuantity, overReturnQuantity, overReturnReason,
        createdAt, updatedAt, isSynced
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
        now
      );

      items.forEach((it, idx) => {
        const qtyReq = Number(it.quantity || 0);
        // Optional cap logic (if you link to original sale/stock). Here we accept all, set applied=qtyReq.
        const appliedQty = qtyReq;
        const overQty = Math.max(0, qtyReq - appliedQty);

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
          overQty > 0 ? it.overReturnReason || "Over return" : null,
          now,
          now
        );

        if (appliedQty > 0) {
          db.prepare(
            `UPDATE products SET stock = COALESCE(stock,0) + ? WHERE id=?`
          ).run(appliedQty, it.productId);
        }
      });

      db.prepare(
        `UPDATE sale_returns SET totalAmount=?, discount=? WHERE id=?`
      ).run(totalAmount, header.discount || 0, id);

      // Customer ledger (credit sale returns reduce receivable)
      if (header.saleType !== "CASH" && header.customerId) {
        const grand = Math.max(0, totalAmount - (header.discount || 0));
        db.prepare(
          `
          INSERT INTO customer_transactions
          (id, licenseId, customerId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES(?, ?, ?, 'RETURN', ?, ?, ?, ?, -1, 'Sale Return', ?, ?, 0)
        `
        ).run(
          uuidv4(),
          header.licenseId,
          header.customerId,
          id,
          header.billNo || null,
          now,
          grand,
          now,
          now
        );
      }
    });

    trx(header, items);
    return { success: true, returnId: id, slNo, totalAmount };
  });

  // list
  ipcMain.handle(
    "sale-return:list",
    (evt, licenseId, { page = 1, pageSize = 50 } = {}) => {
      const offset = (page - 1) * pageSize;
      const rows = db
        .prepare(
          `
      SELECT * FROM sale_returns
      WHERE licenseId=? AND deletedAt IS NULL
      ORDER BY slNo DESC
      LIMIT ? OFFSET ?
    `
        )
        .all(licenseId, pageSize, offset);
      const total = db
        .prepare(
          `
      SELECT COUNT(*) as count FROM sale_returns
      WHERE licenseId=? AND deletedAt IS NULL
    `
        )
        .get(licenseId).count;
      return { returns: rows, total };
    }
  );

  // mark synced
  ipcMain.handle("sale-return:mark-synced", (evt, ids, serverSyncedAt) => {
    const ts = serverSyncedAt || new Date().toISOString();
    const trx = db.transaction((ids) => {
      const stmt = db.prepare(
        `UPDATE sale_returns SET isSynced=1, syncedAt=? WHERE id=?`
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
