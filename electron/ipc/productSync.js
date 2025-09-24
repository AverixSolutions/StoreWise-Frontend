// electron/ipc/ProductSync.js

const { ipcMain } = require("electron");
const db = require("../db");

function registerProductSyncHandlers() {
  ipcMain.handle("bulk-upsert-products", (event, items = []) => {
    const trx = db.transaction((rows) => {
      const insertOrReplace = db.prepare(`
        INSERT INTO products (
          id, licenseId, code, codeNumber, name, brand, category, unit, tax, hsn,
          costPrice, salePrice, stock, barcode, createdAt, updatedAt, deletedAt, isSynced, syncedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, COALESCE(?, datetime('now')))
        ON CONFLICT(id) DO UPDATE SET
          code=excluded.code,
          codeNumber=excluded.codeNumber,
          name=excluded.name,
          brand=excluded.brand,
          category=excluded.category,
          unit=excluded.unit,
          tax=excluded.tax,
          hsn=excluded.hsn,
          costPrice=excluded.costPrice,
          salePrice=excluded.salePrice,
          stock=excluded.stock,
          barcode=excluded.barcode,
          updatedAt=excluded.updatedAt,
          deletedAt=excluded.deletedAt,
          isSynced=1,
          syncedAt=excluded.syncedAt
      `);

      const upsertSeq = db.prepare(`
        INSERT INTO code_sequence (licenseId, lastCodeNumber)
        VALUES (?, ?)
        ON CONFLICT(licenseId) DO UPDATE SET lastCodeNumber = MAX(lastCodeNumber, excluded.lastCodeNumber)
      `);

      for (const r of rows) {
        insertOrReplace.run(
          r.id,
          r.licenseId,
          r.code,
          r.codeNumber,
          r.name,
          r.brand,
          r.category,
          r.unit,
          r.tax,
          r.hsn,
          r.costPrice,
          r.salePrice,
          r.stock,
          r.barcode ?? null,
          r.createdAt,
          r.updatedAt,
          r.deletedAt,
          r.syncedAt
        );
        upsertSeq.run(r.licenseId, r.codeNumber);
      }
    });

    trx(items);
    return { success: true, count: items.length };
  });

  ipcMain.handle("sync-state:get", (event, scope = "products") => {
    return (
      db
        .prepare(
          `SELECT scope, lastPulledAt, lastPushedAt FROM sync_state WHERE scope = ?`
        )
        .get(scope) || null
    );
  });

  ipcMain.handle(
    "sync-state:set",
    (event, scope = "products", changes = {}) => {
      const { lastPulledAt = null, lastPushedAt = null } = changes;
      db.prepare(
        `
      INSERT INTO sync_state (scope, lastPulledAt, lastPushedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(scope) DO UPDATE SET
        lastPulledAt = COALESCE(?, lastPulledAt),
        lastPushedAt = COALESCE(?, lastPushedAt)
    `
      ).run(scope, lastPulledAt, lastPushedAt, lastPulledAt, lastPushedAt);
      return { success: true };
    }
  );
}

module.exports = { registerProductSyncHandlers };
