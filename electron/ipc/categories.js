// electron/ipc/categories.js
const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

function normalizeText(value) {
  return String(value || "").trim();
}

function registerCategoryHandlers() {
  // List all non-deleted categories for a license
  // Parent categories first, then children, then alphabetical
  ipcMain.handle("category:list", (event, licenseId) => {
    try {
      const safeLicenseId = normalizeText(licenseId);
      if (!safeLicenseId) {
        return { success: false, rows: [], error: "licenseId is required" };
      }

      const rows = db
        .prepare(
          `SELECT id, licenseId, name, parentId, createdAt, updatedAt
           FROM categories
           WHERE licenseId = ? AND COALESCE(deletedAt, '') = ''
           ORDER BY 
             CASE WHEN parentId IS NULL OR parentId = '' THEN 0 ELSE 1 END,
             name COLLATE NOCASE ASC`,
        )
        .all(safeLicenseId);

      return { success: true, rows };
    } catch (e) {
      return { success: false, rows: [], error: String(e?.message || e) };
    }
  });

  // Create or update a category
  ipcMain.handle("category:save", (event, payload) => {
    try {
      if (!payload || typeof payload !== "object") {
        return { success: false, error: "Invalid payload" };
      }

      const licenseId = normalizeText(payload.licenseId);
      const name = normalizeText(payload.name);
      const id = normalizeText(payload.id) || null;
      const parentId = normalizeText(payload.parentId) || null;

      if (!licenseId || !name) {
        return { success: false, error: "licenseId and name are required" };
      }

      if (id && parentId && id === parentId) {
        return { success: false, error: "Category cannot be its own parent" };
      }

      if (parentId) {
        const parent = db
          .prepare(
            `SELECT id
             FROM categories
             WHERE id = ?
               AND licenseId = ?
               AND COALESCE(deletedAt, '') = ''`,
          )
          .get(parentId, licenseId);

        if (!parent) {
          return {
            success: false,
            error: "Selected parent category does not exist",
          };
        }
      }

      const now = new Date().toISOString();

      if (id) {
        const existing = db
          .prepare(
            `SELECT id
             FROM categories
             WHERE licenseId = ?
               AND LOWER(name) = LOWER(?)
               AND COALESCE(parentId, '') = COALESCE(?, '')
               AND COALESCE(deletedAt, '') = ''
               AND id <> ?`,
          )
          .get(licenseId, name, parentId, id);

        if (existing) {
          return {
            success: false,
            error: "A category with the same name already exists here",
          };
        }

        // ── mark dirty on update ──────────────────────────────────────────
        const result = db
          .prepare(
            `UPDATE categories
             SET name = ?, parentId = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
             WHERE id = ? AND licenseId = ?`,
          )
          .run(name, parentId, now, id, licenseId);

        if (result.changes === 0) {
          return { success: false, error: "Category not found" };
        }

        return { success: true, id };
      }

      const duplicate = db
        .prepare(
          `SELECT id
           FROM categories
           WHERE licenseId = ?
             AND LOWER(name) = LOWER(?)
             AND COALESCE(parentId, '') = COALESCE(?, '')
             AND COALESCE(deletedAt, '') = ''`,
        )
        .get(licenseId, name, parentId);

      if (duplicate) {
        return {
          success: false,
          error: "A category with the same name already exists here",
        };
      }

      const newId = uuidv4();

      // ── mark dirty on insert ──────────────────────────────────────────────
      db.prepare(
        `INSERT INTO categories (
          id,
          licenseId,
          name,
          parentId,
          createdAt,
          updatedAt,
          isSynced,
          syncedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`,
      ).run(newId, licenseId, name, parentId, now, now);

      return { success: true, id: newId };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });

  // Soft-delete a category and its direct children
  ipcMain.handle("category:delete", (event, payload) => {
    try {
      const categoryId =
        typeof payload === "string"
          ? normalizeText(payload)
          : normalizeText(payload?.id);

      const licenseId =
        typeof payload === "string" ? "" : normalizeText(payload?.licenseId);

      if (!categoryId) {
        return { success: false, error: "Category id is required" };
      }

      const now = new Date().toISOString();

      const category = licenseId
        ? db
            .prepare(
              `SELECT id
               FROM categories
               WHERE id = ?
                 AND licenseId = ?
                 AND COALESCE(deletedAt, '') = ''`,
            )
            .get(categoryId, licenseId)
        : db
            .prepare(
              `SELECT id
               FROM categories
               WHERE id = ?
                 AND COALESCE(deletedAt, '') = ''`,
            )
            .get(categoryId);

      if (!category) {
        return { success: false, error: "Category not found" };
      }

      const tx = db.transaction(() => {
        if (licenseId) {
          // ── mark dirty on delete (children) ────────────────────────────
          db.prepare(
            `UPDATE categories
             SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
             WHERE parentId = ?
               AND licenseId = ?
               AND COALESCE(deletedAt, '') = ''`,
          ).run(now, now, categoryId, licenseId);

          // ── mark dirty on delete (self) ─────────────────────────────────
          db.prepare(
            `UPDATE categories
             SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
             WHERE id = ?
               AND licenseId = ?
               AND COALESCE(deletedAt, '') = ''`,
          ).run(now, now, categoryId, licenseId);
        } else {
          // ── mark dirty on delete (children, no licenseId) ───────────────
          db.prepare(
            `UPDATE categories
             SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
             WHERE parentId = ?
               AND COALESCE(deletedAt, '') = ''`,
          ).run(now, now, categoryId);

          // ── mark dirty on delete (self, no licenseId) ───────────────────
          db.prepare(
            `UPDATE categories
             SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
             WHERE id = ?
               AND COALESCE(deletedAt, '') = ''`,
          ).run(now, now, categoryId);
        }
      });

      tx();

      return { success: true };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });

  // ── Sync handlers ───────────────────────────────────────────────────────────

  ipcMain.handle("category:getDirty", (event, licenseId, limit = 200) => {
    try {
      return db
        .prepare(
          `SELECT *
           FROM categories
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

  ipcMain.handle("category:markSynced", (event, ids, serverSyncedAt) => {
    try {
      const ts = serverSyncedAt || new Date().toISOString();
      const stmt = db.prepare(
        `UPDATE categories SET isSynced = 1, syncedAt = ? WHERE id = ?`,
      );
      db.transaction((list) => list.forEach((id) => stmt.run(ts, id)))(ids);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });

  ipcMain.handle("category:bulkUpsert", (event, items = []) => {
    try {
      // Parents must be inserted before children — sort nulls/empty parentId first
      const sorted = [...items].sort((a, b) => {
        const aIsChild = a.parentId ? 1 : 0;
        const bIsChild = b.parentId ? 1 : 0;
        return aIsChild - bIsChild;
      });

      const stmt = db.prepare(
        `INSERT INTO categories (id, licenseId, name, parentId, createdAt, updatedAt, deletedAt, isSynced, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(id) DO UPDATE SET
           name      = excluded.name,
           parentId  = excluded.parentId,
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
            r.parentId ?? null,
            r.createdAt,
            r.updatedAt,
            r.deletedAt ?? null,
            r.syncedAt ?? null,
          );
        }
      })(sorted);
      return { success: true, count: items.length };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });
}

module.exports = { registerCategoryHandlers };
