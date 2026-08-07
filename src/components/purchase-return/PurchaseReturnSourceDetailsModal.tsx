"use client";

import { useEffect, useMemo } from "react";
import { FileSearch2, X } from "lucide-react";
import type { ItemRow } from "@/components/purchase/types";

type SourceItem = {
  id: string;
  productId: string;
  productName?: string | null;
  productCode?: string | null;
  quantity?: number | null;
  previouslyReturnedQuantity?: number | null;
  remainingReturnableQuantity?: number | null;
  availableStock?: number | null;
  batchNo?: string | null;
  purchaseBatchNo?: string | null;
  rate?: number | null;
};

type SourceState = {
  purchase: Record<string, any>;
  items: SourceItem[];
};

type Props = {
  open: boolean;
  source: SourceState | null;
  rows: ItemRow[];
  onClose: () => void;
};

function qty(value: unknown) {
  const number = Number(value || 0);
  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function money(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function date(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString("en-IN");
}

export default function PurchaseReturnSourceDetailsModal({
  open,
  source,
  rows,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, open]);

  const returnQtyBySourceItem = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      if (!row.sourcePurchaseItemId) return;
      map.set(row.sourcePurchaseItemId, Number(row.quantity || 0));
    });
    return map;
  }, [rows]);

  if (!open || !source) return null;

  const purchase = source.purchase || {};
  const reference =
    String(purchase.billNo || "").trim() ||
    (purchase.slNo != null ? `Entry #${purchase.slNo}` : "Purchase bill");

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close source Purchase details"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-return-source-details-title"
        className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[22px] border border-slate-200 bg-white shadow-2xl sm:max-w-5xl sm:rounded-[22px]"
      >
        <header className="shrink-0 bg-[linear-gradient(135deg,#091120_0%,#0f1e38_62%,#16213d_100%)] px-4 py-3.5 text-white sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
                <FileSearch2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Source Purchase
                </p>
                <h3
                  id="purchase-return-source-details-title"
                  className="truncate text-base font-semibold"
                >
                  {reference}
                </h3>
                <p className="mt-0.5 text-[10px] text-white/55">
                  Bought / returned / remaining limits are kept here instead of
                  taking space inside the item grid.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="rounded-lg p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Supplier", purchase.supplierName || "—"],
              ["Purchase date", date(purchase.purchaseDate)],
              ["Purchase total", `Rs. ${money(purchase.totalAmount)}`],
              ["Source items", String(source.items.length)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {label}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-xs">
                <thead className="bg-slate-100 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-left">Batch</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">Bought</th>
                    <th className="px-3 py-2 text-right">Returned</th>
                    <th className="px-3 py-2 text-right">Remaining</th>
                    <th className="px-3 py-2 text-right">In stock</th>
                    <th className="px-3 py-2 text-right">Return now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {source.items.map((item, index) => {
                    const row = rows.find(
                      (candidate) => candidate.sourcePurchaseItemId === item.id,
                    );
                    const availableStock =
                      row?.sourceAvailableStock ?? item.availableStock ?? 0;
                    return (
                      <tr key={item.id} className="text-slate-700">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">
                            {item.productName ||
                              row?.name ||
                              `Item ${index + 1}`}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {item.productCode || row?.code || item.productId}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {row?.purchaseBatchNo ||
                            row?.batchNo ||
                            item.purchaseBatchNo ||
                            item.batchNo ||
                            "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          Rs. {money(row?.rate ?? item.rate)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {qty(item.quantity)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {qty(item.previouslyReturnedQuantity)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-cyan-700">
                          {qty(item.remainingReturnableQuantity)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {qty(availableStock)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                          {qty(returnQtyBySourceItem.get(item.id) || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
            A source-linked Return cannot exceed the lower of Remaining and the
            selected batch stock. The Quantity input is clamped and save
            validation checks the same limit again.
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-[10px] text-slate-500">
            Shortcut:{" "}
            <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[9px] font-semibold">
              F5
            </kbd>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
