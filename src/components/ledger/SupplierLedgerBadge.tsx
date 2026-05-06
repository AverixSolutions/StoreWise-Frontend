// src/components/ledger/SupplierLedgerBadge.tsx
"use client";
import { useEffect, useState } from "react";
import { ReceiptIndianRupee } from "lucide-react";

export default function LedgerBadge({
  licenseId,
  supplierId,
  onClick,
}: {
  licenseId: string;
  supplierId: string;
  onClick?: () => void;
}) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await (window as any).electronAPI.getSupplierLedger({
          licenseId,
          supplierId,
          page: 1,
          pageSize: 1,
        });
        setBalance(Number(res?.balance ?? 0));
      } catch {
        setBalance(0);
      }
    })();
  }, [licenseId, supplierId]);

  const isLoading = balance === null;
  const isPositive = !isLoading && balance! > 0;

  return (
    <button
      onClick={onClick}
      title="Open ledger"
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 cursor-pointer"
    >
      <ReceiptIndianRupee className="h-3.5 w-3.5 shrink-0" />
      <span
        className={
          isLoading
            ? "text-white/50"
            : isPositive
              ? "text-rose-300"
              : "text-emerald-300"
        }
      >
        {isLoading ? "…" : `₹${Math.abs(balance!).toFixed(2)}`}
      </span>
    </button>
  );
}
