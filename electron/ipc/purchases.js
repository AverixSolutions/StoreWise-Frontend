// electron/ipc/purchases.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");
const { reserveOneBarcode } = require("./barcodes");

// ========= BATCH HELPER FUNCTIONS =========
// These should ideally be imported from products.js or a shared batches.js module
// For now, including them here for completeness

function buildBatchIdentityWhere(alias, payload) {
  const p = alias ? `${alias}.` : "";

  const where = [
    `${p}licenseId = @licenseId`,
    `${p}productId = @productId`,
    `COALESCE(${p}deletedAt,'') = ''`,
  ];
  const params = {
    licenseId: payload.licenseId,
    productId: payload.productId,
  };

  const fields = [
    "barcode",
    "mrp",
    "salePrice",
    "batchNo",
    "mfgDate",
    "expiryDate",
  ];
  for (const f of fields) {
    const val = payload[f] ?? null;
    if (val === null) {
      where.push(`${p}${f} IS NULL`);
    } else {
      where.push(`${p}${f} = @${f}`);
      params[f] = val;
    }
  }
  return { where, params };
}

function findOrCreateBatch(payload) {
  const now = new Date().toISOString();
  const overrideExisting = !!payload.overrideExisting;
  const forceNewBatch = !!payload.forceNewBatch;

  if (payload.barcode) {
    const existing = db
      .prepare(
        `
        SELECT *
        FROM product_batches
        WHERE licenseId = ? AND barcode = ?
          AND COALESCE(deletedAt,'') = ''
        LIMIT 1
      `,
      )
      .get(payload.licenseId, payload.barcode);

    if (existing) {
      if (existing.productId !== payload.productId) {
        const err = new Error(
          `BARCODE_IN_USE: Barcode ${payload.barcode} already used for another product`,
        );
        err.code = "BARCODE_IN_USE";
        err.existingProductId = existing.productId;
        throw err;
      }

      if (!forceNewBatch) {
        if (overrideExisting) {
          db.prepare(
            `
            UPDATE product_batches
            SET
              mrp       = COALESCE(@mrp, mrp),
              salePrice = COALESCE(@salePrice, salePrice),
              costPrice = COALESCE(@costPrice, costPrice),
              batchNo   = COALESCE(@batchNo, batchNo),
              mfgDate   = COALESCE(@mfgDate, mfgDate),
              expiryDate= COALESCE(@expiryDate, expiryDate),
              updatedAt = @now
            WHERE id = @id
          `,
          ).run({
            id: existing.id,
            mrp: payload.mrp ?? null,
            salePrice: payload.salePrice ?? null,
            costPrice: payload.costPrice ?? null,
            batchNo: payload.batchNo ?? null,
            mfgDate: payload.mfgDate ?? null,
            expiryDate: payload.expiryDate ?? null,
            now,
          });

          const updated = db
            .prepare(`SELECT * FROM product_batches WHERE id = ?`)
            .get(existing.id);
          return { batch: updated };
        }

        // Simple reuse
        return { batch: existing };
      }
    }
  }

  if (!forceNewBatch) {
    const { where, params } = buildBatchIdentityWhere("", payload);

    let batch = db
      .prepare(
        `SELECT * FROM product_batches WHERE ${where.join(" AND ")} LIMIT 1`,
      )
      .get(params);

    if (batch) return { batch };
  }

  const batchId = uuidv4();

  db.prepare(
    `
    INSERT INTO product_batches (
      id, licenseId, productId, barcode, mrp, salePrice, costPrice,
      batchNo, mfgDate, expiryDate, receivedAt, stock, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    batchId,
    payload.licenseId,
    payload.productId,
    payload.barcode ?? null,
    payload.mrp ?? null,
    payload.salePrice ?? null,
    payload.costPrice ?? null,
    payload.batchNo ?? null,
    payload.mfgDate ?? null,
    payload.expiryDate ?? null,
    payload.receivedAt || now,
    payload.stock || 0,
    now,
    now,
  );

  const batch = db
    .prepare(`SELECT * FROM product_batches WHERE id = ?`)
    .get(batchId);
  return { batch };
}

function bumpBatchAndProductStock({ batchId, productId, deltaQty }) {
  const delta = Number(deltaQty || 0);
  const now = new Date().toISOString();

  db.prepare(
    `
    UPDATE product_batches
    SET stock = COALESCE(stock, 0) + ?,
        updatedAt = ?
    WHERE id = ?
  `,
  ).run(delta, now, batchId);

  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(stock),0) AS qty
      FROM product_batches
      WHERE productId = ? AND COALESCE(deletedAt,'') = ''
    `,
    )
    .get(productId);

  db.prepare(
    `
    UPDATE products
    SET stock = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
    WHERE id = ?
  `,
  ).run(Number(row?.qty || 0), now, productId);
}

// ========= HELPER FUNCTIONS =========

function sum(arr) {
  return arr.reduce((s, n) => s + (Number(n) || 0), 0);
}

function getItemsForPurchase(purchaseId) {
  return db
    .prepare(
      `
    SELECT productId, quantity, isFree, batchId
    FROM purchase_items
    WHERE purchaseId = ? AND COALESCE(deletedAt,'') = ''
  `,
    )
    .all(purchaseId);
}

