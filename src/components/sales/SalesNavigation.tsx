// src/components/sales/SalesNavigation.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react";

interface SalesNavigationProps {
  onNavigate: (path: string) => void;
  title?: string;
}

export default function SalesNavigation({
  onNavigate,
  title,
}: SalesNavigationProps) {
  const pathname = usePathname();

  const inferredTitle = useMemo(() => {
    if (title) return title;
    if (!pathname) return "Sales";
    if (pathname.includes("sales-return")) return "Sales Return";
    if (pathname.includes("sales")) return "Sales Entry";
    return "Sales";
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

  return (
    <div className="sticky top-0 z-40 bg-[#1e3a5f] border-b border-[#1e3a5f]">
      <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between">
        {/* Back to Entries */}
        <button
          onClick={() => onNavigate("/dashboard/entries")}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors cursor-pointer"
          title="Back to Entries"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Entries</span>
        </button>

        {/* Page Title */}
        <h1 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate max-w-[120px] sm:max-w-none">
          {inferredTitle}
        </h1>

        {/* Online/Offline pill */}
        <div
          className={
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium " +
            (online
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
              : "bg-amber-500/20 text-amber-300 border border-amber-400/30")
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
      {/* Brand gradient separator */}
      <div className="h-[2px] bg-gradient-to-r from-[#20b7ff] via-[#b026ff] to-[#20b7ff]" />
    </div>
  );
}
