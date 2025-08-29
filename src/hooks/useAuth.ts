// src/hooks/useAuth.ts
import api from "@/lib/axios";
import { stopProductsSync, pushDirtyProductsOnce } from "@/sync/productsSync";

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

type BootstrapResponse = {
  serverTime: string;
  products: Array<{
    id: string;
    licenseId: string;
    code: string;
    codeNumber: number;
    name: string;
    brand: string | null;
    category: string | null;
    unit: "KG" | "NOS" | "LTR" | "MTR";
    tax: "NT" | "P5" | "P12" | "P18" | "P28";
    hsn: string | null;
    costPrice: string;
    salePrice: string | null;
    stock: number;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
  }>;
};

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
    const boot = await api.get<BootstrapResponse>("/sync/product/bootstrap");

    await (window as any).electronAPI.bulkUpsertProducts(
      boot.data.products.map((p) => ({
        ...p,
        costPrice: Number(p.costPrice),
        salePrice: p.salePrice != null ? Number(p.salePrice) : null,
        syncedAt: boot.data.serverTime,
      }))
    );
    await (window as any).electronAPI.setSyncState("products", {
      lastPulledAt: boot.data.serverTime,
    });
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

    await pushDirtyProductsOnce(1000);

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
