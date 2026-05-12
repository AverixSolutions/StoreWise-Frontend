// src/lib/session/runtimeSession.ts
const TOKEN_KEY = "kynflow_token";
const LICENSE_KEY = "kynflow_licenseId";
const TIER_KEY = "kynflow_tier";
const BARCODE_ENABLED_KEY = "kynflow_barcodeEnabled";

export function getActiveToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function getActiveLicenseId(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(LICENSE_KEY) || "";
}

export function getActiveTier(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(TIER_KEY) || "";
}

export function canUseBarcode(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(BARCODE_ENABLED_KEY) !== "false";
}

export function getLicenseFeatures() {
  return {
    barcodeEnabled: canUseBarcode(),
  };
}

export function setRuntimeSession(params: {
  token: string;
  licenseId: string;
  tier?: string;
  barcodeEnabled?: boolean;
}) {
  localStorage.setItem(TOKEN_KEY, params.token);
  localStorage.setItem(LICENSE_KEY, params.licenseId);
  if (params.tier) localStorage.setItem(TIER_KEY, params.tier);
  localStorage.setItem(
    BARCODE_ENABLED_KEY,
    String(params.barcodeEnabled !== false),
  );
}

export function clearRuntimeSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LICENSE_KEY);
  localStorage.removeItem(TIER_KEY);
  localStorage.removeItem(BARCODE_ENABLED_KEY);
}

export function getActiveUser() {
  return null;
}

export function getActiveLicenseName(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem("licenseName") || "";
}
