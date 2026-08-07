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

    if (byId) {
      if (byId.productId !== item.productId) {
        throw new Error(
          "Selected batch does not belong to the return product.",
        );
      }
      return byId;
    }
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

function getSourceSale(licenseId, saleId) {
  return db
    .prepare(
      `
      SELECT *
      FROM sales
      WHERE id=? AND licenseId=? AND COALESCE(deletedAt,'')=''
      LIMIT 1
    `,
    )
    .get(saleId, licenseId);
}

function getPreviouslyReturnedQuantity({
  saleId,
  saleItemId,
  excludeReturnId = null,
}) {
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(COALESCE(sri.appliedQuantity, sri.quantity, 0)), 0) AS qty
      FROM sale_return_items sri
      JOIN sale_returns sr ON sr.id = sri.returnId
      WHERE sr.saleId=?
        AND sri.saleItemId=?
        AND COALESCE(sr.deletedAt,'')=''
        AND COALESCE(sri.deletedAt,'')=''
        AND (? IS NULL OR sr.id <> ?)
    `,
    )
    .get(saleId, saleItemId, excludeReturnId, excludeReturnId);

  return Math.max(0, Number(row?.qty || 0));
}

function sourceDiscountPercent(item) {
  if (Number(item?.isFree || 0) === 1) return 0;
  const qty = Math.max(0, Number(item?.quantity || 0));
  const rate = Math.max(0, Number(item?.rate || 0));
  const taxPct =
    item?.taxPercent === "NT"
      ? 0
      : parseInt(String(item?.taxPercent || "").replace("P", "")) || 0;
  const gross = rate * qty * (1 + taxPct / 100);
  if (gross <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, (Number(item?.discount || 0) / gross) * 100),
  );
}

function getSaleReturnSourceData(licenseId, saleId, excludeReturnId = null) {
  const sale = getSourceSale(licenseId, saleId);
  if (!sale) {
    return { success: false, error: "Sale bill not found." };
  }

  const sourceItems = db
    .prepare(
      `
      SELECT si.*, p.name AS productName, p.code AS productCode,
             pb.stock AS batchStock
      FROM sale_items si
      LEFT JOIN products p ON p.id = si.productId
      LEFT JOIN product_batches pb ON pb.id = si.batchId
      WHERE si.saleId=?
        AND COALESCE(si.deletedAt,'')=''
      ORDER BY COALESCE(si.lineNo, 0), si.createdAt
    `,
    )
    .all(saleId);

  const items = sourceItems.map((item) => {
    const soldQuantity = Math.max(0, Number(item.quantity || 0));
    const previouslyReturnedQuantity = getPreviouslyReturnedQuantity({
      saleId,
      saleItemId: item.id,
      excludeReturnId,
    });
    const remainingReturnableQuantity = Math.max(
      0,
      soldQuantity - previouslyReturnedQuantity,
    );

    return {
      ...item,
      quantity: soldQuantity,
      sourceDiscountPercent: sourceDiscountPercent(item),
      previouslyReturnedQuantity,
      remainingReturnableQuantity,
      currentBatchStock: item.batchId
        ? Math.max(0, Number(item.batchStock || 0))
        : Math.max(
            0,
            Number(
              db
                .prepare(`SELECT stock FROM products WHERE id=?`)
                .get(item.productId)?.stock || 0,
            ),
          ),
    };
  });

  return { success: true, sale, items };
}

function resolveLinkedSaleItem({ header, item, excludeReturnId = null }) {
  if (!header.saleId) {
    throw new Error("Select the original Sale bill.");
  }
  if (!item.saleItemId) {
    throw new Error("The return item is not linked to the selected Sale.");
  }

  const sourceItem = db
    .prepare(
      `
      SELECT si.*
      FROM sale_items si
      WHERE si.id=?
        AND si.saleId=?
        AND COALESCE(si.deletedAt,'')=''
      LIMIT 1
    `,
    )
    .get(item.saleItemId, header.saleId);

  if (!sourceItem) {
    throw new Error("The selected Sale item is no longer available.");
  }
  if (sourceItem.productId !== item.productId) {
    throw new Error(
      "The return product does not match the original Sale item.",
    );
  }

  const soldQuantity = Math.max(0, Number(sourceItem.quantity || 0));
  const previouslyReturnedQuantity = getPreviouslyReturnedQuantity({
    saleId: header.saleId,
    saleItemId: sourceItem.id,
    excludeReturnId,
  });
  const remainingReturnableQuantity = Math.max(
    0,
    soldQuantity - previouslyReturnedQuantity,
  );

  return { sourceItem, remainingReturnableQuantity };
}

function normalizeSaleReturnHeader(header) {
  const sourceSale = header.saleId
    ? getSourceSale(header.licenseId, header.saleId)
    : null;

  if (header.saleId && !sourceSale) {
    throw new Error("Source Sale bill was not found.");
  }

  const saleType = sourceSale
    ? sourceSale.saleType === "CREDIT"
      ? "CREDIT"
      : "CASH"
    : header.saleType === "CREDIT"
      ? "CREDIT"
      : "CASH";

  const customerId = sourceSale
    ? sourceSale.customerId || null
    : header.customerId || null;

  if (saleType === "CREDIT" && !customerId) {
    throw new Error("Customer is required for CREDIT Sales Return.");
  }

  return {
    ...header,
    saleId: sourceSale?.id || null,
    saleType,
    customerId,
    customerName: sourceSale?.customerName ?? header.customerName ?? null,
    billNo: sourceSale?.billNo ?? header.billNo ?? null,
  };
}

function computeSaleReturnAmounts(item, appliedQty) {
  const qty = Number(appliedQty || 0);
  const isFree = Boolean(item.isFree);
  const rate = Number(item.rate || 0);

  const taxPct =
    item.taxPercent === "NT"
      ? 0
      : parseInt(String(item.taxPercent).replace("P", "")) || 0;

  const taxAmount = isFree ? 0 : rate * qty * (taxPct / 100);
  const totalCost = isFree ? 0 : rate * qty + taxAmount;

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

  const billedValue = isFree ? 0 : Math.max(0, totalCost - discountAbs);
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
  const now = nowISO();
  db.prepare(
    `UPDATE customer_transactions SET deletedAt=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE licenseId=? AND kind='RETURN' AND refId=?`,
  ).run(now, now, licenseId, refId);

  db.prepare(
    `UPDATE cash_transactions SET deletedAt=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE licenseId=? AND kind='PAYMENT' AND refId=?`,
  ).run(now, now, licenseId, refId);
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
  excludeReturnId = null,
}) {
  let totalAmount = 0;
  let savedItemCount = 0;
  const sourceMode = Boolean(header.saleId);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const qtyReq = Math.max(0, Number(item.quantity || 0));
    if (qtyReq <= 0) continue;

    let sourceItem = null;
    if (sourceMode) {
      const linked = resolveLinkedSaleItem({
        header,
        item,
        excludeReturnId,
      });
      sourceItem = linked.sourceItem;
      if (qtyReq > linked.remainingReturnableQuantity) {
        throw new Error(
          `Row ${idx + 1}: only ${linked.remainingReturnableQuantity} can still be returned from this Sale item.`,
        );
      }
    }

    const productId = sourceItem?.productId || item.productId;
    const product = db
      .prepare(
        `SELECT id FROM products WHERE id=? AND licenseId=? AND COALESCE(deletedAt,'')=''`,
      )
      .get(productId, header.licenseId);
    if (!product) {
      throw new Error(`Row ${idx + 1}: product was not found.`);
    }

    const batch = resolveSaleReturnBatch({
      licenseId: header.licenseId,
      item: {
        ...item,
        productId,
        batchId: item.batchId ?? sourceItem?.batchId ?? null,
        batchNo: item.batchNo ?? sourceItem?.batchNo ?? null,
        barcode: item.barcode ?? sourceItem?.barcode ?? null,
        mfgDate: item.mfgDate ?? sourceItem?.mfgDate ?? null,
        expiryDate: item.expiryDate ?? sourceItem?.expiryDate ?? null,
      },
    });
    const hasBatchIdentity = Boolean(
      item.batchId ||
      sourceItem?.batchId ||
      item.batchNo ||
      sourceItem?.batchNo ||
      item.barcode ||
      sourceItem?.barcode ||
      item.mfgDate ||
      sourceItem?.mfgDate ||
      item.expiryDate ||
      sourceItem?.expiryDate,
    );
    if (hasBatchIdentity && !batch) {
      throw new Error(`Row ${idx + 1}: selected batch was not found.`);
    }

    const batchId = batch?.id || null;
    const isFree = sourceMode
      ? Number(sourceItem?.isFree || 0) === 1
      : Boolean(item.isFree);

    const amounts = computeSaleReturnAmounts(
      {
        ...item,
        isFree,
        taxPercent: item.taxPercent || sourceItem?.taxPercent || "NT",
        salePrice: item.salePrice ?? sourceItem?.salePrice ?? null,
      },
      qtyReq,
    );

    totalAmount += amounts.billedValue;

    insertItemStmt.run(
      uuidv4(),
      returnId,
      sourceItem?.id || null,
      productId,
      batchId,
      item.barcode || sourceItem?.barcode || item.code || null,
      qtyReq,
      item.unit || sourceItem?.unit || "NOS",
      Number(item.rate || 0),
      item.mrp ?? sourceItem?.mrp ?? null,
      item.taxPercent || sourceItem?.taxPercent || "NT",
      amounts.taxAmount,
      amounts.discountAbs,
      item.discountType || "ABS",
      item.salePrice ?? sourceItem?.salePrice ?? amounts.salePrice ?? null,
      item.profit ?? null,
      amounts.totalCost,
      amounts.billedValue,
      amounts.effUnit,
      batch?.batchNo || item.batchNo || sourceItem?.batchNo || null,
      item.mfgDate ?? sourceItem?.mfgDate ?? null,
      item.expiryDate ?? sourceItem?.expiryDate ?? null,
      sourceItem?.lineNo ?? item.lineNo ?? idx + 1,
      qtyReq,
      0,
      null,
      item.rateTypeId ?? sourceItem?.rateTypeId ?? null,
      item.rateTypeCode ?? sourceItem?.rateTypeCode ?? null,
      item.rateTypeName ?? sourceItem?.rateTypeName ?? null,
      item.rateSource ?? sourceItem?.rateSource ?? "LEGACY",
      now,
      now,
    );

    if (batchId) {
      bumpBatchAndProductStock({
        batchId,
        productId,
        deltaQty: qtyReq,
      });
    } else {
      bumpLegacyProductStock(productId, qtyReq);
    }
    savedItemCount += 1;
  }

  if (!savedItemCount) {
    throw new Error("Enter a return quantity for at least one item.");
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
    const rawHeader = payload.header || {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    const id = uuidv4();
    const now = nowISO();
    let slNo = null;

    const trx = db.transaction(() => {
      const header = normalizeSaleReturnHeader(rawHeader);
      slNo = getNextSaleReturnSlNo(header.licenseId);

      const insHdr = db.prepare(`
        INSERT INTO sale_returns(
          id, slNo, userId, licenseId, saleId, typeId, customerId, customerName, billNo,
          department, debitAccount, natureOfEntry, returnDate, entryTime,
          totalAmount, discount, saleType, createdAt, updatedAt, isSynced
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      const insItem = db.prepare(`
        INSERT INTO sale_return_items(
          id, returnId, saleItemId, productId, batchId, barcode, quantity, unit, rate, mrp, taxPercent,
          taxAmount, discount, discountType, salePrice, profit, totalCost, billedValue,
          effectiveUnitValue, batchNo, mfgDate, expiryDate, lineNo,
          appliedQuantity, overReturnQuantity, overReturnReason,
          rateTypeId, rateTypeCode, rateTypeName, rateSource,
          createdAt, updatedAt, isSynced
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      insHdr.run(
        id,
        slNo,
        header.userId || null,
        header.licenseId,
        header.saleId || null,
        header.typeId || null,
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
        header.saleType,
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

      return grand;
    });

    try {
      const totalAmount = trx();
      return { success: true, returnId: id, slNo, totalAmount };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle("sale-return:update", (evt, payload) => {
    const { id, items } = payload;
    if (!id) return { success: false, error: "id required" };
    const now = nowISO();

    const trx = db.transaction(() => {
      const existing = db
        .prepare(
          `SELECT * FROM sale_returns WHERE id=? AND COALESCE(deletedAt,'')=''`,
        )
        .get(id);
      if (!existing) throw new Error("Sale return not found");

      const header = normalizeSaleReturnHeader({
        ...(payload.header || {}),
        licenseId: existing.licenseId,
      });

      reverseSaleReturnItemsStock(id);
      deleteSaleReturnLedgers(existing.licenseId, id);

      db.prepare(
        `UPDATE sale_return_items SET deletedAt=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE returnId=? AND COALESCE(deletedAt,'')=''`,
      ).run(now, now, id);

      db.prepare(
        `
        UPDATE sale_returns SET
          saleId=@saleId,
          customerId=@customerId,
          typeId=@typeId,
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
        saleId: header.saleId || null,
        customerId: header.customerId || null,
        typeId: header.typeId || null,
        customerName: header.customerName || null,
        billNo: header.billNo || null,
        department: header.department || null,
        debitAccount: header.debitAccount || null,
        natureOfEntry: header.natureOfEntry || null,
        returnDate: header.returnDate || now,
        entryTime: header.entryTime || now,
        discount: Number(header.discount || 0),
        saleType: header.saleType,
        updatedAt: now,
      });

      const insItem = db.prepare(`
        INSERT INTO sale_return_items(
          id, returnId, saleItemId, productId, batchId, barcode, quantity, unit, rate, mrp, taxPercent,
          taxAmount, discount, discountType, salePrice, profit, totalCost, billedValue,
          effectiveUnitValue, batchNo, mfgDate, expiryDate, lineNo,
          appliedQuantity, overReturnQuantity, overReturnReason,
          rateTypeId, rateTypeCode, rateTypeName, rateSource,
          createdAt, updatedAt, isSynced
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      const totalAmount = insertSaleReturnItems({
        returnId: id,
        header,
        items: Array.isArray(items) ? items : [],
        insertItemStmt: insItem,
        now,
        excludeReturnId: id,
      });

      db.prepare(
        `UPDATE sale_returns SET totalAmount=?, discount=?, updatedAt=? WHERE id=?`,
      ).run(totalAmount, Number(header.discount || 0), now, id);

      const grand = Math.max(0, totalAmount - Number(header.discount || 0));
      createSaleReturnLedgers({
        header,
        refId: id,
        grandAmount: grand,
        txDate: header.returnDate || now,
        now,
      });
      return grand;
    });

    try {
      const totalAmount = trx();
      return { success: true, returnId: id, totalAmount };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle("sale-return:get-source", (evt, saleId, excludeReturnId) => {
    const sale = db
      .prepare(`SELECT licenseId FROM sales WHERE id=?`)
      .get(saleId);
    if (!sale) return { success: false, error: "Sale bill not found." };
    return getSaleReturnSourceData(
      sale.licenseId,
      saleId,
      excludeReturnId || null,
    );
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
          AND COALESCE(sri.deletedAt,'')=''
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
          AND COALESCE(sri.deletedAt,'')=''
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
        `UPDATE sale_return_items SET deletedAt=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE returnId=?`,
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

  ipcMain.handle("sale-return:get-dirty", (evt, licenseId, limit = 200) => {
    const rows = db
      .prepare(
        `
      SELECT id, slNo, billNo, userId, licenseId, saleId, typeId,
             customerId, customerName, department,
             debitAccount, natureOfEntry, saleType,
             returnDate, entryTime,
             totalAmount, discount,
             createdAt, updatedAt, deletedAt,
             isSynced, syncedAt
      FROM sale_returns
      WHERE licenseId = ?
        AND (isSynced = 0 OR isSynced IS NULL)
      ORDER BY updatedAt ASC
      LIMIT ?
    `,
      )
      .all(licenseId, limit);
    return { success: true, records: rows };
  });

  ipcMain.handle(
    "sale-return:get-dirty-items",
    (evt, licenseId, limit = 500) => {
      const rows = db
        .prepare(
          `
      SELECT sri.id, sri.returnId, sri.saleItemId, sri.productId, sri.barcode,
             sri.quantity, sri.unit, sri.rate, sri.mrp,
             sri.taxPercent, sri.taxAmount,
             sri.discount, sri.discountType,
             sri.salePrice, sri.profit, sri.totalCost, sri.billedValue,
             sri.rateTypeId, sri.rateTypeCode, sri.rateTypeName,
             COALESCE(sri.rateSource, 'LEGACY') AS rateSource,
             sri.effectiveUnitValue,
             sri.batchNo, sri.batchId,
             sri.mfgDate, sri.expiryDate,
             sri.lineNo, sri.appliedQuantity,
             sri.overReturnQuantity, sri.overReturnReason,
             sri.createdAt, sri.updatedAt, sri.deletedAt,
             sri.isSynced, sri.syncedAt
      FROM sale_return_items sri
      JOIN sale_returns sr ON sr.id = sri.returnId
      WHERE sr.licenseId = ?
        AND (sri.isSynced = 0 OR sri.isSynced IS NULL)
      ORDER BY sri.updatedAt ASC
      LIMIT ?
    `,
        )
        .all(licenseId, limit);
      return { success: true, records: rows };
    },
  );

  ipcMain.handle(
    "sale-return:mark-items-synced",
    (evt, ids, serverSyncedAt) => {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true };
      const ts = serverSyncedAt || nowISO();
      db.transaction((ids) => {
        const stmt = db.prepare(
          `UPDATE sale_return_items SET isSynced = 1, syncedAt = ? WHERE id = ?`,
        );
        ids.forEach((id) => stmt.run(ts, id));
      })(ids);
      return { success: true, syncedAt: ts };
    },
  );

  ipcMain.handle("sale-return:bulk-upsert", (evt, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = nowISO();
    const upsert = db.prepare(`
      INSERT INTO sale_returns (
        id, slNo, billNo, userId, licenseId, saleId, typeId,
        customerId, customerName, department,
        debitAccount, natureOfEntry, saleType,
        returnDate, entryTime,
        totalAmount, discount,
        createdAt, updatedAt, deletedAt,
        isSynced, syncedAt
      ) VALUES (
        @id, @slNo, @billNo, @userId, @licenseId, @saleId, @typeId,
        @customerId, @customerName, @department,
        @debitAccount, @natureOfEntry, @saleType,
        @returnDate, @entryTime,
        @totalAmount, @discount,
        @createdAt, @updatedAt, @deletedAt,
        1, @syncedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        slNo          = excluded.slNo,
        billNo        = excluded.billNo,
        saleId        = excluded.saleId,
        typeId        = excluded.typeId,
        customerId    = excluded.customerId,
        customerName  = excluded.customerName,
        department    = excluded.department,
        debitAccount  = excluded.debitAccount,
        natureOfEntry = excluded.natureOfEntry,
        saleType      = excluded.saleType,
        returnDate    = excluded.returnDate,
        entryTime     = excluded.entryTime,
        totalAmount   = excluded.totalAmount,
        discount      = excluded.discount,
        updatedAt     = excluded.updatedAt,
        deletedAt     = excluded.deletedAt,
        isSynced      = 1,
        syncedAt      = excluded.syncedAt
      WHERE excluded.updatedAt > sale_returns.updatedAt
         OR sale_returns.updatedAt IS NULL
    `);

    db.transaction((records) => {
      for (const r of records) {
        upsert.run({
          id: r.id,
          slNo: r.slNo ?? null,
          billNo: r.billNo ?? null,
          userId: r.userId ?? null,
          licenseId: r.licenseId,
          saleId: r.saleId ?? null,
          typeId: r.typeId ?? null,
          customerId: r.customerId ?? null,
          customerName: r.customerName ?? null,
          department: r.department ?? null,
          debitAccount: r.debitAccount ?? null,
          natureOfEntry: r.natureOfEntry ?? null,
          saleType: r.saleType ?? "CREDIT",
          returnDate:
            r.returnDate instanceof Date
              ? r.returnDate.toISOString()
              : (r.returnDate ?? now),
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
    })(records);

    const maxRow = db
      .prepare(
        `SELECT MAX(slNo) AS maxSlNo FROM sale_returns WHERE licenseId = ? AND COALESCE(deletedAt,'') = ''`,
      )
      .get(records[0]?.licenseId);

    if (maxRow?.maxSlNo) {
      db.prepare(
        `
        INSERT INTO sale_return_sequence (licenseId, lastSlNo)
        VALUES (?, ?)
        ON CONFLICT(licenseId) DO UPDATE SET
          lastSlNo = MAX(excluded.lastSlNo, sale_return_sequence.lastSlNo)
      `,
      ).run(records[0].licenseId, maxRow.maxSlNo);
    }

    return { success: true, upserted: records.length };
  });

  ipcMain.handle("sale-return:bulk-upsert-items", (evt, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = nowISO();
    const upsert = db.prepare(`
      INSERT INTO sale_return_items (
        id, returnId, saleItemId, productId, barcode,
        quantity, unit, rate, mrp,
        taxPercent, taxAmount, discount, discountType,
        salePrice, profit, totalCost, billedValue,
        effectiveUnitValue, batchNo, batchId,
        mfgDate, expiryDate, lineNo,
        appliedQuantity, overReturnQuantity, overReturnReason,
        rateTypeId, rateTypeCode, rateTypeName, rateSource,
        createdAt, updatedAt, deletedAt, isSynced, syncedAt
      ) VALUES (
        @id, @returnId, @saleItemId, @productId, @barcode,
        @quantity, @unit, @rate, @mrp,
        @taxPercent, @taxAmount, @discount, @discountType,
        @salePrice, @profit, @totalCost, @billedValue,
        @effectiveUnitValue, @batchNo, @batchId,
        @mfgDate, @expiryDate, @lineNo,
        @appliedQuantity, @overReturnQuantity, @overReturnReason,
        @rateTypeId, @rateTypeCode, @rateTypeName, @rateSource,
        @createdAt, @updatedAt, @deletedAt, 1, @syncedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        saleItemId           = excluded.saleItemId,
        quantity             = excluded.quantity,
        unit                 = excluded.unit,
        rate                 = excluded.rate,
        mrp                  = excluded.mrp,
        taxPercent           = excluded.taxPercent,
        taxAmount            = excluded.taxAmount,
        discount             = excluded.discount,
        discountType         = excluded.discountType,
        salePrice            = excluded.salePrice,
        profit               = excluded.profit,
        totalCost            = excluded.totalCost,
        billedValue          = excluded.billedValue,
        effectiveUnitValue   = excluded.effectiveUnitValue,
        batchNo              = excluded.batchNo,
        batchId              = excluded.batchId,
        mfgDate              = excluded.mfgDate,
        expiryDate           = excluded.expiryDate,
        lineNo               = excluded.lineNo,
        appliedQuantity      = excluded.appliedQuantity,
        overReturnQuantity   = excluded.overReturnQuantity,
        overReturnReason     = excluded.overReturnReason,
        rateTypeId           = excluded.rateTypeId,
        rateTypeCode         = excluded.rateTypeCode,
        rateTypeName         = excluded.rateTypeName,
        rateSource           = excluded.rateSource,
        updatedAt            = excluded.updatedAt,
        deletedAt            = excluded.deletedAt,
        isSynced             = 1,
        syncedAt             = excluded.syncedAt
      WHERE excluded.updatedAt > sale_return_items.updatedAt
         OR sale_return_items.updatedAt IS NULL
    `);

    db.transaction((records) => {
      for (const r of records) {
        upsert.run({
          id: r.id,
          returnId: r.returnId,
          saleItemId: r.saleItemId ?? null,
          productId: r.productId,
          barcode: r.barcode ?? null,
          quantity: Number(r.quantity || 0),
          unit: r.unit,
          rate: Number(r.rate || 0),
          mrp: r.mrp != null ? Number(r.mrp) : null,
          taxPercent: r.taxPercent,
          taxAmount: Number(r.taxAmount || 0),
          discount: Number(r.discount || 0),
          discountType: r.discountType ?? "ABS",
          salePrice: r.salePrice != null ? Number(r.salePrice) : null,
          profit: r.profit != null ? Number(r.profit) : null,
          totalCost: Number(r.totalCost || 0),
          billedValue: Number(r.billedValue || 0),
          effectiveUnitValue:
            r.effectiveUnitValue != null ? Number(r.effectiveUnitValue) : null,
          batchNo: r.batchNo ?? null,
          batchId: r.batchId ?? null,
          mfgDate: r.mfgDate ?? null,
          expiryDate: r.expiryDate ?? null,
          lineNo: r.lineNo ?? null,
          appliedQuantity: Number(r.appliedQuantity || 0),
          overReturnQuantity: Number(r.overReturnQuantity || 0),
          overReturnReason: r.overReturnReason ?? null,
          rateTypeId: r.rateTypeId ?? null,
          rateTypeCode: r.rateTypeCode ?? null,
          rateTypeName: r.rateTypeName ?? null,
          rateSource: r.rateSource ?? "LEGACY",
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
    })(records);

    return { success: true, upserted: records.length };
  });

  ipcMain.handle("sale-return:peek-next-slno", (evt, licenseId) => {
    const seq = db
      .prepare(`SELECT lastSlNo FROM sale_return_sequence WHERE licenseId=?`)
      .get(licenseId);
    return { nextSlNo: seq ? seq.lastSlNo + 1 : 1 };
  });
}

module.exports = { registerSaleReturnHandlers };
