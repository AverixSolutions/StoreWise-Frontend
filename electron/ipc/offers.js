const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const OFFER_COLUMNS = `
  id, licenseId, name, type, isActive, applyScope, priority,
  startsAt, endsAt, timeStart, timeEnd, minQty, maxQty, fixedUnitPrice,
  discountPercent, discountAmount, triggerKind, triggerScope, minAmount,
  maxAmount, unit, benefitTarget, benefitKind, benefitQtyMode,
  fixedBenefitQty, maxBenefitQty, maxBenefitAmount, customerRequired,
  oncePerBill, notes, createdAt, updatedAt, deletedAt, isSynced, syncedAt
`;

function asNum(v, fallback = null) {
  if (v === "" || v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function cleanOfferPayload(payload, now) {
  return {
    id: payload.id || uuidv4(),
    licenseId: payload.licenseId,
    name: String(payload.name || "").trim(),
    type: payload.type || "SPECIAL_PRICE",
    isActive: payload.isActive === false || payload.isActive === 0 ? 0 : 1,
    applyScope: payload.applyScope || "ALL_PRODUCTS",
    priority: Number(payload.priority || 0),
    startsAt: payload.startsAt || null,
    endsAt: payload.endsAt || null,
    timeStart: payload.timeStart || null,
    timeEnd: payload.timeEnd || null,
    minQty: asNum(payload.minQty),
    maxQty: asNum(payload.maxQty),
    fixedUnitPrice: asNum(payload.fixedUnitPrice),
    discountPercent: asNum(payload.discountPercent),
    discountAmount: asNum(payload.discountAmount),
    triggerKind: payload.triggerKind || null,
    triggerScope: payload.triggerScope || null,
    minAmount: asNum(payload.minAmount),
    maxAmount: asNum(payload.maxAmount),
    unit: payload.unit || null,
    benefitTarget: payload.benefitTarget || null,
    benefitKind: payload.benefitKind || null,
    benefitQtyMode: payload.benefitQtyMode || null,
    fixedBenefitQty: asNum(payload.fixedBenefitQty),
    maxBenefitQty: asNum(payload.maxBenefitQty),
    maxBenefitAmount: asNum(payload.maxBenefitAmount),
    customerRequired:
      payload.customerRequired === true || payload.customerRequired === 1
        ? 1
        : 0,
    oncePerBill:
      payload.oncePerBill === false || payload.oncePerBill === 0 ? 0 : 1,
    notes: payload.notes || null,
    createdAt: payload.createdAt || now,
    updatedAt: now,
    deletedAt: payload.deletedAt || null,
    isSynced: payload.isSynced ?? 0,
    syncedAt: payload.syncedAt || null,
  };
}

function registerOfferHandlers() {
  ipcMain.handle("offer:list", (evt, { licenseId, filters = {} }) => {
    try {
      const where = ["licenseId = @licenseId"];
      const params = { licenseId };
      if (!filters.includeDeleted) where.push("COALESCE(deletedAt,'') = ''");
      if (!filters.includeInactive) where.push("COALESCE(isActive,1) = 1");
      if (filters.type) {
        where.push("type = @type");
        params.type = filters.type;
      }
      if (filters.q && String(filters.q).trim()) {
        where.push(
          "(LOWER(name) LIKE @q OR LOWER(COALESCE(notes,'')) LIKE @q)",
        );
        params.q = `%${String(filters.q).trim().toLowerCase()}%`;
      }
      const rows = db
        .prepare(
          `
          SELECT ${OFFER_COLUMNS}
          FROM offers
          WHERE ${where.join(" AND ")}
          ORDER BY type ASC, priority DESC, name ASC
        `,
        )
        .all(params);
      return { success: true, rows };
    } catch (e) {
      console.error("[offer:list]", e);
      return { success: false, rows: [], error: e.message };
    }
  });

  ipcMain.handle("offer:list-active", (evt, { licenseId }) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT ${OFFER_COLUMNS}
          FROM offers
          WHERE licenseId = ?
            AND COALESCE(deletedAt,'') = ''
            AND COALESCE(isActive,1) = 1
          ORDER BY priority DESC, name ASC
        `,
        )
        .all(licenseId);
      return { success: true, rows };
    } catch (e) {
      console.error("[offer:list-active]", e);
      return { success: false, rows: [], error: e.message };
    }
  });

  ipcMain.handle("offer:get", (evt, { id, licenseId }) => {
    try {
      const row = db
        .prepare(
          `
          SELECT ${OFFER_COLUMNS}
          FROM offers
          WHERE id = ?
            ${licenseId ? "AND licenseId = ?" : ""}
            AND COALESCE(deletedAt,'') = ''
        `,
        )
        .get(...(licenseId ? [id, licenseId] : [id]));
      return { success: true, offer: row || null };
    } catch (e) {
      console.error("[offer:get]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("offer:save", (evt, payload) => {
    try {
      if (!payload.licenseId) return { success: false, error: "licenseId required" };
      if (!String(payload.name || "").trim()) {
        return { success: false, error: "Offer name is required" };
      }
      const now = new Date().toISOString();
      const existing = payload.id
        ? db.prepare(`SELECT * FROM offers WHERE id = ?`).get(payload.id)
        : null;
      const row = cleanOfferPayload(
        { ...existing, ...payload, createdAt: existing?.createdAt },
        now,
      );
      row.isSynced = 0;
      row.syncedAt = null;

      db.prepare(
        `
        INSERT INTO offers (${OFFER_COLUMNS})
        VALUES (
          @id, @licenseId, @name, @type, @isActive, @applyScope, @priority,
          @startsAt, @endsAt, @timeStart, @timeEnd, @minQty, @maxQty,
          @fixedUnitPrice, @discountPercent, @discountAmount, @triggerKind,
          @triggerScope, @minAmount, @maxAmount, @unit, @benefitTarget,
          @benefitKind, @benefitQtyMode, @fixedBenefitQty, @maxBenefitQty,
          @maxBenefitAmount, @customerRequired, @oncePerBill, @notes,
          @createdAt, @updatedAt, @deletedAt, @isSynced, @syncedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          isActive = excluded.isActive,
          applyScope = excluded.applyScope,
          priority = excluded.priority,
          startsAt = excluded.startsAt,
          endsAt = excluded.endsAt,
          timeStart = excluded.timeStart,
          timeEnd = excluded.timeEnd,
          minQty = excluded.minQty,
          maxQty = excluded.maxQty,
          fixedUnitPrice = excluded.fixedUnitPrice,
          discountPercent = excluded.discountPercent,
          discountAmount = excluded.discountAmount,
          triggerKind = excluded.triggerKind,
          triggerScope = excluded.triggerScope,
          minAmount = excluded.minAmount,
          maxAmount = excluded.maxAmount,
          unit = excluded.unit,
          benefitTarget = excluded.benefitTarget,
          benefitKind = excluded.benefitKind,
          benefitQtyMode = excluded.benefitQtyMode,
          fixedBenefitQty = excluded.fixedBenefitQty,
          maxBenefitQty = excluded.maxBenefitQty,
          maxBenefitAmount = excluded.maxBenefitAmount,
          customerRequired = excluded.customerRequired,
          oncePerBill = excluded.oncePerBill,
          notes = excluded.notes,
          updatedAt = excluded.updatedAt,
          deletedAt = excluded.deletedAt,
          isSynced = 0,
          syncedAt = NULL
      `,
      ).run(row);

      return { success: true, id: row.id };
    } catch (e) {
      console.error("[offer:save]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("offer:delete", (evt, { id, licenseId }) => {
    try {
      const now = new Date().toISOString();
      const info = db
        .prepare(
          `
          UPDATE offers
          SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
          WHERE id = ? AND licenseId = ?
        `,
        )
        .run(now, now, id, licenseId);
      return info.changes
        ? { success: true }
        : { success: false, error: "Offer not found" };
    } catch (e) {
      console.error("[offer:delete]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("offer:toggle", (evt, { id, licenseId, isActive }) => {
    try {
      const now = new Date().toISOString();
      const info = db
        .prepare(
          `
          UPDATE offers
          SET isActive = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
          WHERE id = ? AND licenseId = ? AND COALESCE(deletedAt,'') = ''
        `,
        )
        .run(isActive ? 1 : 0, now, id, licenseId);
      return info.changes
        ? { success: true }
        : { success: false, error: "Offer not found" };
    } catch (e) {
      console.error("[offer:toggle]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("offer-target:list", (evt, { offerId }) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT otp.*, p.name AS productName, p.code AS productCode
          FROM offer_target_products otp
          LEFT JOIN products p ON p.id = otp.productId
          WHERE otp.offerId = ?
            AND COALESCE(otp.deletedAt,'') = ''
          ORDER BY otp.targetRole ASC, p.name ASC
        `,
        )
        .all(offerId);
      return { success: true, rows };
    } catch (e) {
      console.error("[offer-target:list]", e);
      return { success: false, rows: [], error: e.message };
    }
  });

  ipcMain.handle("offer-target:save", (evt, payload) => {
    try {
      const now = new Date().toISOString();
      const existing = db
        .prepare(`SELECT * FROM offer_target_products WHERE offerId = ?`)
        .all(payload.offerId);
      const wanted = new Map(
        (payload.rows || []).map((r) => [`${r.productId}:${r.targetRole}`, r]),
      );
      const insert = db.prepare(
        `
        INSERT INTO offer_target_products
          (id, licenseId, offerId, productId, targetRole, createdAt, updatedAt, deletedAt, isSynced, syncedAt)
        VALUES
          (@id, @licenseId, @offerId, @productId, @targetRole, @createdAt, @updatedAt, NULL, 0, NULL)
        ON CONFLICT(id) DO UPDATE SET
          productId = excluded.productId,
          targetRole = excluded.targetRole,
          updatedAt = excluded.updatedAt,
          deletedAt = NULL,
          isSynced = 0,
          syncedAt = NULL
      `,
      );
      const tombstone = db.prepare(
        `
        UPDATE offer_target_products
        SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
        WHERE id = ?
      `,
      );

      db.transaction(() => {
        for (const row of existing) {
          const key = `${row.productId}:${row.targetRole}`;
          if (!wanted.has(key) && !row.deletedAt) {
            tombstone.run(now, now, row.id);
          }
        }
        for (const row of payload.rows || []) {
          const found = existing.find(
            (r) =>
              r.productId === row.productId && r.targetRole === row.targetRole,
          );
          insert.run({
            id: found?.id || uuidv4(),
            licenseId: payload.licenseId,
            offerId: payload.offerId,
            productId: row.productId,
            targetRole: row.targetRole,
            createdAt: found?.createdAt || now,
            updatedAt: now,
          });
        }
      })();

      return { success: true, id: payload.offerId };
    } catch (e) {
      console.error("[offer-target:save]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("offer:get-dirty", (evt, { licenseId, limit = 200 }) => {
    try {
      const records = db
        .prepare(
          `
          SELECT ${OFFER_COLUMNS}
          FROM offers
          WHERE licenseId = ?
            AND (isSynced = 0 OR isSynced IS NULL)
          ORDER BY updatedAt ASC
          LIMIT ?
        `,
        )
        .all(licenseId, limit);
      return { success: true, records };
    } catch (e) {
      console.error("[offer:get-dirty]", e);
      return { success: false, records: [], error: e.message };
    }
  });

  ipcMain.handle("offer:mark-synced", (evt, { ids, ts }) => {
    const syncedAt = ts || new Date().toISOString();
    const stmt = db.prepare(
      `UPDATE offers SET isSynced = 1, syncedAt = ? WHERE id = ?`,
    );
    db.transaction(() => {
      for (const id of ids || []) stmt.run(syncedAt, id);
    })();
    return { success: true };
  });

  ipcMain.handle("offer:bulk-upsert", (evt, records) => {
    try {
      const now = new Date().toISOString();
      const stmt = db.prepare(
        `
        INSERT INTO offers (${OFFER_COLUMNS})
        VALUES (
          @id, @licenseId, @name, @type, @isActive, @applyScope, @priority,
          @startsAt, @endsAt, @timeStart, @timeEnd, @minQty, @maxQty,
          @fixedUnitPrice, @discountPercent, @discountAmount, @triggerKind,
          @triggerScope, @minAmount, @maxAmount, @unit, @benefitTarget,
          @benefitKind, @benefitQtyMode, @fixedBenefitQty, @maxBenefitQty,
          @maxBenefitAmount, @customerRequired, @oncePerBill, @notes,
          @createdAt, @updatedAt, @deletedAt, 1, @syncedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          isActive = excluded.isActive,
          applyScope = excluded.applyScope,
          priority = excluded.priority,
          startsAt = excluded.startsAt,
          endsAt = excluded.endsAt,
          timeStart = excluded.timeStart,
          timeEnd = excluded.timeEnd,
          minQty = excluded.minQty,
          maxQty = excluded.maxQty,
          fixedUnitPrice = excluded.fixedUnitPrice,
          discountPercent = excluded.discountPercent,
          discountAmount = excluded.discountAmount,
          triggerKind = excluded.triggerKind,
          triggerScope = excluded.triggerScope,
          minAmount = excluded.minAmount,
          maxAmount = excluded.maxAmount,
          unit = excluded.unit,
          benefitTarget = excluded.benefitTarget,
          benefitKind = excluded.benefitKind,
          benefitQtyMode = excluded.benefitQtyMode,
          fixedBenefitQty = excluded.fixedBenefitQty,
          maxBenefitQty = excluded.maxBenefitQty,
          maxBenefitAmount = excluded.maxBenefitAmount,
          customerRequired = excluded.customerRequired,
          oncePerBill = excluded.oncePerBill,
          notes = excluded.notes,
          updatedAt = excluded.updatedAt,
          deletedAt = excluded.deletedAt,
          isSynced = 1,
          syncedAt = excluded.syncedAt
        WHERE excluded.updatedAt > offers.updatedAt
          OR offers.isSynced = 1
      `,
      );
      db.transaction(() => {
        for (const r of records || []) {
          stmt.run(cleanOfferPayload({ ...r, isSynced: 1, syncedAt: now }, now));
        }
      })();
      return { success: true, upserted: records?.length || 0 };
    } catch (e) {
      console.error("[offer:bulk-upsert]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("offer-target:get-dirty", (evt, { licenseId, limit = 500 }) => {
    try {
      const records = db
        .prepare(
          `
          SELECT id, licenseId, offerId, productId, targetRole,
                 createdAt, updatedAt, deletedAt, isSynced, syncedAt
          FROM offer_target_products
          WHERE licenseId = ?
            AND (isSynced = 0 OR isSynced IS NULL)
          ORDER BY updatedAt ASC
          LIMIT ?
        `,
        )
        .all(licenseId, limit);
      return { success: true, records };
    } catch (e) {
      console.error("[offer-target:get-dirty]", e);
      return { success: false, records: [], error: e.message };
    }
  });

  ipcMain.handle("offer-target:mark-synced", (evt, { ids, ts }) => {
    const syncedAt = ts || new Date().toISOString();
    const stmt = db.prepare(
      `UPDATE offer_target_products SET isSynced = 1, syncedAt = ? WHERE id = ?`,
    );
    db.transaction(() => {
      for (const id of ids || []) stmt.run(syncedAt, id);
    })();
    return { success: true };
  });

  ipcMain.handle("offer-target:bulk-upsert", (evt, records) => {
    try {
      const now = new Date().toISOString();
      const stmt = db.prepare(
        `
        INSERT INTO offer_target_products
          (id, licenseId, offerId, productId, targetRole, createdAt, updatedAt, deletedAt, isSynced, syncedAt)
        VALUES
          (@id, @licenseId, @offerId, @productId, @targetRole, @createdAt, @updatedAt, @deletedAt, 1, @syncedAt)
        ON CONFLICT(id) DO UPDATE SET
          productId = excluded.productId,
          targetRole = excluded.targetRole,
          updatedAt = excluded.updatedAt,
          deletedAt = excluded.deletedAt,
          isSynced = 1,
          syncedAt = excluded.syncedAt
        WHERE excluded.updatedAt > offer_target_products.updatedAt
          OR offer_target_products.isSynced = 1
      `,
      );
      db.transaction(() => {
        for (const r of records || []) {
          stmt.run({
            id: r.id,
            licenseId: r.licenseId,
            offerId: r.offerId,
            productId: r.productId,
            targetRole: r.targetRole || "BOTH",
            createdAt: r.createdAt || now,
            updatedAt: r.updatedAt || now,
            deletedAt: r.deletedAt || null,
            syncedAt: r.syncedAt || now,
          });
        }
      })();
      return { success: true, upserted: records?.length || 0 };
    } catch (e) {
      console.error("[offer-target:bulk-upsert]", e);
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerOfferHandlers };
