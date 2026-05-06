// src/app/payment/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Calendar as CalendarIcon,
  Wallet,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import SupplierLedgerModal from "@/components/ledger/SupplierLedgerModal";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import { platform } from "@/platform";

type SupplierOpt = { id: string; name: string };
type PaymentRow = {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  amount: number;
  mode: "CASH" | "BANK" | "CHEQUE";
  notes: string | null;
  allocated: number;
  unallocated: number;
  bills?: { purchaseId: string; billRef: string }[];
  paymentStatus?: string; // for cheque
};

export default function PaymentPage() {
  const [licenseId, setLicenseId] = useState("demo-license");
  const [isClient, setIsClient] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [selected, setSelected] = useState<SupplierOpt | null>(null);

  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total],
  );

  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedLicenseId = localStorage.getItem("licenseId") || "demo-license";
    setLicenseId(savedLicenseId);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    (async () => {
      const res = await platform.listSuppliers?.(licenseId, {
        page: 1,
        pageSize: 1000,
      });
      const opts = (res?.suppliers ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
      })) as SupplierOpt[];
      setSuppliers(opts);
    })();
  }, [licenseId, isClient]);

  async function loadPayments() {
    if (!isClient) return;
    setLoading(true);
    try {
      const res = await platform.listPayments?.({
        licenseId,
        supplierId: selected?.id ?? null,
        q,
        dateFrom,
        dateTo,
        page,
        pageSize,
      });
      if (res?.success) {
        setRows(res.rows || []);
        setTotal(res.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isClient) return;
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, licenseId, selected?.id, q, dateFrom, dateTo, page]);

  if (!isClient) return null;

  const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const billWiseCount = rows.filter(
    (r) => (r.bills?.length || 0) > 0 || Number(r.allocated || 0) > 0,
  ).length;

  // Helper to get mode badge classes
  const getModeClasses = (mode: string) => {
    if (mode === "CASH")
      return "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200";
    if (mode === "CHEQUE")
      return "bg-amber-50 text-amber-600 ring-1 ring-amber-200";
    return "bg-cyan-50 text-cyan-600 ring-1 ring-cyan-200";
  };

  return (
    <div className="space-y-5">
      {/* Hero banner – unchanged */}
      <section className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_8px_24px_rgba(7,12,24,0.14)] md:px-6">
        <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-32 w-32 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              KYNFLOW • PAYMENTS
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-[28px]">
              Supplier <span className="kyn-brand-text">Payments</span>
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Record payments and review supplier history
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="kyn-brand-chip flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/80">
              <Wallet className="h-3.5 w-3.5 text-cyan-400" />
              <span>{rows.length} records</span>
            </div>
            <div className="kyn-brand-chip flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/80">
              <TrendingUp className="h-3.5 w-3.5 text-fuchsia-400" />
              <span>
                ₹
                {totalAmount.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="kyn-brand-chip flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/80">
              <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
              <span>{billWiseCount} bill-wise</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <SearchableDropdown
              value={selected?.id || ""}
              onChange={(id) => {
                const s = suppliers.find((x) => x.id === id) || null;
                setSelected(s);
                setPage(1);
              }}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Select supplier"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition-all focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20">
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="date"
              value={dateFrom ?? ""}
              onChange={(e) => {
                setDateFrom(e.target.value || null);
                setPage(1);
              }}
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="From"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition-all focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20">
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="date"
              value={dateTo ?? ""}
              onChange={(e) => {
                setDateTo(e.target.value || null);
                setPage(1);
              }}
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="To"
            />
          </div>
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search notes / supplier…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => setOpen(true)}
            disabled={!selected}
            title={!selected ? "Select a supplier first" : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(32,183,255,0.25)] transition-all hover:brightness-110 hover:shadow-[0_6px_20px_rgba(32,183,255,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Table with cheque badge */}
      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
              <span className="text-sm">Loading payments…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <Wallet className="h-10 w-10 opacity-30" />
              <p className="text-sm">
                {selected
                  ? "No payments for this supplier."
                  : "No payments recorded yet."}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[linear-gradient(90deg,#0a1324_0%,#16213d_100%)]">
                  {[
                    { key: "date", label: "Date" },
                    { key: "supplier", label: "Supplier" },
                    { key: "mode", label: "Mode" },
                    { key: "amount", label: "Amount" },
                    { key: "type", label: "Type" },
                    { key: "notes", label: "Notes" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`transition-colors duration-150 hover:bg-cyan-50/30 ${
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-slate-800">
                        {new Date(r.date).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(r.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-slate-800">
                        {r.supplierName || r.supplierId}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${getModeClasses(r.mode)}`}
                        >
                          {r.mode}
                        </span>
                        {r.mode === "CHEQUE" && (
                          <span
                            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold ${
                              r.paymentStatus === "PENDING_CHEQUE"
                                ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200"
                                : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"
                            }`}
                          >
                            {r.paymentStatus === "PENDING_CHEQUE"
                              ? "⏳ Pending"
                              : "✓ Cleared"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-slate-900">
                        ₹
                        {Number(r.amount || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {(r.bills?.length || 0) > 0 ||
                      Number(r.allocated || 0) > 0 ? (
                        <span className="inline-flex items-center rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600 ring-1 ring-violet-200">
                          Bill-wise
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-600 ring-1 ring-sky-200">
                          Whole payment
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-400">
                        {r.notes || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <span className="text-xs text-slate-500">
            Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
            <span className="font-semibold text-slate-700">{pages}</span>
            {total > 0 && (
              <span className="ml-2 text-slate-400">({total} total)</span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {open && selected && (
        <SupplierLedgerModal
          isOpen={open}
          onClose={() => {
            setOpen(false);
            loadPayments();
          }}
          onSaved={() => {
            loadPayments();
          }}
          licenseId={licenseId}
          supplierId={selected.id}
          supplierName={selected.name}
        />
      )}
    </div>
  );
}
