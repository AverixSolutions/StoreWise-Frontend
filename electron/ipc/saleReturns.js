// electron/ipc/saleReturns.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

function nowISO() {
  return new Date().toISOString();
}

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
      `
      SELECT COALESCE(SUM(stock),0) AS qty
      FROM product_batches
      WHERE productId=? AND COALESCE(deletedAt,'')=''
    `,
    )
    .get(productId);

  const now = nowISO();

  db.prepare(
    `
    UPDATE products
    SET stock=?, updatedAt=?, isSynced=0, syncedAt=NULL
    WHERE id=?
  `,
  ).run(Number(row?.qty || 0), now, productId);
}

function bumpBatchAndProductStock({ batchId, productId, deltaQty }) {
  const now = nowISO();

  db.prepare(
    `
    UPDATE product_batches
    SET stock = COALESCE(stock,0) + ?, updatedAt = ?
    WHERE id = ?
  `,
  ).run(Number(deltaQty || 0), now, batchId);

  rebuildProductStock(productId);
}

function bumpLegacyProductStock(productId, deltaQty) {
  const now = nowISO();
  db.prepare(
    `
    UPDATE products
    SET stock = COALESCE(stock,0) + ?, updatedAt=?, isSynced=0, syncedAt=NULL
    WHERE id=?
  `,
  ).run(Number(deltaQty || 0), now, productId);
}

function resolveSaleReturnBatch({ licenseId, item }) {
  if (item?.batchId) {
    const byId = db
      .prepare(
        `
        SELECT id, productId
        FROM product_batches
        WHERE id=? AND licenseId=? AND COALESCE(deletedAt,'')=''
        LIMIT 1
      `,
      )
      .get(item.batchId, licenseId);

    if (byId) return byId;
  }

  if (
    item?.productId &&
    (item.batchNo || item.barcode || item.mfgDate || item.expiryDate)
  ) {
    const byIdentity = db
      .prepare(
        `
        SELECT id, productId
        FROM product_batches
        WHERE licenseId=?
          AND productId=?
          AND COALESCE(deletedAt,'')=''
          AND COALESCE(batchNo,'') = COALESCE(?, '')
          AND COALESCE(barcode,'') = COALESCE(?, '')
          AND COALESCE(mfgDate,'') = COALESCE(?, '')
          AND COALESCE(expiryDate,'') = COALESCE(?, '')
        LIMIT 1
      `,
      )
      .get(
        licenseId,
        item.productId,
        item.batchNo || null,
        item.barcode || null,
        item.mfgDate || null,
        item.expiryDate || null,
      );

    if (byIdentity) return byIdentity;
  }

  return null;
}

function computeSaleReturnAmounts(item, appliedQty) {
  const qty = Number(appliedQty || 0);
  const rate = Number(item.rate || 0);

  const taxPct =
    item.taxPercent === "NT"
      ? 0
      : parseInt(String(item.taxPercent).replace("P", "")) || 0;

  const taxAmount = rate * qty * (taxPct / 100);
  const totalCost = rate * qty + taxAmount;

  let salePrice = item.salePrice ?? null;
  if (item.profitPercent) {
    const unitCostWithTax = qty ? rate + taxAmount / qty : rate;
    salePrice = unitCostWithTax * (1 + (Number(item.profitPercent) || 0) / 100);
  }

  const discountAbs =
    item.discountType === "PCT"
      ? totalCost *
        (Math.max(0, Math.min(100, Number(item.discount || 0))) / 100)
      : Number(item.discount || 0);

  const billedValue = Math.max(0, totalCost - discountAbs);
  const effUnit = qty > 0 ? billedValue / qty : 0;

  return {
    taxAmount,
    totalCost,
    salePrice,
    discountAbs,
    billedValue,
    effUnit,
  };
}

function deleteSaleReturnLedgers(licenseId, refId) {
  db.prepare(
    `DELETE FROM customer_transactions WHERE licenseId=? AND kind='RETURN' AND refId=?`,
  ).run(licenseId, refId);

  db.prepare(
    `DELETE FROM cash_transactions WHERE licenseId=? AND kind='PAYMENT' AND refId=?`,
  ).run(licenseId, refId);
}

