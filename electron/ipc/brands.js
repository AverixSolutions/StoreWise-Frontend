// electron/ipc/brands.js
const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

function registerBrandHandlers() {
  // List all non-deleted brands for a license
  ipcMain.handle("brand:list", (event, licenseId) => {
    try {
      if (!licenseId) {
        return { success: false, rows: [], error: "licenseId is required" };
      }

      const rows = db
        .prepare(
          `
          SELECT id, licenseId, name, createdAt, updatedAt, deletedAt
          FROM brands
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
          ORDER BY name COLLATE NOCASE ASC
        `,
        )
        .all(licenseId);

      return { success: true, rows };
    } catch (e) {
      return { success: false, rows: [], error: String(e?.message || e) };
    }
  });

  // Create or update a brand
  ipcMain.handle("brand:save", (event, payload) => {
    try {
      const { id, licenseId, name } = payload || {};
      const trimmedName = String(name || "").trim();

      if (!licenseId || !trimmedName) {
        return { success: false, error: "licenseId and name are required" };
      }

      const duplicate = db
        .prepare(
          `
          SELECT id
          FROM brands
          WHERE licenseId = ?
            AND lower(name) = lower(?)
            AND COALESCE(deletedAt, '') = ''
            AND id <> ?
          LIMIT 1
        `,
        )
        .get(licenseId, trimmedName, id || "");

      if (duplicate) {
        return { success: false, error: "Brand already exists" };
      }

      const now = new Date().toISOString();

      if (id) {
        // ── mark dirty on update ──────────────────────────────────────────
        const result = db
          .prepare(
            `
            UPDATE brands
            SET name = ?, updatedAt = ?, deletedAt = NULL, isSynced = 0, syncedAt = NULL
            WHERE id = ? AND licenseId = ?
          `,
          )
          .run(trimmedName, now, id, licenseId);

        if (result.changes === 0) {
          return { success: false, error: "Brand not found" };
        }

        return { success: true, id };
      }

      const newId = uuidv4();

      // ── mark dirty on insert ──────────────────────────────────────────────
      db.prepare(
        `
        INSERT INTO brands (id, licenseId, name, createdAt, updatedAt, deletedAt, isSynced, syncedAt)
        VALUES (?, ?, ?, ?, ?, NULL, 0, NULL)
      `,
      ).run(newId, licenseId, trimmedName, now, now);

      return { success: true, id: newId };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });

  // Soft delete a brand only if no live products still use it
  ipcMain.handle("brand:delete", (event, id) => {
    try {
      if (!id) {
        return { success: false, error: "id is required" };
      }

      const brand = db
        .prepare(
          `
          SELECT id, licenseId, name
          FROM brands
          WHERE id = ?
            AND COALESCE(deletedAt, '') = ''
          LIMIT 1
        `,
        )
        .get(id);

      if (!brand) {
        return { success: false, error: "Brand not found" };
      }

      const usage = db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM products
          WHERE licenseId = ?
            AND brand IS NOT NULL
            AND lower(brand) = lower(?)
            AND COALESCE(deletedAt, '') = ''
        `,
        )
        .get(brand.licenseId, brand.name);

      if (Number(usage?.count || 0) > 0) {
        return {
          success: false,
          error: `Brand is used by ${usage.count} product(s)`,
        };
      }

      const now = new Date().toISOString();

      // ── mark dirty on delete ──────────────────────────────────────────────
      db.prepare(
        `
        UPDATE brands
        SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
        WHERE id = ?
      `,
      ).run(now, now, id);

      return { success: true };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });

  // ── Sync handlers ───────────────────────────────────────────────────────────

  ipcMain.handle("brand:getDirty", (event, licenseId, limit = 200) => {
    try {
      return db
        .prepare(
          `SELECT *
           FROM brands
           WHERE licenseId = ?
             AND (
               syncedAt IS NULL
               OR updatedAt > syncedAt
               OR (deletedAt IS NOT NULL AND (syncedAt IS NULL OR deletedAt > syncedAt))
             )
           ORDER BY updatedAt ASC
           LIMIT ?`,
        )
        .all(licenseId, limit);
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle("brand:markSynced", (event, ids, serverSyncedAt) => {
    try {
      const ts = serverSyncedAt || new Date().toISOString();
      const stmt = db.prepare(
        `UPDATE brands SET isSynced = 1, syncedAt = ? WHERE id = ?`,
      );
      db.transaction((list) => list.forEach((id) => stmt.run(ts, id)))(ids);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });

  ipcMain.handle("brand:bulkUpsert", (event, items = []) => {
    try {
      const stmt = db.prepare(
        `INSERT INTO brands (id, licenseId, name, createdAt, updatedAt, deletedAt, isSynced, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(id) DO UPDATE SET
           name      = excluded.name,
           updatedAt = excluded.updatedAt,
           deletedAt = excluded.deletedAt,
           isSynced  = 1,
           syncedAt  = excluded.syncedAt`,
      );
      db.transaction((rows) => {
        for (const r of rows) {
          stmt.run(
            r.id,
            r.licenseId,
            r.name,
            r.createdAt,
            r.updatedAt,
            r.deletedAt ?? null,
            r.syncedAt ?? null,
          );
        }
      })(items);
      return { success: true, count: items.length };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });
}

module.exports = { registerBrandHandlers };
