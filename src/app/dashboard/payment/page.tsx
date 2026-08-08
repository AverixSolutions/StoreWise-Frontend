// src/app/dashboard/payment/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CreditCard,
  FilterX,
  Keyboard,
  Plus,
  Search,
  TrendingUp,
  Users,
  Wallet,
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
  paymentStatus?: string;
};

type SupplierDueSummary = {
  balance: number;
  openingBalance: number;
  outstanding: number;
  outstandingBills: number;
  transactions: number;
};

const pageSize = 50;

export default function PaymentPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  const [licenseId, setLicenseId] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [filterSupplier, setFilterSupplier] = useState<SupplierOpt | null>(
    null,
  );
  const [paymentSupplier, setPaymentSupplier] = useState<SupplierOpt | null>(
    null,
  );

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState<SupplierDueSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total],
  );

  const supplierOptions = useMemo(() => {
    const seen = new Set<string>();
    return suppliers.flatMap((supplier) => {
      const value = String(supplier?.id ?? "").trim();
      const label = String(supplier?.name ?? "").trim();
      if (!value || !label || seen.has(value)) return [];
      seen.add(value);
      return [{ value, label }];
    });
  }, [suppliers]);

  const activeFilterCount =
    Number(Boolean(filterSupplier)) +
    Number(Boolean(dateFrom)) +
    Number(Boolean(dateTo)) +
    Number(Boolean(debouncedQ));

  const totalAmount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [rows],
  );

  const billWiseCount = useMemo(
    () =>
      rows.filter(
        (row) => (row.bills?.length || 0) > 0 || Number(row.allocated || 0) > 0,
      ).length,
    [rows],
  );

  const focusSupplierFilter = useCallback(() => {
    requestAnimationFrame(() => {
      const button = document.querySelector<HTMLElement>(
        '[data-payment-filter="supplier"]',
      );
      button?.focus({ preventScroll: true });
    });
  }, []);

  const focusSearch = useCallback(() => {
    requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
      searchRef.current?.select();
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilterSupplier(null);
    setSummary(null);
    setQ("");
    setDebouncedQ("");
    setDateFrom(null);
    setDateTo(null);
    setPage(1);
  }, []);

  const openPaymentFor = useCallback((supplier: SupplierOpt) => {
    setPaymentSupplier(supplier);
    setOpen(true);
  }, []);

  const handleRecordPayment = useCallback(() => {
    if (filterSupplier) {
      openPaymentFor(filterSupplier);
      return;
    }
    focusSupplierFilter();
  }, [filterSupplier, focusSupplierFilter, openPaymentFor]);

  useEffect(() => {
    setIsClient(true);
    setLicenseId(localStorage.getItem("licenseId") || "demo-license");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (!isClient || !licenseId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await platform.listSuppliers?.(licenseId, {
          q: "",
          page: 1,
          pageSize: 1000,
        });
        if (cancelled) return;
        setSuppliers(
          (res?.suppliers ?? []).map((supplier: any) => ({
            id: supplier.id,
            name: supplier.name,
          })),
        );
      } catch (error) {
        console.error("Failed to load payment suppliers:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isClient, licenseId]);

  const loadSupplierSummary = useCallback(async () => {
    if (!isClient || !licenseId || !filterSupplier?.id) {
      setSummary(null);
      return;
    }

    setSummaryLoading(true);
    try {
      const [ledgerRes, billsRes] = await Promise.all([
        platform.getSupplierLedger?.({
          licenseId,
          supplierId: filterSupplier.id,
          page: 1,
          pageSize: 1,
        }),
        platform.getSupplierOutstandingBills?.({
          licenseId,
          supplierId: filterSupplier.id,
          page: 1,
          pageSize: 100,
        }),
      ]);

      const outstanding = (billsRes?.rows || []).reduce(
        (sum: number, bill: any) => sum + Number(bill.remainingDue || 0),
        0,
      );

      setSummary({
        balance: Number(ledgerRes?.balance || 0),
        openingBalance: Number(ledgerRes?.openingBalance || 0),
        transactions: Number(ledgerRes?.total || 0),
        outstanding,
        outstandingBills: Number(
          billsRes?.total || billsRes?.rows?.length || 0,
        ),
      });
    } catch (error) {
      console.error("Failed to load supplier payment summary:", error);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [filterSupplier?.id, isClient, licenseId]);

  const loadPayments = useCallback(async () => {
    if (!isClient || !licenseId) return;

    setLoading(true);
    setLoadError("");
    try {
      const res = await platform.listPayments?.({
        licenseId,
        supplierId: filterSupplier?.id ?? null,
        q: debouncedQ,
        dateFrom,
        dateTo,
        page,
        pageSize,
      });

      if (res?.success) {
        setRows(res.rows || []);
        setTotal(Number(res.total || 0));
      } else {
        setRows([]);
        setTotal(0);
        setLoadError(res?.error || "Unable to load supplier payments.");
      }
    } catch (error) {
      console.error("Failed to load supplier payments:", error);
      setRows([]);
      setTotal(0);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load supplier payments.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    dateFrom,
    dateTo,
    debouncedQ,
    filterSupplier?.id,
    isClient,
    licenseId,
    page,
    refreshKey,
  ]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    void loadSupplierSummary();
  }, [loadSupplierSummary, summaryRefreshKey]);

  useEffect(() => {
    if (!isClient) return;

    const handleSyncUpdate = () => setRefreshKey((key) => key + 1);
    window.addEventListener("kynflow:sync:updated", handleSyncUpdate);
    return () =>
      window.removeEventListener("kynflow:sync:updated", handleSyncUpdate);
  }, [isClient]);

  useEffect(() => {
    if (!isClient || open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F2") {
        event.preventDefault();
        focusSupplierFilter();
        return;
      }

      if (event.key === "F3") {
        event.preventDefault();
        focusSearch();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleRecordPayment();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        router.push("/dashboard/entries");
        return;
      }

      if (event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetFilters();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    focusSupplierFilter,
    focusSearch,
    handleRecordPayment,
    isClient,
    open,
    resetFilters,
    router,
  ]);

  if (!isClient) return null;

  const getModeClasses = (mode: string) => {
    if (mode === "CASH")
      return "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200";
    if (mode === "CHEQUE")
      return "bg-amber-50 text-amber-600 ring-1 ring-amber-200";
    return "bg-cyan-50 text-cyan-600 ring-1 ring-cyan-200";
  };

  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(total, page * pageSize);

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_8px_24px_rgba(7,12,24,0.14)] md:px-6">
        <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard/entries")}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white/85 transition hover:bg-white/15"
                title="Back to Entries (Ctrl+B)"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <span className="kyn-brand-pill inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                KYNFLOW • PAYMENTS
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-[28px]">
              Supplier <span className="kyn-brand-text">Payments</span>
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              All payments load first. Use supplier, date, or search filters
              only when you need to narrow the list.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 xl:items-end">
            <div className="flex flex-wrap gap-2">
              <div className="kyn-brand-chip flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/80">
                <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                <span>{total} payments</span>
              </div>
              <div className="kyn-brand-chip flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/80">
                <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                <span>
                  ₹
                  {totalAmount.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                  <span className="ml-1 text-white/45">this page</span>
                </span>
              </div>
              <div className="kyn-brand-chip flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/80">
                <CreditCard className="h-3.5 w-3.5 text-fuchsia-400" />
                <span>{billWiseCount} bill-wise shown</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-white/55">
              <Keyboard className="h-3 w-3" />
              <span className="rounded-md bg-white/10 px-2 py-1">
                F2 Supplier
              </span>
              <span className="rounded-md bg-white/10 px-2 py-1">
                F3 Search
              </span>
              <span className="rounded-md bg-white/10 px-2 py-1">
                Ctrl+N Payment
              </span>
              <span className="rounded-md bg-white/10 px-2 py-1">
                Ctrl+B Back
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1e3a5f] text-white">
              <Users className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">
                Payment filters
              </div>
              <div className="text-[11px] text-slate-400">
                {activeFilterCount
                  ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                  : "Showing all suppliers"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetFilters}
              disabled={activeFilterCount === 0 && !q}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              title="Clear all filters (Alt+R)"
            >
              <FilterX className="h-3.5 w-3.5" />
              Clear
            </button>
            <button
              type="button"
              onClick={handleRecordPayment}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-4 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(32,183,255,0.25)] transition hover:brightness-110"
              title={
                filterSupplier
                  ? `Record payment for ${filterSupplier.name} (Ctrl+N)`
                  : "Choose a supplier first; Ctrl+N focuses the supplier filter"
              }
            >
              <Plus className="h-4 w-4" />
              Record Payment
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[1.2fr_0.9fr_0.9fr_1.35fr]">
          <SearchableDropdown
            value={filterSupplier?.id || ""}
            onChange={(id) => {
              setFilterSupplier(
                suppliers.find((supplier) => supplier.id === id) || null,
              );
              setSummary(null);
              setPage(1);
              setSummaryRefreshKey((key) => key + 1);
            }}
            options={supplierOptions}
            placeholder="All suppliers"
            autoOpenOnFocus
            buttonProps={{
              "data-payment-filter": "supplier",
              title: "Supplier filter (F2). Leave clear to show all payments.",
              className: "h-10 bg-slate-50/80",
            }}
          />

          <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20">
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={fromRef}
              type="date"
              value={dateFrom ?? ""}
              onChange={(event) => {
                setDateFrom(event.target.value || null);
                setPage(1);
              }}
              className="w-full bg-transparent text-sm text-slate-700 outline-none"
              title="From date"
            />
          </div>

          <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20">
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={toRef}
              type="date"
              value={dateTo ?? ""}
              onChange={(event) => {
                setDateTo(event.target.value || null);
                setPage(1);
              }}
              className="w-full bg-transparent text-sm text-slate-700 outline-none"
              title="To date"
            />
          </div>

          <div className="relative flex h-10 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
            <input
              ref={searchRef}
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Search supplier / notes…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-400/20"
              title="Search payments (F3)"
            />
          </div>
        </div>

        {filterSupplier && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3.5 py-2.5">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-700">
                Supplier filter
              </span>
              <div className="truncate text-sm font-semibold text-slate-800">
                {filterSupplier.name}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilterSupplier(null);
                setSummary(null);
                setPage(1);
                setSummaryRefreshKey((key) => key + 1);
              }}
              className="rounded-lg border border-cyan-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100"
            >
              Show all suppliers
            </button>
          </div>
        )}

        {filterSupplier && (
          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-500">
                Current Balance
              </div>
              <div className="mt-1 text-base font-bold text-rose-700">
                {summaryLoading
                  ? "Loading…"
                  : `₹${Number(summary?.balance || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
              </div>
              <div className="text-[10px] text-rose-500">
                {Number(summary?.balance || 0) > 0
                  ? "We owe supplier"
                  : "Advance / clear"}
              </div>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-600">
                Outstanding
              </div>
              <div className="mt-1 text-base font-bold text-amber-700">
                {summaryLoading
                  ? "Loading…"
                  : `₹${Number(summary?.outstanding || 0).toLocaleString(
                      "en-IN",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}`}
              </div>
              <div className="text-[10px] text-amber-600">
                {summary?.outstandingBills || 0} pending bill(s)
              </div>
            </div>

            <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-600">
                Opening Balance
              </div>
              <div className="mt-1 text-base font-bold text-cyan-700">
                {summaryLoading
                  ? "Loading…"
                  : `₹${Number(summary?.openingBalance || 0).toLocaleString(
                      "en-IN",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}`}
              </div>
              <div className="text-[10px] text-cyan-600">Ledger opening</div>
            </div>

            <div className="rounded-xl border border-violet-100 bg-violet-50 px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600">
                Transactions
              </div>
              <div className="mt-1 text-base font-bold text-violet-700">
                {summaryLoading ? "Loading…" : summary?.transactions || 0}
              </div>
              <div className="text-[10px] text-violet-600">Supplier ledger</div>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
          <div>
            <div className="text-xs font-bold text-slate-800">
              Payment payments
            </div>
            <div className="text-[11px] text-slate-400">
              {filterSupplier ? filterSupplier.name : "All suppliers"}
              {debouncedQ ? ` • Search: ${debouncedQ}` : ""}
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            {total ? `${startRecord}-${endRecord} of ${total}` : "0 payments"}
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
              <span className="text-sm">Loading payments…</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
              <Wallet className="h-9 w-9 text-rose-300" />
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Could not load payments
                </p>
                <p className="mt-1 text-xs text-slate-400">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <Wallet className="h-10 w-10 opacity-30" />
              <p className="text-sm font-semibold text-slate-600">
                {activeFilterCount
                  ? "No payments match the current filters."
                  : "No supplier payments recorded yet."}
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700"
                >
                  Clear filters and show all
                </button>
              )}
            </div>
          ) : (
            <table className="w-full min-w-[900px] table-fixed">
              <thead>
                <tr className="bg-[linear-gradient(90deg,#0a1324_0%,#16213d_100%)]">
                  {[
                    ["Date", "w-[145px]"],
                    ["Supplier", "w-[210px]"],
                    ["Mode", "w-[150px]"],
                    ["Amount", "w-[130px]"],
                    ["Type", "w-[130px]"],
                    ["Notes", ""],
                    ["", "w-[86px]"],
                  ].map(([label, width]) => (
                    <th
                      key={label || "actions"}
                      className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 ${width}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-cyan-50/35 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/45"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-800">
                        {new Date(row.date).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(row.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {row.supplierName?.trim() || "Unknown supplier"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${getModeClasses(row.mode)}`}
                        >
                          {row.mode}
                        </span>
                        {row.mode === "CHEQUE" && (
                          <span
                            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold ${row.paymentStatus === "PENDING_CHEQUE" ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200" : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"}`}
                          >
                            {row.paymentStatus === "PENDING_CHEQUE"
                              ? "Pending"
                              : "Cleared"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">
                      ₹
                      {Number(row.amount || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {(row.bills?.length || 0) > 0 ||
                      Number(row.allocated || 0) > 0 ? (
                        <span className="inline-flex rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600 ring-1 ring-violet-200">
                          Bill-wise
                        </span>
                      ) : (
                        <span className="inline-flex rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-600 ring-1 ring-sky-200">
                          Whole
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="truncate text-sm text-slate-500"
                        title={row.notes || ""}
                      >
                        {row.notes || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          openPaymentFor({
                            id: row.supplierId,
                            name:
                              row.supplierName?.trim() || "Unknown supplier",
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                        title="Open supplier ledger / record another payment"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <span className="text-xs text-slate-500">
            Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
            <span className="font-semibold text-slate-700">{pages}</span>
            {total > 0 && (
              <span className="ml-2 text-slate-400">({total} total)</span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((current) => Math.min(pages, current + 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {open && paymentSupplier && (
        <SupplierLedgerModal
          isOpen={open}
          onClose={() => {
            setOpen(false);
            setPaymentSupplier(null);
            setRefreshKey((key) => key + 1);
            setSummaryRefreshKey((key) => key + 1);
          }}
          onSaved={() => {
            setRefreshKey((key) => key + 1);
            setSummaryRefreshKey((key) => key + 1);
          }}
          licenseId={licenseId}
          supplierId={paymentSupplier.id}
          supplierName={paymentSupplier.name}
        />
      )}
    </div>
  );
}
