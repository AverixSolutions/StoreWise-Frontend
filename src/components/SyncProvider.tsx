// src/components/SyncProvider.tsx
"use client";
import { useEffect } from "react";
import { startProductsSync, stopProductsSync } from "@/sync/productsSync";
import { getCurrentUser } from "@/hooks/useAuth";
import {
  initSyncRegistry,
  getManager,
  createProductsManager,
} from "@/sync/registry";

export default function SyncProvider() {
  useEffect(() => {
    const { token } = getCurrentUser();
    if (!token) return;

    try {
      initSyncRegistry((window as any).electronAPI);
    } catch (err) {
      console.warn("SyncProvider: initSyncRegistry warning:", err);
    }

    try {
      startProductsSync();
    } catch (err) {
      console.error("SyncProvider: failed to start products sync:", err);
    }

    const triggerProductsOnce = async () => {
      try {
        let mgr = getManager("products");
        if (!mgr) {
          mgr = createProductsManager();
        }
        if (mgr && typeof mgr.triggerOnce === "function") {
          await mgr.triggerOnce();
        } else if (mgr && typeof mgr.trigger === "function") {
          mgr.trigger();
        } else {
          console.warn(
            "SyncProvider: products manager does not expose triggerOnce/trigger"
          );
        }
      } catch (err) {
        console.error("SyncProvider: triggerProductsOnce failed:", err);
      }
    };

    const onOnline = () => {
      triggerProductsOnce();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") triggerProductsOnce();
    };
    const onFocus = () => {
      triggerProductsOnce();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      try {
        stopProductsSync();
      } catch (err) {
        console.warn("SyncProvider: stopProductsSync warning:", err);
      }
    };
  }, []);

  return null;
}
