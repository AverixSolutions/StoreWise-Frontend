// src/components/purchase/PurchaseNavigation.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react";

interface PurchaseNavigationProps {
  onNavigate: (path: string) => void;
  title?: string;
}

export default function PurchaseNavigation({
  onNavigate,
  title,
}: PurchaseNavigationProps) {
  const pathname = usePathname();

  const inferredTitle = useMemo(() => {
    if (title) return title;
    if (!pathname) return "Inventory";
    if (pathname.includes("purchase-return")) return "Purchase Return";
    if (pathname.includes("purchase")) return "Purchase Entry";
    return "Inventory";
  }, [pathname, title]);

  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onNavigate("/dashboard");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNavigate]);

  return (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between">
        {/* Back to Dashboard */}
        <button
          onClick={() => onNavigate("/dashboard")}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
          title="Back to Dashboard (Ctrl/Cmd+B)"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Dashboard</span>
        </button>

        {/* Page Title */}
        <h1 className="text-base sm:text-lg font-semibold text-gray-900">
          {inferredTitle}
        </h1>

        {/* Online/Offline pill */}
        <div
          className={
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium " +
            (online
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200")
          }
          title={online ? "Online" : "Offline"}
        >
          {online ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          <span>{online ? "Online" : "Offline"}</span>
        </div>
      </div>
      {/* subtle gradient separator */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
    </div>
  );
}