function getNextPurchaseSlNo(licenseId) {
  const seq = db
    .prepare("SELECT lastSlNo FROM purchase_sequence WHERE licenseId = ?")
    .get(licenseId);
  const next = seq ? seq.lastSlNo + 1 : 1;
  db.prepare(
    `
    INSERT INTO purchase_sequence (licenseId, lastSlNo)
    VALUES (?, ?)
    ON CONFLICT(licenseId) DO UPDATE SET lastSlNo = excluded.lastSlNo
  `,
  ).run(licenseId, next);
  return next;
}

function getNextHoldNo(licenseId) {
  const seq = db
    .prepare(
      "SELECT lastHoldNo FROM purchase_hold_sequence WHERE licenseId = ?",
    )
    .get(licenseId);
  const next = seq ? seq.lastHoldNo + 1 : 1;
  db.prepare(
    `
    INSERT INTO purchase_hold_sequence (licenseId, lastHoldNo)
    VALUES (?, ?)
    ON CONFLICT(licenseId) DO UPDATE SET lastHoldNo = excluded.lastHoldNo
  `,
  ).run(licenseId, next);
  return next;
}

// ========= PURCHASE CRUD HANDLERS =========

function registerPurchaseHandlers() {
  // ========= BATCH RESOLVER =========
  ipcMain.handle("product.batch:resolve", (e, payload) => {
    // payload: { licenseId, productId, barcode?, mrp?, salePrice?, batchNo?, mfgDate?, expiryDate? }
    const { where, params } = buildBatchIdentityWhere("b", payload);
    const exact = db
      .prepare(
        `SELECT * FROM product_batches b WHERE ${where.join(" AND ")} LIMIT 1`,
      )
      .get(params);

    // If exact match exists => reuse
    if (exact) {
      return { success: true, decision: "REUSE", batch: exact };
    }

    // If barcode present, check if some batch exists with same barcode but different price fields
    if (payload.barcode) {
      const sameBarcode = db
        .prepare(
          `SELECT * FROM product_batches
         WHERE licenseId=@licenseId AND productId=@productId
           AND COALESCE(deletedAt,'')='' AND barcode=@barcode
         ORDER BY datetime(receivedAt) DESC LIMIT 1`,
        )
        .get({
          licenseId: payload.licenseId,
          productId: payload.productId,
          barcode: payload.barcode,
        });

      if (sameBarcode) {
        const diffs = {};
        for (const k of [
          "mrp",
          "salePrice",
          "batchNo",
          "mfgDate",
          "expiryDate",
        ]) {
          if ((payload[k] ?? null) !== (sameBarcode[k] ?? null)) {
            diffs[k] = {
              current: sameBarcode[k] ?? null,
              proposed: payload[k] ?? null,
            };
          }
        }
        return {
          success: true,
          decision: "CONFLICT_BARCODE",
          batch: sameBarcode,
          diffs,
        };
      }
    }

    return { success: true, decision: "NEW" };
  });

  // ========= LIST PURCHASES (with filters) =========
  ipcMain.handle("purchase:list", (event, licenseId, filters = {}) => {
    const {
      q = "",
      supplierId = null,
      dateFrom = null,
      dateTo = null,
      page = 1,
      pageSize = 50,
      includeDeleted = false,
    } = filters;

    const where = ["licenseId = @licenseId"];
    const params = { licenseId };

    if (!includeDeleted) where.push("(deletedAt IS NULL)");
    if (supplierId) {
      where.push("supplierId = @supplierId");
      params.supplierId = supplierId;
    }
    if (dateFrom) {
      where.push("purchaseDate >= @dateFrom");
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      where.push("purchaseDate < @dateTo");
      params.dateTo = dateTo;
    }
    if (q && q.trim()) {
      where.push(
        "(COALESCE(billNo,'') LIKE @q OR COALESCE(supplierName,'') LIKE @q)",
      );
      params.q = `%${q.trim()}%`;
    }

    const base = `
    FROM purchases
    WHERE ${where.join(" AND ")}
  `;

    const total = db.prepare(`SELECT COUNT(*) AS cnt ${base}`).get(params).cnt;

    const rows = db
      .prepare(
        `
    SELECT id, slNo, billNo, supplierId, supplierName, purchaseDate, entryTime,
           totalAmount, discount, purchaseType, isSynced, deletedAt, syncedAt
    ${base}
    ORDER BY datetime(purchaseDate) DESC, slNo DESC
    LIMIT @limit OFFSET @offset
  `,
      )
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

    return { success: true, total, page, pageSize, rows };
  });

  // ========= GET PURCHASE =========
  ipcMain.handle("purchase:get", (event, id) => {
    const p = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(id);
    if (!p) return { success: false, error: "Not found" };
    const items = db
      .prepare(
        `
        SELECT pi.*, p.name as productName, p.code as productCode
        FROM purchase_items pi
        LEFT JOIN products p ON p.id = pi.productId
        WHERE pi.purchaseId = ?
        ORDER BY COALESCE(pi.lineNo, 0), pi.createdAt
  `,
      )
      .all(id);
    return { success: true, purchase: p, items };
  });

  // ========= GET PURCHASE FULL  =========
  ipcMain.handle("purchase:getFull", (event, id) => {
    const p = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(id);
    if (!p) return { success: false, error: "Not found" };
    const items = db
      .prepare(
        `
      SELECT pi.*, p.name as productName, p.code as productCode
      FROM purchase_items pi
      LEFT JOIN products p ON p.id = pi.productId
      WHERE pi.purchaseId = ?
      ORDER BY COALESCE(pi.lineNo, 0), pi.createdAt
    `,
      )
      .all(id);
    return { success: true, purchase: p, items };
  });

  // ========= CREATE PURCHASE (WITH BATCH SYSTEM) =========
  ipcMain.handle("create-purchase", (event, purchase, items) => {
    if (purchase?.purchaseType === "CREDIT" && !purchase?.supplierId) {
      throw new Error("Supplier is required for CREDIT purchases.");
    }

    const newId = purchase.id || uuidv4();
    const now = new Date().toISOString();
    const slNo = getNextPurchaseSlNo(purchase.licenseId);
    const batchNameBase = `${slNo}-${purchase.billNo || "NO-BILL"}`;

    let totalAmount = 0;

    const insertPurchase = db.prepare(`
    INSERT INTO purchases (
      id, slNo, userId, licenseId, billNo, supplierId, supplierName, department,
      debitAccount, natureOfEntry, purchaseDate, entryTime,
      totalAmount, discount, createdAt, isSynced, purchaseType
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

    const insertItem = db.prepare(`
    INSERT INTO purchase_items (
      id, purchaseId, productId, barcode, quantity, unit, rate, mrp,
      taxPercent, taxAmount, discount, salePrice, profit, totalCost, billedValue, effectiveUnitValue,
      batchNo, mfgDate, expiryDate, discountType, lineNo, isFree, batchId,
      createdAt, updatedAt, isSynced
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

    const trx = db.transaction((purchase, items) => {
      insertPurchase.run(
        newId,
        slNo,
        purchase.userId,
        purchase.licenseId,
        purchase.billNo || null,
        purchase.supplierId || null,
        purchase.supplierName || null,
        purchase.department || null,
        purchase.debitAccount || null,
        purchase.natureOfEntry || null,
        purchase.purchaseDate || now,
        purchase.entryTime || now,
        0,
        purchase.discount || 0,
        now,
        purchase.purchaseType || "CREDIT",
      );

      items.forEach((item, index) => {
        const taxPercentValue =
          parseInt(String(item.taxPercent).replace("P", "")) || 0;
        const taxAmount = item.isFree
          ? 0
          : item.rate * item.quantity * (taxPercentValue / 100);
        const totalCost = item.isFree
          ? 0
          : item.rate * item.quantity + taxAmount;

        let salePrice = item.salePrice;
        if (item.profitPercent) {
          salePrice =
            (item.rate + taxAmount / Math.max(1, item.quantity)) *
            (1 + item.profitPercent / 100);
        }

        const discountAbs =
          item.discountType === "PCT"
            ? totalCost * (Math.max(0, Math.min(100, item.discount)) / 100)
            : item.discount || 0;

        const profit = salePrice
          ? salePrice - (item.rate + taxAmount / Math.max(1, item.quantity))
          : null;

        const billedValue = item.isFree
          ? 0
          : Math.max(0, totalCost - discountAbs);

        const effectiveUnitValue = item.isFree
          ? 0
          : billedValue / Math.max(1, item.quantity);

        totalAmount += billedValue;

        // BARCODE / BATCH RESOLUTION
        let batchBarcode = item.barcode?.trim() || null;
        if (!batchBarcode) {
          batchBarcode = reserveOneBarcode(purchase.licenseId);
        }

        const batchNoForInsert =
          item.forceNewBatch === true || !item.batchNo
            ? batchNameBase
            : item.batchNo;

        const { batch } = findOrCreateBatch({
          licenseId: purchase.licenseId,
          productId: item.productId,
          barcode: batchBarcode,
          mrp: item.mrp ?? null,
          salePrice: salePrice ?? item.salePrice ?? null,
          costPrice: item.rate ?? null,
          batchNo: batchNoForInsert,
          mfgDate: item.mfgDate ?? null,
          expiryDate: item.expiryDate ?? null,
          receivedAt: purchase.purchaseDate || now,
          stock: 0,
          overrideExisting: item.overrideBatchPrices === true,
          forceNewBatch: item.forceNewBatch === true,
        });

        if (!item.isFree) {
          bumpBatchAndProductStock({
            batchId: batch.id,
            productId: item.productId,
            deltaQty: item.quantity,
          });
        }

        insertItem.run(
          uuidv4(),
          newId,
          item.productId,
          batchBarcode,
          item.quantity,
          item.unit,
          item.rate,
          item.mrp || null,
          item.taxPercent,
          taxAmount,
          discountAbs,
          salePrice || null,
          profit,
          totalCost,
          billedValue,
          effectiveUnitValue,
          batchNoForInsert,
          item.mfgDate || null,
          item.expiryDate || null,
          item.discountType || "ABS",
          item.lineNo || index + 1,
          item.isFree ? 1 : 0,
          batch.id,
          now,
          now,
        );
      });

      db.prepare(
        `UPDATE purchases
         SET totalAmount = ?, discount = ?
         WHERE id = ?`,
      ).run(totalAmount, purchase.discount || 0, newId);

      const grandAmount = Math.max(0, totalAmount - (purchase.discount || 0));

      if (purchase.purchaseType === "CREDIT" && purchase.supplierId) {
        db.prepare(
          `
        INSERT INTO supplier_transactions
        (id, licenseId, supplierId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 0)
        `,
        ).run(
          uuidv4(),
          purchase.licenseId,
          purchase.supplierId,
          "PURCHASE",
          newId,
          purchase.billNo || null,
          purchase.purchaseDate || now,
          grandAmount,
          1,
          "Purchase",
          now,
          now,
        );
      }

      if (purchase.purchaseType === "CASH") {
        db.prepare(
          `
          INSERT INTO cash_transactions
          (id, licenseId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES (?,?,?,?,?,?,?,?,?,?,?, 0)
          `,
        ).run(
          uuidv4(),
          purchase.licenseId,
          "PURCHASE",
          newId,
          purchase.billNo || null,
          purchase.purchaseDate || now,
          grandAmount,
          -1,
          "Purchase (Cash)",
          now,
          now,
        );
      }
    });

    trx(purchase, items);
    return { success: true, purchaseId: newId, slNo, totalAmount };
  });

  // ========= UPDATE PURCHASE (WITH BATCH SYSTEM) =========
  ipcMain.handle("purchase:update", (event, payload) => {
    const { id, header, items } = payload;
    if (!id) return { success: false, error: "id required" };

    const trx = db.transaction(() => {
      const existing = db.prepare(`SELECT * FROM purchases WHERE id=?`).get(id);
      if (!existing) throw new Error("Purchase not found");

      const batchNameBase = `${existing.slNo}-${existing.billNo || "NO-BILL"}`;

      const now = new Date().toISOString();

      // Reverse stock from OLD items (by batch)
      const oldItems = getItemsForPurchase(id);
      for (const it of oldItems) {
        if (!it.isFree && it.batchId) {
          bumpBatchAndProductStock({
            batchId: it.batchId,
            productId: it.productId,
            deltaQty: -Number(it.quantity || 0),
          });
        } else if (!it.isFree) {
          // legacy fallback (no batchId recorded)
          db.prepare(
            `UPDATE products SET stock=COALESCE(stock,0)-? WHERE id=?`,
          ).run(it.quantity, it.productId);
        }
      }

      // Upsert header
      const totalAmount = items.reduce(
        (s, it) => s + Number(it.billedValue || 0),
        0,
      );
      const grandAmount = Math.max(
        0,
        totalAmount - Number(header.discount || 0),
      );

      db.prepare(
        `
        UPDATE purchases SET
          billNo = @billNo,
          supplierId = @supplierId,
          supplierName = @supplierName,
          department = @department,
          debitAccount = @debitAccount,
          natureOfEntry = @natureOfEntry,
          purchaseDate = @purchaseDate,
          entryTime = @entryTime,
          discount = @discount,
          totalAmount = @totalAmount,
          purchaseType = @purchaseType,
          updatedAt = @now,
          isSynced = 0
        WHERE id = @id
      `,
      ).run({
        id,
        billNo: header.billNo || null,
        supplierId: header.supplierId || null,
        supplierName: header.supplierName || null,
        department: header.department || null,
        debitAccount: header.debitAccount || null,
        natureOfEntry: header.natureOfEntry || null,
        purchaseDate: header.purchaseDate,
        entryTime: header.entryTime || header.purchaseDate,
        discount: Number(header.discount || 0),
        totalAmount,
        purchaseType: header.purchaseType === "CASH" ? "CASH" : "CREDIT",
        now,
      });

      // Replace items
      db.prepare(`DELETE FROM purchase_items WHERE purchaseId = ?`).run(id);

      const insItem = db.prepare(`
        INSERT INTO purchase_items(
          id, purchaseId, productId, quantity, unit, rate, taxPercent, taxAmount,
          discount, discountType, salePrice, profit, totalCost, billedValue,
          barcode, mrp, batchNo, mfgDate, expiryDate, lineNo, isFree, batchId,
          effectiveUnitValue, createdAt, updatedAt, isSynced, syncedAt
        ) VALUES (
          lower(hex(randomblob(16))), @purchaseId, @productId, @quantity, @unit, @rate, @taxPercent, @taxAmount,
          @discount, @discountType, @salePrice, @profit, @totalCost, @billedValue,
          @barcode, @mrp, @batchNo, @mfgDate, @expiryDate, @lineNo, @isFree, @batchId,
          @effectiveUnitValue, @now, @now, 0, NULL
        )
      `);

      items.forEach((it, idx) => {
        const lineNo = it.lineNo ?? idx + 1;
        const qty = Number(it.quantity || 0);
        const isFree = it.isFree ? 1 : 0;
        const effUnit = qty > 0 ? Number(it.billedValue || 0) / qty : 0;

        let batchBarcode = it.barcode?.trim() || null;
        if (!batchBarcode) {
          batchBarcode = reserveOneBarcode(header.licenseId);
        }

        const batchNoForInsert =
          it.forceNewBatch === true || !it.batchNo ? batchNameBase : it.batchNo;

        const { batch } = findOrCreateBatch({
          licenseId: header.licenseId,
          productId: it.productId,
          barcode: batchBarcode,
          mrp: it.mrp ?? null,
          salePrice: it.salePrice ?? null,
          costPrice: it.rate ?? null,
          batchNo: batchNoForInsert,
          mfgDate: it.mfgDate ?? null,
          expiryDate: it.expiryDate ?? null,
          receivedAt: header.purchaseDate || now,
          stock: 0,
          overrideExisting: it.overrideBatchPrices === true,
          forceNewBatch: it.forceNewBatch === true,
        });

        insItem.run({
          purchaseId: id,
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
          barcode: batchBarcode,
          mrp: it.mrp ?? null,
          batchNo: batchNoForInsert,
          mfgDate: it.mfgDate ?? null,
          expiryDate: it.expiryDate ?? null,
          lineNo,
          isFree,
          batchId: batch.id,
          effectiveUnitValue: effUnit,
          now,
        });

        if (!isFree) {
          bumpBatchAndProductStock({
            batchId: batch.id,
            productId: it.productId,
            deltaQty: qty,
          });
        }
      });

      // Delete old ledger entries for both supplier and cash
      db.prepare(
        `
        DELETE FROM supplier_transactions
        WHERE licenseId = @licenseId AND kind='PURCHASE' AND refId = @refId
      `,
      ).run({ licenseId: header.licenseId, refId: id });

      db.prepare(
        `
        DELETE FROM cash_transactions
        WHERE licenseId = @licenseId AND kind='PURCHASE' AND refId = @refId
        `,
      ).run({ licenseId: header.licenseId, refId: id });

      // Insert new ledger entry based on purchase type
      if (header.purchaseType === "CREDIT" && header.supplierId) {
        db.prepare(
          `
          INSERT INTO supplier_transactions
          (id, licenseId, supplierId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES (lower(hex(randomblob(16))), ?, ?, 'PURCHASE', ?, ?, ?, ?, 1, 'Purchase', ?, ?, 0)
        `,
        ).run(
          header.licenseId,
          header.supplierId,
          id,
          header.billNo || null,
          header.purchaseDate || now,
          grandAmount,
          now,
          now,
        );
      }

      if (header.purchaseType === "CASH") {
        db.prepare(
          `
          INSERT INTO cash_transactions
          (id, licenseId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES (lower(hex(randomblob(16))), ?, 'PURCHASE', ?, ?, ?, ?, -1, 'Purchase (Cash)', ?, ?, 0)
          `,
        ).run(
          header.licenseId,
          id,
          header.billNo || null,
          header.purchaseDate || now,
          grandAmount,
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

  // ========= DELETE PURCHASE (WITH BATCH SYSTEM) =========
  ipcMain.handle("purchase:delete", (event, id) => {
    const now = new Date().toISOString();

    const trx = db.transaction(() => {
      // Reverse stock (by batch)
      const items = getItemsForPurchase(id);

      for (const it of items) {
        if (!it.isFree && it.batchId) {
          bumpBatchAndProductStock({
            batchId: it.batchId,
            productId: it.productId,
            deltaQty: -Number(it.quantity || 0),
          });
        } else if (!it.isFree) {
          // legacy fallback
          db.prepare(
            `UPDATE products SET stock = COALESCE(stock,0) - ? WHERE id=?`,
          ).run(it.quantity, it.productId);
        }
      }

      // Fetch licenseId before soft-deleting
      const p = db
        .prepare(`SELECT licenseId FROM purchases WHERE id=?`)
        .get(id);

      db.prepare(`UPDATE purchases SET deletedAt=?, isSynced=0 WHERE id=?`).run(
        now,
        id,
      );
      db.prepare(
        `UPDATE purchase_items SET deletedAt=?, isSynced=0 WHERE purchaseId=?`,
      ).run(now, id);

      // Delete ledger rows with license guard
      if (p?.licenseId) {
        db.prepare(
          `DELETE FROM supplier_transactions WHERE licenseId=? AND kind='PURCHASE' AND refId=?`,
        ).run(p.licenseId, id);

        db.prepare(
          `DELETE FROM cash_transactions WHERE licenseId=? AND kind='PURCHASE' AND refId=?`,
        ).run(p.licenseId, id);
      } else {
        db.prepare(
          `DELETE FROM supplier_transactions WHERE kind='PURCHASE' AND refId=?`,
        ).run(id);

        db.prepare(
          `DELETE FROM cash_transactions WHERE kind='PURCHASE' AND refId=?`,
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

  // ========= LEGACY GET PURCHASES  =========
  ipcMain.handle(
    "get-purchases",
    (event, licenseId, { page = 1, pageSize = 10 } = {}) => {
      const offset = (page - 1) * pageSize;
      const purchases = db
        .prepare(
          `
      SELECT * FROM purchases
      WHERE licenseId = ? AND deletedAt IS NULL
      ORDER BY slNo DESC
      LIMIT ? OFFSET ?
    `,
        )
        .all(licenseId, pageSize, offset);

      const total = db
        .prepare(
          `
      SELECT COUNT(*) as count FROM purchases
      WHERE licenseId = ? AND deletedAt IS NULL
    `,
        )
        .get(licenseId).count;

      return { purchases, total };
    },
  );

  // ========= SYNC HANDLERS =========
  ipcMain.handle("mark-purchases-synced", (event, ids, serverSyncedAt) => {
    const ts = serverSyncedAt || new Date().toISOString();
    const trx = db.transaction((ids) => {
      const stmt = db.prepare(`
        UPDATE purchases
        SET isSynced = 1, syncedAt = ?
        WHERE id = ?
      `);
      ids.forEach((id) => stmt.run(ts, id));
    });
    trx(ids);
    return { success: true, syncedAt: ts };
  });

  // ========= HOLD HANDLERS =========

  // ---- HOLD: create/update ----
  ipcMain.handle("purchase-hold:save", (event, payload) => {
    const now = new Date().toISOString();

    if (payload.id) {
      const existing = db
        .prepare(
          `SELECT title, headerJson, rowsJson FROM purchase_holds WHERE id = ? AND deletedAt IS NULL`,
        )
        .get(payload.id);

      if (!existing) {
        return { success: false, error: "NOT_FOUND" };
      }

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
      UPDATE purchase_holds
      SET title = ?, headerJson = ?, rowsJson = ?, updatedAt = ?
      WHERE id = ?
    `,
      ).run(newTitle || null, newHeaderJson, newRowsJson, now, payload.id);

      return { success: true, id: payload.id, holdNo: null, updated: true };
    }

    const id = uuidv4();
    const holdNo = getNextHoldNo(payload.licenseId);

    db.prepare(
      `
    INSERT INTO purchase_holds
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

  // ---- HOLD: list ----
  ipcMain.handle(
    "purchase-hold:list",
    (event, licenseId, { page = 1, pageSize = 50 } = {}) => {
      const offset = (page - 1) * pageSize;
      const rows = db
        .prepare(
          `
        SELECT id, holdNo, title, createdAt, updatedAt
        FROM purchase_holds
        WHERE licenseId = ? AND deletedAt IS NULL
        ORDER BY updatedAt DESC
        LIMIT ? OFFSET ?
      `,
        )
        .all(licenseId, pageSize, offset);

      const total = db
        .prepare(
          `
          SELECT COUNT(*) as count FROM purchase_holds
          WHERE licenseId = ? AND deletedAt IS NULL
        `,
        )
        .get(licenseId).count;

      return { holds: rows, total };
    },
  );

  // ---- HOLD: get one ----
  ipcMain.handle("purchase-hold:get", (event, id) => {
    const row = db
      .prepare(
        `
      SELECT * FROM purchase_holds WHERE id = ? AND deletedAt IS NULL
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

  // ---- HOLD: delete ----
  ipcMain.handle("purchase-hold:delete", (event, id) => {
    const now = new Date().toISOString();
    db.prepare(
      `
      UPDATE purchase_holds SET deletedAt = ? WHERE id = ?
    `,
    ).run(now, id);
    return { success: true };
  });

  // ---- HOLD: peek next hold no (optional) ----
  ipcMain.handle("purchase-hold:peek-next-no", (event, licenseId) => {
    const seq = db
      .prepare(
        "SELECT lastHoldNo FROM purchase_hold_sequence WHERE licenseId = ?",
      )
      .get(licenseId);
    return { nextHoldNo: seq ? seq.lastHoldNo + 1 : 1 };
  });

  // ========= UTILITY HANDLERS =========
  ipcMain.handle("purchase:peek-next-slno", (event, licenseId) => {
    const seq = db
      .prepare("SELECT lastSlNo FROM purchase_sequence WHERE licenseId = ?")
      .get(licenseId);
    const nextSlNo = seq ? seq.lastSlNo + 1 : 1;
    return { nextSlNo };
  });

  // ===== SUPPLIER LEDGER HANDLERS =====
  ipcMain.handle(
    "supplier-ledger:list",
    (
      e,
      {
        licenseId,
        supplierId,
        dateFrom = null,
        dateTo = null,
        page = 1,
        pageSize = 50,
      },
    ) => {
      if (!licenseId || !supplierId)
        return { success: false, error: "licenseId & supplierId required" };
      const where = [
        "licenseId=@licenseId",
        "supplierId=@supplierId",
        "COALESCE(deletedAt,'')=''",
        "kind IN ('OPENING','PURCHASE','PAYMENT','ADJUSTMENT')",
      ];
      const params = { licenseId, supplierId };

      if (dateFrom) {
        where.push("date >= @dateFrom");
        params.dateFrom = dateFrom;
      }
      if (dateTo) {
        where.push("date < @dateTo");
        params.dateTo = dateTo;
      }

      const base = `
    FROM supplier_transactions
    WHERE ${where.join(" AND ")}
  `;

      const total = db
        .prepare(`SELECT COUNT(*) AS cnt ${base}`)
        .get(params).cnt;

      const rows = db
        .prepare(
          `
    SELECT id, kind, refId, refNo, date, amount, sign, notes, createdAt
    ${base}
    ORDER BY datetime(date) DESC, datetime(createdAt) DESC
    LIMIT @limit OFFSET @offset
  `,
        )
        .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

      const sum = db
        .prepare(
          `
    SELECT COALESCE(SUM(sign*amount),0) AS txSum
    ${base}
  `,
        )
        .get(params).txSum;

      // openingBalance (from suppliers table)
      const openingBalance = 0;
      const balance = Number(sum || 0);

      return {
        success: true,
        total,
        page,
        pageSize,
        rows,
        openingBalance: 0,
        balance: Number(sum || 0),
      };
    },
  );

  ipcMain.handle(
    "supplier-ledger:payment:create",
    (
      e,
      {
        licenseId,
        supplierId,
        amount,
        date,
        mode = "CASH",
        notes = null,
        allocations = [],
      },
    ) => {
      if (!licenseId || !supplierId || !amount || Number(amount) <= 0) {
        return {
          success: false,
          error: "licenseId, supplierId and positive amount required",
        };
      }

      const now = new Date().toISOString();
      const txId = uuidv4();
      const payAmt = Number(amount);

      let allocSum = 0;
      for (const a of allocations || []) {
        const v = Number(a?.amount || 0);
        if (v < 0)
          return { success: false, error: "Allocation amount must be >= 0" };
        allocSum += v;

        const pr = db
          .prepare(
            `SELECT licenseId, supplierId, totalAmount, discount, deletedAt, purchaseType FROM purchases WHERE id=?`,
          )
          .get(a.purchaseId);

        if (
          !pr ||
          pr.licenseId !== licenseId ||
          pr.supplierId !== supplierId ||
          pr.deletedAt
        ) {
          return {
            success: false,
            error: `Invalid purchaseId in allocation: ${a.purchaseId}`,
          };
        }
        if (pr.purchaseType !== "CREDIT") {
          return {
            success: false,
            error: `Cannot allocate to non-CREDIT purchase: ${a.purchaseId}`,
          };
        }
      }

      if (allocSum > payAmt) {
        return {
          success: false,
          error: "Sum of allocations exceeds payment amount",
        };
      }

      const trx = db.transaction(() => {
        // Supplier ledger payment (reduces balance => sign = -1)
        db.prepare(
          `
        INSERT INTO supplier_transactions
        (id, licenseId, supplierId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
        VALUES(?, ?, ?, 'PAYMENT', NULL, NULL, ?, ?, -1, ?, ?, ?, 0)
      `,
        ).run(
          txId,
          licenseId,
          supplierId,
          date || now,
          payAmt,
          notes || "Payment",
          now,
          now,
        );

        // Optional bill-wise allocations
        for (const a of allocations || []) {
          if (Number(a.amount || 0) <= 0) continue;
          db.prepare(
            `
          INSERT INTO supplier_bill_settlements
          (id, licenseId, supplierId, paymentTxId, purchaseId, amount, createdAt)
          VALUES(?, ?, ?, ?, ?, ?, ?)
        `,
          ).run(
            uuidv4(),
            licenseId,
            supplierId,
            txId,
            a.purchaseId,
            Number(a.amount),
            now,
          );
        }

        if (mode === "CASH" || mode === "BANK") {
          db.prepare(
            `
          INSERT INTO cash_transactions
          (id, licenseId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES (?,?,?,?,?,?,?,?,?,?,?, 0)
        `,
          ).run(
            uuidv4(),
            licenseId,
            "PAYMENT",
            txId,
            null,
            date || now,
            payAmt,
            -1,
            mode === "CASH"
              ? "Supplier Payment (Cash)"
              : "Supplier Payment (Bank)",
            now,
            now,
          );
        }
      });

      try {
        trx();
        return {
          success: true,
          id: txId,
          allocated: allocSum,
          unallocated: payAmt - allocSum,
        };
      } catch (err) {
        return { success: false, error: String(err?.message || err) };
      }
    },
  );

  // ===== SUPPLIER OUTSTANDING BILLS (bill-wise) =====
  ipcMain.handle(
    "supplier:outstanding-bills",
    (e, { licenseId, supplierId, q = "", page = 1, pageSize = 50 }) => {
      if (!licenseId || !supplierId)
        return { success: false, error: "licenseId & supplierId required" };

      const like = `%${q.trim()}%`;

      const baseRows = db
        .prepare(
          `
        SELECT
          p.id,
          p.slNo,
          p.billNo,
          p.purchaseDate,
          p.totalAmount,
          p.discount,
          p.purchaseType
        FROM purchases p
        WHERE p.licenseId = ? AND p.supplierId = ? AND COALESCE(p.deletedAt,'') = ''
          AND p.purchaseType = 'CREDIT'
          AND (COALESCE(p.billNo,'') LIKE ? OR COALESCE(p.supplierName,'') LIKE ?)
        ORDER BY datetime(p.purchaseDate) DESC, p.slNo DESC
        LIMIT ? OFFSET ?
      `,
        )
        .all(
          licenseId,
          supplierId,
          like,
          like,
          pageSize,
          (page - 1) * pageSize,
        );

      const total = db
        .prepare(
          `
        SELECT COUNT(*) AS cnt
        FROM purchases p
        WHERE p.licenseId = ? AND p.supplierId = ? AND COALESCE(p.deletedAt,'') = ''
          AND p.purchaseType = 'CREDIT'
          AND (COALESCE(p.billNo,'') LIKE ? OR COALESCE(p.supplierName,'') LIKE ?)
      `,
        )
        .get(licenseId, supplierId, like, like).cnt;

      const rows = baseRows.map((r) => {
        const grand = Math.max(
          0,
          Number(r.totalAmount || 0) - Number(r.discount || 0),
        );

        const paid = db
          .prepare(
            `
          SELECT COALESCE(SUM(amount),0) AS paid
          FROM supplier_bill_settlements
          WHERE licenseId=? AND purchaseId=?
        `,
          )
          .get(licenseId, r.id).paid;

        const remaining = Math.max(0, grand - Number(paid || 0));
        return {
          ...r,
          grandAmount: grand,
          paidAmount: Number(paid || 0),
          remainingDue: remaining,
        };
      });

      return { success: true, page, pageSize, total, rows };
    },
  );

  // ===== PAYMENTS: list =====
  ipcMain.handle(
    "payments:list",
    (
      e,
      {
        licenseId,
        supplierId = null,
        q = "",
        dateFrom = null,
        dateTo = null,
        page = 1,
        pageSize = 50,
      },
    ) => {
      if (!licenseId) return { success: false, error: "licenseId required" };

      const where = [
        "st.licenseId = @licenseId",
        "COALESCE(st.deletedAt,'')=''",
        "st.kind = 'PAYMENT'",
      ];
      const params = {
        licenseId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };

      if (supplierId) {
        where.push("st.supplierId = @supplierId");
        params.supplierId = supplierId;
      }
      if (dateFrom) {
        where.push("st.date >= @dateFrom");
        params.dateFrom = dateFrom;
      }
      if (dateTo) {
        where.push("st.date < @dateTo");
        params.dateTo = dateTo;
      }
      if (q && q.trim()) {
        where.push(
          "(COALESCE(s.name,'') LIKE @q OR COALESCE(st.notes,'') LIKE @q)",
        );
        params.q = `%${q.trim()}%`;
      }

      const base = `
      FROM supplier_transactions st
      LEFT JOIN suppliers s ON s.id = st.supplierId
      LEFT JOIN cash_transactions ct
        ON ct.licenseId = st.licenseId
       AND ct.refId = st.id
       AND ct.kind = 'PAYMENT'
      WHERE ${where.join(" AND ")}
    `;

      const total = db
        .prepare(`SELECT COUNT(*) AS cnt ${base}`)
        .get(params).cnt;

      // Pull payments + allocated sum
      const rows = db
        .prepare(
          `
      SELECT
        st.id,
        st.supplierId,
        COALESCE(s.name,'') AS supplierName,
        st.date,
        st.amount,
        st.notes,
        st.createdAt,
        CASE
          WHEN LOWER(COALESCE(ct.notes,'')) LIKE '%bank%' THEN 'BANK'
          WHEN LOWER(COALESCE(ct.notes,'')) LIKE '%cash%' THEN 'CASH'
          ELSE 'CASH'
        END AS mode,
        (SELECT COALESCE(SUM(amount),0)
           FROM supplier_bill_settlements b
          WHERE b.licenseId = st.licenseId AND b.paymentTxId = st.id) AS allocated
      ${base}
      ORDER BY datetime(st.date) DESC, datetime(st.createdAt) DESC
      LIMIT @limit OFFSET @offset
      `,
        )
        .all(params);

      // For each payment, fetch the bills it was applied to
      const billStmt = db.prepare(`
      SELECT b.purchaseId,
             COALESCE(p.billNo, printf('SL-%d', p.slNo)) AS billRef
        FROM supplier_bill_settlements b
        LEFT JOIN purchases p
               ON p.id = b.purchaseId
       WHERE b.licenseId = ? AND b.paymentTxId = ?
       ORDER BY datetime(p.purchaseDate) DESC, p.slNo DESC
    `);

      const mapped = rows.map((r) => {
        const bills = billStmt.all(licenseId, r.id) || [];
        const allocated = Number(r.allocated || 0);
        const unallocated = Math.max(0, Number(r.amount || 0) - allocated);

        return {
          ...r,
          allocated,
          unallocated,
          bills: bills.map((x) => ({
            purchaseId: x.purchaseId,
            billRef: x.billRef || x.purchaseId,
          })),
        };
      });

      return { success: true, total, page, pageSize, rows: mapped };
    },
  );
}

module.exports = { registerPurchaseHandlers };
