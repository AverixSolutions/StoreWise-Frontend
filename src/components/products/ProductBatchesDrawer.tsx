// src/components/products/ProductBatchesDrawer.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { platform } from "@/platform";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { X, Boxes, Trash2, Plus, Edit2 } from "lucide-react";

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
  "w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400";

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
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Batch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);

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

  // ── Helpers ──────────────────────────────────────────────────────────────

  function money(value?: number | null) {
    return value != null ? `₹${value}` : "—";
  }

  function shortDate(value?: string | null) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString();
  }

  function toLocalDateTimeInput(value?: string | null) {
    if (!value) return "";
    const date = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function resetBatchForm() {
    formRef.current?.reset();
    setEditTarget(null);
  }

  function startEdit(batch: Batch) {
    setEditTarget(batch);

    const form = formRef.current;
    if (!form) return;

    (form.elements.namedItem("barcode") as HTMLInputElement).value =
      batch.barcode || "";
    (form.elements.namedItem("batchNo") as HTMLInputElement).value =
      batch.batchNo || "";
    (form.elements.namedItem("mrp") as HTMLInputElement).value =
      batch.mrp != null ? String(batch.mrp) : "";
    (form.elements.namedItem("salePrice") as HTMLInputElement).value =
      batch.salePrice != null ? String(batch.salePrice) : "";
    (form.elements.namedItem("costPrice") as HTMLInputElement).value =
      batch.costPrice != null ? String(batch.costPrice) : "";
    (form.elements.namedItem("mfgDate") as HTMLInputElement).value =
      batch.mfgDate || "";
    (form.elements.namedItem("expiryDate") as HTMLInputElement).value =
      batch.expiryDate || "";
    (form.elements.namedItem("receivedAt") as HTMLInputElement).value =
      toLocalDateTimeInput(batch.receivedAt);

    const deltaInput = form.elements.namedItem(
      "deltaQty",
    ) as HTMLInputElement | null;
    if (deltaInput) deltaInput.value = "";

    window.requestAnimationFrame(() => {
      const scrollArea = scrollAreaRef.current;
      const formSection = formSectionRef.current;

      if (scrollArea && formSection) {
        scrollArea.scrollTo({
          top: Math.max(formSection.offsetTop - 8, 0),
          behavior: "smooth",
        });
      } else {
        formSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      window.setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 180);
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function submitBatch(form: FormData) {
    if (!productId) return;
    setSaving(true);

    try {
      const deltaQty = form.get("deltaQty") ? Number(form.get("deltaQty")) : 0;

      const basePayload = {
        licenseId,
        productId,
        barcode: form.get("barcode")?.toString() || null,
        mrp: form.get("mrp") ? Number(form.get("mrp")) : null,
        salePrice: form.get("salePrice") ? Number(form.get("salePrice")) : null,
        costPrice: form.get("costPrice") ? Number(form.get("costPrice")) : null,
        batchNo: form.get("batchNo")?.toString() || null,
        mfgDate: form.get("mfgDate")?.toString() || null,
        expiryDate: form.get("expiryDate")?.toString() || null,
        receivedAt: form.get("receivedAt")?.toString() || null,
      };

      if (editTarget) {
        const updateResult = await platform.updateBatch({
          id: editTarget.id,
          ...basePayload,
        });

        if (!updateResult?.success) {
          throw new Error(updateResult?.error || "Failed to update batch");
        }

        if (deltaQty !== 0) {
          const stockResult = await platform.saveBatch({
            ...basePayload,
            stock: deltaQty,
          });

          if (!stockResult?.success) {
            throw new Error(
              stockResult?.error || "Failed to update batch stock",
            );
          }
        }

        showToast("success", "Batch updated successfully.");
      } else {
        const result = await platform.saveBatch({
          ...basePayload,
          stock: deltaQty,
        });

        if (!result?.success) {
          throw new Error(result?.error || "Failed to save batch");
        }

        showToast("success", "Batch saved successfully.");
      }

      await platform.rebuildProductStock?.(productId);
      await refresh();
      resetBatchForm();
    } catch (err: any) {
      showToast("error", err?.message || "Failed to save batch");
    } finally {
      setSaving(false);
    }
  }
  // ── Delete ────────────────────────────────────────────────────────────────

  function requestDelete(batch: Batch) {
    setDeleteTarget(batch);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await platform.deleteBatch?.(deleteTarget.id);
    if (!result?.success) {
      showToast(
        "error",
        `Failed to delete batch: ${result?.error || "Unknown error"}`,
      );
      return;
    }
    setDeleteTarget(null);
    await refresh();
    showToast("success", "Batch deleted successfully.");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full rounded-t-[24px] sm:max-w-2xl lg:max-w-[760px] sm:rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.97))] shadow-[0_-10px_50px_rgba(3,10,24,0.16)] backdrop-blur flex flex-col max-h-[94dvh] sm:max-h-[88dvh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-t-[24px] bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-3.5 py-3 text-white shrink-0">
          <div className="pointer-events-none absolute -left-8 top-0 h-24 w-24 rounded-full bg-cyan-400/15 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
              <span className="kyn-brand-pill shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/80 whitespace-nowrap">
                Batch Management
              </span>
              <h2 className="text-sm font-semibold tracking-[-0.02em] text-white truncate">
                {productName || "Product Batches"}
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

        {/* ── Scrollable content ── */}
        <div
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto no-scrollbar px-3 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-3 space-y-3"
        >
          {/* Total Stock KPI */}
          <div className="flex items-center gap-3 rounded-[16px] border border-white/8 bg-[linear-gradient(135deg,#091120,#16213d)] px-3.5 py-3 text-white shadow-[0_6px_18px_rgba(5,10,20,0.12)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl kyn-brand-chip">
              <Boxes className="h-4 w-4 text-slate-900" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Total Stock
              </p>
              <p className="mt-0.5 text-2xl font-semibold tracking-[-0.06em] text-white">
                {total}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] text-slate-400">Batches</p>
              <p className="text-lg font-semibold text-white">{rows.length}</p>
            </div>
          </div>

          {/* ── Add / Edit form ── */}
          <div
            ref={formSectionRef}
            className={`rounded-[16px] border bg-white/80 p-3.5 space-y-3 transition ${
              editTarget
                ? "border-cyan-300 ring-2 ring-cyan-100"
                : "border-slate-200/80"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-xl kyn-brand-chip">
                {editTarget ? (
                  <Edit2 className="h-3 w-3 text-slate-800" />
                ) : (
                  <Plus className="h-3 w-3 text-slate-800" />
                )}
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                {editTarget ? "Edit Batch" : "Add / Adjust Batch"}
              </h3>
            </div>

            <form
              ref={formRef}
              id="batch-form"
              onSubmit={(e) => {
                e.preventDefault();
                submitBatch(new FormData(e.currentTarget));
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Barcode */}
                <div>
                  <label className={labelClass}>Batch Barcode</label>
                  <input
                    ref={barcodeInputRef}
                    name="barcode"
                    placeholder="Enter barcode"
                    className={fieldClass}
                  />
                </div>

                {/* Batch No */}
                <div>
                  <label className={labelClass}>Batch Number</label>
                  <input
                    name="batchNo"
                    placeholder="Enter batch no."
                    className={fieldClass}
                  />
                </div>

                {/* MRP */}
                <div>
                  <label className={labelClass}>MRP (₹)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                      ₹
                    </span>
                    <input
                      name="mrp"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      className={`${fieldClass} pl-7`}
                    />
                  </div>
                </div>

                {/* Sale Price */}
                <div>
                  <label className={labelClass}>Sale Price (₹)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                      ₹
                    </span>
                    <input
                      name="salePrice"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      className={`${fieldClass} pl-7`}
                    />
                  </div>
                </div>

                {/* Cost Price */}
                <div>
                  <label className={labelClass}>Cost Price (₹)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                      ₹
                    </span>
                    <input
                      name="costPrice"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      className={`${fieldClass} pl-7`}
                    />
                  </div>
                </div>

                {/* Mfg Date */}
                <div>
                  <label className={labelClass}>Manufacturing Date</label>
                  <input name="mfgDate" type="date" className={fieldClass} />
                </div>

                {/* Expiry Date */}
                <div>
                  <label className={labelClass}>Expiry Date</label>
                  <input name="expiryDate" type="date" className={fieldClass} />
                </div>

                {/* Received At */}
                <div>
                  <label className={labelClass}>Received At</label>
                  <input
                    name="receivedAt"
                    type="datetime-local"
                    className={fieldClass}
                  />
                </div>

                {/* Quantity */}
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
                    defaultValue="0"
                    placeholder="e.g. +100 or -50"
                    className={fieldClass}
                  />
                </div>
              </div>

              {/* Cancel Edit */}
              <div
                className={`grid gap-2 ${editTarget ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {editTarget && (
                  <button
                    type="button"
                    onClick={resetBatchForm}
                    className="rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel Edit
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-3.5 w-3.5 animate-spin"
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
                  ) : editTarget ? (
                    "Update Batch"
                  ) : (
                    "Save Batch"
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── Existing Batches ── */}
          <div className="space-y-2.5">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Existing Batches
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                  <Boxes className="h-6 w-6 text-slate-300" />
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
                  className="rounded-[14px] border border-slate-200/80 bg-white/95 p-3"
                >
                  <div className="flex items-start gap-3">
                    {/* Main content */}
                    <div className="min-w-0 flex-1">
                      {/* Top line */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="max-w-full truncate text-sm font-semibold text-slate-900">
                          {r.batchNo || "No Batch #"}
                        </span>

                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-500">
                          {r.barcode || "No barcode"}
                        </span>

                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Stock {r.stock}
                        </span>
                      </div>

                      {/* Detail chips */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          <span className="font-semibold text-slate-500">
                            MRP:
                          </span>{" "}
                          {money(r.mrp)}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          <span className="font-semibold text-slate-500">
                            Sale:
                          </span>{" "}
                          {money(r.salePrice)}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          <span className="font-semibold text-slate-500">
                            Cost:
                          </span>{" "}
                          {money(r.costPrice)}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          <span className="font-semibold text-slate-500">
                            Mfg:
                          </span>{" "}
                          {shortDate(r.mfgDate)}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          <span className="font-semibold text-slate-500">
                            Exp:
                          </span>{" "}
                          {shortDate(r.expiryDate)}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          <span className="font-semibold text-slate-500">
                            Recv:
                          </span>{" "}
                          {shortDate(r.receivedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => startEdit(r)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 text-[11px] font-semibold text-cyan-700 transition hover:bg-cyan-100"
                        title="Edit batch"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>

                      <button
                        onClick={() => requestDelete(r)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                        title="Delete batch"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Confirm Delete Modal ── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete batch?"
        message={
          deleteTarget
            ? `Are you sure you want to delete batch "${deleteTarget.batchNo || deleteTarget.barcode || deleteTarget.id}"?\n\nIts stock will be removed from this product totals.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
