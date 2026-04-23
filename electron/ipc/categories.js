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

        const result = db
          .prepare(
            `UPDATE categories
             SET name = ?, parentId = ?, updatedAt = ?
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

      db.prepare(
        `INSERT INTO categories (
          id,
          licenseId,
          name,
          parentId,
          createdAt,
          updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?)`,
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
          db.prepare(
            `UPDATE categories
             SET deletedAt = ?, updatedAt = ?
             WHERE parentId = ?
               AND licenseId = ?
               AND COALESCE(deletedAt, '') = ''`,
          ).run(now, now, categoryId, licenseId);

          db.prepare(
            `UPDATE categories
             SET deletedAt = ?, updatedAt = ?
             WHERE id = ?
               AND licenseId = ?
               AND COALESCE(deletedAt, '') = ''`,
          ).run(now, now, categoryId, licenseId);
        } else {
          db.prepare(
            `UPDATE categories
             SET deletedAt = ?, updatedAt = ?
             WHERE parentId = ?
               AND COALESCE(deletedAt, '') = ''`,
          ).run(now, now, categoryId);

          db.prepare(
            `UPDATE categories
             SET deletedAt = ?, updatedAt = ?
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
}

module.exports = { registerCategoryHandlers };
