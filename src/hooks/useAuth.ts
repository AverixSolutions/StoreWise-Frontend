// src/hooks/useAuth.ts
console.log("useAuth.ts loaded");

interface OfflineUser {
  id: string;
  userId: string;
  role: string;
  licenseId: string;
  licenseName: string;
}

const DEFAULT_USER = {
  id: "offline-admin",
  userId: "admin",
  password: "admin123",
  role: "ADMIN",
  licenseId: "demo-license",
  licenseName: "StoreWise Offline",
};

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
): Promise<OfflineUser> {
  const normalizedUserId = userId.trim();
  const normalizedRole = role.trim().toUpperCase();

  const isValid =
    normalizedUserId === DEFAULT_USER.userId &&
    password === DEFAULT_USER.password &&
    normalizedRole === DEFAULT_USER.role;

  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  if (hasStorage()) {
    localStorage.setItem(STORAGE_KEYS.token, "offline-session");
    localStorage.setItem(STORAGE_KEYS.sessionId, "offline-session");
    localStorage.setItem(STORAGE_KEYS.role, DEFAULT_USER.role);
    localStorage.setItem(STORAGE_KEYS.userName, DEFAULT_USER.userId);
    localStorage.setItem(STORAGE_KEYS.licenseId, DEFAULT_USER.licenseId);
    localStorage.setItem(STORAGE_KEYS.licenseName, DEFAULT_USER.licenseName);
  }

  return {
    id: DEFAULT_USER.id,
    userId: DEFAULT_USER.userId,
    role: DEFAULT_USER.role,
    licenseId: DEFAULT_USER.licenseId,
    licenseName: DEFAULT_USER.licenseName,
  };
}

export async function logout() {
  if (!hasStorage()) return;

  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.sessionId);
  localStorage.removeItem(STORAGE_KEYS.role);
  localStorage.removeItem(STORAGE_KEYS.userName);
  localStorage.removeItem(STORAGE_KEYS.licenseId);
  localStorage.removeItem(STORAGE_KEYS.licenseName);
}

export function getCurrentUser() {
  if (!hasStorage()) {
    return {
      token: null,
      sessionId: null,
      role: "ADMIN",
      licenseName: "StoreWise Offline",
      userName: "admin",
      licenseId: "demo-license",
    };
  }

  return {
    token: localStorage.getItem(STORAGE_KEYS.token),
    sessionId: localStorage.getItem(STORAGE_KEYS.sessionId),
    role: localStorage.getItem(STORAGE_KEYS.role) || "ADMIN",
    licenseName:
      localStorage.getItem(STORAGE_KEYS.licenseName) || "StoreWise Offline",
    userName: localStorage.getItem(STORAGE_KEYS.userName) || "admin",
    licenseId: localStorage.getItem(STORAGE_KEYS.licenseId) || "demo-license",
  };
}
