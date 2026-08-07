// src/components/purchase/BatchSelectModal.tsx
"use client";

import { Barcode, Boxes, CalendarDays, Plus, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BatchInfo } from "./types";

interface BatchSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  batches: BatchInfo[];
  onSelect: (batch: BatchInfo | null) => void;
  onAddNewBatch?: (barcode: string) => void;
  productName?: string;
  nextBarcode?: string;
  licenseId?: string;
  allowCreateNew?: boolean;
  barcodeEnabled?: boolean;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN");
}

function formatMoney(value?: number | null) {
  return value == null ? "—" : `₹${Number(value).toFixed(2)}`;
}

export default function BatchSelectModal({
  isOpen,
  onClose,
  batches,
  onSelect,
  onAddNewBatch,
  productName,
  nextBarcode,
  allowCreateNew = true,
  barcodeEnabled = true,
}: BatchSelectModalProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const [customBarcode, setCustomBarcode] = useState("");
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const canCreateBarcode = allowCreateNew && barcodeEnabled;

  useEffect(() => {
    if (!isOpen) return;
    setCustomBarcode("");
    setTab(canCreateBarcode && batches.length === 0 ? "new" : "existing");
    const timer = setTimeout(() => firstButtonRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [isOpen, batches.length, canCreateBarcode]);

  if (!isOpen) return null;

  function handleSelect(batch: BatchInfo | null) {
    onSelect(batch);
    onClose();
  }

  function handleAddNew(barcode: string) {
    const value = barcode.trim();
    if (!value) return;
    onAddNewBatch?.(value);
    onClose();
  }

  function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const buttons = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>(
          "[data-batch-btn='1']",
        ),
      );
      if (!buttons.length) return;
      const current = buttons.findIndex(
        (button) => button === document.activeElement,
      );
      const next =
        current === -1
          ? 0
          : event.key === "ArrowDown"
            ? (current + 1) % buttons.length
            : (current - 1 + buttons.length) % buttons.length;
      buttons[next]?.focus();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[84vh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
              <Boxes className="h-4 w-4 text-[#1e3a5f]" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">
                {barcodeEnabled ? "Choose Barcode / Batch" : "Choose Batch"}
              </h3>
              {productName ? (
                <p className="max-w-[520px] truncate text-xs text-slate-500">
                  {productName}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {canCreateBarcode ? (
          <div className="flex shrink-0 border-b border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setTab("existing")}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition ${
                tab === "existing"
                  ? "border-b-2 border-[#1e3a5f] bg-sky-50 text-[#1e3a5f]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              Existing
              <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                {batches.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("new")}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition ${
                tab === "new"
                  ? "border-b-2 border-[#1e3a5f] bg-sky-50 text-[#1e3a5f]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              Add New Barcode
            </button>
          </div>
        ) : null}

        <div className="shrink-0 border-b border-sky-100 bg-sky-50 px-4 py-1.5 text-[11px] text-sky-800">
          {tab === "existing"
            ? "Use ↑ / ↓ and Enter to choose. Stock and dates are shown inline."
            : `Create a separate barcode batch${
                nextBarcode ? ` • Next: ${nextBarcode}` : ""
              }.`}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === "existing" ? (
            batches.length === 0 ? (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                {barcodeEnabled ? (
                  <Barcode className="mb-2 h-8 w-8 text-slate-300" />
                ) : (
                  <Boxes className="mb-2 h-8 w-8 text-slate-300" />
                )}
                <p className="text-sm font-medium text-slate-600">
                  No sellable batches available
                </p>
                {canCreateBarcode ? (
                  <button
                    type="button"
                    onClick={() => setTab("new")}
                    className="mt-2 text-xs font-semibold text-sky-700 hover:underline"
                  >
                    Add a new barcode
                  </button>
                ) : null}
              </div>
            ) : (
              <div
                onKeyDown={handleListKeyDown}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[1.25fr_1.1fr_78px_78px_78px_68px_1.25fr] gap-2 border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <div>{barcodeEnabled ? "Barcode" : "Batch"}</div>
                      <div>Purchase Batch</div>
                      <div>MRP</div>
                      <div>Sale</div>
                      <div>Cost</div>
                      <div>Stock</div>
                      <div>Dates</div>
                    </div>

                    <div className="max-h-[48vh] divide-y divide-slate-200 overflow-y-auto">
                      {batches.map((batch, index) => (
                        <button
                          key={batch.id}
                          ref={index === 0 ? firstButtonRef : null}
                          type="button"
                          data-batch-btn="1"
                          onClick={() => handleSelect(batch)}
                          className="grid w-full grid-cols-[1.25fr_1.1fr_78px_78px_78px_68px_1.25fr] items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 outline-none transition hover:bg-sky-50 focus:bg-sky-50 focus:ring-2 focus:ring-inset focus:ring-sky-400"
                        >
                          <div
                            className="truncate font-mono font-semibold text-slate-900"
                            title={
                              barcodeEnabled
                                ? batch.barcode || ""
                                : batch.purchaseBatchNo || batch.batchNo || ""
                            }
                          >
                            {barcodeEnabled
                              ? batch.barcode || "—"
                              : batch.purchaseBatchNo || batch.batchNo || "—"}
                          </div>
                          <div
                            className="truncate"
                            title={batch.purchaseBatchNo || batch.batchNo || ""}
                          >
                            {batch.purchaseBatchNo || batch.batchNo || "—"}
                          </div>
                          <div className="font-medium">
                            {formatMoney(batch.mrp)}
                          </div>
                          <div className="font-medium text-sky-700">
                            {formatMoney(batch.salePrice)}
                          </div>
                          <div className="font-medium">
                            {formatMoney((batch as any).costPrice)}
                          </div>
                          <div>
                            <span
                              className={`inline-flex min-w-10 justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                                Number((batch as any).stock || 0) > 0
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {Number((batch as any).stock || 0)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 whitespace-nowrap text-[10px] text-slate-500">
                            <CalendarDays className="h-3 w-3 shrink-0 text-slate-400" />
                            <span>M {formatDate(batch.mfgDate)}</span>
                            <span className="text-slate-300">•</span>
                            <span>E {formatDate(batch.expiryDate)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : null}

          {canCreateBarcode && tab === "new" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-sky-700" />
                  <span className="text-xs font-semibold text-sky-900">
                    Auto-generate
                  </span>
                </div>
                <p className="mb-3 text-[11px] text-sky-700">
                  Next available barcode:{" "}
                  <span className="font-mono font-bold">
                    {nextBarcode || "—"}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => handleAddNew(nextBarcode || "")}
                  disabled={!nextBarcode}
                  className="h-9 w-full rounded-lg bg-[#1e3a5f] text-xs font-semibold text-white transition hover:bg-[#16304f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use {nextBarcode || "generated barcode"}
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-slate-600" />
                  <span className="text-xs font-semibold text-slate-800">
                    Custom barcode
                  </span>
                </div>
                <p className="mb-3 text-[11px] text-slate-500">
                  Enter an EAN, QR value or internal code.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customBarcode}
                    onChange={(event) => setCustomBarcode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddNew(customBarcode);
                      }
                    }}
                    placeholder="Barcode value"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-xs text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    autoFocus={batches.length === 0}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddNew(customBarcode)}
                    disabled={!customBarcode.trim()}
                    className="h-9 rounded-lg bg-slate-800 px-4 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Use
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-[11px] text-slate-500">
            <strong className="text-slate-700">{batches.length}</strong>{" "}
            available
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
