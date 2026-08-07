"use client";

import { useEffect } from "react";
import { X, Link2 } from "lucide-react";
import type { SaleReturnSourceResult } from "@/platform/types";
import type { SalesReturnItemRow } from "./types";

function money(v: unknown) {
  return `Rs. ${Number(v || 0).toFixed(2)}`;
}
export default function SalesReturnSourceDetailsModal({
  isOpen,
  source,
  rows,
  onClose,
}: {
  isOpen: boolean;
  source: SaleReturnSourceResult | null;
  rows: SalesReturnItemRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const sale = source?.sale;
  const items = source?.items || [];
  return (
    <div
      className="fixed inset-0 z-[1650] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Source Sale Details
              </h2>
              <p className="text-xs text-slate-500">
                F5 opens this view. Remaining = sold - previous linked returns.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Close Source Sale details"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sale Bill
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {sale?.billNo || sale?.id || "-"}
            </div>
          </div>
          <div className="rounded-xl bg-white p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Customer
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {sale?.customerName || "-"}
            </div>
          </div>
          <div className="rounded-xl bg-white p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Original Sale Date
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {sale?.saleDate
                ? new Date(sale.saleDate).toLocaleDateString("en-IN")
                : "-"}
            </div>
          </div>
          <div className="rounded-xl bg-white p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sale Type
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {sale?.saleType || "-"}
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[1040px] w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-950 text-white">
              <tr>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Original Batch</th>
                <th className="px-3 py-2.5 text-right">Original Rate</th>
                <th className="px-3 py-2.5">Rate Type</th>
                <th className="px-3 py-2.5 text-right">Sold Qty</th>
                <th className="px-3 py-2.5 text-right">Previous Returns</th>
                <th className="px-3 py-2.5 text-right">Remaining</th>
                <th className="px-3 py-2.5 text-right">Current Return</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any) => {
                const row = rows.find((r) => r.sourceSaleItemId === it.id);
                return (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">
                        {it.productName || it.productId}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {it.productCode || ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {it.batchNo || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {money(it.rate)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {it.rateTypeName ||
                        it.rateTypeCode ||
                        it.rateSource ||
                        "Legacy"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {Number(it.quantity || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {Number(it.previouslyReturnedQuantity || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-cyan-700">
                      {Number(it.remainingReturnableQuantity || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-950">
                      {Number(row?.quantity || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
