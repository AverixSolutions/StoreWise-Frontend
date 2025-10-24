// src/components/ledger/SupplierLedgerBadge.tsx
"use client";
import { useEffect, useState } from "react";

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

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-xs"
      title="Open ledger"
    >
      <span
        className={`font-medium ${
          balance! > 0 ? "text-red-600" : "text-green-600"
        }`}
      >
        {balance === null
          ? "…"
          : balance > 0
          ? `₹${balance.toFixed(2)}`
          : `₹${Math.abs(balance).toFixed(2)}`}
      </span>
    </button>
  );
}
