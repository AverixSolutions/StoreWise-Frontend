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

function getSourcePurchase(licenseId, purchaseId) {
  return db
    .prepare(
      `
      SELECT *
      FROM purchases
      WHERE id=? AND licenseId=? AND COALESCE(deletedAt,'')=''
      LIMIT 1
    `,
    )
    .get(purchaseId, licenseId);
}

function getPreviouslyReturnedQuantity({
  purchaseId,
  purchaseItemId,
  excludeReturnId = null,
}) {
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(COALESCE(pri.appliedQuantity, pri.quantity, 0)), 0) AS qty
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pr.id = pri.returnId
      WHERE pr.purchaseId=?
        AND pri.purchaseItemId=?
        AND COALESCE(pr.deletedAt,'')=''
        AND COALESCE(pri.deletedAt,'')=''
        AND (? IS NULL OR pr.id <> ?)
    `,
    )
    .get(purchaseId, purchaseItemId, excludeReturnId, excludeReturnId);

  return Math.max(0, Number(row?.qty || 0));
}

function getPurchaseReturnSourceData(
  licenseId,
  purchaseId,
  excludeReturnId = null,
) {
  const purchase = getSourcePurchase(licenseId, purchaseId);
  if (!purchase) {
    return { success: false, error: "Purchase bill not found." };
  }

  if (!purchase.supplierId) {
    return {
      success: false,
      error: "The selected Purchase bill does not have a supplier.",
    };
  }

  const sourceItems = db
    .prepare(
      `
      SELECT pi.*, p.name AS productName, p.code AS productCode,
             pb.stock AS batchStock
      FROM purchase_items pi
      LEFT JOIN products p ON p.id = pi.productId
      LEFT JOIN product_batches pb ON pb.id = pi.batchId
      WHERE pi.purchaseId=?
        AND COALESCE(pi.deletedAt,'')=''
      ORDER BY COALESCE(pi.lineNo, 0), pi.createdAt
    `,
    )
    .all(purchaseId);

  const items = sourceItems.map((item) => {
    const purchasedQuantity = Math.max(0, Number(item.quantity || 0));
    const previouslyReturnedQuantity = getPreviouslyReturnedQuantity({
      purchaseId,
      purchaseItemId: item.id,
      excludeReturnId,
    });
    const remainingReturnableQuantity = Math.max(
      0,
      purchasedQuantity - previouslyReturnedQuantity,
    );

    let availableStock = 0;
    if (Number(item.isFree || 0) === 1) {
      availableStock = remainingReturnableQuantity;
    } else if (item.batchId) {
      availableStock = Math.max(0, Number(item.batchStock || 0));
    } else {
      const product = db
        .prepare(`SELECT stock FROM products WHERE id=?`)
        .get(item.productId);
      availableStock = Math.max(0, Number(product?.stock || 0));
    }

    return {
      ...item,
      quantity: purchasedQuantity,
      previouslyReturnedQuantity,
      remainingReturnableQuantity,
      availableStock,
    };
  });

  return { success: true, purchase, items };
}

function resolveLinkedPurchaseItem({ header, item, excludeReturnId = null }) {
  if (!header.purchaseId) {
    throw new Error("Select the original Purchase bill.");
  }

  if (!item.purchaseItemId) {
    throw new Error("The return item is not linked to the selected Purchase.");
  }

  const sourceItem = db
    .prepare(
      `
      SELECT pi.*, pb.stock AS batchStock
      FROM purchase_items pi
      LEFT JOIN product_batches pb ON pb.id = pi.batchId
      WHERE pi.id=?
        AND pi.purchaseId=?
        AND COALESCE(pi.deletedAt,'')=''
      LIMIT 1
    `,
    )
    .get(item.purchaseItemId, header.purchaseId);

  if (!sourceItem) {
    throw new Error("The selected Purchase item is no longer available.");
  }

  if (sourceItem.productId !== item.productId) {
    throw new Error(
      "The return product does not match the original Purchase item.",
    );
  }

  const purchasedQuantity = Math.max(0, Number(sourceItem.quantity || 0));
  const previouslyReturnedQuantity = getPreviouslyReturnedQuantity({
    purchaseId: header.purchaseId,
    purchaseItemId: sourceItem.id,
    excludeReturnId,
  });
  const remainingReturnableQuantity = Math.max(
    0,
    purchasedQuantity - previouslyReturnedQuantity,
  );

  const isFree = Number(sourceItem.isFree || 0) === 1;
  let availableStock = remainingReturnableQuantity;
  if (!isFree && sourceItem.batchId) {
    availableStock = Math.max(0, Number(sourceItem.batchStock || 0));
  } else if (!isFree) {
    const product = db
      .prepare(`SELECT stock FROM products WHERE id=?`)
      .get(sourceItem.productId);
    availableStock = Math.max(0, Number(product?.stock || 0));
  }

  return {
    sourceItem,
    isFree,
    remainingReturnableQuantity,
    availableStock,
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
  let savedItemCount = 0;
  const sourceMode = Boolean(header.purchaseId);

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const qtyRequested = Number(item.quantity || 0);
    if (qtyRequested <= 0) continue;

    let sourceItem = null;
    let linked = null;

    if (sourceMode) {
      linked = resolveLinkedPurchaseItem({
        header,
        item,
        excludeReturnId: returnId,
      });
      sourceItem = linked.sourceItem;

      if (qtyRequested > linked.remainingReturnableQuantity) {
        throw new Error(
          `Row ${index + 1}: only ${linked.remainingReturnableQuantity} can still be returned from this Purchase item.`,
        );
      }
    }

    const productId = sourceItem?.productId || item.productId;
    if (!productId) {
      throw new Error(`Row ${index + 1}: product is required.`);
    }

    const product = db
      .prepare(
        `
        SELECT id, stock
        FROM products
        WHERE id=? AND licenseId=? AND COALESCE(deletedAt,'')=''
        LIMIT 1
      `,
      )
      .get(productId, header.licenseId);

    if (!product) {
      throw new Error(`Row ${index + 1}: product was not found.`);
    }

    const isFree = sourceMode
      ? Boolean(linked?.isFree)
      : Boolean(item.isFree || item.lineType === "FREE");

    let batch = null;
    if (!isFree) {
      batch = resolvePurchaseReturnBatch({
        licenseId: header.licenseId,
        item: {
          ...item,
          productId,
        },
      });

      const availableStock = batch
        ? Math.max(0, Number(batch.stock || 0))
        : Math.max(0, Number(product.stock || 0));

      if (qtyRequested > availableStock) {
        throw new Error(
          `Row ${index + 1}: only ${availableStock} is available in the selected ${batch ? "batch" : "product stock"}.`,
        );
      }
    }

    const sourceQuantity = sourceItem
      ? Math.max(1, Number(sourceItem.quantity || 0))
      : 1;
    const proportionalDiscount = sourceItem
      ? (Number(sourceItem.discount || 0) / sourceQuantity) * qtyRequested
      : Number(item.discount || 0);

    const amountInput = sourceItem
      ? {
          rate: Number(sourceItem.rate || 0),
          taxPercent: sourceItem.taxPercent || "NT",
          discountType: "ABS",
          discount: proportionalDiscount,
          salePrice:
            item.salePrice != null
              ? Number(item.salePrice)
              : sourceItem.salePrice != null
                ? Number(sourceItem.salePrice)
                : null,
          profitPercent: 0,
        }
      : {
          rate: Number(item.rate || 0),
          taxPercent: item.taxPercent || "NT",
          discountType: item.discountType || "ABS",
          discount: Number(item.discount || 0),
          salePrice: item.salePrice != null ? Number(item.salePrice) : null,
          profitPercent: Number(item.profitPercent || 0),
        };

    const amounts = computeReturnAmounts(amountInput, qtyRequested);
    totalAmount += amounts.billedValue;

    const storedBatchId = isFree ? null : batch?.id || null;
    const storedBarcode = isFree
      ? sourceItem?.barcode || item.barcode || null
      : item.barcode || sourceItem?.barcode || null;
    const storedBatchNo = isFree
      ? sourceItem?.batchNo || item.batchNo || null
      : item.batchNo || sourceItem?.batchNo || null;
    const storedMfgDate = isFree
      ? sourceItem?.mfgDate || item.mfgDate || null
      : item.mfgDate || sourceItem?.mfgDate || null;
    const storedExpiryDate = isFree
      ? sourceItem?.expiryDate || item.expiryDate || null
      : item.expiryDate || sourceItem?.expiryDate || null;

    insertItemStmt.run(
      uuidv4(),
      returnId,
      sourceItem?.id || null,
      productId,
      storedBarcode,
      qtyRequested,
      sourceItem?.unit || item.unit,
      sourceItem ? Number(sourceItem.rate || 0) : Number(item.rate || 0),
      item.mrp ?? sourceItem?.mrp ?? null,
      sourceItem?.taxPercent || item.taxPercent || "NT",
      amounts.taxAmount,
      amounts.discountAbs,
      sourceItem ? "ABS" : item.discountType || "ABS",
      item.salePrice ?? sourceItem?.salePrice ?? amounts.salePrice ?? null,
      sourceItem?.profit ?? item.profit ?? amounts.profit ?? null,
      amounts.totalCost,
      amounts.billedValue,
      amounts.effectiveUnitValue,
      storedBatchNo,
      storedMfgDate,
      storedExpiryDate,
      sourceItem?.lineNo || item.lineNo || index + 1,
      storedBatchId,
      qtyRequested,
      0,
      null,
      item.sellingRatesJson ?? sourceItem?.sellingRatesJson ?? null,
      now,
      now,
    );

    if (!isFree) {
      if (storedBatchId) {
        bumpBatchAndProductStock({
          batchId: storedBatchId,
          productId,
          deltaQty: -qtyRequested,
        });
      } else {
        bumpLegacyProductStock(productId, -qtyRequested);
      }
    }

    savedItemCount += 1;
  }

  if (!savedItemCount) {
    throw new Error("Enter a return quantity for at least one item.");
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
        id, slNo, userId, licenseId, purchaseId, supplierId, supplierName, billNo,
        typeId, department, debitAccount, natureOfEntry, returnDate, entryTime,
        totalAmount, discount, purchaseType, createdAt, updatedAt, isSynced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const insertItem = db.prepare(`
      INSERT INTO purchase_return_items (
        id, returnId, purchaseItemId, productId, barcode, quantity, unit, rate,
        mrp, taxPercent, taxAmount, discount, discountType, salePrice, profit,
        totalCost, billedValue, effectiveUnitValue, batchNo, mfgDate, expiryDate,
        lineNo, batchId, appliedQuantity, overReturnQuantity, overReturnReason,
        sellingRatesJson, createdAt, updatedAt, isSynced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const trx = db.transaction(({ header, items }) => {
      let effectiveHeader = {
        ...header,
        purchaseId: header.purchaseId || null,
        supplierId: header.supplierId || null,
        supplierName: header.supplierName || null,
        billNo: header.billNo || null,
        purchaseType: header.purchaseType === "CREDIT" ? "CREDIT" : "CASH",
      };

      if (effectiveHeader.purchaseId) {
        const sourcePurchase = getSourcePurchase(
          header.licenseId,
          effectiveHeader.purchaseId,
        );
        if (!sourcePurchase) {
          throw new Error("Source Purchase bill not found.");
        }
        if (!sourcePurchase.supplierId) {
          throw new Error("The source Purchase bill does not have a supplier.");
        }
        if (
          header.supplierId &&
          header.supplierId !== sourcePurchase.supplierId
        ) {
          throw new Error(
            "The selected Purchase bill does not belong to this supplier.",
          );
        }

        effectiveHeader = {
          ...effectiveHeader,
          purchaseId: sourcePurchase.id,
          supplierId: sourcePurchase.supplierId,
          supplierName:
            sourcePurchase.supplierName || header.supplierName || null,
          billNo:
            sourcePurchase.billNo ||
            header.billNo ||
            `Purchase #${sourcePurchase.slNo || ""}`,
          purchaseType:
            sourcePurchase.purchaseType === "CASH" ||
            header.purchaseType === "CASH"
              ? "CASH"
              : "CREDIT",
        };
      } else if (
        effectiveHeader.purchaseType === "CREDIT" &&
        !effectiveHeader.supplierId
      ) {
        throw new Error("Select a supplier for CREDIT Purchase Return.");
      }

      insertReturn.run(
        newId,
        slNo,
        effectiveHeader.userId || null,
        effectiveHeader.licenseId,
        effectiveHeader.purchaseId,
        effectiveHeader.supplierId,
        effectiveHeader.supplierName,
        effectiveHeader.billNo,
        effectiveHeader.typeId || null,
        effectiveHeader.department || null,
        effectiveHeader.debitAccount || null,
        effectiveHeader.natureOfEntry || null,
        effectiveHeader.returnDate || now,
        effectiveHeader.entryTime || now,
        0,
        Number(effectiveHeader.discount || 0),
        effectiveHeader.purchaseType,
        now,
        now,
      );

      const totalAmount = insertPurchaseReturnItems({
        returnId: newId,
        header: effectiveHeader,
        items,
        insertItemStmt: insertItem,
        now,
      });

      db.prepare(
        `UPDATE purchase_returns SET totalAmount=?, discount=?, updatedAt=? WHERE id=?`,
      ).run(totalAmount, Number(effectiveHeader.discount || 0), now, newId);

      const grandAmount = Math.max(
        0,
        totalAmount - Number(effectiveHeader.discount || 0),
      );

      createPurchaseReturnLedgers({
        header: effectiveHeader,
        refId: newId,
        grandAmount,
        txDate: effectiveHeader.returnDate || now,
        now,
      });

      return grandAmount;
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
        id, returnId, purchaseItemId, productId, barcode, quantity, unit, rate,
        mrp, taxPercent, taxAmount, discount, discountType, salePrice, profit,
        totalCost, billedValue, effectiveUnitValue, batchNo, mfgDate, expiryDate,
        lineNo, batchId, appliedQuantity, overReturnQuantity, overReturnReason,
        sellingRatesJson, createdAt, updatedAt, isSynced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const trx = db.transaction(() => {
      const existing = db
        .prepare(`SELECT * FROM purchase_returns WHERE id=?`)
        .get(id);

      if (!existing) throw new Error("Purchase return not found");

      const purchaseId = header.purchaseId || existing.purchaseId || null;
      let effectiveHeader = {
        ...header,
        licenseId: existing.licenseId,
        purchaseId,
        supplierId: header.supplierId || null,
        supplierName: header.supplierName || null,
        billNo: header.billNo || null,
        purchaseType: header.purchaseType === "CREDIT" ? "CREDIT" : "CASH",
      };

      if (purchaseId) {
        const sourcePurchase = getSourcePurchase(
          existing.licenseId,
          purchaseId,
        );
        if (!sourcePurchase) {
          throw new Error("Source Purchase bill not found.");
        }
        if (!sourcePurchase.supplierId) {
          throw new Error("The source Purchase bill does not have a supplier.");
        }
        if (
          header.supplierId &&
          header.supplierId !== sourcePurchase.supplierId
        ) {
          throw new Error(
            "The selected Purchase bill does not belong to this supplier.",
          );
        }

        effectiveHeader = {
          ...effectiveHeader,
          purchaseId: sourcePurchase.id,
          supplierId: sourcePurchase.supplierId,
          supplierName:
            sourcePurchase.supplierName || header.supplierName || null,
          billNo:
            sourcePurchase.billNo ||
            header.billNo ||
            `Purchase #${sourcePurchase.slNo || ""}`,
          purchaseType:
            sourcePurchase.purchaseType === "CASH" ||
            header.purchaseType === "CASH"
              ? "CASH"
              : "CREDIT",
        };
      } else if (
        effectiveHeader.purchaseType === "CREDIT" &&
        !effectiveHeader.supplierId
      ) {
        throw new Error("Select a supplier for CREDIT Purchase Return.");
      }

      reversePurchaseReturnItemsStock(id);
      deletePurchaseReturnLedgers(existing.licenseId, id);
      db.prepare(`DELETE FROM purchase_return_items WHERE returnId=?`).run(id);

      db.prepare(
        `
        UPDATE purchase_returns SET
          purchaseId=@purchaseId,
          supplierId=@supplierId,
          supplierName=@supplierName,
          billNo=@billNo,
          typeId=@typeId,
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
        purchaseId: effectiveHeader.purchaseId,
        supplierId: effectiveHeader.supplierId,
        supplierName: effectiveHeader.supplierName,
        billNo: effectiveHeader.billNo,
        typeId: effectiveHeader.typeId || null,
        department: effectiveHeader.department || null,
        debitAccount: effectiveHeader.debitAccount || null,
        natureOfEntry: effectiveHeader.natureOfEntry || null,
        returnDate: effectiveHeader.returnDate || now,
        entryTime: effectiveHeader.entryTime || now,
        discount: Number(effectiveHeader.discount || 0),
        purchaseType: effectiveHeader.purchaseType,
        updatedAt: now,
      });

      const totalAmount = insertPurchaseReturnItems({
        returnId: id,
        header: effectiveHeader,
        items,
        insertItemStmt: insertItem,
        now,
      });

      db.prepare(
        `UPDATE purchase_returns SET totalAmount=?, discount=?, updatedAt=? WHERE id=?`,
      ).run(totalAmount, Number(effectiveHeader.discount || 0), now, id);

      const grandAmount = Math.max(
        0,
        totalAmount - Number(effectiveHeader.discount || 0),
      );

      createPurchaseReturnLedgers({
        header: effectiveHeader,
        refId: id,
        grandAmount,
        txDate: effectiveHeader.returnDate || now,
        now,
      });

      return grandAmount;
    });

    try {
      const totalAmount = trx();
      return { success: true, returnId: id, totalAmount };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle(
    "purchase-return:get-source",
    (event, purchaseId, excludeReturnId = null) => {
      const purchase = db
        .prepare(`SELECT licenseId FROM purchases WHERE id=? LIMIT 1`)
        .get(purchaseId);
      if (!purchase?.licenseId) {
        return { success: false, error: "Purchase bill not found." };
      }
      return getPurchaseReturnSourceData(
        purchase.licenseId,
        purchaseId,
        excludeReturnId,
      );
    },
  );

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

  // ── Sync: get dirty purchase returns ────────────────────────────────────
  ipcMain.handle(
    "purchase-return:get-dirty",
    (event, licenseId, limit = 200) => {
      const rows = db
        .prepare(
          `
      SELECT id, slNo, billNo, userId, licenseId,
             purchaseId, supplierId, supplierName, typeId, department,
             debitAccount, natureOfEntry, purchaseType,
             returnDate, entryTime,
             totalAmount, discount,
             createdAt, updatedAt, deletedAt,
             isSynced, syncedAt
      FROM purchase_returns
      WHERE licenseId = ?
        AND (isSynced = 0 OR isSynced IS NULL)
      ORDER BY updatedAt ASC
      LIMIT ?
    `,
        )
        .all(licenseId, limit);
      return { success: true, records: rows };
    },
  );

  // ── Sync: get dirty purchase return items ────────────────────────────────
  ipcMain.handle(
    "purchase-return:get-dirty-items",
    (event, licenseId, limit = 500) => {
      const rows = db
        .prepare(
          `
      SELECT pri.id, pri.returnId, pri.purchaseItemId, pri.productId, pri.barcode,
             pri.quantity, pri.unit, pri.rate, pri.mrp,
             pri.taxPercent, pri.taxAmount,
             pri.discount, pri.discountType,
             pri.salePrice, pri.profit, pri.totalCost, pri.billedValue,
             pri.sellingRatesJson,
             pri.batchNo, pri.batchId,
             pri.mfgDate, pri.expiryDate,
             pri.lineNo, pri.effectiveUnitValue,
             pri.appliedQuantity, pri.overReturnQuantity, pri.overReturnReason,
             pri.createdAt, pri.updatedAt, pri.deletedAt,
             pri.isSynced
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pr.id = pri.returnId
      WHERE pr.licenseId = ?
        AND (pri.isSynced = 0 OR pri.isSynced IS NULL)
      ORDER BY pri.updatedAt ASC
      LIMIT ?
    `,
        )
        .all(licenseId, limit);
      return { success: true, records: rows };
    },
  );

  // ── Sync: mark purchase return items synced ──────────────────────────────
  ipcMain.handle(
    "purchase-return:mark-items-synced",
    (event, ids, serverSyncedAt) => {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true };
      const ts = serverSyncedAt || nowISO();
      db.transaction((ids) => {
        const stmt = db.prepare(
          `UPDATE purchase_return_items SET isSynced = 1, syncedAt = ? WHERE id = ?`,
        );
        ids.forEach((id) => stmt.run(ts, id));
      })(ids);
      return { success: true, syncedAt: ts };
    },
  );

  // ── Sync: bulk upsert purchase returns from server ───────────────────────
  ipcMain.handle("purchase-return:bulk-upsert", (event, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = nowISO();
    const upsert = db.prepare(`
      INSERT INTO purchase_returns (
        id, slNo, billNo, userId, licenseId,
        purchaseId, supplierId, supplierName, typeId, department,
        debitAccount, natureOfEntry, purchaseType,
        returnDate, entryTime,
        totalAmount, discount,
        createdAt, updatedAt, deletedAt,
        isSynced, syncedAt
      ) VALUES (
        @id, @slNo, @billNo, @userId, @licenseId,
        @purchaseId, @supplierId, @supplierName, @typeId, @department,
        @debitAccount, @natureOfEntry, @purchaseType,
        @returnDate, @entryTime,
        @totalAmount, @discount,
        @createdAt, @updatedAt, @deletedAt,
        1, @syncedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        slNo          = excluded.slNo,
        billNo        = excluded.billNo,
        purchaseId    = excluded.purchaseId,
        supplierId    = excluded.supplierId,
        supplierName  = excluded.supplierName,
        typeId        = excluded.typeId,
        department    = excluded.department,
        debitAccount  = excluded.debitAccount,
        natureOfEntry = excluded.natureOfEntry,
        purchaseType  = excluded.purchaseType,
        returnDate    = excluded.returnDate,
        entryTime     = excluded.entryTime,
        totalAmount   = excluded.totalAmount,
        discount      = excluded.discount,
        updatedAt     = excluded.updatedAt,
        deletedAt     = excluded.deletedAt,
        isSynced      = 1,
        syncedAt      = excluded.syncedAt
      WHERE excluded.updatedAt > purchase_returns.updatedAt
         OR purchase_returns.updatedAt IS NULL
    `);

    db.transaction((records) => {
      for (const r of records) {
        upsert.run({
          id: r.id,
          slNo: r.slNo ?? null,
          billNo: r.billNo ?? null,
          userId: r.userId ?? null,
          licenseId: r.licenseId,
          purchaseId: r.purchaseId ?? null,
          supplierId: r.supplierId ?? null,
          supplierName: r.supplierName ?? null,
          typeId: r.typeId ?? null,
          department: r.department ?? null,
          debitAccount: r.debitAccount ?? null,
          natureOfEntry: r.natureOfEntry ?? null,
          purchaseType: r.purchaseType ?? "CREDIT",
          returnDate: r.returnDate ?? now,
          entryTime: r.entryTime ?? null,
          totalAmount: Number(r.totalAmount || 0),
          discount: Number(r.discount || 0),
          createdAt: r.createdAt ?? now,
          updatedAt: r.updatedAt ?? now,
          deletedAt: r.deletedAt ?? null,
          syncedAt: r.syncedAt ?? now,
        });
      }
    })(records);

    const maxRow = db
      .prepare(
        `SELECT MAX(slNo) AS maxSlNo FROM purchase_returns WHERE licenseId = ? AND deletedAt IS NULL`,
      )
      .get(records[0]?.licenseId);

    if (maxRow?.maxSlNo) {
      db.prepare(
        `
        INSERT INTO purchase_return_sequence (licenseId, lastSlNo)
        VALUES (?, ?)
        ON CONFLICT(licenseId) DO UPDATE SET
          lastSlNo = MAX(excluded.lastSlNo, purchase_return_sequence.lastSlNo)
      `,
      ).run(records[0].licenseId, maxRow.maxSlNo);
    }

    return { success: true, upserted: records.length };
  });

  // ── Sync: bulk upsert purchase return items from server ──────────────────
  ipcMain.handle("purchase-return:bulk-upsert-items", (event, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = nowISO();
    const upsert = db.prepare(`
      INSERT INTO purchase_return_items (
        id, returnId, purchaseItemId, productId, barcode,
        quantity, unit, rate, mrp,
        taxPercent, taxAmount, discount, discountType,
        salePrice, profit, totalCost, billedValue,
        effectiveUnitValue, batchNo, batchId,
        mfgDate, expiryDate, lineNo,
        appliedQuantity, overReturnQuantity, overReturnReason,
        sellingRatesJson,
        createdAt, updatedAt, deletedAt, isSynced, syncedAt
      ) VALUES (
        @id, @returnId, @purchaseItemId, @productId, @barcode,
        @quantity, @unit, @rate, @mrp,
        @taxPercent, @taxAmount, @discount, @discountType,
        @salePrice, @profit, @totalCost, @billedValue,
        @effectiveUnitValue, @batchNo, @batchId,
        @mfgDate, @expiryDate, @lineNo,
        @appliedQuantity, @overReturnQuantity, @overReturnReason,
        @sellingRatesJson,
        @createdAt, @updatedAt, @deletedAt, 1, @syncedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        purchaseItemId       = excluded.purchaseItemId,
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
        sellingRatesJson     = excluded.sellingRatesJson,
        updatedAt            = excluded.updatedAt,
        deletedAt            = excluded.deletedAt,
        isSynced             = 1,
        syncedAt             = excluded.syncedAt
      WHERE excluded.updatedAt > purchase_return_items.updatedAt
         OR purchase_return_items.updatedAt IS NULL
    `);

    db.transaction((records) => {
      for (const r of records) {
        upsert.run({
          id: r.id,
          returnId: r.returnId,
          purchaseItemId: r.purchaseItemId ?? null,
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
          sellingRatesJson: r.sellingRatesJson ?? null,
          createdAt: r.createdAt ?? now,
          updatedAt: r.updatedAt ?? now,
          deletedAt: r.deletedAt ?? null,
          syncedAt: r.syncedAt ?? now,
        });
      }
    })(records);

    return { success: true, upserted: records.length };
  });

  // ── Sync: get dirty purchase return holds ────────────────────────────────
  ipcMain.handle(
    "purchase-return-hold:get-dirty",
    (event, licenseId, limit = 200) => {
      const rows = db
        .prepare(
          `
      SELECT id, licenseId, userId, holdNo, title, headerJson, rowsJson,
             createdAt, updatedAt, deletedAt, isSynced
      FROM purchase_return_holds
      WHERE licenseId = ?
        AND (isSynced = 0 OR isSynced IS NULL)
      ORDER BY updatedAt ASC
      LIMIT ?
    `,
        )
        .all(licenseId, limit);
      return { success: true, records: rows };
    },
  );

  // ── Sync: mark purchase return holds synced ──────────────────────────────
  ipcMain.handle(
    "purchase-return-hold:mark-synced",
    (event, ids, serverSyncedAt) => {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true };
      const ts = serverSyncedAt || nowISO();
      db.transaction((ids) => {
        const stmt = db.prepare(
          `UPDATE purchase_return_holds SET isSynced = 1, syncedAt = ? WHERE id = ?`,
        );
        ids.forEach((id) => stmt.run(ts, id));
      })(ids);
      return { success: true, syncedAt: ts };
    },
  );

  // ── Sync: bulk upsert purchase return holds from server ──────────────────
  ipcMain.handle("purchase-return-hold:bulk-upsert", (event, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = nowISO();
    const upsert = db.prepare(`
      INSERT INTO purchase_return_holds (
        id, licenseId, userId, holdNo, title,
        headerJson, rowsJson,
        createdAt, updatedAt, deletedAt,
        isSynced, syncedAt
      ) VALUES (
        @id, @licenseId, @userId, @holdNo, @title,
        @headerJson, @rowsJson,
        @createdAt, @updatedAt, @deletedAt,
        1, @syncedAt
      )
      ON CONFLICT(licenseId, holdNo) DO UPDATE SET
        id         = excluded.id,
        title      = excluded.title,
        headerJson = excluded.headerJson,
        rowsJson   = excluded.rowsJson,
        updatedAt  = excluded.updatedAt,
        deletedAt  = excluded.deletedAt,
        isSynced   = 1,
        syncedAt   = excluded.syncedAt
      WHERE excluded.updatedAt > purchase_return_holds.updatedAt
         OR purchase_return_holds.updatedAt IS NULL
    `);

    db.transaction((records) => {
      for (const r of records) {
        upsert.run({
          id: r.id,
          licenseId: r.licenseId,
          userId: r.userId ?? null,
          holdNo: r.holdNo,
          title: r.title ?? null,
          headerJson:
            typeof r.headerJson === "string"
              ? r.headerJson
              : JSON.stringify(r.header ?? {}),
          rowsJson:
            typeof r.rowsJson === "string"
              ? r.rowsJson
              : JSON.stringify(r.rows ?? []),
          createdAt: r.createdAt ?? now,
          updatedAt: r.updatedAt ?? now,
          deletedAt: r.deletedAt ?? null,
          syncedAt: r.syncedAt ?? now,
        });
      }
    })(records);

    const maxRow = db
      .prepare(
        `SELECT MAX(holdNo) AS maxHoldNo FROM purchase_return_holds WHERE licenseId = ?`,
      )
      .get(records[0]?.licenseId);

    if (maxRow?.maxHoldNo) {
      db.prepare(
        `
        INSERT INTO purchase_return_hold_sequence (licenseId, lastHoldNo)
        VALUES (?, ?)
        ON CONFLICT(licenseId) DO UPDATE SET
          lastHoldNo = MAX(excluded.lastHoldNo, purchase_return_hold_sequence.lastHoldNo)
      `,
      ).run(records[0].licenseId, maxRow.maxHoldNo);
    }

    return { success: true, upserted: records.length };
  });
}

module.exports = { registerPurchaseReturnHandlers };
