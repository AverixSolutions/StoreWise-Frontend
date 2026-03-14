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

    db.prepare(
      `
      INSERT INTO shop_settings (
        licenseId, shopName, logoDataUrl,
        addressLine1, addressLine2, city, state, pincode,
        mobile, email, gstin, footerNote, authorizedSignatory,
        createdAt, updatedAt
      )
      VALUES (
        @licenseId, @shopName, @logoDataUrl,
        @addressLine1, @addressLine2, @city, @state, @pincode,
        @mobile, @email, @gstin, @footerNote, @authorizedSignatory,
        @createdAt, @updatedAt
      )
      ON CONFLICT(licenseId) DO UPDATE SET
        shopName = excluded.shopName,
        logoDataUrl = excluded.logoDataUrl,
        addressLine1 = excluded.addressLine1,
        addressLine2 = excluded.addressLine2,
        city = excluded.city,
        state = excluded.state,
        pincode = excluded.pincode,
        mobile = excluded.mobile,
        email = excluded.email,
        gstin = excluded.gstin,
        footerNote = excluded.footerNote,
        authorizedSignatory = excluded.authorizedSignatory,
        updatedAt = excluded.updatedAt
    `,
    ).run({
      licenseId: payload.licenseId,
      shopName: payload.shopName || "My Shop",
      logoDataUrl: payload.logoDataUrl || null,
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
}

module.exports = { registerShopSettingsHandlers };