function createSaleReturnLedgers({ header, refId, grandAmount, txDate, now }) {
  if (header.saleType !== "CASH" && header.customerId) {
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
      refId,
      header.billNo || null,
      txDate,
      grandAmount,
      now,
      now,
    );
  }

  if (header.saleType === "CASH") {
    db.prepare(
      `
      INSERT INTO cash_transactions
      (id, licenseId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
      VALUES (?, ?, 'PAYMENT', ?, ?, ?, ?, -1, 'Sale Return (Cash Refund)', ?, ?, 0)
    `,
    ).run(
      uuidv4(),
      header.licenseId,
      refId,
      header.billNo || null,
      txDate,
      grandAmount,
      now,
      now,
    );
  }
}

function insertSaleReturnItems({
  returnId,
  header,
  items,
  insertItemStmt,
  now,
}) {
  let totalAmount = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const qtyReq = Number(it.quantity || 0);
    const appliedQty = qtyReq;
    const overQty = 0;

    const batch = resolveSaleReturnBatch({
      licenseId: header.licenseId,
      item: it,
    });

    const batchId = batch?.id || null;

    const {
      taxAmount,
      totalCost,
      salePrice,
      discountAbs,
      billedValue,
      effUnit,
    } = computeSaleReturnAmounts(it, appliedQty);

    totalAmount += billedValue;

    insertItemStmt.run(
      uuidv4(),
      returnId,
      it.productId,
      batchId,
      it.barcode || it.code || null,
      qtyReq,
      it.unit,
      Number(it.rate || 0),
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
          deltaQty: appliedQty,
        });
      } else {
        bumpLegacyProductStock(it.productId, appliedQty);
      }
    }
  }

  return totalAmount;
}

function reverseSaleReturnItemsStock(returnId) {
  const rows = db
    .prepare(
      `
      SELECT productId, batchId, appliedQuantity, quantity
      FROM sale_return_items
      WHERE returnId=? AND COALESCE(deletedAt,'')=''
    `,
    )
    .all(returnId);

  for (const it of rows) {
    const qty = Number(it.appliedQuantity ?? it.quantity ?? 0);
    if (qty <= 0) continue;

    if (it.batchId) {
      bumpBatchAndProductStock({
        batchId: it.batchId,
        productId: it.productId,
        deltaQty: -qty,
      });
    } else {
      bumpLegacyProductStock(it.productId, -qty);
    }
  }
}

