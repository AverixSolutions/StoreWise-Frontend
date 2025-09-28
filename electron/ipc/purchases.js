// electron/ipc/purchases.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

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

function registerPurchaseHandlers() {
  ipcMain.handle("create-purchase", (event, purchase, items) => {
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
}

ipcMain.handle("purchase:peek-next-slno", (event, licenseId) => {
  const seq = db
    .prepare("SELECT lastSlNo FROM purchase_sequence WHERE licenseId = ?")
    .get(licenseId);
  const nextSlNo = seq ? seq.lastSlNo + 1 : 1;
  return { nextSlNo };
});

module.exports = { registerPurchaseHandlers };
