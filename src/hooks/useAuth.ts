// src/hooks/useAuth.ts
import { isSyncEnabled } from "@/platform/mode";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

const STORAGE_KEYS = {
  token: "token",
  sessionId: "sessionId",
  role: "role",
  userName: "userName",
  licenseId: "licenseId",
  licenseName: "licenseName",
};

function hasStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export async function login(
  userId: string,
  password: string,
  role: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password, role }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Login failed");
  }

  const data = await res.json();
  const { token, sessionId, user } = data;

  if (hasStorage()) {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
    localStorage.setItem(STORAGE_KEYS.role, user.role);
    localStorage.setItem(STORAGE_KEYS.userName, user.userId);
    localStorage.setItem(STORAGE_KEYS.licenseId, user.licenseId);
    localStorage.setItem(STORAGE_KEYS.licenseName, user.licenseName || "");

    localStorage.setItem("kynflow_token", token);
    localStorage.setItem("kynflow_licenseId", user.licenseId);
    localStorage.setItem("kynflow_tier", user.tier || "");
    localStorage.setItem(
      "kynflow_mode",
      user.tier === "PRO" ? "ONLINE" : "OFFLINE",
    );
  }

  // ── Bootstrap: pull all server data into local cache ──────────────────
  // Do this after writing auth keys so getSyncState can read the token.
  if (isSyncEnabled()) {
    try {
      const { SyncManager } = await import("@/sync/SyncManager");
      const isDesktop =
        typeof window !== "undefined" && !!(window as any).electronAPI;
      // Don't await here — let it run in background while user sees the
      // dashboard. SyncProvider will expose bootstrapping=true so we can
      // show a subtle loading indicator.
      SyncManager.initAndSync(isDesktop).catch(() => {});
    } catch {
      // Non-fatal — user can still use offline data
    }
  }
}

export async function logout() {
  if (!hasStorage()) return;

  // ── Pre-logout flush: push dirty records before wiping local state ────
  if (isSyncEnabled()) {
    try {
      const { SyncManager } = await import("@/sync/SyncManager");
      await SyncManager.flushBeforeLogout();
    } catch {
      // best-effort — proceed with logout even if flush fails
    }
  }

  const sessionId = localStorage.getItem(STORAGE_KEYS.sessionId);
  const token = localStorage.getItem(STORAGE_KEYS.token);

  if (sessionId && token) {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }

  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("kynflow_token");
  localStorage.removeItem("kynflow_licenseId");
  localStorage.removeItem("kynflow_tier");
  localStorage.removeItem("kynflow_mode");

  // Clear sync state so next login gets a fresh bootstrap
  localStorage.removeItem("kynflow_sync_products");
  localStorage.removeItem("kynflow_sync_suppliers");
}

export function getCurrentUser() {
  if (!hasStorage()) {
    return {
      token: null,
      sessionId: null,
      role: null,
      licenseName: null,
      userName: null,
      licenseId: null,
    };
  }

  return {
    token: localStorage.getItem(STORAGE_KEYS.token),
    sessionId: localStorage.getItem(STORAGE_KEYS.sessionId),
    role: localStorage.getItem(STORAGE_KEYS.role),
    licenseName: localStorage.getItem(STORAGE_KEYS.licenseName),
    userName: localStorage.getItem(STORAGE_KEYS.userName),
    licenseId: localStorage.getItem(STORAGE_KEYS.licenseId),
  };
}
