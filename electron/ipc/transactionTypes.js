// electron/ipc/transactionTypes.js
const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

function registerTransactionTypeHandlers() {
  // ── List types for a given category ────────────────────────────────────────
  ipcMain.handle("txn-type:list", (event, { licenseId, category }) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT id, licenseId, name, code, category, isDefault, sortOrder,
                 createdAt, updatedAt
          FROM transaction_types
          WHERE licenseId = ?
            AND category  = ?
            AND COALESCE(deletedAt, '') = ''
          ORDER BY sortOrder ASC, name ASC
        `,
        )
        .all(licenseId, category);

      return { success: true, rows };
    } catch (e) {
      console.error("[txn-type:list]", e);
      return { success: false, error: e.message };
    }
  });

  // ── List ALL categories for a license (useful for settings page) ───────────
  ipcMain.handle("txn-type:list-all", (event, { licenseId }) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT id, licenseId, name, code, category, isDefault, sortOrder,
                 createdAt, updatedAt
          FROM transaction_types
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
          ORDER BY category ASC, sortOrder ASC, name ASC
        `,
        )
        .all(licenseId);

      return { success: true, rows };
    } catch (e) {
      console.error("[txn-type:list-all]", e);
      return { success: false, error: e.message };
    }
  });

  // ── Get single type by id ──────────────────────────────────────────────────
  ipcMain.handle("txn-type:get", (event, { id, licenseId }) => {
    try {
      const row = db
        .prepare(
          `
          SELECT id, licenseId, name, code, category, isDefault, sortOrder,
                 createdAt, updatedAt
          FROM transaction_types
          WHERE id = ? AND licenseId = ? AND COALESCE(deletedAt, '') = ''
        `,
        )
        .get(id, licenseId);

      return { success: true, row: row ?? null };
    } catch (e) {
      console.error("[txn-type:get]", e);
      return { success: false, error: e.message };
    }
  });

  // ── Create or Update ───────────────────────────────────────────────────────
  ipcMain.handle("txn-type:save", (event, payload) => {
    try {
      const {
        id,
        licenseId,
        name,
        code,
        category,
        isDefault = false,
        sortOrder = 999,
      } = payload;

      const now = new Date().toISOString();

      // Trim & normalise — empty string code becomes NULL so the partial
      // unique index stays clean
      const cleanCode =
        typeof code === "string" && code.trim() !== ""
          ? code.trim().toUpperCase()
          : null;

      if (id) {
        // ── Update existing ──────────────────────────────────────────────
        const existing = db
          .prepare(
            `SELECT id FROM transaction_types WHERE id = ? AND licenseId = ?`,
          )
          .get(id, licenseId);

        if (!existing) {
          return { success: false, error: "Record not found" };
        }

        db.prepare(
          `
          UPDATE transaction_types
          SET name      = ?,
              code      = ?,
              isDefault = ?,
              sortOrder = ?,
              updatedAt = ?,
              isSynced  = 0,
              syncedAt  = NULL
          WHERE id = ? AND licenseId = ?
        `,
        ).run(
          name.trim(),
          cleanCode,
          isDefault ? 1 : 0,
          sortOrder,
          now,
          id,
          licenseId,
        );

        return { success: true, id };
      }

      // ── Create new ──────────────────────────────────────────────────────
      const newId = uuidv4();

      db.prepare(
        `
        INSERT INTO transaction_types
          (id, licenseId, name, code, category, isDefault, sortOrder,
           createdAt, updatedAt, isSynced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      ).run(
        newId,
        licenseId,
        name.trim(),
        cleanCode,
        category,
        isDefault ? 1 : 0,
        sortOrder,
        now,
        now,
      );

      return { success: true, id: newId };
    } catch (e) {
      console.error("[txn-type:save]", e);
      // Surface duplicate name / code constraint clearly
      if (e.message?.includes("UNIQUE")) {
        return {
          success: false,
          error:
            "A type with this name or code already exists for this category.",
        };
      }
      return { success: false, error: e.message };
    }
  });

  // ── Set as default (clears previous default for same category) ─────────────
  ipcMain.handle(
    "txn-type:set-default",
    (event, { id, licenseId, category }) => {
      try {
        const now = new Date().toISOString();

        db.transaction(() => {
          // Clear existing default for this category
          db.prepare(
            `
            UPDATE transaction_types
            SET isDefault = 0, updatedAt = ?, isSynced = 0, syncedAt = NULL
            WHERE licenseId = ? AND category = ? AND isDefault = 1
          `,
          ).run(now, licenseId, category);

          // Set new default
          db.prepare(
            `
            UPDATE transaction_types
            SET isDefault = 1, updatedAt = ?, isSynced = 0, syncedAt = NULL
            WHERE id = ? AND licenseId = ?
          `,
          ).run(now, id, licenseId);
        })();

        return { success: true };
      } catch (e) {
        console.error("[txn-type:set-default]", e);
        return { success: false, error: e.message };
      }
    },
  );

  // ── Soft delete ────────────────────────────────────────────────────────────
  ipcMain.handle("txn-type:delete", (event, { id, licenseId }) => {
    try {
      const row = db
        .prepare(
          `SELECT isDefault FROM transaction_types WHERE id = ? AND licenseId = ?`,
        )
        .get(id, licenseId);

      if (!row) {
        return { success: false, error: "Record not found" };
      }

      if (row.isDefault) {
        return {
          success: false,
          error:
            "Cannot delete the default type. Set another type as default first.",
        };
      }

      const now = new Date().toISOString();

      db.prepare(
        `
        UPDATE transaction_types
        SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
        WHERE id = ? AND licenseId = ?
      `,
      ).run(now, now, id, licenseId);

      return { success: true };
    } catch (e) {
      console.error("[txn-type:delete]", e);
      return { success: false, error: e.message };
    }
  });

  // ── Get the default type for a category (used when opening a new bill) ─────
  ipcMain.handle("txn-type:get-default", (event, { licenseId, category }) => {
    try {
      const row = db
        .prepare(
          `
          SELECT id, name, code, category, isDefault, sortOrder
          FROM transaction_types
          WHERE licenseId = ?
            AND category  = ?
            AND isDefault = 1
            AND COALESCE(deletedAt, '') = ''
          LIMIT 1
        `,
        )
        .get(licenseId, category);

      return { success: true, row: row ?? null };
    } catch (e) {
      console.error("[txn-type:get-default]", e);
      return { success: false, error: e.message };
    }
  });

  // ── Sync: get dirty ────────────────────────────────────────────────────────
  ipcMain.handle("txn-type:get-dirty", (event, { licenseId, limit = 200 }) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT * FROM transaction_types
          WHERE licenseId = ?
            AND (isSynced = 0 OR isSynced IS NULL)
          ORDER BY updatedAt ASC
          LIMIT ?
        `,
        )
        .all(licenseId, limit);
      return rows;
    } catch (e) {
      console.error("[txn-type:get-dirty]", e);
      return [];
    }
  });

  // ── Sync: mark synced ──────────────────────────────────────────────────────
  ipcMain.handle("txn-type:mark-synced", (event, { ids, ts }) => {
    try {
      const stmt = db.prepare(
        `UPDATE transaction_types SET isSynced = 1, syncedAt = ? WHERE id = ?`,
      );
      db.transaction(() => {
        for (const id of ids) stmt.run(ts, id);
      })();
      return { success: true };
    } catch (e) {
      console.error("[txn-type:mark-synced]", e);
      return { success: false, error: e.message };
    }
  });

  // ── Sync: bulk upsert from server ──────────────────────────────────────────
  ipcMain.handle("txn-type:bulk-upsert", (event, records) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO transaction_types
          (id, licenseId, name, code, category, isDefault, sortOrder,
           createdAt, updatedAt, deletedAt, isSynced, syncedAt)
        VALUES
          (@id, @licenseId, @name, @code, @category, @isDefault, @sortOrder,
           @createdAt, @updatedAt, @deletedAt, 1, @syncedAt)
        ON CONFLICT(id) DO UPDATE SET
          name      = excluded.name,
          code      = excluded.code,
          isDefault = excluded.isDefault,
          sortOrder = excluded.sortOrder,
          updatedAt = excluded.updatedAt,
          deletedAt = excluded.deletedAt,
          isSynced  = 1,
          syncedAt  = excluded.syncedAt
        WHERE excluded.updatedAt > transaction_types.updatedAt
          OR  transaction_types.isSynced = 1
      `);

      const now = new Date().toISOString();
      db.transaction(() => {
        for (const r of records) {
          stmt.run({
            id: r.id,
            licenseId: r.licenseId,
            name: r.name,
            code: r.code ?? null,
            category: r.category,
            isDefault: r.isDefault ? 1 : 0,
            sortOrder: r.sortOrder ?? 999,
            createdAt: r.createdAt ?? now,
            updatedAt: r.updatedAt ?? now,
            deletedAt: r.deletedAt ?? null,
            syncedAt: now,
          });
        }
      })();

      return { success: true };
    } catch (e) {
      console.error("[txn-type:bulk-upsert]", e);
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerTransactionTypeHandlers };
