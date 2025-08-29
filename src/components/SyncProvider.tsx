// src/components/SyncProvider.tsx
"use client";
"use client";
import { useEffect } from "react";
import {
  startProductsSync,
  stopProductsSync,
  triggerSyncNow,
} from "@/sync/productsSync";
import { getCurrentUser } from "@/hooks/useAuth";

export default function SyncProvider() {
  useEffect(() => {
    const { token } = getCurrentUser();
    if (!token) return;

    startProductsSync(30_000, 200);

    const onOnline = () => triggerSyncNow();
    const onVisibility = () => {
      if (document.visibilityState === "visible") triggerSyncNow();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    const onFocus = () => triggerSyncNow();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      stopProductsSync();
    };
  }, []);

  return null;
}
