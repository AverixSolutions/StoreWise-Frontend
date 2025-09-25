// src/hooks/useAuth.ts
console.log("useAuth.ts loaded");

import api from "@/lib/axios";
import { stopProductsSync, startProductsSync } from "@/sync/productsSync";
import { bootstrapProducts } from "@/bootstrap/products";
import { stopSuppliersSync, startSuppliersSync } from "@/sync/suppliersSync";
import {
  initSyncRegistry,
  getManager,
  createProductsManager,
  createSuppliersManager,
} from "@/sync/registry";
import { bootstrapSuppliers } from "@/bootstrap/suppliers";

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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function login(userId: string, password: string, role: string) {
  if (!navigator.onLine) {
    throw new Error("No internet connection. Please connect to login.");
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
    try {
      initSyncRegistry((window as any).electronAPI);
    } catch (err) {
      console.error("Failed to initialize sync registry:", err);
    }

    try {
      try {
        stopProductsSync();
      } catch {}
      startProductsSync();
      await delay(100);
    } catch (err) {
      console.error("Failed to start products sync:", err);
    }

    try {
      await bootstrapProducts();
    } catch (err) {
      console.error("Products bootstrap failed (continuing):", err);
    }

    try {
      try {
        stopSuppliersSync();
      } catch {}
      startSuppliersSync();
      await delay(100);
    } catch (err) {
      console.error("Failed to start suppliers sync:", err);
    }

    try {
      await bootstrapSuppliers();
    } catch (err) {
      console.error("Suppliers bootstrap failed (continuing):", err);
    }

    try {
      const pMgr = getManager("products");
      const sMgr = getManager("suppliers");

      if (!pMgr) {
        console.warn(
          "Products manager not found after start; attempting to create..."
        );
      }

      setTimeout(async () => {
        try {
          const p = getManager("products");
          const s = getManager("suppliers");
          if (p) await p.triggerOnce();
          await delay(300);
          if (s) await s.triggerOnce();
        } catch (err) {
          console.error("Manual trigger failed:", err);
        }
      }, 3000);
    } catch (err) {
      console.error("Post-start registry check failed:", err);
    }
  } catch (e) {
    console.error("Bootstrap/sync failed:", e);
  }

  return data.user;
}

export async function logout() {
  if (!navigator.onLine) {
    alert("Cannot logout without internet connection.");
    return;
  }

  const sessionId = localStorage.getItem("sessionId");
  if (!sessionId) {
    console.warn("No sessionId found in localStorage");
    return;
  }

  // config
  const MAX_WAIT_MS = 10_000;
  const POLL_INTERVAL_MS = 500;

  // helper: wait ms
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    try {
      const pMgr = getManager("products");
      const sMgr = getManager("suppliers");

      if (!pMgr) {
        try {
          createProductsManager();
        } catch {}
      }
      if (!sMgr) {
        try {
          createSuppliersManager();
        } catch {}
      }

      const pm = getManager("products");
      const sm = getManager("suppliers");
      const triggers: Promise<void>[] = [];
      if (pm?.triggerOnce) triggers.push(pm.triggerOnce());
      if (sm?.triggerOnce) triggers.push(sm.triggerOnce());
      Promise.allSettled(triggers).catch(() => {});
    } catch (err) {
      console.warn("Logout: error triggering managers (continuing):", err);
    }

    const licenseId = localStorage.getItem("licenseId");
    if (!licenseId) {
      console.warn("Logout: no licenseId, proceeding to logout");
    } else {
      const start = Date.now();
      let ok = false;

      while (Date.now() - start < MAX_WAIT_MS) {
        const [dirtyProducts, dirtySuppliers] = await Promise.all([
          (window as any).electronAPI
            .getDirtyProducts(licenseId, 1)
            .catch(() => []),
          (window as any).electronAPI
            .getDirtySuppliers(licenseId, 1)
            .catch(() => []),
        ]);

        const pCount = (dirtyProducts && dirtyProducts.length) || 0;
        const sCount = (dirtySuppliers && dirtySuppliers.length) || 0;

        if (pCount === 0 && sCount === 0) {
          ok = true;
          break;
        }

        await wait(POLL_INTERVAL_MS);
      }

      if (!ok) {
        alert(
          "Unable to finish syncing local changes. Please try again after a moment (or check network). Logout cancelled."
        );
        return;
      }
    }

    try {
      try {
        stopProductsSync();
      } catch {}
      try {
        stopSuppliersSync();
      } catch {}
    } catch (err) {
      console.warn("Logout: failed stopping sync managers:", err);
    }

    try {
      await (window as any).electronAPI.wipeLocalData();
    } catch (err) {
      console.warn("Logout: failed wiping local data:", err);
    }

    try {
      await api.post("/auth/logout", { sessionId });
    } catch (err) {
      console.warn("Logout: server logout failed (continuing):", err);
    }

    localStorage.clear();
  } catch (err) {
    console.error("Logout encountered an error:", err);

    try {
      localStorage.clear();
    } catch {}
    alert("Logout encountered an issue. Local data cleared where possible.");
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
