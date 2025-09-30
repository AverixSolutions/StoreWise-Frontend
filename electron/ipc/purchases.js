// electron/ipc/purchases.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

// ========= HELPER FUNCTIONS =========

// Helper: total calc
function sum(arr) {
  return arr.reduce((s, n) => s + (Number(n) || 0), 0);
}

function getItemsForPurchase(purchaseId) {
  return db
    .prepare(
      `
    SELECT productId, quantity, isFree
    FROM purchase_items
    WHERE purchaseId = ? AND COALESCE(deletedAt,'') = ''
  `
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
  `
  ).run(licenseId, next);
  return next;
}

function getNextHoldNo(licenseId) {
  const seq = db
    .prepare(
      "SELECT lastHoldNo FROM purchase_hold_sequence WHERE licenseId = ?"
    )
    .get(licenseId);
  const next = seq ? seq.lastHoldNo + 1 : 1;
  db.prepare(
    `
    INSERT INTO purchase_hold_sequence (licenseId, lastHoldNo)
    VALUES (?, ?)
    ON CONFLICT(licenseId) DO UPDATE SET lastHoldNo = excluded.lastHoldNo
  `
  ).run(licenseId, next);
  return next;
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
        "(COALESCE(billNo,'') LIKE @q OR COALESCE(supplierName,'') LIKE @q)"
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
  `
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
    SELECT *
    FROM purchase_items
    WHERE purchaseId = ?
    ORDER BY COALESCE(lineNo, 0), createdAt
  `
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
      SELECT *
      FROM purchase_items
      WHERE purchaseId = ?
      ORDER BY COALESCE(lineNo, 0), createdAt
    `
      )
      .all(id);
    return { success: true, purchase: p, items };
  });

  // ========= CREATE PURCHASE =========
  ipcMain.handle("create-purchase", (event, purchase, items) => {
    if (!purchase?.supplierId) {
      throw new Error("Supplier is required for purchases.");
    }

    const newId = purchase.id || uuidv4();
    const now = new Date().toISOString();
    const slNo = getNextPurchaseSlNo(purchase.licenseId);

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
      batchNo, mfgDate, expiryDate, discountType, lineNo, isFree,
      createdAt, updatedAt, isSynced
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
        purchase.purchaseType || "CREDIT"
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
          salePrice || null,
          profit,
          totalCost,
          billedValue,
          effectiveUnitValue,
          item.batchNo || null,
          item.mfgDate || null,
          item.expiryDate || null,
          item.discountType || "ABS",
          item.lineNo || index + 1,
          item.isFree ? 1 : 0,
          now,
          now
        );

        if (!item.isFree) {
          db.prepare(
            `
          UPDATE products
          SET stock = COALESCE(stock, 0) + ?
          WHERE id = ?
          `
          ).run(item.quantity, item.productId);
        }
      });

      db.prepare(
        `UPDATE purchases
         SET totalAmount = ?, discount = ?
         WHERE id = ?`
      ).run(totalAmount, purchase.discount || 0, newId);

      if (purchase.purchaseType === "CREDIT" && purchase.supplierId) {
        db.prepare(
          `
        INSERT INTO supplier_transactions
        (id, licenseId, supplierId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 0)
        `
        ).run(
          uuidv4(),
          purchase.licenseId,
          purchase.supplierId,
          "PURCHASE",
          newId,
          purchase.billNo || null,
          now,
          Math.max(0, totalAmount - (purchase.discount || 0)),
          1,
          "Purchase",
          now,
          now
        );
      }
    });

    trx(purchase, items);
    return { success: true, purchaseId: newId, slNo, totalAmount };
  });

  // ========= UPDATE PURCHASE (with stock & ledger reconciliation) =========
  ipcMain.handle("purchase:update", (event, payload) => {
    const { id, header, items } = payload;
    if (!id) return { success: false, error: "id required" };

    const trx = db.transaction(() => {
      const existing = db.prepare(`SELECT * FROM purchases WHERE id=?`).get(id);
      if (!existing) throw new Error("Purchase not found");

      const now = new Date().toISOString();

      // Reverse stock from OLD items
      const oldItems = getItemsForPurchase(id);
      for (const it of oldItems) {
        if (!it.isFree) {
          db.prepare(
            `UPDATE products SET stock = COALESCE(stock,0) - ? WHERE id=?`
          ).run(it.quantity, it.productId);
        }
      }

      //  Upsert header
      const totalAmount = items.reduce(
        (s, it) => s + Number(it.billedValue || 0),
        0
      );
      const grandAmount = Math.max(
        0,
        totalAmount - Number(header.discount || 0)
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
      `
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
          barcode, mrp, batchNo, mfgDate, expiryDate, lineNo, isFree,
          effectiveUnitValue, createdAt, updatedAt, isSynced, syncedAt
        ) VALUES (
          lower(hex(randomblob(16))), @purchaseId, @productId, @quantity, @unit, @rate, @taxPercent, @taxAmount,
          @discount, @discountType, @salePrice, @profit, @totalCost, @billedValue,
          @barcode, @mrp, @batchNo, @mfgDate, @expiryDate, @lineNo, @isFree,
          @effectiveUnitValue, @now, @now, 0, NULL
        )
      `);

      items.forEach((it, idx) => {
        const lineNo = it.lineNo ?? idx + 1;
        const qty = Number(it.quantity || 0);
        const isFree = it.isFree ? 1 : 0;
        const effUnit = qty > 0 ? Number(it.billedValue || 0) / qty : 0;

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
          barcode: it.barcode ?? null,
          mrp: it.mrp ?? null,
          batchNo: it.batchNo ?? null,
          mfgDate: it.mfgDate ?? null,
          expiryDate: it.expiryDate ?? null,
          lineNo,
          isFree,
          effectiveUnitValue: effUnit,
          now,
        });

        if (!isFree) {
          db.prepare(
            `UPDATE products SET stock = COALESCE(stock,0) + ? WHERE id=?`
          ).run(qty, it.productId);
        }
      });

      db.prepare(
        `
        DELETE FROM supplier_transactions
        WHERE licenseId = @licenseId AND kind='PURCHASE' AND refId = @refId
      `
      ).run({ licenseId: header.licenseId, refId: id });

      if (header.purchaseType === "CREDIT" && header.supplierId) {
        db.prepare(
          `
          INSERT INTO supplier_transactions
          (id, licenseId, supplierId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES (lower(hex(randomblob(16))), ?, ?, 'PURCHASE', ?, ?, ?, ?, 1, 'Purchase', ?, ?, 0)
        `
        ).run(
          header.licenseId,
          header.supplierId,
          id,
          header.billNo || null,
          header.purchaseDate || now,
          grandAmount,
          now,
          now
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

  // ========= DELETE PURCHASE  =========
  ipcMain.handle("purchase:delete", (event, id) => {
    const now = new Date().toISOString();

    const trx = db.transaction(() => {
      // Reverse stock
      const items = db
        .prepare(
          `
        SELECT productId, quantity, isFree
        FROM purchase_items
        WHERE purchaseId = ? AND COALESCE(deletedAt,'') = ''
      `
        )
        .all(id);

      for (const it of items) {
        if (!it.isFree) {
          db.prepare(
            `UPDATE products SET stock = COALESCE(stock,0) - ? WHERE id=?`
          ).run(it.quantity, it.productId);
        }
      }

      db.prepare(`UPDATE purchases SET deletedAt=?, isSynced=0 WHERE id=?`).run(
        now,
        id
      );
      db.prepare(
        `UPDATE purchase_items SET deletedAt=?, isSynced=0 WHERE purchaseId=?`
      ).run(now, id);

      db.prepare(
        `
        DELETE FROM supplier_transactions
        WHERE kind='PURCHASE' AND refId=?
      `
      ).run(id);
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
    `
        )
        .all(licenseId, pageSize, offset);

      const total = db
        .prepare(
          `
      SELECT COUNT(*) as count FROM purchases
      WHERE licenseId = ? AND deletedAt IS NULL
    `
        )
        .get(licenseId).count;

      return { purchases, total };
    }
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
          `SELECT title, headerJson, rowsJson FROM purchase_holds WHERE id = ? AND deletedAt IS NULL`
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
    `
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
  `
    ).run(
      id,
      payload.licenseId,
      payload.userId || null,
      holdNo,
      payload.title || null,
      JSON.stringify(payload.header || {}),
      JSON.stringify(payload.rows || []),
      now,
      now
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
      `
        )
        .all(licenseId, pageSize, offset);

      const total = db
        .prepare(
          `
          SELECT COUNT(*) as count FROM purchase_holds
          WHERE licenseId = ? AND deletedAt IS NULL
        `
        )
        .get(licenseId).count;

      return { holds: rows, total };
    }
  );

  // ---- HOLD: get one ----
  ipcMain.handle("purchase-hold:get", (event, id) => {
    const row = db
      .prepare(
        `
      SELECT * FROM purchase_holds WHERE id = ? AND deletedAt IS NULL
    `
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
    `
    ).run(now, id);
    return { success: true };
  });

  // ---- HOLD: peek next hold no (optional) ----
  ipcMain.handle("purchase-hold:peek-next-no", (event, licenseId) => {
    const seq = db
      .prepare(
        "SELECT lastHoldNo FROM purchase_hold_sequence WHERE licenseId = ?"
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
}

module.exports = { registerPurchaseHandlers };
