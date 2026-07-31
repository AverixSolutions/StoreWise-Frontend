// src/components/quotations/QuotationViewModal.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Printer,
  ArrowRight,
  Loader2,
  CheckCircle,
  Clock,
  Send,
  XCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { platform } from "@/platform";
import { isSyncEnabled } from "@/platform/mode";
import { SyncManager } from "@/sync/SyncManager";
import { printQuotation } from "@/lib/print/printQuotation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quotationId: string | null;
  onEdit: (id: string) => void;
  onDeleted: () => void;
}

const STATUS_BADGE: Record<
  string,
  { label: string; cls: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: "Draft",
    cls: "bg-slate-100/80 text-slate-500 border-slate-200",
    icon: <Clock className="w-3 h-3" />,
  },
  SENT: {
    label: "Sent",
    cls: "bg-sky-50 text-sky-600 border-sky-200",
    icon: <Send className="w-3 h-3" />,
  },
  CONVERTED: {
    label: "Converted",
    cls: "bg-emerald-50 text-emerald-600 border-emerald-200",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  EXPIRED: {
    label: "Expired",
    cls: "bg-rose-50 text-rose-600 border-rose-200",
    icon: <XCircle className="w-3 h-3" />,
  },
};

function getConvertedSaleLabel(quotation: any) {
  if (!quotation) return "";

  if (quotation.convertedSaleBillNo) {
    return `Sale ${quotation.convertedSaleBillNo}`;
  }

  if (quotation.convertedSaleSlNo != null) {
    return `Sale ${String(quotation.convertedSaleSlNo).padStart(5, "0")}`;
  }

  return "Converted sale";
}

