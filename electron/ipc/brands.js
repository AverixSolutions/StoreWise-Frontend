// electron/ipc/brands.j
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
        const result = db
          .prepare(
            `
            UPDATE brands
            SET name = ?, updatedAt = ?, deletedAt = NULL
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

      db.prepare(
        `
        INSERT INTO brands (id, licenseId, name, createdAt, updatedAt, deletedAt)
        VALUES (?, ?, ?, ?, ?, NULL)
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

      db.prepare(
        `
        UPDATE brands
        SET deletedAt = ?, updatedAt = ?
        WHERE id = ?
      `,
      ).run(now, now, id);

      return { success: true };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });
}

module.exports = { registerBrandHandlers };
