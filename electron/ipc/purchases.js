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

function registerPurchaseHandlers() {
  // Create a purchase with items
  ipcMain.handle("create-purchase", (event, purchase, items) => {
    const newId = purchase.id || uuidv4();
    const now = new Date().toISOString();
    const slNo = getNextPurchaseSlNo(purchase.licenseId);

    let totalAmount = 0;

    const insertPurchase = db.prepare(`
      INSERT INTO purchases (
        id, slNo, userId, licenseId, billNo, supplierName, department,
        debitAccount, natureOfEntry, purchaseDate, entryTime,
        totalAmount, discount, createdAt, isSynced
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const insertItem = db.prepare(`
      INSERT INTO purchase_items (
        id, purchaseId, productId, barcode, quantity, unit, rate, mrp,
        taxPercent, taxAmount, discount, salePrice, profit, totalCost, billedValue,
        createdAt, updatedAt, isSynced
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const trx = db.transaction((purchase, items) => {
      items.forEach((item) => {
        const taxPercentValue = parseInt(item.taxPercent.replace("P", "")) || 0;
        const taxAmount = item.rate * item.quantity * (taxPercentValue / 100);
        const totalCost = item.rate * item.quantity + taxAmount;

        // profit% → salePrice
        let salePrice = item.salePrice;
        if (item.profitPercent) {
          salePrice =
            (item.rate + taxAmount / item.quantity) *
            (1 + item.profitPercent / 100);
        }

        const profit = salePrice
          ? salePrice - (item.rate + taxAmount / item.quantity)
          : null;
        const billedValue = totalCost - (item.discount || 0);

        totalAmount += billedValue;

        insertItem.run(
          uuidv4(),
          newId,
          item.productId,
          item.barcode || item.code,
          item.quantity,
          item.unit,
          item.rate,
          item.mrp || null,
          item.taxPercent,
          taxAmount,
          item.discount || 0,
          salePrice || null,
          profit,
          totalCost,
          billedValue,
          now,
          now
        );
      });

      insertPurchase.run(
        newId,
        slNo,
        purchase.userId,
        purchase.licenseId,
        purchase.billNo || null,
        purchase.supplierName || null,
        purchase.department || null,
        purchase.debitAccount || null,
        purchase.natureOfEntry || null,
        purchase.purchaseDate || now,
        purchase.entryTime || now,
        totalAmount,
        purchase.discount || 0,
        now
      );
    });

    trx(purchase, items);
    return { success: true, purchaseId: newId, slNo, totalAmount };
  });

  // Get purchases
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

  // Mark purchases as synced
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
}

module.exports = { registerPurchaseHandlers };
