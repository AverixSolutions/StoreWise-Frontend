// src/components/products/ProductBatchesDrawer.tsx
"use client";

import { useEffect, useState } from "react";
import { platform } from "@/platform";
import { X, Boxes, Trash2, Plus } from "lucide-react";

type Batch = {
  id: string;
  barcode?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  costPrice?: number | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  receivedAt?: string | null;
  stock: number;
  deletedAt?: string | null;
};

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";

export default function ProductBatchesDrawer({
  open,
  onClose,
  productId,
  licenseId,
  productName,
}: {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  licenseId: string;
  productName?: string;
}) {
  const [rows, setRows] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (!productId) return;
    const res = await platform.listBatchesForProduct(productId, false);
    if (res?.success) {
      setRows(res.rows);
      setTotal(res.totalStock ?? 0);
    }
  }

  useEffect(() => {
    if (open && productId) refresh();
  }, [open, productId]);

  async function addOrAdjust(form: FormData) {
    if (!productId) return;
    setSaving(true);
    try {
      const payload = {
        licenseId,
        productId,
        barcode: form.get("barcode")?.toString() || null,
        mrp: form.get("mrp") ? Number(form.get("mrp")) : null,
        salePrice: form.get("salePrice") ? Number(form.get("salePrice")) : null,
        costPrice: form.get("costPrice") ? Number(form.get("costPrice")) : null,
        batchNo: form.get("batchNo")?.toString() || null,
        mfgDate: form.get("mfgDate")?.toString() || null,
        expiryDate: form.get("expiryDate")?.toString() || null,
        receivedAt: form.get("receivedAt")?.toString() || undefined,
        stock: form.get("deltaQty") ? Number(form.get("deltaQty")) : 0,
      };

      const result = await platform.saveBatch(payload);
      if (!result?.success) {
        alert(`Failed to save batch: ${result?.error || "Unknown error"}`);
        return;
      }

      await platform.rebuildProductStock?.(productId);
      await refresh();
      (document.getElementById("batch-form") as HTMLFormElement)?.reset();
    } catch (err: any) {
      alert(`Error: ${err?.message || "Failed to save batch"}`);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this batch? Stock will be removed from totals."))
      return;
    const result = await platform.deleteBatch?.(id);
    if (!result?.success) {
      alert(`Failed to delete batch: ${result?.error || "Unknown error"}`);
      return;
    }
    await refresh();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Sheet on mobile, centered panel on sm+ */}
      <div
        className="w-full sm:max-w-3xl rounded-t-[28px] sm:rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.97))] shadow-[0_-10px_60px_rgba(3,10,24,0.18)] backdrop-blur flex flex-col max-h-[92dvh] sm:max-h-[90dvh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden rounded-t-[28px] bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-6 py-5 text-white shrink-0">
          <div className="pointer-events-none absolute -left-8 top-0 h-24 w-24 rounded-full bg-cyan-400/15 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="kyn-brand-pill mb-2 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                Batch Management
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">
                {productName || "Product Batches"}
              </h2>
              {productName && (
                <p className="mt-1 text-sm text-slate-400">{productId}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 sm:p-6 space-y-5">
          {/* Total Stock KPI */}
          <div className="flex items-center gap-5 rounded-[22px] border border-white/8 bg-[linear-gradient(135deg,#091120,#16213d)] p-5 text-white shadow-[0_10px_30px_rgba(5,10,20,0.14)]">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl kyn-brand-chip">
              <Boxes className="h-7 w-7 text-slate-900" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Total Stock
              </p>
              <p className="mt-1 text-4xl font-semibold tracking-[-0.06em] text-white">
                {total}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[11px] text-slate-400">Batches</p>
              <p className="text-2xl font-semibold text-white">{rows.length}</p>
            </div>
          </div>

          {/* Add / Adjust form */}
          <div className="rounded-[22px] border border-slate-200/80 bg-white/80 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl kyn-brand-chip">
                <Plus className="h-3.5 w-3.5 text-slate-800" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Add / Adjust Batch
              </h3>
            </div>

            <form
              id="batch-form"
              onSubmit={(e) => {
                e.preventDefault();
                addOrAdjust(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Batch Barcode</label>
                  <input
                    name="barcode"
                    placeholder="Enter barcode"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Batch Number</label>
                  <input
                    name="batchNo"
                    placeholder="Enter batch no."
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>MRP (₹)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">
                      ₹
                    </span>
                    <input
                      name="mrp"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className={`${fieldClass} pl-8`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Sale Price (₹)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">
                      ₹
                    </span>
                    <input
                      name="salePrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className={`${fieldClass} pl-8`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Cost Price (₹)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">
                      ₹
                    </span>
                    <input
                      name="costPrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className={`${fieldClass} pl-8`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Manufacturing Date</label>
                  <input name="mfgDate" type="date" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Expiry Date</label>
                  <input name="expiryDate" type="date" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Received At</label>
                  <input
                    name="receivedAt"
                    type="datetime-local"
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Quantity Change{" "}
                    <span className="normal-case tracking-normal text-slate-400">
                      (+ add, − reduce)
                    </span>
                  </label>
                  <input
                    name="deltaQty"
                    type="number"
                    step="1"
                    placeholder="e.g. +100 or -50"
                    required
                    className={fieldClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving…
                  </span>
                ) : (
                  "Save Batch"
                )}
              </button>
            </form>
          </div>

          {/* Existing batches */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="mb-1 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Existing Batches
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                  <Boxes className="h-7 w-7 text-slate-300" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-500">
                  No batches yet
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Add your first batch using the form above.
                </p>
              </div>
            ) : (
              rows.map((r) => (
                <div
                  key={r.id}
                  className="rounded-[20px] border border-slate-200/80 bg-white/90 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="font-semibold text-slate-900 text-sm">
                          {r.batchNo || "No Batch #"}
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-500">
                          {r.barcode || "No barcode"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                        {[
                          {
                            label: "MRP",
                            value: r.mrp != null ? `₹${r.mrp}` : "—",
                          },
                          {
                            label: "Sale",
                            value:
                              r.salePrice != null ? `₹${r.salePrice}` : "—",
                          },
                          {
                            label: "Cost",
                            value:
                              r.costPrice != null ? `₹${r.costPrice}` : "—",
                          },
                          { label: "Mfg", value: r.mfgDate || "—" },
                          { label: "Exp", value: r.expiryDate || "—" },
                          {
                            label: "Received",
                            value: r.receivedAt
                              ? new Date(r.receivedAt).toLocaleDateString()
                              : "—",
                          },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                              {label}
                            </span>
                            <p className="mt-0.5 text-sm font-medium text-slate-800">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-2 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Stock
                        </p>
                        <p className="mt-0.5 text-2xl font-semibold text-slate-900">
                          {r.stock}
                        </p>
                      </div>
                      <button
                        onClick={() => onDelete(r.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100"
                        title="Delete batch"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
