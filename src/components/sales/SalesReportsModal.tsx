// src/components/sales/SalesReportsModal.tsx
"use client";
import { useEffect, useState } from "react";
import {
  X,
  Search,
  Calendar,
  RotateCcw,
  Trash2,
  ExternalLink,
  ShoppingCart,
  Maximize2,
  Minimize2,
} from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Pagination from "@/components/ui/Pagination";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import { platform } from "@/platform";
import { isSyncEnabled } from "@/platform/mode";
import { SyncManager } from "@/sync/SyncManager";

type Row = {
  id: string;
  slNo: number | null;
  billNo?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  dateIso: string;
  totalAmount: number;
  discount: number;
  saleType: "CASH" | "CREDIT";
  isDeleted?: boolean;
};

export interface SalesReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseId: string;
  customers: Array<{ id: string; name: string }>;
  onOpenSale: (id: string) => void;
  onReturnSale?: (id: string) => void;
  openingId?: string;
}

export default function SalesReportsModal({
  isOpen,
  onClose,
  licenseId,
  customers,
  onOpenSale,
  onReturnSale,
  openingId,
}: SalesReportsModalProps) {
  const [q, setQ] = useState("");
  const [customerId, setCustomerId] = useState<string | "">("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(true);

  const customerOptions = [
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ];

  async function refresh() {
    setLoading(true);
    try {
      const res = await platform.listSales?.(licenseId, {
        q,
        customerId: customerId || null,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
        dateTo: dateTo
          ? new Date(
              new Date(dateTo).getTime() + 24 * 60 * 60 * 1000,
            ).toISOString()
          : null,
        page,
        pageSize,
      });
      const mapped: Row[] = (res?.rows || []).map((r: any) => ({
        id: r.id,
        slNo: r.slNo ?? null,
        billNo: r.billNo,
        customerId: r.customerId,
        customerName: r.customerName,
        dateIso: r.saleDate,
        totalAmount: Number(r.totalAmount || 0),
        discount: Number(r.discount || 0),
        saleType: r.saleType || "CASH",
        isDeleted: !!r.deletedAt,
      }));
      setRows(mapped);
      setTotal(res?.total || 0);
    } catch (e) {
      console.error("Failed to load sales", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, page, pageSize]);

  function resetAndRefresh() {
    setPage(1);
    refresh();
  }

  function handleDelete(id: string) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await platform.deleteSale?.(deleteId);
    if (isSyncEnabled()) {
      SyncManager.pushEntity("sale").catch(() => {});
      SyncManager.pushEntity("saleItem").catch(() => {});
      SyncManager.pushEntity("customerTransaction").catch(() => {});
      SyncManager.pushEntity("cashTransaction").catch(() => {});
      SyncManager.pushEntity("product").catch(() => {});
    }
    setDeleteId(null);
    refresh();
  }

  const toggleMaximized = () => {
    setIsMaximized((value) => !value);
  };

  const panelSizeClass = isMaximized
    ? "h-[calc(100dvh-16px)] w-[calc(100vw-16px)] rounded-[24px]"
    : "h-[86dvh] w-[min(1180px,calc(100vw-32px))] rounded-[24px]";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-md sm:p-4">
      <div
        className={`flex flex-col overflow-hidden border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.99))] shadow-[0_24px_90px_rgba(2,6,23,0.32)] transition-[width,height,border-radius,box-shadow] duration-200 ${panelSizeClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden bg-[linear-gradient(135deg,#07101f_0%,#0f1a31_58%,#17213c_100%)] px-3 py-1.5 text-white sm:px-4">
          <div className="pointer-events-none absolute -left-8 top-0 h-24 w-24 rounded-full bg-cyan-400/15 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-2xl" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
              </div>

              <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                <span className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white">
                  Sales Reports
                </span>
                <span className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-white/35 sm:inline">
                  · {total > 0 ? `${total} records` : "All sales"}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMaximized}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                title={isMaximized ? "Restore window" : "Maximize window"}
              >
                {isMaximized ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-rose-500/80"
                title="Close"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Opening banner */}
        {openingId && (
          <div className="flex shrink-0 items-center gap-2 border-b border-cyan-200/70 bg-cyan-50 px-4 py-2 text-xs font-medium text-cyan-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
            Opening sale{" "}
            <span className="font-mono font-semibold">{openingId}</span>…
          </div>
        )}

        {/* Content */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/80 px-3 py-3 sm:px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Filters */}
          <section className="rounded-[18px] border border-slate-200 bg-white/85 p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-[38px] w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
                  placeholder="Bill no / customer…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && resetAndRefresh()}
                />
              </div>

              {/* Customer — SearchableDropdown */}
              <SearchableDropdown
                value={customerId}
                onChange={(val) => setCustomerId(val)}
                options={customerOptions}
                placeholder="All customers"
                buttonProps={{
                  className:
                    "h-[38px] rounded-2xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10",
                }}
              />

              {/* Date From */}
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  className="h-[38px] w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              {/* Date To */}
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  className="h-[38px] w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="truncate text-xs font-medium text-slate-500">
                {customerId
                  ? `Customer: ${
                      customers.find((c) => c.id === customerId)?.name ?? ""
                    }`
                  : "Showing all customers"}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={resetAndRefresh}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setCustomerId("");
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                    setTimeout(() => refresh(), 0);
                  }}
                  className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Clear
                </button>
              </div>
            </div>
          </section>

          {/* Table shell */}
          <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <svg
                  className="h-7 w-7 animate-spin text-cyan-500"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span className="text-sm font-medium text-slate-500">
                  Loading sales…
                </span>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <ShoppingCart className="h-10 w-10 text-slate-300" />
                <span className="text-sm font-medium text-slate-500">
                  No records found
                </span>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-800 bg-[linear-gradient(135deg,#07101f_0%,#0f1a31_58%,#17213c_100%)]">
                      {[
                        "#",
                        "Bill No",
                        "Customer",
                        "Date",
                        "Total",
                        "Type",
                        "Actions",
                      ].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300 ${
                            i >= 4 ? "text-right" : "text-left"
                          } ${i === 5 ? "text-center" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="bg-white transition hover:bg-cyan-50/40"
                      >
                        {/* Sl No */}
                        <td className="px-4 py-1.5 text-xs font-mono text-slate-400">
                          {r.slNo ?? "—"}
                        </td>

                        {/* Bill No */}
                        <td className="px-4 py-1.5 text-xs font-semibold font-mono text-slate-900">
                          {r.billNo || "—"}
                        </td>

                        {/* Customer */}
                        <td className="px-4 py-1.5 text-xs font-medium text-slate-600">
                          {r.customerName || "—"}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-1.5 text-xs text-slate-500">
                          {new Date(r.dateIso).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>

                        {/* Total */}
                        <td className="px-4 py-1.5 text-right text-xs font-bold font-mono text-slate-950">
                          ₹ {Number(r.totalAmount).toFixed(2)}
                        </td>

                        {/* Type */}
                        <td className="px-4 py-1.5 text-center">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                              r.saleType === "CASH"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-cyan-200 bg-cyan-50 text-cyan-700"
                            }`}
                          >
                            {r.saleType}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-1.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              disabled={Boolean(openingId)}
                              onClick={() =>
                                openingId ? null : onOpenSale(r.id)
                              }
                              className={`inline-flex h-6 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                                openingId === r.id
                                  ? "border border-slate-200 bg-slate-100 text-slate-400"
                                  : "border border-cyan-200 bg-slate-950 text-cyan-300 hover:bg-slate-800"
                              }`}
                            >
                              {openingId === r.id ? (
                                <>
                                  <svg
                                    className="h-3 w-3 animate-spin"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                      fill="none"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                    />
                                  </svg>
                                  Opening…
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="h-3 w-3" />
                                  Open
                                </>
                              )}
                            </button>

                            {onReturnSale && (
                              <button
                                disabled={Boolean(openingId)}
                                onClick={() => onReturnSale(r.id)}
                                className="inline-flex h-6 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Return
                              </button>
                            )}

                            <button
                              disabled={Boolean(openingId)}
                              onClick={() => handleDelete(r.id)}
                              className="inline-flex h-6 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Footer / Pagination */}
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel="sale records"
          className="shrink-0 border-t border-slate-200 bg-white/95"
        />
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        title="Delete Sale"
        message="Soft delete this entry?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
