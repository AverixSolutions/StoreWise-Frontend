// electron/ipc/purchases.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");
const { reserveOneBarcode } = require("./barcodes");
const { canUseBarcode } = require("../licenseFeatures");

// ========= BATCH HELPER FUNCTIONS =========

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

function makePurchaseBatchNo(billNo, purchaseDate) {
  const rawBill = String(billNo || "NO-BILL")
    .trim()
    .replace(/[^\w-]/g, "");
  const d = purchaseDate ? new Date(purchaseDate) : new Date();

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `PB-${rawBill}-${dd}-${mm}-${yyyy}`;
}

function createPurchaseItemBatch(payload) {
  const now = new Date().toISOString();
  const batchId = uuidv4();

  db.prepare(
    `
    INSERT INTO product_batches (
  id, licenseId, productId, barcode, mrp, salePrice, costPrice,
  batchNo, purchaseBatchNo, purchaseId,
  mfgDate, expiryDate, receivedAt, stock, createdAt, updatedAt,
  isSystemGeneratedBarcode
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    payload.purchaseBatchNo ?? null,
    payload.purchaseId ?? null,
    payload.mfgDate ?? null,
    payload.expiryDate ?? null,
    payload.receivedAt || now,
    Number(payload.stock || 0),
    now,
    now,
    payload.isSystemGeneratedBarcode ? 1 : 0,
  );

  return db.prepare(`SELECT * FROM product_batches WHERE id = ?`).get(batchId);
}

function findLiveBatchById({ licenseId, productId, batchId }) {
  if (!batchId) return null;

  return db
    .prepare(
      `
      SELECT *
      FROM product_batches
      WHERE id = ?
        AND licenseId = ?
        AND productId = ?
        AND COALESCE(deletedAt,'') = ''
      LIMIT 1
    `,
    )
    .get(batchId, licenseId, productId);
}

function findLiveBatchByBarcode({ licenseId, barcode }) {
  if (!barcode) return null;

  return db
    .prepare(
      `
      SELECT *
      FROM product_batches
      WHERE licenseId = ?
        AND barcode = ?
        AND COALESCE(deletedAt,'') = ''
      LIMIT 1
    `,
    )
    .get(licenseId, barcode);
}

// ──────── NEW HELPERS FOR PURCHASE-GROUP IDENTITY MATCHING ────────

function normalizeNullable(v) {
  return v === undefined || v === null || v === "" ? null : v;
}

function sameValue(a, b) {
  return normalizeNullable(a) === normalizeNullable(b);
}

function findExistingPurchaseGroupBatch({
  licenseId,
  productId,
  purchaseBatchNo,
  barcode,
  mrp,
  salePrice,
  costPrice,
  batchNo,
  mfgDate,
  expiryDate,
}) {
  const rows = db
    .prepare(
      `
      SELECT *
      FROM product_batches
      WHERE licenseId = ?
        AND productId = ?
        AND purchaseBatchNo = ?
        AND COALESCE(deletedAt,'') = ''
      ORDER BY createdAt ASC
    `,
    )
    .all(licenseId, productId, purchaseBatchNo);

  return (
    rows.find((r) => {
      if (barcode && !sameValue(r.barcode, barcode)) return false;

      return (
        sameValue(r.mrp, mrp) &&
        sameValue(r.salePrice, salePrice) &&
        sameValue(r.costPrice, costPrice) &&
        sameValue(r.batchNo, batchNo) &&
        sameValue(r.mfgDate, mfgDate) &&
        sameValue(r.expiryDate, expiryDate)
      );
    }) || null
  );
}

// ──────── UPDATED FUNCTION WITH GROUP MERGE LOGIC ────────

function resolveOrCreatePurchaseBatch({
  licenseId,
  productId,
  batchId,
  barcode,
  mrp,
  salePrice,
  costPrice,
  batchNo,
  purchaseBatchNo,
  purchaseId,
  mfgDate,
  expiryDate,
  receivedAt,
  isSystemGeneratedBarcode = false,
}) {
  let batch = findLiveBatchById({ licenseId, productId, batchId });
  if (batch) return batch;

  // If barcode explicitly provided, barcode must stay global-unique
  if (barcode) {
    batch = findLiveBatchByBarcode({ licenseId, barcode });
    if (batch) {
      if (batch.productId !== productId) {
        throw new Error(
          `BARCODE_IN_USE: Barcode ${barcode} already belongs to another product`,
        );
      }
      return batch;
    }
  }

  // Merge inside same purchase batch group if identity matches
  batch = findExistingPurchaseGroupBatch({
    licenseId,
    productId,
    purchaseBatchNo,
    barcode: barcode || null,
    mrp: mrp ?? null,
    salePrice: salePrice ?? null,
    costPrice: costPrice ?? null,
    batchNo: batchNo ?? null,
    mfgDate: mfgDate ?? null,
    expiryDate: expiryDate ?? null,
  });

  if (batch) {
    return batch;
  }

  return createPurchaseItemBatch({
    licenseId,
    productId,
    barcode: barcode || null,
    mrp,
    salePrice,
    costPrice,
    batchNo,
    purchaseBatchNo,
    purchaseId,
    mfgDate,
    expiryDate,
    receivedAt,
    stock: 0,
    isSystemGeneratedBarcode,
  });
}

// ========= PURCHASE CRUD HANDLERS =========

function registerPurchaseHandlers() {
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
           totalAmount, discount, purchaseType, isSynced, deletedAt, syncedAt, typeId
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
        AND COALESCE(pi.deletedAt,'') = ''
        ORDER BY COALESCE(pi.lineNo, 0), pi.createdAt
  `,
      )
      .all(id);
    return { success: true, purchase: p, items };
  });

  // ========= GET PURCHASE FULL  =========
  ipcMain.handle("purchase:getFull", (event, id) => {
    const p = db
      .prepare(`SELECT *, typeId FROM purchases WHERE id = ?`)
      .get(id);
    if (!p) return { success: false, error: "Not found" };
    const items = db
      .prepare(
        `
      SELECT pi.*, p.name as productName, p.code as productCode
      FROM purchase_items pi
      LEFT JOIN products p ON p.id = pi.productId
      WHERE pi.purchaseId = ?
      AND COALESCE(pi.deletedAt,'') = ''
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
    const purchaseBatchNo = makePurchaseBatchNo(
      purchase.billNo,
      purchase.purchaseDate || now,
    );

    let totalAmount = 0;

    const insertPurchase = db.prepare(`
    INSERT INTO purchases (
  id, slNo, userId, licenseId, typeId, billNo, purchaseBatchNo, supplierId, supplierName, department,
  debitAccount, natureOfEntry, purchaseDate, entryTime,
  totalAmount, discount, createdAt, isSynced, purchaseType
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

    const insertItem = db.prepare(`
   INSERT INTO purchase_items (
  id, purchaseId, productId, barcode, quantity, unit, rate, mrp,
  taxPercent, taxAmount, discount, salePrice, profit, totalCost, billedValue, effectiveUnitValue,
  batchNo, purchaseBatchNo, mfgDate, expiryDate, discountType, lineNo, isFree, batchId,
  createdAt, updatedAt, isSynced
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

    const trx = db.transaction((purchase, items) => {
      insertPurchase.run(
        newId,
        slNo,
        purchase.userId,
        purchase.licenseId,
        purchase.typeId || null,
        purchase.billNo || null,
        purchaseBatchNo,
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

      const barcodeEnabled = canUseBarcode(purchase.licenseId);

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

        // ──── BARCODE / BATCH RESOLUTION WITH GROUP MERGING ────
        let batchBarcode = item.barcode?.trim() || null;

        let existingGroupedBatch = null;

        if (!batchBarcode) {
          existingGroupedBatch = findExistingPurchaseGroupBatch({
            licenseId: purchase.licenseId,
            productId: item.productId,
            purchaseBatchNo,
            barcode: null,
            mrp: item.mrp ?? null,
            salePrice: salePrice ?? item.salePrice ?? null,
            costPrice: item.rate ?? null,
            batchNo: purchaseBatchNo,
            mfgDate: item.mfgDate ?? null,
            expiryDate: item.expiryDate ?? null,
          });

          if (existingGroupedBatch?.barcode) {
            batchBarcode = existingGroupedBatch.barcode;
          }
        }

        let wasAutoGenerated = false;
        if (!batchBarcode && barcodeEnabled) {
          batchBarcode = reserveOneBarcode(purchase.licenseId);
          wasAutoGenerated = true;
        }

        const batchNoForInsert = purchaseBatchNo;

        const batch = existingGroupedBatch
          ? existingGroupedBatch
          : resolveOrCreatePurchaseBatch({
              licenseId: purchase.licenseId,
              productId: item.productId,
              batchId: item.batchId || null,
              barcode: batchBarcode,
              mrp: item.mrp ?? null,
              salePrice: salePrice ?? item.salePrice ?? null,
              costPrice: item.rate ?? null,
              batchNo: batchNoForInsert,
              purchaseBatchNo,
              purchaseId: newId,
              mfgDate: item.mfgDate ?? null,
              expiryDate: item.expiryDate ?? null,
              receivedAt: purchase.purchaseDate || now,
              isSystemGeneratedBarcode: wasAutoGenerated,
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
          purchaseBatchNo,
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

      const licenseId = existing.licenseId;
      const now = new Date().toISOString();

      const purchaseBatchNo = makePurchaseBatchNo(
        header.billNo || existing.billNo,
        header.purchaseDate || existing.purchaseDate || now,
      );

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
          typeId = @typeId,
          purchaseBatchNo = @purchaseBatchNo,
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
        typeId: header.typeId || null,
        purchaseBatchNo,
        supplierId: header.supplierId || header.supplier?.id || null,
        supplierName: header.supplierName || header.supplier?.name || null,
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

      db.prepare(
        `UPDATE product_batches
   SET deletedAt = ?, updatedAt = ?
   WHERE purchaseId = ? AND COALESCE(deletedAt,'') = ''`,
      ).run(now, now, id);

      // Soft-delete old items so sync can push tombstones to the server.
      // DO NOT hard-delete here, or cloud keeps old active rows.
      db.prepare(
        `
  UPDATE purchase_items
  SET deletedAt = ?,
      updatedAt = ?,
      isSynced = 0,
      syncedAt = NULL
  WHERE purchaseId = ?
    AND COALESCE(deletedAt,'') = ''
`,
      ).run(now, now, id);

      const insItem = db.prepare(`
        INSERT INTO purchase_items(
          id, purchaseId, productId, quantity, unit, rate, taxPercent, taxAmount,
          discount, discountType, salePrice, profit, totalCost, billedValue,
         barcode, mrp, batchNo, purchaseBatchNo, mfgDate, expiryDate, lineNo, isFree, batchId,
          effectiveUnitValue, createdAt, updatedAt, isSynced, syncedAt
        ) VALUES (
          lower(hex(randomblob(16))), @purchaseId, @productId, @quantity, @unit, @rate, @taxPercent, @taxAmount,
          @discount, @discountType, @salePrice, @profit, @totalCost, @billedValue,
          @barcode, @mrp, @batchNo, @purchaseBatchNo, @mfgDate, @expiryDate, @lineNo, @isFree, @batchId,
          @effectiveUnitValue, @now, @now, 0, NULL
        )
      `);

      const barcodeEnabled = canUseBarcode(licenseId);

      items.forEach((it, idx) => {
        const lineNo = it.lineNo ?? idx + 1;
        const qty = Number(it.quantity || 0);
        const isFree = it.isFree ? 1 : 0;
        const effUnit = qty > 0 ? Number(it.billedValue || 0) / qty : 0;

        // ──── BARCODE / BATCH RESOLUTION WITH GROUP MERGING ────
        let batchBarcode = it.barcode?.trim() || null;

        let existingGroupedBatch = null;
        let wasAutoGenerated = false;

        if (!batchBarcode) {
          existingGroupedBatch = findExistingPurchaseGroupBatch({
            licenseId,
            productId: it.productId,
            purchaseBatchNo,
            barcode: null,
            mrp: it.mrp ?? null,
            salePrice: it.salePrice ?? null,
            costPrice: it.rate ?? null,
            batchNo: purchaseBatchNo,
            mfgDate: it.mfgDate ?? null,
            expiryDate: it.expiryDate ?? null,
          });

          if (existingGroupedBatch?.barcode) {
            batchBarcode = existingGroupedBatch.barcode;
          }
        }

        if (!batchBarcode && barcodeEnabled) {
          batchBarcode = reserveOneBarcode(licenseId);
          wasAutoGenerated = true;
        }

        const batchNoForInsert = purchaseBatchNo;

        const batch = existingGroupedBatch
          ? existingGroupedBatch
          : resolveOrCreatePurchaseBatch({
              licenseId,
              productId: it.productId,
              batchId: it.batchId || null,
              barcode: batchBarcode,
              mrp: it.mrp ?? null,
              salePrice: it.salePrice ?? null,
              costPrice: it.rate ?? null,
              batchNo: batchNoForInsert,
              purchaseBatchNo,
              purchaseId: id,
              mfgDate: it.mfgDate ?? null,
              expiryDate: it.expiryDate ?? null,
              receivedAt: header.purchaseDate || now,
              isSystemGeneratedBarcode: wasAutoGenerated,
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
          purchaseBatchNo,
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
      ).run({ licenseId, refId: id });

      db.prepare(
        `
        DELETE FROM cash_transactions
        WHERE licenseId = @licenseId AND kind='PURCHASE' AND refId = @refId
        `,
      ).run({ licenseId, refId: id });

      // Insert new ledger entry based on purchase type
      if (
        header.purchaseType === "CREDIT" &&
        (header.supplierId || header.supplier?.id)
      ) {
        db.prepare(
          `
          INSERT INTO supplier_transactions
          (id, licenseId, supplierId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES (lower(hex(randomblob(16))), ?, ?, 'PURCHASE', ?, ?, ?, ?, 1, 'Purchase', ?, ?, 0)
        `,
        ).run(
          licenseId,
          header.supplierId || header.supplier?.id,
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
          licenseId,
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

      db.prepare(
        `UPDATE product_batches
   SET deletedAt = ?, updatedAt = ?
   WHERE purchaseId = ? AND COALESCE(deletedAt,'') = ''`,
      ).run(now, now, id);

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
  SET title = ?, headerJson = ?, rowsJson = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
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
    UPDATE purchase_holds
    SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
    WHERE id = ?
  `,
    ).run(now, now, id);
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

  // ========= PURCHASE HOLD SYNC HANDLERS =========

  // Get unsynced holds (for push to server)
  ipcMain.handle(
    "get-dirty-purchase-holds",
    (event, licenseId, limit = 200) => {
      const rows = db
        .prepare(
          `
      SELECT id, licenseId, userId, holdNo, title, headerJson, rowsJson,
             createdAt, updatedAt, deletedAt, isSynced
      FROM purchase_holds
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

  // Mark holds as synced after successful push
  ipcMain.handle("mark-purchase-holds-synced", (event, ids, serverSyncedAt) => {
    const ts = serverSyncedAt || new Date().toISOString();
    const trx = db.transaction((ids) => {
      const stmt = db.prepare(
        `UPDATE purchase_holds SET isSynced = 1, syncedAt = ? WHERE id = ?`,
      );
      ids.forEach((id) => stmt.run(ts, id));
    });
    trx(ids);
    return { success: true, syncedAt: ts };
  });

  // Bulk upsert holds pulled from server (using composite key licenseId+holdNo)
  ipcMain.handle("bulk-upsert-purchase-holds", (event, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = new Date().toISOString();

    const upsert = db.prepare(`
    INSERT INTO purchase_holds (
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
    WHERE excluded.updatedAt > purchase_holds.updatedAt
       OR purchase_holds.updatedAt IS NULL
  `);

    const trx = db.transaction((records) => {
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
    });

    trx(records);

    // Keep hold sequence in sync (same as sales)
    const maxRow = db
      .prepare(
        `
      SELECT MAX(holdNo) AS maxHoldNo
      FROM purchase_holds
      WHERE licenseId = ?
    `,
      )
      .get(records[0]?.licenseId);

    if (maxRow?.maxHoldNo) {
      db.prepare(
        `
      INSERT INTO purchase_hold_sequence (licenseId, lastHoldNo)
      VALUES (?, ?)
      ON CONFLICT(licenseId) DO UPDATE SET
        lastHoldNo = MAX(excluded.lastHoldNo, purchase_hold_sequence.lastHoldNo)
    `,
      ).run(records[0].licenseId, maxRow.maxHoldNo);
    }

    return { success: true, upserted: records.length };
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
        SELECT id, kind, refId, refNo, date, amount, sign, notes, createdAt,
               paymentStatus, paymentMode, chequeNo, chequeIssueDate, chequeClearanceDate
        ${base}
        ORDER BY datetime(date) DESC, datetime(createdAt) DESC
        LIMIT @limit OFFSET @offset
      `,
        )
        .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

      // Balance calculation: exclude payments that are not CLEARED
      const sum = db
        .prepare(
          `
        SELECT COALESCE(SUM(sign*amount),0) AS txSum
        FROM supplier_transactions
        WHERE licenseId=@licenseId AND supplierId=@supplierId
          AND COALESCE(deletedAt,'')=''
          AND kind IN ('OPENING','PURCHASE','PAYMENT','ADJUSTMENT')
          AND (kind != 'PAYMENT' OR COALESCE(paymentStatus,'CLEARED') = 'CLEARED')
      `,
        )
        .get(params).txSum;

      const openingBalance = 0;
      const balance = Number(sum || 0);

      return {
        success: true,
        total,
        page,
        pageSize,
        rows,
        openingBalance: 0,
        balance,
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
        chequeNo = null,
        chequeIssueDate = null,
        chequeClearanceDate = null,
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
      const isCheque = mode === "CHEQUE";
      const paymentStatus = isCheque ? "PENDING_CHEQUE" : null; // ← changed

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
        // Supplier ledger payment entry
        db.prepare(
          `
        INSERT INTO supplier_transactions
        (id, licenseId, supplierId, kind, refId, refNo, date, amount, sign, notes,
         paymentStatus, paymentMode, chequeNo, chequeIssueDate, chequeClearanceDate,
         createdAt, updatedAt, isSynced)
        VALUES(?, ?, ?, 'PAYMENT', NULL, NULL, ?, ?, -1, ?,
               ?, ?, ?, ?, ?,
               ?, ?, 0)
      `,
        ).run(
          txId,
          licenseId,
          supplierId,
          date || now,
          payAmt,
          notes || (isCheque ? "Cheque Payment" : "Payment"),
          paymentStatus, // ← null for CASH/BANK, "PENDING_CHEQUE" for CHEQUE
          mode, // ← new: stores "CASH" | "BANK" | "CHEQUE"
          chequeNo || null,
          chequeIssueDate || null,
          chequeClearanceDate || null,
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

        // Only create cash transaction immediately for CASH/BANK; cheque waits for clearance
        if (!isCheque && (mode === "CASH" || mode === "BANK")) {
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
          paymentStatus,
        };
      } catch (err) {
        return { success: false, error: String(err?.message || err) };
      }
    },
  );

  // ===== CHEQUE: Mark as received / cleared =====
  ipcMain.handle("supplier-cheque:mark-received", (e, { licenseId, txId }) => {
    if (!licenseId || !txId)
      return { success: false, error: "licenseId and txId required" };

    const now = new Date().toISOString();

    const tx = db
      .prepare(
        `SELECT * FROM supplier_transactions WHERE id = ? AND licenseId = ? AND kind = 'PAYMENT'`,
      )
      .get(txId, licenseId);

    if (!tx) return { success: false, error: "Transaction not found" };

    if (tx.paymentStatus !== "PENDING_CHEQUE")
      return { success: false, error: "Transaction is not a pending cheque" };

    try {
      db.transaction(() => {
        // Mark as cleared — now it counts in balance calc
        db.prepare(
          `UPDATE supplier_transactions
             SET paymentStatus = 'CLEARED', updatedAt = ?, isSynced = 0
             WHERE id = ?`,
        ).run(now, txId);

        // Create cash transaction (cheque clears through bank)
        db.prepare(
          `INSERT INTO cash_transactions
             (id, licenseId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
             VALUES (?,?,?,?,?,?,?,?,?,?,?, 0)`,
        ).run(
          uuidv4(),
          licenseId,
          "PAYMENT",
          txId,
          tx.chequeNo || null,
          now,
          Number(tx.amount),
          -1,
          `Cheque Cleared${tx.chequeNo ? " - " + tx.chequeNo : ""}`,
          now,
          now,
        );
      })();

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });
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
        st.paymentStatus,
        st.paymentMode,
        st.chequeNo,
        CASE
          WHEN st.paymentMode IN ('CASH', 'BANK', 'CHEQUE') THEN st.paymentMode
          WHEN st.chequeNo IS NOT NULL
            OR st.chequeIssueDate IS NOT NULL
            OR st.chequeClearanceDate IS NOT NULL
            OR st.paymentStatus = 'PENDING_CHEQUE'
          THEN 'CHEQUE'
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

  // ========= SYNC: get dirty purchases =========
  ipcMain.handle("get-dirty-purchases", (event, licenseId, limit = 200) => {
    const rows = db
      .prepare(
        `
        SELECT id, slNo, billNo, userId, licenseId,
               supplierId, supplierName, department,
               debitAccount, natureOfEntry, purchaseType,
               typeId,
               purchaseBatchNo, purchaseDate, entryTime,
               totalAmount, discount,
               createdAt, updatedAt, deletedAt,
               isSynced, syncedAt
        FROM purchases
        WHERE licenseId = ?
          AND (isSynced = 0 OR isSynced IS NULL)
        ORDER BY updatedAt ASC
        LIMIT ?
      `,
      )
      .all(licenseId, limit);

    return { success: true, records: rows };
  });

  // ========= SYNC: get dirty purchase items =========
  ipcMain.handle(
    "get-dirty-purchase-items",
    (event, licenseId, limit = 500) => {
      const rows = db
        .prepare(
          `
          SELECT pi.id, pi.purchaseId, pi.productId, pi.barcode,
                 pi.quantity, pi.unit, pi.rate, pi.mrp,
                 pi.taxPercent, pi.taxAmount,
                 pi.discount, pi.discountType,
                 pi.salePrice, pi.profit, pi.totalCost, pi.billedValue,
                 pi.batchNo, pi.batchId, pi.purchaseBatchNo,
                 pi.mfgDate, pi.expiryDate,
                 pi.lineNo, pi.isFree, pi.effectiveUnitValue,
                 pi.createdAt, pi.updatedAt, pi.deletedAt,
                 pi.isSynced, pi.syncedAt
          FROM purchase_items pi
          JOIN purchases p ON p.id = pi.purchaseId
          WHERE p.licenseId = ?
            AND (pi.isSynced = 0 OR pi.isSynced IS NULL)
          ORDER BY pi.updatedAt ASC
          LIMIT ?
        `,
        )
        .all(licenseId, limit);

      return { success: true, records: rows };
    },
  );

  // ========= SYNC: mark purchase items synced =========
  ipcMain.handle("mark-purchase-items-synced", (event, ids, serverSyncedAt) => {
    if (!Array.isArray(ids) || ids.length === 0)
      return { success: true, synced: 0 };

    const ts = serverSyncedAt || new Date().toISOString();
    const trx = db.transaction((ids) => {
      const stmt = db.prepare(`
          UPDATE purchase_items
          SET isSynced = 1, syncedAt = ?
          WHERE id = ?
        `);
      ids.forEach((id) => stmt.run(ts, id));
    });
    trx(ids);
    return { success: true, synced: ids.length, syncedAt: ts };
  });

  // ========= SYNC: bulk upsert purchases from server (pull) =========
  ipcMain.handle("bulk-upsert-purchases", (event, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = new Date().toISOString();

    const upsert = db.prepare(`
      INSERT INTO purchases (
        id, slNo, billNo, userId, licenseId, typeId,
        supplierId, supplierName, department,
        debitAccount, natureOfEntry, purchaseType,
        purchaseBatchNo, purchaseDate, entryTime,
        totalAmount, discount,
        createdAt, updatedAt, deletedAt,
        isSynced, syncedAt
      ) VALUES (
        @id, @slNo, @billNo, @userId, @licenseId, @typeId,
        @supplierId, @supplierName, @department,
        @debitAccount, @natureOfEntry, @purchaseType,
        @purchaseBatchNo, @purchaseDate, @entryTime,
        @totalAmount, @discount,
        @createdAt, @updatedAt, @deletedAt,
        1, @syncedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        slNo            = excluded.slNo,
        billNo          = excluded.billNo,
        typeId          = excluded.typeId,
        supplierId      = excluded.supplierId,
        supplierName    = excluded.supplierName,
        department      = excluded.department,
        debitAccount    = excluded.debitAccount,
        natureOfEntry   = excluded.natureOfEntry,
        purchaseType    = excluded.purchaseType,
        purchaseBatchNo = excluded.purchaseBatchNo,
        purchaseDate    = excluded.purchaseDate,
        entryTime       = excluded.entryTime,
        totalAmount     = excluded.totalAmount,
        discount        = excluded.discount,
        updatedAt       = excluded.updatedAt,
        deletedAt       = excluded.deletedAt,
        isSynced        = 1,
        syncedAt        = excluded.syncedAt
      WHERE excluded.updatedAt > purchases.updatedAt
        OR purchases.updatedAt IS NULL
    `);

    const trx = db.transaction((records) => {
      for (const r of records) {
        upsert.run({
          id: r.id,
          slNo: r.slNo ?? null,
          billNo: r.billNo ?? null,
          userId: r.userId ?? null,
          licenseId: r.licenseId,
          typeId: r.typeId ?? null,
          supplierId: r.supplierId ?? null,
          supplierName: r.supplierName ?? null,
          department: r.department ?? null,
          debitAccount: r.debitAccount ?? null,
          natureOfEntry: r.natureOfEntry ?? null,
          purchaseType: r.purchaseType ?? null,
          purchaseBatchNo: r.purchaseBatchNo ?? null,
          purchaseDate:
            r.purchaseDate instanceof Date
              ? r.purchaseDate.toISOString()
              : r.purchaseDate,
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
    const maxRow = db
      .prepare(
        `SELECT MAX(slNo) AS maxSlNo FROM purchases WHERE licenseId = ? AND deletedAt IS NULL`,
      )
      .get(records[0]?.licenseId);

    if (maxRow?.maxSlNo) {
      db.prepare(
        `INSERT INTO purchase_sequence (licenseId, lastSlNo)
         VALUES (?, ?)
         ON CONFLICT(licenseId) DO UPDATE SET
           lastSlNo = MAX(excluded.lastSlNo, purchase_sequence.lastSlNo)`,
      ).run(records[0].licenseId, maxRow.maxSlNo);
    }

    return { success: true, upserted: records.length };
  });

  // ========= SYNC: bulk upsert purchase items from server (pull) =========
  ipcMain.handle("bulk-upsert-purchase-items", (event, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = new Date().toISOString();

    // Filter out records whose parent purchase or product doesn't exist locally yet.
    // They will be retried on the next sync cycle once the parents arrive.
    function getExistingIds(table, ids) {
      const BATCH = 900;
      const existing = new Set();
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const placeholders = batch.map(() => "?").join(",");
        db.prepare(`SELECT id FROM ${table} WHERE id IN (${placeholders})`)
          .all(...batch)
          .forEach((r) => existing.add(r.id));
      }
      return existing;
    }

    const uniquePurchaseIds = [...new Set(records.map((r) => r.purchaseId))];
    const uniqueProductIds = [...new Set(records.map((r) => r.productId))];
    const existingPurchaseIds = getExistingIds("purchases", uniquePurchaseIds);
    const existingProductIds = getExistingIds("products", uniqueProductIds);

    const validRecords = records.filter(
      (r) =>
        existingPurchaseIds.has(r.purchaseId) &&
        existingProductIds.has(r.productId),
    );

    const skipped = records.length - validRecords.length;
    if (validRecords.length === 0)
      return { success: true, upserted: 0, skipped };

    const upsert = db.prepare(`
      INSERT INTO purchase_items (
        id, purchaseId, productId, barcode,
        quantity, unit, rate, mrp,
        taxPercent, taxAmount, discount, discountType,
        salePrice, profit, totalCost, billedValue,
        batchNo, batchId, purchaseBatchNo,
        mfgDate, expiryDate, lineNo, isFree, effectiveUnitValue,
        createdAt, updatedAt, deletedAt, isSynced, syncedAt
      ) VALUES (
        @id, @purchaseId, @productId, @barcode,
        @quantity, @unit, @rate, @mrp,
        @taxPercent, @taxAmount, @discount, @discountType,
        @salePrice, @profit, @totalCost, @billedValue,
        @batchNo, @batchId, @purchaseBatchNo,
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
        purchaseBatchNo    = excluded.purchaseBatchNo,
        mfgDate            = excluded.mfgDate,
        expiryDate         = excluded.expiryDate,
        lineNo             = excluded.lineNo,
        isFree             = excluded.isFree,
        effectiveUnitValue = excluded.effectiveUnitValue,
        updatedAt          = excluded.updatedAt,
        deletedAt          = excluded.deletedAt,
        isSynced           = 1,
        syncedAt           = excluded.syncedAt
      WHERE excluded.updatedAt > purchase_items.updatedAt
        OR purchase_items.updatedAt IS NULL
    `);

    const trx = db.transaction((records) => {
      for (const r of records) {
        upsert.run({
          id: r.id,
          purchaseId: r.purchaseId,
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
          purchaseBatchNo: r.purchaseBatchNo ?? null,
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

    trx(validRecords);
    return { success: true, upserted: validRecords.length, skipped };
  });
}

module.exports = { registerPurchaseHandlers };
