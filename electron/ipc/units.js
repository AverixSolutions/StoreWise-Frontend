// electron/ipc/units.js
const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const DEFAULT_UNITS = [
  { code: "KG", label: "Kilograms", sortOrder: 1 },
  { code: "NOS", label: "Numbers", sortOrder: 2 },
  { code: "LTR", label: "Liters", sortOrder: 3 },
  { code: "MTR", label: "Meters", sortOrder: 4 },
];

function seedDefaults(licenseId) {
  const ts = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO units (id, licenseId, code, label, isDefault, sortOrder, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const u of DEFAULT_UNITS) {
      insert.run(uuidv4(), licenseId, u.code, u.label, u.sortOrder, ts, ts);
    }
  })();
}

function registerUnitHandlers() {
  ipcMain.handle("unit:list", (event, licenseId) => {
    try {
      if (!licenseId)
        return { success: false, rows: [], error: "licenseId required" };

      // Lazy-seed defaults on first access per license
      const hasDefaults = db
        .prepare(
          `SELECT 1 FROM units WHERE licenseId=? AND isDefault=1 LIMIT 1`,
        )
        .get(licenseId);
      if (!hasDefaults) seedDefaults(licenseId);

      const rows = db
        .prepare(
          `
          SELECT id, licenseId, code, label, isDefault, sortOrder, createdAt, updatedAt
          FROM units
          WHERE licenseId=? AND COALESCE(deletedAt,'')=''
          ORDER BY sortOrder ASC, label COLLATE NOCASE ASC
        `,
        )
        .all(licenseId);

      return { success: true, rows };
    } catch (e) {
      return { success: false, rows: [], error: String(e?.message || e) };
    }
  });

  ipcMain.handle("unit:save", (event, payload) => {
    try {
      const { id, licenseId, code, label } = payload || {};
      const trimCode = String(code || "")
        .trim()
        .toUpperCase();
      const trimLabel = String(label || "").trim();

      if (!licenseId || !trimCode || !trimLabel) {
        return {
          success: false,
          error: "licenseId, code and label are required",
        };
      }

      if (!/^[A-Z0-9_-]{1,20}$/.test(trimCode)) {
        return {
          success: false,
          error: "Code must be 1-20 uppercase letters/numbers (- _ allowed)",
        };
      }

      const now = new Date().toISOString();

      if (id) {
        // Edit — cannot change code of a default unit
        const existing = db
          .prepare(`SELECT * FROM units WHERE id=? LIMIT 1`)
          .get(id);
        if (!existing) return { success: false, error: "Unit not found" };
        if (existing.isDefault && existing.code !== trimCode) {
          return {
            success: false,
            error: "Cannot change the code of a built-in unit",
          };
        }

        // Check code uniqueness if changed
        const conflict = db
          .prepare(
            `SELECT id FROM units WHERE licenseId=? AND code=? AND id<>? AND COALESCE(deletedAt,'')='' LIMIT 1`,
          )
          .get(licenseId, trimCode, id);
        if (conflict)
          return {
            success: false,
            error: `Code "${trimCode}" is already in use`,
          };

        // FIX: mark dirty on update so the sync engine picks up the change
        db.prepare(
          `UPDATE units SET code=?, label=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE id=? AND licenseId=?`,
        ).run(trimCode, trimLabel, now, id, licenseId);

        return { success: true, id };
      }

      // Create new
      const duplicate = db
        .prepare(
          `SELECT id FROM units WHERE licenseId=? AND code=? AND COALESCE(deletedAt,'')='' LIMIT 1`,
        )
        .get(licenseId, trimCode);
      if (duplicate)
        return { success: false, error: `Code "${trimCode}" already exists` };

      const newId = uuidv4();
      // FIX: mark dirty on insert so the sync engine picks up the new row
      db.prepare(
        `
        INSERT INTO units (id, licenseId, code, label, isDefault, sortOrder, createdAt, updatedAt, isSynced, syncedAt)
        VALUES (?, ?, ?, ?, 0, 999, ?, ?, 0, NULL)
      `,
      ).run(newId, licenseId, trimCode, trimLabel, now, now);

      return { success: true, id: newId };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });

  ipcMain.handle("unit:delete", (event, id) => {
    try {
      if (!id) return { success: false, error: "id required" };

      const unit = db
        .prepare(
          `SELECT * FROM units WHERE id=? AND COALESCE(deletedAt,'')='' LIMIT 1`,
        )
        .get(id);
      if (!unit) return { success: false, error: "Unit not found" };
      if (unit.isDefault)
        return { success: false, error: "Built-in units cannot be deleted" };

      // Check usage
      const usage = db
        .prepare(
          `SELECT COUNT(*) AS c FROM products WHERE licenseId=? AND unit=? AND COALESCE(deletedAt,'')=''`,
        )
        .get(unit.licenseId, unit.code);
      if (Number(usage?.c || 0) > 0) {
        return {
          success: false,
          error: `Unit is used by ${usage.c} product(s) — reassign first`,
        };
      }

      const now = new Date().toISOString();
      // FIX: mark dirty on delete so the sync engine propagates the soft-delete
      db.prepare(
        `UPDATE units SET deletedAt=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE id=?`,
      ).run(now, now, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });

  // ---------------------------------------------------------------------------
  // Sync IPC handlers
  // ---------------------------------------------------------------------------

  ipcMain.handle("unit:getDirty", (event, licenseId, limit = 200) => {
    try {
      return db
        .prepare(
          `SELECT * FROM units
         WHERE licenseId = ?
           AND (syncedAt IS NULL OR updatedAt > syncedAt
                OR (deletedAt IS NOT NULL AND (syncedAt IS NULL OR deletedAt > syncedAt)))
         ORDER BY updatedAt ASC LIMIT ?`,
        )
        .all(licenseId, limit);
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle("unit:markSynced", (event, ids, serverSyncedAt) => {
    try {
      const ts = serverSyncedAt || new Date().toISOString();
      const stmt = db.prepare(
        `UPDATE units SET isSynced = 1, syncedAt = ? WHERE id = ?`,
      );
      db.transaction((list) => list.forEach((id) => stmt.run(ts, id)))(ids);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });

  ipcMain.handle("unit:bulkUpsert", (event, items = []) => {
    console.log(
      "[unit:bulkUpsert] received",
      items.length,
      "items",
      JSON.stringify(items.map((i) => i.code)),
    );
    try {
      db.transaction((rows) => {
        for (const r of rows) {
          console.log("[unit:bulkUpsert] processing", r.code, r.id);
          const existingByCode = db
            .prepare(
              `SELECT id FROM units WHERE licenseId=? AND code=? AND id<>? LIMIT 1`,
            )
            .get(r.licenseId, r.code, r.id);

          if (existingByCode) {
            console.log(
              "[unit:bulkUpsert] deleting conflicting id",
              existingByCode.id,
              "for code",
              r.code,
            );
            db.prepare(`DELETE FROM units WHERE id=?`).run(existingByCode.id);
          }

          db.prepare(
            `INSERT INTO units (id, licenseId, code, label, isDefault, sortOrder, createdAt, updatedAt, deletedAt, isSynced, syncedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
           ON CONFLICT(id) DO UPDATE SET
             code=excluded.code, label=excluded.label,
             isDefault=excluded.isDefault, sortOrder=excluded.sortOrder,
             updatedAt=excluded.updatedAt, deletedAt=excluded.deletedAt,
             isSynced=1, syncedAt=excluded.syncedAt`,
          ).run(
            r.id,
            r.licenseId,
            r.code,
            r.label,
            r.isDefault ? 1 : 0, // ← convert boolean to integer
            r.sortOrder ?? 999,
            r.createdAt,
            r.updatedAt,
            r.deletedAt ?? null,
            r.syncedAt ?? null,
          );

          console.log("[unit:bulkUpsert] upserted", r.code, r.id);
        }
      })(items);

      console.log(
        "[unit:bulkUpsert] transaction complete, count:",
        items.length,
      );
      return { success: true, count: items.length };
    } catch (e) {
      console.error("[unit:bulkUpsert] error:", e?.message || e);
      return { success: false, error: String(e?.message || e) };
    }
  });
}

module.exports = { registerUnitHandlers };
