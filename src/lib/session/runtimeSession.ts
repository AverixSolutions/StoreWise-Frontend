// src/lib/session/runtimeSession.ts
const TOKEN_KEY = "kynflow_token";
const LICENSE_KEY = "kynflow_licenseId";
const TIER_KEY = "kynflow_tier";

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

export function setRuntimeSession(params: {
  token: string;
  licenseId: string;
  tier?: string;
}) {
  localStorage.setItem(TOKEN_KEY, params.token);
  localStorage.setItem(LICENSE_KEY, params.licenseId);
  if (params.tier) localStorage.setItem(TIER_KEY, params.tier);
}

export function clearRuntimeSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LICENSE_KEY);
  localStorage.removeItem(TIER_KEY);
}

export function getActiveUser() {
  return null;
}

export function getActiveLicenseName(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem("licenseName") || "";
}
