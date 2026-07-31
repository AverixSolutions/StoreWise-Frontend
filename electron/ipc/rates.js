const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const RATE_COLUMNS = `
  id, licenseId, code, name, isDefault, isActive, sortOrder,
  createdAt, updatedAt, deletedAt, isSynced, syncedAt
`;

function requiredLicenseId(licenseId) {
  const value = String(licenseId || "").trim();
  if (!value) throw new Error("licenseId required");
  return value;
}

function ensureDefaultRate(licenseId) {
  const scopedLicenseId = requiredLicenseId(licenseId);
  const current = db
    .prepare(`
      SELECT * FROM rate_types
      WHERE licenseId=? AND isDefault=1 AND isActive=1 AND deletedAt IS NULL
      ORDER BY updatedAt DESC, id ASC LIMIT 1
    `)
    .get(scopedLicenseId);
  if (current) return current;

  const now = new Date().toISOString();
  let candidate = db
    .prepare(`
      SELECT * FROM rate_types
      WHERE licenseId=? AND code='RETAIL' COLLATE NOCASE
        AND deletedAt IS NULL
      LIMIT 1
    `)
    .get(scopedLicenseId);
  if (!candidate) {
    const id = `retail-${scopedLicenseId}`;
    db.prepare(`
      INSERT INTO rate_types (
        id, licenseId, code, name, isDefault, isActive, sortOrder,
        createdAt, updatedAt, isSynced, syncedAt
      ) VALUES (?, ?, 'RETAIL', 'Retail', 1, 1, 0, ?, ?, 0, NULL)
    `).run(id, scopedLicenseId, now, now);
    candidate = db.prepare(`SELECT * FROM rate_types WHERE id=?`).get(id);
  } else {
    db.prepare(`
      UPDATE rate_types
      SET isDefault=1, isActive=1, updatedAt=?, isSynced=0, syncedAt=NULL
      WHERE id=? AND licenseId=?
    `).run(now, candidate.id, scopedLicenseId);
    candidate = { ...candidate, isDefault: 1, isActive: 1, updatedAt: now };
  }
  return candidate;
}

function refreshCompatibilityMirrors(licenseId, rateTypeId, now) {
  db.prepare(`
    UPDATE products
    SET salePrice=NULL, updatedAt=?, isSynced=0, syncedAt=NULL
    WHERE licenseId=?
  `).run(now, licenseId);
  db.prepare(`
    UPDATE products
    SET salePrice=(
      SELECT pr.amount FROM product_rates pr
      WHERE pr.productId=products.id AND pr.rateTypeId=?
        AND pr.licenseId=? AND pr.deletedAt IS NULL
      LIMIT 1
    ), updatedAt=?, isSynced=0, syncedAt=NULL
    WHERE licenseId=?
  `).run(rateTypeId, licenseId, now, licenseId);

  db.prepare(`
    UPDATE product_batches
    SET salePrice=NULL, updatedAt=?
    WHERE licenseId=?
  `).run(now, licenseId);
  db.prepare(`
    UPDATE product_batches
    SET salePrice=COALESCE(
      (
        SELECT pbr.amount FROM product_batch_rates pbr
        WHERE pbr.batchId=product_batches.id AND pbr.rateTypeId=?
          AND pbr.licenseId=? AND pbr.deletedAt IS NULL
        LIMIT 1
      ),
      (
        SELECT pr.amount FROM product_rates pr
        WHERE pr.productId=product_batches.productId AND pr.rateTypeId=?
          AND pr.licenseId=? AND pr.deletedAt IS NULL
        LIMIT 1
      )
    ), updatedAt=?
    WHERE licenseId=?
  `).run(
    rateTypeId,
    licenseId,
    rateTypeId,
    licenseId,
    now,
    licenseId,
  );
}

