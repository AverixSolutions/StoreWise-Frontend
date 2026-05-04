// electron/ipc/ProductSync.js

const { ipcMain } = require("electron");
const db = require("../db");

function registerProductSyncHandlers() {
  ipcMain.handle("bulk-upsert-products", (event, items = []) => {
    const trx = db.transaction((rows) => {
      const insertOrReplace = db.prepare(`
        INSERT INTO products (
          id, licenseId, code, codeNumber, shortCode,
          name, brand, category, subcategory, productName, model, size,
          unit, tax, hsn, costPrice, salePrice, stock, barcode,
          imagePath, imageFileName,
          createdAt, updatedAt, deletedAt, isSynced, syncedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, COALESCE(?, datetime('now')))
        ON CONFLICT(id) DO UPDATE SET
          code=excluded.code,
          codeNumber=excluded.codeNumber,
          shortCode=excluded.shortCode,
          name=excluded.name,
          brand=excluded.brand,
          category=excluded.category,
          subcategory=excluded.subcategory,
          productName=excluded.productName,
          model=excluded.model,
          size=excluded.size,
          unit=excluded.unit,
          tax=excluded.tax,
          hsn=excluded.hsn,
          costPrice=excluded.costPrice,
          salePrice=excluded.salePrice,
          stock=excluded.stock,
          barcode=excluded.barcode,
          imagePath=COALESCE(excluded.imagePath, imagePath),
          imageFileName=COALESCE(excluded.imageFileName, imageFileName),
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
          r.shortCode ?? null,
          r.name,
          r.brand ?? null,
          r.category ?? null,
          r.subcategory ?? null,
          r.productName ?? null,
          r.model ?? null,
          r.size ?? null,
          r.unit,
          r.tax,
          r.hsn ?? null,
          r.costPrice,
          r.salePrice ?? null,
          r.stock ?? 0,
          r.barcode ?? null,
          r.imagePath ?? null,
          r.imageFileName ?? null,
          r.createdAt,
          r.updatedAt,
          r.deletedAt ?? null,
          r.syncedAt ?? null,
        );
        upsertSeq.run(r.licenseId, r.codeNumber);
      }
    });

    trx(items);
    return { success: true, count: items.length };
  });

  // ── NEW: read dirty (unsynced) products for a given license ──────────────
  ipcMain.handle("get-dirty-products", (event, licenseId, limit = 200) => {
    const rows = db
      .prepare(
        `SELECT * FROM products
         WHERE licenseId = ? AND isSynced = 0
         ORDER BY updatedAt ASC
         LIMIT ?`,
      )
      .all(licenseId, limit);
    return rows;
  });

  // ── NEW: stamp a batch of products as synced after a successful push ─────
  ipcMain.handle("mark-products-synced", (event, ids = [], serverUpdatedAt) => {
    const update = db.prepare(
      `UPDATE products
       SET isSynced = 1, syncedAt = ?
       WHERE id = ?`,
    );
    const trx = db.transaction((idList) => {
      for (const id of idList) {
        update.run(serverUpdatedAt, id);
      }
    });
    trx(ids);
    return { success: true };
  });

  ipcMain.handle("sync-state:get", (event, scope = "products") => {
    return (
      db
        .prepare(
          `SELECT scope, lastPulledAt, lastPushedAt FROM sync_state WHERE scope = ?`,
        )
        .get(scope) || null
    );
  });

  ipcMain.handle(
    "sync-state:set",
    (event, scope = "products", changes = {}) => {
      try {
        const { lastPulledAt = null, lastPushedAt = null } = changes;
        db.prepare(
          `
      INSERT INTO sync_state (scope, lastPulledAt, lastPushedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(scope) DO UPDATE SET
        lastPulledAt = COALESCE(?, lastPulledAt),
        lastPushedAt = COALESCE(?, lastPushedAt)
    `,
        ).run(scope, lastPulledAt, lastPushedAt, lastPulledAt, lastPushedAt);
        return { success: true };
      } catch (err) {
        console.warn("[sync-state:set] skipped due to lock:", err.code);
        return { success: false, error: err.code };
      }
    },
  );
}

module.exports = { registerProductSyncHandlers };