function registerSaleReturnHandlers() {
  ipcMain.handle("sale-return:create", (evt, payload) => {
    const { header, items } = payload;
    const id = uuidv4();
    const now = nowISO();
    const slNo = getNextSaleReturnSlNo(header.licenseId);

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

      const totalAmount = insertSaleReturnItems({
        returnId: id,
        header,
        items,
        insertItemStmt: insItem,
        now,
      });

      db.prepare(
        `UPDATE sale_returns SET totalAmount=?, discount=?, updatedAt=? WHERE id=?`,
      ).run(totalAmount, header.discount || 0, now, id);

      const grand = Math.max(0, totalAmount - Number(header.discount || 0));

      createSaleReturnLedgers({
        header,
        refId: id,
        grandAmount: grand,
        txDate: header.returnDate || now,
        now,
      });

      return totalAmount;
    });

    try {
      const totalAmount = trx(header, items);
      return { success: true, returnId: id, slNo, totalAmount };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle("sale-return:update", (evt, payload) => {
    const { id, header, items } = payload;
    if (!id) return { success: false, error: "id required" };

    const now = nowISO();

    const insItem = db.prepare(`
      INSERT INTO sale_return_items(
        id, returnId, productId, batchId, barcode, quantity, unit, rate, mrp, taxPercent,
        taxAmount, discount, discountType, salePrice, profit, totalCost, billedValue,
        effectiveUnitValue, batchNo, mfgDate, expiryDate, lineNo,
        appliedQuantity, overReturnQuantity, overReturnReason,
        createdAt, updatedAt, isSynced
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const trx = db.transaction(() => {
      const existing = db
        .prepare(`SELECT * FROM sale_returns WHERE id=?`)
        .get(id);

      if (!existing) throw new Error("Sale return not found");

      reverseSaleReturnItemsStock(id);
      deleteSaleReturnLedgers(existing.licenseId, id);

      db.prepare(`DELETE FROM sale_return_items WHERE returnId=?`).run(id);

      db.prepare(
        `
        UPDATE sale_returns SET
          customerId=@customerId,
          customerName=@customerName,
          billNo=@billNo,
          department=@department,
          debitAccount=@debitAccount,
          natureOfEntry=@natureOfEntry,
          returnDate=@returnDate,
          entryTime=@entryTime,
          discount=@discount,
          saleType=@saleType,
          updatedAt=@updatedAt,
          isSynced=0,
          syncedAt=NULL
        WHERE id=@id
      `,
      ).run({
        id,
        customerId: header.customerId || null,
        customerName: header.customerName || null,
        billNo: header.billNo || null,
        department: header.department || null,
        debitAccount: header.debitAccount || null,
        natureOfEntry: header.natureOfEntry || null,
        returnDate: header.returnDate || now,
        entryTime: header.entryTime || now,
        discount: Number(header.discount || 0),
        saleType: header.saleType || "CASH",
        updatedAt: now,
      });

      const totalAmount = insertSaleReturnItems({
        returnId: id,
        header: { ...header, licenseId: existing.licenseId },
        items,
        insertItemStmt: insItem,
        now,
      });

      db.prepare(
        `UPDATE sale_returns SET totalAmount=?, discount=?, updatedAt=? WHERE id=?`,
      ).run(totalAmount, Number(header.discount || 0), now, id);

      const grand = Math.max(0, totalAmount - Number(header.discount || 0));

      createSaleReturnLedgers({
        header: { ...header, licenseId: existing.licenseId },
        refId: id,
        grandAmount: grand,
        txDate: header.returnDate || now,
        now,
      });

      return totalAmount;
    });

    try {
      const totalAmount = trx();
      return { success: true, returnId: id, totalAmount };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle("sale-return:list", (evt, licenseId, filters = {}) => {
    const {
      q = "",
      customerId = null,
      dateFrom = null,
      dateTo = null,
      page = 1,
      pageSize = 50,
    } = filters;

    const where = ["licenseId = @licenseId", "COALESCE(deletedAt,'') = ''"];
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
        `SELECT * ${base} ORDER BY datetime(returnDate) DESC, slNo DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

    return { returns: rows, total };
  });

  ipcMain.handle("sale-return:get", (evt, id) => {
    const r = db.prepare(`SELECT * FROM sale_returns WHERE id=?`).get(id);
    if (!r) return { success: false, error: "Not found" };

    const items = db
      .prepare(
        `
        SELECT sri.*, p.name AS productName, p.code AS productCode
        FROM sale_return_items sri
        LEFT JOIN products p ON p.id = sri.productId
        WHERE sri.returnId=?
        ORDER BY COALESCE(sri.lineNo,0), sri.createdAt
      `,
      )
      .all(id);

    return { success: true, saleReturn: r, items };
  });

  ipcMain.handle("sale-return:getFull", (evt, id) => {
    const r = db.prepare(`SELECT * FROM sale_returns WHERE id=?`).get(id);
    if (!r) return { success: false, error: "Not found" };

    const items = db
      .prepare(
        `
        SELECT sri.*, p.name AS productName, p.code AS productCode
        FROM sale_return_items sri
        LEFT JOIN products p ON p.id = sri.productId
        WHERE sri.returnId=?
        ORDER BY COALESCE(sri.lineNo,0), sri.createdAt
      `,
      )
      .all(id);

    return { success: true, saleReturn: r, items };
  });

  ipcMain.handle("sale-return:delete", (evt, id) => {
    const now = nowISO();

    const trx = db.transaction(() => {
      const existing = db
        .prepare(`SELECT * FROM sale_returns WHERE id=?`)
        .get(id);

      if (!existing) throw new Error("Sale return not found");

      reverseSaleReturnItemsStock(id);

      db.prepare(
        `UPDATE sale_returns SET deletedAt=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE id=?`,
      ).run(now, now, id);

      db.prepare(
        `UPDATE sale_return_items SET deletedAt=?, updatedAt=?, isSynced=0 WHERE returnId=?`,
      ).run(now, now, id);

      deleteSaleReturnLedgers(existing.licenseId, id);
    });

    try {
      trx();
      return { success: true, deletedAt: now };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle("sale-return:mark-synced", (evt, ids, serverSyncedAt) => {
    const ts = serverSyncedAt || nowISO();
    const trx = db.transaction((ids) => {
      const stmt = db.prepare(
        `UPDATE sale_returns SET isSynced=1, syncedAt=? WHERE id=?`,
      );
      ids.forEach((id) => stmt.run(ts, id));
    });
    trx(ids);
    return { success: true, syncedAt: ts };
  });

  ipcMain.handle("sale-return:peek-next-slno", (evt, licenseId) => {
    const seq = db
      .prepare(`SELECT lastSlNo FROM sale_return_sequence WHERE licenseId=?`)
      .get(licenseId);
    return { nextSlNo: seq ? seq.lastSlNo + 1 : 1 };
  });
}

module.exports = { registerSaleReturnHandlers };