export default function QuotationViewModal({
  isOpen,
  onClose,
  quotationId,
  onEdit,
  onDeleted,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [quotation, setQuotation] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen || !quotationId) return;
    setLoading(true);
    setConfirmDelete(false);
    platform
      .getQuotationFull?.(quotationId)
      .then((res) => {
        if (res?.success) {
          setQuotation((res as any).quotation);
          setItems((res as any).items || []);
        }
      })
      .finally(() => setLoading(false));
  }, [isOpen, quotationId]);

  async function handleDelete() {
    if (!quotationId) return;
    setDeleting(true);
    try {
      const res = await platform.deleteQuotation?.(quotationId);
      if (!res?.success) {
        alert((res as any)?.error || "Delete failed");
        return;
      }
      if (isSyncEnabled()) {
        SyncManager.pushEntity("quotation").catch(() => {});
        SyncManager.pushEntity("quotationItem").catch(() => {});
      }
      onDeleted();
    } catch (err: any) {
      alert(err.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handlePrint() {
    if (!quotationId) return;
    try {
      await printQuotation(quotationId, { preview: true });
    } catch (err: any) {
      alert(err.message || "Print failed");
    }
  }

  function handleOpenInSales() {
    if (!quotationId) return;
    onClose();
    router.push(
      `/dashboard/sales?quotationId=${encodeURIComponent(quotationId)}`,
    );
  }

  if (!isOpen) return null;

  const badge = STATUS_BADGE[quotation?.status] ?? STATUS_BADGE["DRAFT"];
  const isConverted = quotation?.status === "CONVERTED";
  const canOpenInSales =
    quotation?.status === "DRAFT" || quotation?.status === "SENT";
  const subTotal = items.reduce(
    (s: number, it: any) => s + Number(it.billedValue || 0),
    0,
  );
  const discountAmt = Number(quotation?.discount || 0);
  const grandTotal = Math.max(0, subTotal - discountAmt);
  const convertedSaleLabel = getConvertedSaleLabel(quotation);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[24px] bg-white shadow-[0_24px_60px_rgba(7,12,24,0.22)] overflow-hidden border border-slate-200/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#0f1e38_60%,#16213d_100%)] text-white shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight">
              Quotation Details
            </h2>
            {quotation?.quotationNo && (
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/10 text-xs font-medium">
                {quotation.quotationNo}
              </span>
            )}
            {quotation?.status && (
              <span
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-medium ${badge.cls}`}
              >
                {badge.icon}
                {badge.label}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  {
                    label: "Date",
                    value: quotation?.quotationDate
                      ? new Date(quotation.quotationDate).toLocaleDateString(
                          "en-IN",
                        )
                      : "—",
                  },
                  {
                    label: "Customer",
                    value: quotation?.customerName || "—",
                  },
                  {
                    label: "Department",
                    value: quotation?.department || "—",
                  },
                  {
                    label: "Grand Total",
                    value: `₹${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
                    highlight: true,
                  },
                ].map((cell) => (
                  <div
                    key={cell.label}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 block mb-0.5">
                      {cell.label}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        cell.highlight ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {cell.value}
                    </span>
                  </div>
                ))}
              </div>

              {isConverted && (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                        <CheckCircle className="h-4 w-4" />
                        This quotation has been converted to a sale
                      </div>
                      <p className="mt-1 text-xs text-emerald-700">
                        This is now a locked quotation record linked to{" "}
                        <span className="font-semibold">
                          {convertedSaleLabel}
                        </span>
                        .
                      </p>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      {convertedSaleLabel}
                    </span>
                  </div>
                </div>
              )}

              {quotation?.notes && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  {quotation.notes}
                </div>
              )}

              {/* Items table */}
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm border-collapse min-w-[560px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100">
                      <th className="px-3 py-2.5 text-left w-8 font-semibold">
                        #
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold">
                        Product
                      </th>
                      <th className="px-3 py-2.5 text-right w-16 font-semibold">
                        Qty
                      </th>
                      <th className="px-3 py-2.5 text-left w-16 font-semibold">
                        Unit
                      </th>
                      <th className="px-3 py-2.5 text-right w-24 font-semibold">
                        Rate
                      </th>
                      <th className="px-3 py-2.5 text-right w-24 font-semibold">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, i: number) => (
                      <tr
                        key={it.id}
                        className="border-b border-slate-50 last:border-0 hover:bg-sky-50/30 transition-colors"
                      >
                        <td className="px-3 py-2.5 text-slate-400 text-xs text-center">
                          {it.lineNo ?? i + 1}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          {it.productName || it.name || it.productId}
                          {it.batchNo && (
                            <span className="ml-2 text-xs text-slate-400 font-normal">
                              [{it.batchNo}]
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">
                          {it.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 text-xs">
                          {it.unit}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">
                          ₹{Number(it.rate || 0).toFixed(2)}
                          <div className="text-[10px] font-normal text-slate-400">
                            {it.rateTypeName ||
                              (it.rateSource === "CUSTOM"
                                ? "Custom"
                                : "Legacy")}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                          ₹{Number(it.billedValue || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-3 flex justify-end">
                <div className="w-56 text-sm space-y-1.5">
                  <div className="flex justify-between text-slate-500">
                    <span>Sub Total</span>
                    <span className="tabular-nums">₹{subTotal.toFixed(2)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Discount</span>
                      <span className="tabular-nums">
                        −₹{discountAmt.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-1.5">
                    <span>Grand Total</span>
                    <span className="tabular-nums">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delete confirm */}
              {confirmDelete && (
                <div className="mt-4 p-4 rounded-xl border border-rose-200 bg-rose-50">
                  <p className="text-sm text-rose-700 font-medium mb-3">
                    Delete this quotation? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition disabled:opacity-60 cursor-pointer"
                    >
                      {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2 text-sm text-slate-600 hover:bg-white rounded-lg transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer actions ── */}
        {!loading && (
          <div className="shrink-0 border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              {!isConverted && (
                <>
                  <button
                    onClick={() => quotationId && onEdit(quotationId)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </>
              )}
            </div>

            {canOpenInSales ? (
              <button
                onClick={handleOpenInSales}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer shadow-[0_4px_12px_rgba(5,150,105,0.25)]"
              >
                <ArrowRight className="w-4 h-4" />
                Open in Sales
              </button>
            ) : isConverted ? (
              <span className="flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
                <CheckCircle className="w-4 h-4" />
                {convertedSaleLabel}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-rose-600 font-medium">
                <XCircle className="w-4 h-4" />
                Expired
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
