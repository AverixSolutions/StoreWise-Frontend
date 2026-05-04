// electron/ipc/shopSettings.js
const { ipcMain } = require("electron");
const db = require("../db");

function nowISO() {
  return new Date().toISOString();
}

function registerShopSettingsHandlers() {
  ipcMain.handle("shop-settings:get", (_event, licenseId) => {
    if (!licenseId) {
      return { success: false, error: "licenseId required" };
    }

    const row = db
      .prepare(`SELECT * FROM shop_settings WHERE licenseId = ?`)
      .get(licenseId);

    return {
      success: true,
      settings: row || {
        licenseId,
        shopName: "My Shop",
        logoDataUrl: null,
        logoUrl: null,
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        pincode: "",
        mobile: "",
        email: "",
        gstin: "",
        footerNote: "",
        authorizedSignatory: "Authorized Signature",
      },
    };
  });

  ipcMain.handle("shop-settings:save", (_event, payload) => {
    if (!payload?.licenseId) {
      return { success: false, error: "licenseId required" };
    }

    const ts = nowISO();

    // Desktop always writes logoDataUrl (base64); logoUrl is unused on desktop
    // but we persist it as NULL so the column exists for future use.
    db.prepare(
      `
      INSERT INTO shop_settings (
        licenseId, shopName, logoDataUrl, logoUrl,
        addressLine1, addressLine2, city, state, pincode,
        mobile, email, gstin, footerNote, authorizedSignatory,
        createdAt, updatedAt, isSynced, syncedAt
      )
      VALUES (
        @licenseId, @shopName, @logoDataUrl, @logoUrl,
        @addressLine1, @addressLine2, @city, @state, @pincode,
        @mobile, @email, @gstin, @footerNote, @authorizedSignatory,
        @createdAt, @updatedAt, 0, NULL
      )
      ON CONFLICT(licenseId) DO UPDATE SET
        shopName             = excluded.shopName,
        logoDataUrl          = excluded.logoDataUrl,
        logoUrl              = excluded.logoUrl,
        addressLine1         = excluded.addressLine1,
        addressLine2         = excluded.addressLine2,
        city                 = excluded.city,
        state                = excluded.state,
        pincode              = excluded.pincode,
        mobile               = excluded.mobile,
        email                = excluded.email,
        gstin                = excluded.gstin,
        footerNote           = excluded.footerNote,
        authorizedSignatory  = excluded.authorizedSignatory,
        updatedAt            = excluded.updatedAt,
        isSynced             = 0,
        syncedAt             = NULL
    `,
    ).run({
      licenseId: payload.licenseId,
      shopName: payload.shopName || "My Shop",
      logoDataUrl: payload.logoDataUrl || null,
      logoUrl: payload.logoUrl || null,
      addressLine1: payload.addressLine1 || "",
      addressLine2: payload.addressLine2 || "",
      city: payload.city || "",
      state: payload.state || "",
      pincode: payload.pincode || "",
      mobile: payload.mobile || "",
      email: payload.email || "",
      gstin: payload.gstin || "",
      footerNote: payload.footerNote || "",
      authorizedSignatory:
        payload.authorizedSignatory || "Authorized Signature",
      createdAt: ts,
      updatedAt: ts,
    });

    return { success: true };
  });

  // ── Sync handlers ───────────────────────────────────────────────────────────

  ipcMain.handle("shop-settings:getDirty", (_event, licenseId) => {
    try {
      const row = db
        .prepare(
          `SELECT *
           FROM shop_settings
           WHERE licenseId = ?
             AND (syncedAt IS NULL OR updatedAt > syncedAt)`,
        )
        .get(licenseId);
      return row ? [row] : [];
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle(
    "shop-settings:markSynced",
    (_event, licenseId, serverSyncedAt) => {
      try {
        const ts = serverSyncedAt || nowISO();
        db.prepare(
          `UPDATE shop_settings SET isSynced = 1, syncedAt = ? WHERE licenseId = ?`,
        ).run(ts, licenseId);
        return { success: true };
      } catch (e) {
        return { success: false, error: String(e?.message || e) };
      }
    },
  );

  ipcMain.handle("shop-settings:upsertFromServer", (_event, record) => {
    try {
      if (!record?.licenseId)
        return { success: false, error: "licenseId required" };

      db.prepare(
        `
        INSERT INTO shop_settings (
          licenseId, shopName, logoDataUrl, logoUrl,
          addressLine1, addressLine2, city, state, pincode,
          mobile, email, gstin, footerNote, authorizedSignatory,
          createdAt, updatedAt, isSynced, syncedAt
        )
        VALUES (
          @licenseId, @shopName, @logoDataUrl, @logoUrl,
          @addressLine1, @addressLine2, @city, @state, @pincode,
          @mobile, @email, @gstin, @footerNote, @authorizedSignatory,
          @createdAt, @updatedAt, 1, @syncedAt
        )
        ON CONFLICT(licenseId) DO UPDATE SET
          shopName             = excluded.shopName,
          logoDataUrl          = excluded.logoDataUrl,
          logoUrl              = excluded.logoUrl,
          addressLine1         = excluded.addressLine1,
          addressLine2         = excluded.addressLine2,
          city                 = excluded.city,
          state                = excluded.state,
          pincode              = excluded.pincode,
          mobile               = excluded.mobile,
          email                = excluded.email,
          gstin                = excluded.gstin,
          footerNote           = excluded.footerNote,
          authorizedSignatory  = excluded.authorizedSignatory,
          updatedAt            = excluded.updatedAt,
          isSynced             = 1,
          syncedAt             = excluded.syncedAt
      `,
      ).run({
        licenseId: record.licenseId,
        shopName: record.shopName || "My Shop",
        logoDataUrl: record.logoDataUrl || null,
        logoUrl: record.logoUrl || null,
        addressLine1: record.addressLine1 || "",
        addressLine2: record.addressLine2 || "",
        city: record.city || "",
        state: record.state || "",
        pincode: record.pincode || "",
        mobile: record.mobile || "",
        email: record.email || "",
        gstin: record.gstin || "",
        footerNote: record.footerNote || "",
        authorizedSignatory:
          record.authorizedSignatory || "Authorized Signature",
        createdAt: record.createdAt || nowISO(),
        updatedAt: record.updatedAt || nowISO(),
        syncedAt: record.syncedAt || nowISO(),
      });

      return { success: true };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  });
}

module.exports = { registerShopSettingsHandlers };
