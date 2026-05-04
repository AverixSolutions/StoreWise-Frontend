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
    localStorage.setItem("kynflow_tier", user.tier || "PRO");
    localStorage.setItem("kynflow_mode", "ONLINE");
  }

  if (isSyncEnabled()) {
    try {
      const { SyncManager } = await import("@/sync/SyncManager");
      const isDesktop =
        typeof window !== "undefined" && !!(window as any).electronAPI;
      SyncManager.initAndSync(isDesktop).catch(() => {});
    } catch {
      // Non-fatal
    }
  }
}

export async function logout() {
  if (!hasStorage()) return;

  if (isSyncEnabled()) {
    try {
      const { SyncManager } = await import("@/sync/SyncManager");
      await SyncManager.flushBeforeLogout();
    } catch {}
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