const setDefaultTransaction = db.transaction((licenseId, rateTypeId, synced) => {
  const scopedLicenseId = requiredLicenseId(licenseId);
  const rate = db
    .prepare(`
      SELECT * FROM rate_types
      WHERE id=? AND licenseId=? AND isActive=1 AND deletedAt IS NULL
    `)
    .get(rateTypeId, scopedLicenseId);
  if (!rate) throw new Error("Only an active rate can be set as default");
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE rate_types
    SET isDefault=0, updatedAt=?, isSynced=?, syncedAt=?
    WHERE licenseId=? AND isDefault=1 AND id<>?
  `).run(now, synced ? 1 : 0, synced ? now : null, scopedLicenseId, rateTypeId);
  db.prepare(`
    UPDATE rate_types
    SET isDefault=1, updatedAt=?, isSynced=?, syncedAt=?
    WHERE id=? AND licenseId=?
  `).run(now, synced ? 1 : 0, synced ? now : null, rateTypeId, scopedLicenseId);
  refreshCompatibilityMirrors(scopedLicenseId, rateTypeId, now);
  return rateTypeId;
});

function assertProduct(licenseId, productId) {
  const row = db
    .prepare(`SELECT id FROM products WHERE id=? AND licenseId=? AND deletedAt IS NULL`)
    .get(productId, licenseId);
  if (!row) throw new Error("Product not found for this license");
}

function assertBatch(licenseId, productId, batchId) {
  const row = db
    .prepare(`
      SELECT id FROM product_batches
      WHERE id=? AND productId=? AND licenseId=? AND deletedAt IS NULL
    `)
    .get(batchId, productId, licenseId);
  if (!row) throw new Error("Batch not found for this product and license");
}

function assertRateType(licenseId, rateTypeId) {
  const row = db
    .prepare(`
      SELECT id, isDefault FROM rate_types
      WHERE id=? AND licenseId=? AND deletedAt IS NULL
    `)
    .get(rateTypeId, licenseId);
  if (!row) throw new Error("Rate type not found for this license");
  return row;
}

function saveRateValues({ table, ownerColumn, ownerId, licenseId, productId, rates }) {
  const scopedLicenseId = requiredLicenseId(licenseId);
  assertProduct(scopedLicenseId, productId);
  if (ownerColumn === "batchId") {
    assertBatch(scopedLicenseId, productId, ownerId);
  }
  if (!Array.isArray(rates)) throw new Error("rates must be an array");
  const now = new Date().toISOString();
  const existingStmt = db.prepare(`
    SELECT id FROM ${table}
    WHERE ${ownerColumn}=? AND rateTypeId=? LIMIT 1
  `);
  const batchColumn = ownerColumn === "batchId" ? ", batchId" : "";
  const batchValue = ownerColumn === "batchId" ? ", @ownerId" : "";
  const upsertStmt = db.prepare(`
    INSERT INTO ${table} (
      id, licenseId, productId${batchColumn}, rateTypeId, amount,
      createdAt, updatedAt, deletedAt, isSynced, syncedAt
    ) VALUES (
      @id, @licenseId, @productId${batchValue}, @rateTypeId, @amount,
      @createdAt, @updatedAt, NULL, 0, NULL
    )
    ON CONFLICT(id) DO UPDATE SET
      amount=excluded.amount, deletedAt=NULL, updatedAt=excluded.updatedAt,
      isSynced=0, syncedAt=NULL
  `);
  const deleteStmt = db.prepare(`
    UPDATE ${table}
    SET deletedAt=?, updatedAt=?, isSynced=0, syncedAt=NULL
    WHERE ${ownerColumn}=? AND rateTypeId=? AND licenseId=? AND deletedAt IS NULL
  `);

  for (const input of rates) {
    const rateTypeId = String(input.rateTypeId || "").trim();
    const rateType = assertRateType(scopedLicenseId, rateTypeId);
    const blank = input.amount === "" || input.amount == null;
    const existing = existingStmt.get(ownerId, rateTypeId);
    if (blank) {
      deleteStmt.run(now, now, ownerId, rateTypeId, scopedLicenseId);
      if (rateType.isDefault) {
        if (ownerColumn === "productId") {
          db.prepare(`
            UPDATE products SET salePrice=NULL, updatedAt=?, isSynced=0, syncedAt=NULL
            WHERE id=? AND licenseId=?
          `).run(now, productId, scopedLicenseId);
          db.prepare(`
            UPDATE product_batches
            SET salePrice=NULL, updatedAt=?
            WHERE productId=? AND licenseId=? AND deletedAt IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM product_batch_rates pbr
                WHERE pbr.batchId=product_batches.id
                  AND pbr.rateTypeId=? AND pbr.deletedAt IS NULL
              )
          `).run(now, productId, scopedLicenseId, rateTypeId);
        } else {
          const fallback = db.prepare(`
            SELECT amount FROM product_rates
            WHERE productId=? AND rateTypeId=? AND licenseId=? AND deletedAt IS NULL
            LIMIT 1
          `).get(productId, rateTypeId, scopedLicenseId);
          db.prepare(`
            UPDATE product_batches SET salePrice=?, updatedAt=?
            WHERE id=? AND licenseId=?
          `).run(fallback?.amount ?? null, now, ownerId, scopedLicenseId);
        }
      }
      continue;
    }
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Rate amounts must be finite non-negative numbers");
    }
    upsertStmt.run({
      id:
        existing?.id ||
        (ownerColumn === "batchId"
          ? `pbr:${ownerId}:${rateTypeId}`
          : `pr:${productId}:${rateTypeId}`),
      licenseId: scopedLicenseId,
      productId,
      ownerId,
      rateTypeId,
      amount,
      createdAt: now,
      updatedAt: now,
    });
    if (rateType.isDefault) {
      if (ownerColumn === "productId") {
        db.prepare(`
          UPDATE products SET salePrice=?, updatedAt=?, isSynced=0, syncedAt=NULL
          WHERE id=? AND licenseId=?
        `).run(amount, now, productId, scopedLicenseId);
        db.prepare(`
          UPDATE product_batches
          SET salePrice=?, updatedAt=?
          WHERE productId=? AND licenseId=? AND deletedAt IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM product_batch_rates pbr
              WHERE pbr.batchId=product_batches.id
                AND pbr.rateTypeId=? AND pbr.deletedAt IS NULL
            )
        `).run(amount, now, productId, scopedLicenseId, rateTypeId);
      } else {
        db.prepare(`
          UPDATE product_batches SET salePrice=?, updatedAt=?
          WHERE id=? AND licenseId=?
        `).run(amount, now, ownerId, scopedLicenseId);
      }
    }
  }
}

function registerRateHandlers() {
  ipcMain.handle("rate-type:list", (_event, { licenseId, includeInactive = true } = {}) => {
    try {
      const scopedLicenseId = requiredLicenseId(licenseId);
      ensureDefaultRate(scopedLicenseId);
      const rows = db.prepare(`
        SELECT ${RATE_COLUMNS} FROM rate_types
        WHERE licenseId=? AND deletedAt IS NULL
          ${includeInactive ? "" : "AND isActive=1"}
        ORDER BY sortOrder ASC, name COLLATE NOCASE ASC
      `).all(scopedLicenseId);
      return { success: true, rows };
    } catch (error) {
      return { success: false, rows: [], error: String(error.message || error) };
    }
  });

  ipcMain.handle("rate-type:save", (_event, payload = {}) => {
    try {
      const licenseId = requiredLicenseId(payload.licenseId);
      const code = String(payload.code || "").trim().toUpperCase();
      const name = String(payload.name || "").trim();
      if (!/^[A-Z0-9_-]{1,30}$/.test(code)) {
        throw new Error("Code must use 1-30 letters, numbers, hyphens or underscores");
      }
      if (!name) throw new Error("Rate name is required");
      const existing = payload.id
        ? db.prepare(`SELECT * FROM rate_types WHERE id=? AND licenseId=?`).get(payload.id, licenseId)
        : null;
      if (payload.id && !existing) throw new Error("Rate type not found");
      const duplicate = db.prepare(`
        SELECT id FROM rate_types
        WHERE licenseId=? AND deletedAt IS NULL AND id<>?
          AND (code=? COLLATE NOCASE OR name=? COLLATE NOCASE)
        LIMIT 1
      `).get(licenseId, payload.id || "", code, name);
      if (duplicate) throw new Error("Rate code or name already exists");
      if (existing?.isDefault && payload.isActive === false) {
        throw new Error("Set another active rate as default before deactivating this rate");
      }
      const now = new Date().toISOString();
      const id = existing?.id || uuidv4();
      db.prepare(`
        INSERT INTO rate_types (
          id, licenseId, code, name, isDefault, isActive, sortOrder,
          createdAt, updatedAt, deletedAt, isSynced, syncedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL)
        ON CONFLICT(id) DO UPDATE SET
          code=excluded.code, name=excluded.name, isActive=excluded.isActive,
          sortOrder=excluded.sortOrder, updatedAt=excluded.updatedAt,
          isSynced=0, syncedAt=NULL
      `).run(
        id,
        licenseId,
        code,
        name,
        existing?.isDefault ? 1 : 0,
        payload.isActive === false ? 0 : 1,
        Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0,
        existing?.createdAt || now,
        now,
      );
      if (payload.isDefault) setDefaultTransaction(licenseId, id, false);
      else ensureDefaultRate(licenseId);
      return { success: true, id };
    } catch (error) {
      return { success: false, error: String(error.message || error) };
    }
  });

  ipcMain.handle("rate-type:set-default", (_event, { licenseId, id } = {}) => {
    try {
      setDefaultTransaction(requiredLicenseId(licenseId), id, false);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error.message || error) };
    }
  });

  ipcMain.handle("rate-type:toggle", (_event, { licenseId, id, isActive } = {}) => {
    try {
      const scopedLicenseId = requiredLicenseId(licenseId);
      const row = assertRateType(scopedLicenseId, id);
      if (row.isDefault && !isActive) {
        throw new Error("Set another active rate as default before deactivating this rate");
      }
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE rate_types SET isActive=?, updatedAt=?, isSynced=0, syncedAt=NULL
        WHERE id=? AND licenseId=?
      `).run(isActive ? 1 : 0, now, id, scopedLicenseId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error.message || error) };
    }
  });

  ipcMain.handle("rate-type:delete", (_event, { licenseId, id } = {}) => {
    try {
      const scopedLicenseId = requiredLicenseId(licenseId);
      const row = assertRateType(scopedLicenseId, id);
      if (row.isDefault) throw new Error("The default rate cannot be deleted");
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE rate_types
        SET deletedAt=?, isActive=0, updatedAt=?, isSynced=0, syncedAt=NULL
        WHERE id=? AND licenseId=?
      `).run(now, now, id, scopedLicenseId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error.message || error) };
    }
  });

  ipcMain.handle("product-rate:list", (_event, { licenseId, productId } = {}) => {
    try {
      const scopedLicenseId = requiredLicenseId(licenseId);
      assertProduct(scopedLicenseId, productId);
      return {
        success: true,
        rows: db.prepare(`
          SELECT * FROM product_rates
          WHERE licenseId=? AND productId=? AND deletedAt IS NULL
          ORDER BY updatedAt ASC
        `).all(scopedLicenseId, productId),
      };
    } catch (error) {
      return { success: false, rows: [], error: String(error.message || error) };
    }
  });

  ipcMain.handle("product-rate:save", (_event, payload = {}) => {
    try {
      db.transaction(() => saveRateValues({
        table: "product_rates",
        ownerColumn: "productId",
        ownerId: payload.productId,
        licenseId: payload.licenseId,
        productId: payload.productId,
        rates: payload.rates,
      }))();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error.message || error) };
    }
  });

  ipcMain.handle("product-batch-rate:list", (_event, { licenseId, productId, batchId } = {}) => {
    try {
      const scopedLicenseId = requiredLicenseId(licenseId);
      assertBatch(scopedLicenseId, productId, batchId);
      return {
        success: true,
        rows: db.prepare(`
          SELECT * FROM product_batch_rates
          WHERE licenseId=? AND productId=? AND batchId=? AND deletedAt IS NULL
          ORDER BY updatedAt ASC
        `).all(scopedLicenseId, productId, batchId),
      };
    } catch (error) {
      return { success: false, rows: [], error: String(error.message || error) };
    }
  });

  ipcMain.handle("product-batch-rate:save", (_event, payload = {}) => {
    try {
      db.transaction(() => saveRateValues({
        table: "product_batch_rates",
        ownerColumn: "batchId",
        ownerId: payload.batchId,
        licenseId: payload.licenseId,
        productId: payload.productId,
        rates: payload.rates,
      }))();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error.message || error) };
    }
  });

  for (const [entity, table, prefix] of [
    ["rate-type", "rate_types", "rateType"],
    ["product-rate", "product_rates", "productRate"],
    ["product-batch-rate", "product_batch_rates", "productBatchRate"],
  ]) {
    ipcMain.handle(`${entity}:get-dirty`, (_event, { licenseId, limit = 200 } = {}) => {
      try {
        const scopedLicenseId = requiredLicenseId(licenseId);
        return db.prepare(`
          SELECT * FROM ${table}
          WHERE licenseId=? AND (
            syncedAt IS NULL OR updatedAt > syncedAt OR
            (deletedAt IS NOT NULL AND (syncedAt IS NULL OR deletedAt > syncedAt))
          )
          ORDER BY updatedAt ASC LIMIT ?
        `).all(scopedLicenseId, Number(limit) || 200);
      } catch (_error) {
        return [];
      }
    });
    ipcMain.handle(`${entity}:mark-synced`, (_event, { ids = [], ts } = {}) => {
      try {
        const syncedAt = ts || new Date().toISOString();
        const stmt = db.prepare(`UPDATE ${table} SET isSynced=1, syncedAt=? WHERE id=?`);
        db.transaction((rows) => rows.forEach((id) => stmt.run(syncedAt, id)))(ids);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error.message || error) };
      }
    });
    ipcMain.handle(`${entity}:bulk-upsert`, (_event, records = []) => {
      try {
        db.transaction((rows) => {
          if (entity === "rate-type") {
            const winnerByLicense = new Map();
            for (const row of [...rows].sort((a, b) =>
              String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) ||
              String(a.id).localeCompare(String(b.id)),
            )) {
              const licenseId = requiredLicenseId(row.licenseId);
              if (
                row.isDefault &&
                row.isActive &&
                !row.deletedAt &&
                !winnerByLicense.has(licenseId)
              ) {
                winnerByLicense.set(licenseId, row.id);
              }
            }
            for (const row of rows) {
              const licenseId = requiredLicenseId(row.licenseId);
              const winnerId = winnerByLicense.get(licenseId);
              const code = String(row.code || "").trim().toUpperCase();
              const name = String(row.name || "").trim();
              if (!code || !name) throw new Error("Rate code and name are required");
              if (winnerId && row.id === winnerId) {
                db.prepare(`UPDATE rate_types SET isDefault=0 WHERE licenseId=? AND id<>?`).run(licenseId, row.id);
              }
              db.prepare(`
                INSERT INTO rate_types (${RATE_COLUMNS})
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                ON CONFLICT(id) DO UPDATE SET
                  code=excluded.code, name=excluded.name,
                  isDefault=excluded.isDefault, isActive=excluded.isActive,
                  sortOrder=excluded.sortOrder, updatedAt=excluded.updatedAt,
                  deletedAt=excluded.deletedAt, isSynced=1, syncedAt=excluded.syncedAt
              `).run(
                row.id, licenseId, code, name,
                winnerId ? (row.id === winnerId ? 1 : 0) : row.isDefault ? 1 : 0,
                row.isActive ? 1 : 0, Number(row.sortOrder || 0),
                row.createdAt || row.updatedAt, row.updatedAt,
                row.deletedAt || null, row.syncedAt || row.updatedAt,
              );
            }
            for (const licenseId of [...new Set(rows.map((row) => row.licenseId))]) {
              const current = ensureDefaultRate(licenseId);
              refreshCompatibilityMirrors(licenseId, current.id, new Date().toISOString());
            }
            return;
          }

          const isBatch = entity === "product-batch-rate";
          for (const row of rows) {
            const licenseId = requiredLicenseId(row.licenseId);
            assertProduct(licenseId, row.productId);
            assertRateType(licenseId, row.rateTypeId);
            if (isBatch) assertBatch(licenseId, row.productId, row.batchId);
            db.prepare(`
              INSERT INTO ${table} (
                id, licenseId, productId, ${isBatch ? "batchId," : ""}
                rateTypeId, amount, createdAt, updatedAt, deletedAt, isSynced, syncedAt
              ) VALUES (
                ?, ?, ?, ${isBatch ? "?," : ""} ?, ?, ?, ?, ?, 1, ?
              )
              ON CONFLICT(id) DO UPDATE SET
                amount=excluded.amount, updatedAt=excluded.updatedAt,
                deletedAt=excluded.deletedAt, isSynced=1, syncedAt=excluded.syncedAt
            `).run(
              row.id, licenseId, row.productId,
              ...(isBatch ? [row.batchId] : []),
              row.rateTypeId, Number(row.amount), row.createdAt || row.updatedAt,
              row.updatedAt, row.deletedAt || null, row.syncedAt || row.updatedAt,
            );
          }
          for (const licenseId of [...new Set(rows.map((row) => row.licenseId))]) {
            const current = ensureDefaultRate(licenseId);
            refreshCompatibilityMirrors(
              licenseId,
              current.id,
              new Date().toISOString(),
            );
          }
        })(records);
        return { success: true, count: records.length, entity: prefix };
      } catch (error) {
        return { success: false, error: String(error.message || error) };
      }
    });
  }
}

module.exports = { registerRateHandlers };
