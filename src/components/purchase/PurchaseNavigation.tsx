// src/components/purchase/PurchaseNavigation.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, FilePlus2, Printer, Wifi, WifiOff } from "lucide-react";

interface PurchaseNavigationProps {
  onNavigate: (path: string) => void;
  title?: string;
  keyboardEnabled?: boolean;
  savedBillOpen?: boolean;
  onPrintBill?: () => void;
  onNewBill?: () => void;
  savedLabel?: string;
  printLabel?: string;
  newLabel?: string;
}

export default function PurchaseNavigation({
  onNavigate,
  title,
  keyboardEnabled = true,
  savedBillOpen = false,
  onPrintBill,
  onNewBill,
  savedLabel = "Saved bill open",
  printLabel = "Print",
  newLabel = "New Bill",
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
    if (!keyboardEnabled) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        onNavigate("/dashboard/entries");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboardEnabled, onNavigate]);

  return (
    <div className="sticky top-0 z-40 border-b border-[#1e3a5f] bg-[#1e3a5f]">
      <div className="flex min-h-[48px] items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate("/dashboard/entries")}
            className="flex shrink-0 items-center gap-2 text-white transition-colors hover:text-white"
            title="Back to Entries (Ctrl/Cmd+B)"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden text-sm font-medium sm:inline">
              Entries
            </span>
            <kbd className="hidden rounded border border-white/30 bg-white/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-white lg:inline-flex">
              Ctrl+B
            </kbd>
          </button>

          <span className="h-5 w-px shrink-0 bg-white/15" />

          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-white sm:text-base lg:text-lg">
              {inferredTitle}
            </h1>
            {savedBillOpen ? (
              <span className="hidden shrink-0 rounded-full border border-emerald-300/25 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 md:inline-flex">
                {savedLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {savedBillOpen && onPrintBill ? (
            <button
              type="button"
              onClick={onPrintBill}
              title="Print Bill (Ctrl/Cmd+P)"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/20 bg-white/15 px-2.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{printLabel}</span>
              <kbd className="hidden rounded border border-white/30 bg-white/15 px-1 py-0.5 font-mono text-[8px] text-white xl:inline-flex">
                Ctrl+P
              </kbd>
            </button>
          ) : null}

          {savedBillOpen && onNewBill ? (
            <button
              type="button"
              onClick={onNewBill}
              title="Start New Bill (Ctrl/Cmd+N)"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/25 bg-white px-2.5 text-xs font-semibold text-[#1e3a5f] transition hover:bg-slate-100"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{newLabel}</span>
              <kbd className="hidden rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono text-[8px] text-slate-500 xl:inline-flex">
                Ctrl+N
              </kbd>
            </button>
          ) : null}

          <div
            className={
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium " +
              (online
                ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-300"
                : "border-amber-400/30 bg-amber-500/20 text-amber-300")
            }
            title={online ? "Online" : "Offline"}
          >
            {online ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            <span className="hidden md:inline">
              {online ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>
      <div className="h-[2px] bg-gradient-to-r from-[#20b7ff] via-[#b026ff] to-[#20b7ff]" />
    </div>
  );
}
