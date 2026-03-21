// electron/ipc/purchaseReturns.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

function nowISO() {
  return new Date().toISOString();
}

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

function resolvePurchaseReturnBatch({ licenseId, item }) {
  if (item?.batchId) {
    const byId = db
      .prepare(
        `
        SELECT id, productId, stock
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
        SELECT id, productId, stock
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

function computeReturnAmounts(item, appliedQty) {
  const qty = Number(appliedQty || 0);
  const rate = Number(item.rate || 0);

  const taxPercentValue =
    item.taxPercent === "NT"
      ? 0
      : parseInt(String(item.taxPercent).replace("P", "")) || 0;

  const taxAmount = rate * qty * (taxPercentValue / 100);
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
  const effectiveUnitValue = qty > 0 ? billedValue / qty : 0;

  return {
    taxAmount,
    totalCost,
    salePrice,
    discountAbs,
    billedValue,
    effectiveUnitValue,
  };
}

function deletePurchaseReturnLedgers(licenseId, refId) {
  db.prepare(
    `DELETE FROM supplier_transactions WHERE licenseId=? AND kind='RETURN' AND refId=?`,
  ).run(licenseId, refId);

  db.prepare(
    `DELETE FROM cash_transactions WHERE licenseId=? AND kind='RECEIPT' AND refId=?`,
  ).run(licenseId, refId);
}

function createPurchaseReturnLedgers({
  header,
  refId,
  grandAmount,
  txDate,
  now,
}) {
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
      refId,
      header.billNo || null,
      txDate,
      grandAmount,
      "Purchase Return",
      now,
      now,
    );
  }

  if (header.purchaseType === "CASH") {
    db.prepare(
      `
      INSERT INTO cash_transactions
      (id, licenseId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
      VALUES (?, ?, 'RECEIPT', ?, ?, ?, ?, 1, 'Purchase Return (Cash)', ?, ?, 0)
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

function insertPurchaseReturnItems({
  returnId,
  header,
  items,
  insertItemStmt,
  now,
}) {
  let totalAmount = 0;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const qtyRequested = Number(item.quantity || 0);

    const batch = resolvePurchaseReturnBatch({
      licenseId: header.licenseId,
      item,
    });

    let batchId = batch?.id || null;
    let availableStock = 0;

    if (batchId) {
      availableStock = Math.max(0, Number(batch?.stock || 0));
    } else {
      const p = db
        .prepare(`SELECT stock FROM products WHERE id=?`)
        .get(item.productId);
      availableStock = Math.max(0, Number(p?.stock || 0));
    }

    const appliedQty = Math.min(qtyRequested, availableStock);
    const overQty = Math.max(0, qtyRequested - appliedQty);

    const {
      taxAmount,
      totalCost,
      salePrice,
      discountAbs,
      billedValue,
      effectiveUnitValue,
    } = computeReturnAmounts(item, appliedQty);

    totalAmount += billedValue;

    insertItemStmt.run(
      uuidv4(),
      returnId,
      item.productId,
      item.barcode || item.code || null,
      qtyRequested,
      item.unit,
      Number(item.rate || 0),
      item.mrp ?? null,
      item.taxPercent,
      taxAmount,
      discountAbs,
      item.discountType || "ABS",
      salePrice,
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

    if (appliedQty > 0) {
      if (batchId) {
        bumpBatchAndProductStock({
          batchId,
          productId: item.productId,
          deltaQty: -appliedQty,
        });
      } else {
        bumpLegacyProductStock(item.productId, -appliedQty);
      }
    }
  }

  return totalAmount;
}

function reversePurchaseReturnItemsStock(returnId) {
  const rows = db
    .prepare(
      `
      SELECT productId, batchId, appliedQuantity, quantity
      FROM purchase_return_items
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
        deltaQty: qty,
      });
    } else {
      bumpLegacyProductStock(it.productId, qty);
    }
  }
}

function registerPurchaseReturnHandlers() {
  ipcMain.handle("purchase-return:create", (event, payload) => {
    const { header, items } = payload;
    const newId = uuidv4();
    const now = nowISO();
    const slNo = getNextReturnSlNo(header.licenseId);

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

      const totalAmount = insertPurchaseReturnItems({
        returnId: newId,
        header,
        items,
        insertItemStmt: insertItem,
        now,
      });

      db.prepare(
        `UPDATE purchase_returns SET totalAmount=?, discount=?, updatedAt=? WHERE id=?`,
      ).run(totalAmount, header.discount || 0, now, newId);

      const grandAmount = Math.max(
        0,
        totalAmount - Number(header.discount || 0),
      );

      createPurchaseReturnLedgers({
        header,
        refId: newId,
        grandAmount,
        txDate: header.returnDate || now,
        now,
      });

      return totalAmount;
    });

    try {
      const totalAmount = trx({ header, items });
      return { success: true, returnId: newId, slNo, totalAmount };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle("purchase-return:update", (event, payload) => {
    const { id, header, items } = payload;
    if (!id) return { success: false, error: "id required" };

    const now = nowISO();

    const insertItem = db.prepare(`
      INSERT INTO purchase_return_items (
        id, returnId, productId, barcode, quantity, unit, rate, mrp, taxPercent,
        taxAmount, discount, discountType, salePrice, profit, totalCost, billedValue,
        effectiveUnitValue, batchNo, mfgDate, expiryDate, lineNo,
        batchId, appliedQuantity, overReturnQuantity, overReturnReason,
        createdAt, updatedAt, isSynced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const trx = db.transaction(() => {
      const existing = db
        .prepare(`SELECT * FROM purchase_returns WHERE id=?`)
        .get(id);

      if (!existing) throw new Error("Purchase return not found");

      reversePurchaseReturnItemsStock(id);
      deletePurchaseReturnLedgers(existing.licenseId, id);

      db.prepare(`DELETE FROM purchase_return_items WHERE returnId=?`).run(id);

      db.prepare(
        `
        UPDATE purchase_returns SET
          supplierId=@supplierId,
          supplierName=@supplierName,
          billNo=@billNo,
          department=@department,
          debitAccount=@debitAccount,
          natureOfEntry=@natureOfEntry,
          returnDate=@returnDate,
          entryTime=@entryTime,
          discount=@discount,
          purchaseType=@purchaseType,
          updatedAt=@updatedAt,
          isSynced=0,
          syncedAt=NULL
        WHERE id=@id
      `,
      ).run({
        id,
        supplierId: header.supplierId || null,
        supplierName: header.supplierName || null,
        billNo: header.billNo || null,
        department: header.department || null,
        debitAccount: header.debitAccount || null,
        natureOfEntry: header.natureOfEntry || null,
        returnDate: header.returnDate || now,
        entryTime: header.entryTime || now,
        discount: Number(header.discount || 0),
        purchaseType: header.purchaseType || "CREDIT",
        updatedAt: now,
      });

      const totalAmount = insertPurchaseReturnItems({
        returnId: id,
        header: { ...header, licenseId: existing.licenseId },
        items,
        insertItemStmt: insertItem,
        now,
      });

      db.prepare(
        `UPDATE purchase_returns SET totalAmount=?, discount=?, updatedAt=? WHERE id=?`,
      ).run(totalAmount, Number(header.discount || 0), now, id);

      const grandAmount = Math.max(
        0,
        totalAmount - Number(header.discount || 0),
      );

      createPurchaseReturnLedgers({
        header: { ...header, licenseId: existing.licenseId },
        refId: id,
        grandAmount,
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

  ipcMain.handle("purchase-return:list", (event, licenseId, filters = {}) => {
    const {
      q = "",
      supplierId = null,
      dateFrom = null,
      dateTo = null,
      page = 1,
      pageSize = 10,
    } = filters;

    const where = ["licenseId = @licenseId", "COALESCE(deletedAt,'') = ''"];
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
        `SELECT * ${base} ORDER BY datetime(returnDate) DESC, slNo DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

    return { returns: rows, total };
  });

  ipcMain.handle("purchase-return:get", (event, id) => {
    const r = db.prepare(`SELECT * FROM purchase_returns WHERE id = ?`).get(id);
    if (!r) return { success: false, error: "Not found" };

    const items = db
      .prepare(
        `
        SELECT pri.*, p.name AS productName, p.code AS productCode
        FROM purchase_return_items pri
        LEFT JOIN products p ON p.id = pri.productId
        WHERE pri.returnId = ?
        ORDER BY COALESCE(pri.lineNo,0), pri.createdAt
      `,
      )
      .all(id);

    return { success: true, purchaseReturn: r, items };
  });

  ipcMain.handle("purchase-return:getFull", (event, id) => {
    const r = db.prepare(`SELECT * FROM purchase_returns WHERE id = ?`).get(id);
    if (!r) return { success: false, error: "Not found" };

    const items = db
      .prepare(
        `
        SELECT pri.*, p.name AS productName, p.code AS productCode
        FROM purchase_return_items pri
        LEFT JOIN products p ON p.id = pri.productId
        WHERE pri.returnId = ?
        ORDER BY COALESCE(pri.lineNo,0), pri.createdAt
      `,
      )
      .all(id);

    return { success: true, purchaseReturn: r, items };
  });

  ipcMain.handle("purchase-return:delete", (event, id) => {
    const now = nowISO();

    const trx = db.transaction(() => {
      const existing = db
        .prepare(`SELECT * FROM purchase_returns WHERE id=?`)
        .get(id);

      if (!existing) throw new Error("Purchase return not found");

      reversePurchaseReturnItemsStock(id);

      db.prepare(
        `UPDATE purchase_returns SET deletedAt=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE id=?`,
      ).run(now, now, id);

      db.prepare(
        `UPDATE purchase_return_items SET deletedAt=?, updatedAt=?, isSynced=0 WHERE returnId=?`,
      ).run(now, now, id);

      deletePurchaseReturnLedgers(existing.licenseId, id);
    });

    try {
      trx();
      return { success: true, deletedAt: now };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle(
    "purchase-return:mark-synced",
    (event, ids, serverSyncedAt) => {
      const ts = serverSyncedAt || nowISO();
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

  ipcMain.handle("purchase-return:peek-next-slno", (event, licenseId) => {
    const seq = db
      .prepare(
        "SELECT lastSlNo FROM purchase_return_sequence WHERE licenseId = ?",
      )
      .get(licenseId);
    return { nextSlNo: seq ? seq.lastSlNo + 1 : 1 };
  });

  ipcMain.handle("purchase-return-hold:save", (event, payload) => {
    const now = nowISO();

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

  ipcMain.handle("purchase-return-hold:delete", (event, id) => {
    const now = nowISO();
    db.prepare(
      `
      UPDATE purchase_return_holds SET deletedAt = ? WHERE id = ?
    `,
    ).run(now, id);
    return { success: true };
  });

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
