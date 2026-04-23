// src/components/products/ProductViewModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Package, Layers, Receipt, Boxes, Barcode } from "lucide-react";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import type { ProductSummary } from "@/platform/types";

type Product = ProductSummary;
type BarcodeRow = { id: string; barcode?: string | null };

function money(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `₹${Number(value).toFixed(2)}`;
}

function fieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <div className="mt-0.5 text-[12px] font-semibold text-slate-800 break-words leading-4">
        {value}
      </div>
    </div>
  );
}

export default function ProductViewModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}) {
  const [barcodes, setBarcodes] = useState<string[]>([]);
  const [loadingBarcodes, setLoadingBarcodes] = useState(false);

  const licenseId = typeof window !== "undefined" ? getActiveLicenseId() : "";

  useEffect(() => {
    let alive = true;

    async function loadBarcodes() {
      if (!open || !product?.id || !licenseId) {
        setBarcodes([]);
        return;
      }

      setLoadingBarcodes(true);
      try {
        const res = await platform.listBarcodesForProduct?.(
          licenseId,
          product.id,
        );
        if (!alive) return;

        const nextBarcodes = (res?.rows || [])
          .map((row: BarcodeRow) => String(row?.barcode || "").trim())
          .filter(Boolean);

        setBarcodes(Array.from(new Set(nextBarcodes)));
      } catch {
        if (!alive) return;
        setBarcodes([]);
      } finally {
        if (alive) setLoadingBarcodes(false);
      }
    }

    loadBarcodes();

    return () => {
      alive = false;
    };
  }, [open, product?.id, licenseId]);

  const barcodeSummary = useMemo(() => {
    if (loadingBarcodes) return "Loading...";
    if (barcodes.length === 0) return "—";
    return `${barcodes.length} barcode${barcodes.length > 1 ? "s" : ""}`;
  }, [barcodes, loadingBarcodes]);

  if (!open || !product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl rounded-t-[22px] sm:rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_-10px_50px_rgba(3,10,24,0.16)] overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[84dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden rounded-t-[22px] bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-3.5 py-2.5 text-white shrink-0">
          <div className="pointer-events-none absolute -left-6 top-0 h-14 w-14 rounded-full bg-cyan-400/15 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-14 w-14 rounded-full bg-fuchsia-500/15 blur-2xl" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/80 border border-white/15 bg-white/10">
                Product Details
              </div>
              <h2 className="mt-1 truncate text-sm sm:text-base font-semibold text-white">
                {product.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-3.5 py-2.5 sm:px-4 sm:py-2.5 space-y-2">
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/8 bg-[linear-gradient(135deg,#091120,#16213d)] px-2.5 py-2 text-white shadow-[0_6px_18px_rgba(5,10,20,0.10)]">
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10">
                  <Package className="h-3 w-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] uppercase tracking-[0.12em] text-slate-400">
                    Code
                  </p>
                  <p className="font-mono text-xs font-semibold text-white truncate">
                    #{fieldValue(product.code)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Boxes className="h-3 w-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] uppercase tracking-[0.12em] text-emerald-600">
                    Stock
                  </p>
                  <p className="text-xs font-semibold text-emerald-700 truncate">
                    {fieldValue((product as any).stock)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-fuchsia-100 text-fuchsia-700">
                  <Layers className="h-3 w-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] uppercase tracking-[0.12em] text-fuchsia-600">
                    Batches
                  </p>
                  <p className="text-xs font-semibold text-fuchsia-700 truncate">
                    {fieldValue((product as any).batchCount ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main info */}
          <div className="grid grid-cols-2 gap-2">
            <InfoCard
              label="Product Name"
              value={fieldValue((product as any).productName || product.name)}
            />
            <InfoCard label="Brand" value={fieldValue(product.brand)} />
            <InfoCard label="Category" value={fieldValue(product.category)} />

            {(product as any).subcategory && (
              <InfoCard
                label="Subcategory"
                value={fieldValue((product as any).subcategory)}
              />
            )}

            {(product as any).model && (
              <InfoCard
                label="Model / Variant"
                value={fieldValue((product as any).model)}
              />
            )}

            {(product as any).size && (
              <InfoCard
                label="Size / Qty"
                value={fieldValue((product as any).size)}
              />
            )}

            <InfoCard label="Unit" value={fieldValue(product.unit)} />
            <InfoCard label="Tax" value={fieldValue(product.tax)} />
            <InfoCard
              label="HSN Code"
              value={fieldValue((product as any).hsn)}
            />
            <InfoCard
              label="Cost Price"
              value={money((product as any).costPrice)}
            />
            <InfoCard
              label="Sale Price"
              value={money((product as any).salePrice)}
            />
          </div>

          {/* Barcode section */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Barcode className="h-3 w-3" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">Barcodes</p>
                <p className="text-[10px] text-slate-400">{barcodeSummary}</p>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {loadingBarcodes ? (
                <span className="text-[11px] text-slate-400">Loading...</span>
              ) : barcodes.length === 0 ? (
                <span className="text-[11px] text-slate-400">
                  No barcodes found
                </span>
              ) : (
                barcodes.map((barcode) => (
                  <span
                    key={barcode}
                    className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-700"
                  >
                    {barcode}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5">
            <div className="flex items-start gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                <Receipt className="h-3 w-3" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Quick Summary
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {fieldValue(product.name)}
                  </span>{" "}
                  is the saved item name.
                  {(product as any).productName && (
                    <>
                      {" "}
                      Base product:{" "}
                      <span className="font-semibold text-slate-700">
                        {fieldValue((product as any).productName)}
                      </span>
                      .
                    </>
                  )}
                  {product.brand && (
                    <>
                      {" "}
                      Brand:{" "}
                      <span className="font-semibold text-slate-700">
                        {fieldValue(product.brand)}
                      </span>
                      .
                    </>
                  )}
                  {product.category && (
                    <>
                      {" "}
                      Category:{" "}
                      <span className="font-semibold text-slate-700">
                        {fieldValue(product.category)}
                      </span>
                      {(product as any).subcategory && (
                        <>
                          {" "}
                          ›{" "}
                          <span className="font-semibold text-slate-700">
                            {fieldValue((product as any).subcategory)}
                          </span>
                        </>
                      )}
                      .
                    </>
                  )}
                  {(product as any).model && (
                    <>
                      {" "}
                      Variant:{" "}
                      <span className="font-semibold text-slate-700">
                        {fieldValue((product as any).model)}
                      </span>
                      .
                    </>
                  )}
                  {(product as any).size && (
                    <>
                      {" "}
                      Size:{" "}
                      <span className="font-semibold text-slate-700">
                        {fieldValue((product as any).size)}
                      </span>
                      .
                    </>
                  )}{" "}
                  It uses{" "}
                  <span className="font-semibold text-slate-700">
                    {fieldValue(product.unit)}
                  </span>{" "}
                  as the selling unit, carries tax code{" "}
                  <span className="font-semibold text-slate-700">
                    {fieldValue(product.tax)}
                  </span>
                  , stock{" "}
                  <span className="font-semibold text-slate-700">
                    {fieldValue((product as any).stock)}
                  </span>
                  , and{" "}
                  <span className="font-semibold text-slate-700">
                    {fieldValue((product as any).batchCount ?? 0)}
                  </span>{" "}
                  batches.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 bg-white/80 px-3.5 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
