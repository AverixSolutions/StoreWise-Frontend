const featuresByLicense = new Map();
const { ipcMain } = require("electron");

function normalizeLicenseId(licenseId) {
  return String(licenseId || "").trim();
}

function setLicenseFeatures({ licenseId, barcodeEnabled = true } = {}) {
  const id = normalizeLicenseId(licenseId);
  if (!id) return { success: false, error: "licenseId required" };

  featuresByLicense.set(id, {
    barcodeEnabled: barcodeEnabled !== false,
  });

  return { success: true };
}

function getLicenseFeatures(licenseId) {
  const id = normalizeLicenseId(licenseId);
  return featuresByLicense.get(id) || { barcodeEnabled: true };
}

function canUseBarcode(licenseId) {
  return getLicenseFeatures(licenseId).barcodeEnabled !== false;
}

function barcodeDisabledResult() {
  return {
    success: false,
    code: "BARCODE_DISABLED",
    error: "Barcode Support is disabled for this license.",
  };
}

module.exports = {
  registerLicenseFeatureHandlers() {
    ipcMain.handle("license:setFeatures", (_event, features) =>
      setLicenseFeatures(features),
    );
  },
  setLicenseFeatures,
  getLicenseFeatures,
  canUseBarcode,
  barcodeDisabledResult,
};
