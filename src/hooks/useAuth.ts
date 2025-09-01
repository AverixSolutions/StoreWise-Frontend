// src/hooks/useAuth.ts
import api from "@/lib/axios";
import { stopProductsSync } from "@/sync/productsSync";
import { bootstrapProducts } from "@/bootstrap/products";

interface LoginResponse {
  token: string;
  sessionId: string;
  user: {
    id: string;
    userId: string;
    role: string;
    licenseId?: string;
    licenseName?: string;
    [key: string]: any;
  };
}

export async function login(userId: string, password: string, role: string) {
  if (!navigator.onLine) {
    throw new Error("⚠️ No internet connection. Please connect to login.");
  }

  const res = await api.post<LoginResponse>("/auth/login", {
    userId,
    password,
    role,
    deviceInfo: navigator.userAgent,
  });

  const data = res.data;

  localStorage.setItem("token", data.token);
  localStorage.setItem("sessionId", data.sessionId);
  localStorage.setItem("role", data.user.role);
  localStorage.setItem("userName", data.user.userId);
  if (data.user.licenseName)
    localStorage.setItem("licenseName", data.user.licenseName);
  if (data.user.licenseId)
    localStorage.setItem("licenseId", data.user.licenseId);

  try {
    await bootstrapProducts();
  } catch (e) {
    console.error("Bootstrap failed:", e);
  }

  return data.user;
}

export async function logout() {
  if (!navigator.onLine) {
    alert("⚠️ Cannot logout without internet connection.");
    return;
  }

  const sessionId = localStorage.getItem("sessionId");

  if (!sessionId) {
    console.warn("⚠️ No sessionId found in localStorage");
    return;
  }

  try {
    stopProductsSync();

    await (window as any).electronAPI.wipeLocalData();

    await api.post("/auth/logout", { sessionId });
    localStorage.clear();
  } catch (err) {
    console.error("❌ Logout failed:", err);

    localStorage.clear();
    alert("Logout encountered an issue, but local data was cleared.");
  }
}

export function getCurrentUser() {
  return {
    token: localStorage.getItem("token"),
    role: localStorage.getItem("role"),
    licenseName: localStorage.getItem("licenseName"),
    userName: localStorage.getItem("userName"),
  };
}
