// src/components/SyncProvider.tsx
"use client";
import { useEffect } from "react";
import { startProductsSync, stopProductsSync } from "@/sync/productsSync";
import { getCurrentUser } from "@/hooks/useAuth";
import { triggerSync } from "@/sync/core";

export default function SyncProvider() {
  useEffect(() => {
    const { token } = getCurrentUser();
    if (!token) return;

    startProductsSync();

    const onOnline = () => triggerSync("products");
    const onVisibility = () => {
      if (document.visibilityState === "visible") triggerSync("products");
    };
    const onFocus = () => triggerSync("products");

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
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
