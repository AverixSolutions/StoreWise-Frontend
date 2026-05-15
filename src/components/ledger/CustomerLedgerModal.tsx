// src/components/ledger/CustomerLedgerModal.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import {
  X,
  Plus,
  Loader2,
  ListChecks,
  Wand2,
  ReceiptIndianRupee,
  CreditCard,
  Activity,
  CheckCircle2,
  Clock,
} from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import { platform } from "@/platform";
import { isSyncEnabled } from "@/platform/mode";
import { SyncManager } from "@/sync/SyncManager";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/15";

function SectionCard({
  icon: Icon,
  title,
  iconColor = "text-cyan-300",
  children,
}: {
  icon: React.ElementType;
  title: string;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)] overflow-hidden">
      <div className="flex items-center gap-3 bg-[#1e3a5f] px-5 py-3">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
          {title}
        </span>
      </div>
      <div className="bg-slate-50/60 p-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatPill({
  label,
  value,
  accent = false,
  positive = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2.5 rounded-xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(3,10,24,0.05)]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </span>
      <span
        className={`text-sm font-bold ${accent ? (positive ? "text-emerald-600" : "text-rose-600") : "text-slate-800"}`}
      >
        {value}
      </span>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    SALE: "bg-violet-100 text-violet-700 border-violet-200",
    RECEIPT: "bg-emerald-100 text-emerald-700 border-emerald-200",
    OPENING: "bg-cyan-100 text-cyan-700 border-cyan-200",
    RETURN: "bg-amber-100 text-amber-700 border-amber-200",
    ADJUSTMENT: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${map[kind] || "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {kind}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status?: string | null }) {
  if (status === "PENDING_CHEQUE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        <Clock className="h-3 w-3" /> Cheque Pending
      </span>
    );
  }
  if (!status || status === "CLEARED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Cleared
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      {status}
    </span>
  );
}

type Tx = {
  id: string;
  kind: string;
  refId: string | null;
  refNo: string | null;
  date: string;
  amount: number;
  sign: number;
  notes?: string | null;
  createdAt: string;
  paymentStatus?: string | null;
  chequeNo?: string | null;
  chequeIssueDate?: string | null;
  chequeClearanceDate?: string | null;
};

type OutstandingSale = {
  id: string;
  slNo: number | null;
  billNo: string | null;
  saleDate: string;
  totalAmount: number;
  discount: number;
  saleType: string;
  grandAmount: number;
  paidAmount: number;
  remainingDue: number;
};

export default function CustomerLedgerModal({
  isOpen,
  onClose,
  licenseId,
  customerId,
  customerName,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  licenseId: string;
  customerId: string;
  customerName?: string;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [rows, setRows] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [balance, setBalance] = useState(0);

  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString());
  const [payMode, setPayMode] = useState<"CASH" | "BANK" | "CHEQUE">("CASH");
  const [payNotes, setPayNotes] = useState<string>("");

  const [chequeNo, setChequeNo] = useState("");
  const [chequeIssueDate, setChequeIssueDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [chequeClearanceDate, setChequeClearanceDate] = useState<string>("");

  const [billWise, setBillWise] = useState(false);
  const [billsLoading, setBillsLoading] = useState(false);
  const [bills, setBills] = useState<OutstandingSale[]>([]);
  const [billPage, setBillPage] = useState(1);
  const billPageSize = 50;
  const [billTotal, setBillTotal] = useState(0);
  const [billQuery, setBillQuery] = useState("");
  const [billQueryDebounced, setBillQueryDebounced] = useState("");

  const [allocs, setAllocs] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setBillQueryDebounced(billQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [billQuery]);

  const loadLedger = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await platform.getCustomerLedger?.({
        licenseId,
        customerId,
        page,
        pageSize,
      });
      if (res?.success) {
        setRows(res.rows || []);
        setTotal(res.total || 0);
        setBalance(Number(res.balance || 0));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadBills = async () => {
    if (!isOpen || !billWise) return;
    setBillsLoading(true);
    try {
      const res = await platform.getCustomerOutstandingSales?.({
        licenseId,
        customerId,
        page: billPage,
        pageSize: billPageSize,
        q: billQueryDebounced,
      });
      if (res?.success) {
        setBills(res.rows || []);
        setBillTotal(res.total || 0);
        setAllocs((prev) => {
          const next: Record<string, number> = {};
          for (const b of res.rows || []) {
            if (prev[b.id] && prev[b.id] > 0)
              next[b.id] = clamp(0, prev[b.id], b.remainingDue);
          }
          return next;
        });
      }
    } finally {
      setBillsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadLedger();
  }, [isOpen, page, refetchKey]);
  useEffect(() => {
    if (isOpen) loadBills();
  }, [isOpen, billWise, billPage, billQueryDebounced, refetchKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (payMode !== "CHEQUE") {
      setChequeNo("");
      setChequeClearanceDate("");
    }
  }, [payMode]);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total],
  );
  const billPages = useMemo(
    () => Math.max(1, Math.ceil(billTotal / billPageSize)),
    [billTotal],
  );
  const allocSum = useMemo(
    () => Object.values(allocs).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocs],
  );
  const effectiveAmount = useMemo(() => {
    if (billWise)
      return Number(payAmount || 0) > 0 ? Number(payAmount) : allocSum;
    return Number(payAmount || 0);
  }, [billWise, payAmount, allocSum]);
  const unallocated = Math.max(0, effectiveAmount - allocSum);

  const addEnabled =
    !saving &&
    (billWise
      ? allocSum > 0 && allocSum <= effectiveAmount
      : Number(payAmount || 0) > 0);

  function clamp(min: number, v: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }
  function setAlloc(saleId: string, value: number, cap?: number) {
    setAllocs((prev) => ({
      ...prev,
      [saleId]: clamp(0, Number(value) || 0, cap ?? Number.MAX_SAFE_INTEGER),
    }));
  }

  function autoDistribute() {
    let remaining = effectiveAmount;
    const next: Record<string, number> = {};
    for (const b of bills) {
      if (remaining <= 0) break;
      const take = Math.min(b.remainingDue, remaining);
      if (take > 0) {
        next[b.id] = take;
        remaining -= take;
      }
    }
    setAllocs(next);
  }

  const handleMarkReceived = async (txId: string) => {
    setMarkingId(txId);
    try {
      const res = await platform.markCustomerChequeReceived?.(licenseId, txId);
      if (res?.success) {
        if (isSyncEnabled()) {
          SyncManager.pushEntity("customerTransaction").catch(() => {});
          SyncManager.pushEntity("cashTransaction").catch(() => {});
        }
        setRefetchKey((k) => k + 1);
        onSaved?.();
      } else alert("Failed: " + (res?.error || "Unknown error"));
    } finally {
      setMarkingId(null);
    }
  };

  const handleCreateReceipt = async () => {
    const amount = billWise
      ? Number(payAmount || 0) > 0
        ? Number(payAmount)
        : allocSum
      : Number(payAmount || 0);

    if (!amount || amount <= 0) return;
    if (payMode === "CHEQUE" && !chequeClearanceDate) {
      alert("Please enter cheque clearance date.");
      return;
    }
    if (billWise && allocSum > amount) {
      alert("Allocated amount exceeds receipt amount.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        licenseId,
        customerId,
        amount,
        date: payDate,
        mode: payMode,
        notes: payNotes || null,
      };
      if (payMode === "CHEQUE") {
        payload.chequeNo = chequeNo || null;
        payload.chequeIssueDate = chequeIssueDate || null;
        payload.chequeClearanceDate = chequeClearanceDate || null;
      }
      if (billWise) {
        payload.allocations = Object.entries(allocs)
          .filter(([, v]) => Number(v) > 0)
          .map(([saleId, v]) => ({ saleId, amount: Number(v) }));
      }

      const res = await platform.createCustomerReceipt?.(payload);
      if (res?.success) {
        if (isSyncEnabled()) {
          SyncManager.pushEntity("customerTransaction").catch(() => {});
          SyncManager.pushEntity("cashTransaction").catch(() => {});
        }
        setPayAmount(0);
        setPayNotes("");
        setPayDate(new Date().toISOString());
        setChequeNo("");
        setChequeClearanceDate("");
        setChequeIssueDate(new Date().toISOString().slice(0, 10));
        setAllocs({});
        setRefetchKey((k) => k + 1);
        onSaved?.();
      } else {
        alert("Receipt failed: " + (res?.error || "Unknown error"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-5xl rounded-t-[24px] sm:rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(3,10,24,0.22)] flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden rounded-t-[24px] bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-5 py-4 text-white shrink-0">
          <div className="pointer-events-none absolute -left-6 top-0 h-16 w-16 rounded-full bg-emerald-400/20 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full bg-cyan-500/15 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/20">
                <ReceiptIndianRupee className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Customer Ledger
                </p>
                <h3 className="text-base font-semibold text-white">
                  {customerName || "Ledger"}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="shrink-0 px-5 py-3 bg-slate-50/80 border-b border-slate-200/80">
          <div className="flex flex-wrap gap-3">
            <StatPill
              label="Current Balance"
              value={
                balance > 0
                  ? `₹${balance.toFixed(2)} (receivable)`
                  : `₹${Math.abs(balance).toFixed(2)} (advance)`
              }
              accent
              positive={balance <= 0}
            />
            <StatPill label="Transactions" value={String(total)} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Add Receipt */}
          <SectionCard
            icon={CreditCard}
            title="Add Receipt"
            iconColor="text-emerald-300"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Amount">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={payAmount || ""}
                    onChange={(e) => setPayAmount(Number(e.target.value || 0))}
                    className={inputCls}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="datetime-local"
                    value={new Date(payDate).toISOString().slice(0, 16)}
                    onChange={(e) =>
                      setPayDate(new Date(e.target.value).toISOString())
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Mode">
                  <Dropdown
                    value={payMode}
                    onChange={(v) => setPayMode(v as any)}
                    options={[
                      { value: "CASH", label: "Cash" },
                      { value: "BANK", label: "Bank Transfer" },
                      { value: "CHEQUE", label: "Cheque" },
                    ]}
                  />
                </Field>
                <Field label="Notes">
                  <input
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className={inputCls}
                    placeholder="Optional note"
                  />
                </Field>
              </div>

              {payMode === "CHEQUE" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="sm:col-span-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-700 mb-3 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Cheque Details — Balance updates only when cheque is
                      marked as received
                    </p>
                  </div>
                  <Field label="Cheque No.">
                    <input
                      value={chequeNo}
                      onChange={(e) => setChequeNo(e.target.value)}
                      className={inputCls}
                      placeholder="e.g. 001234"
                    />
                  </Field>
                  <Field label="Issue Date">
                    <input
                      type="date"
                      value={chequeIssueDate}
                      onChange={(e) => setChequeIssueDate(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Valid Till / Clearance Date *">
                    <input
                      type="date"
                      value={chequeClearanceDate}
                      onChange={(e) => setChequeClearanceDate(e.target.value)}
                      className={inputCls}
                      required
                    />
                  </Field>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billWise}
                      onChange={(e) => setBillWise(e.target.checked)}
                      className="rounded"
                      style={{ accentColor: "#1e3a5f" }}
                    />
                    <span className="text-sm text-slate-600 font-medium">
                      Allocate bill-wise
                    </span>
                  </label>
                  {billWise && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={autoDistribute}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#1e3a5f]/30 bg-[#1e3a5f]/8 px-3 py-2 text-xs font-semibold text-[#1e3a5f] transition hover:bg-[#1e3a5f] hover:text-white cursor-pointer"
                      >
                        <Wand2 className="h-3.5 w-3.5" /> Auto-distribute
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllocs({})}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCreateReceipt}
                  disabled={!addEnabled}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(32,183,255,0.22)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      {payMode === "CHEQUE" ? "Record Cheque" : "Add Receipt"}
                    </>
                  )}
                </button>
              </div>
              {billWise && (
                <p className="text-[11px] text-slate-400 -mt-1">
                  {Number(payAmount || 0) > 0
                    ? `Using top amount: ₹${effectiveAmount.toFixed(2)}`
                    : `Using allocations total: ₹${allocSum.toFixed(2)}`}
                </p>
              )}
            </div>
          </SectionCard>

          {/* Outstanding Sales */}
          {billWise && (
            <SectionCard
              icon={ListChecks}
              title="Outstanding Credit Sales"
              iconColor="text-amber-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <input
                  value={billQuery}
                  onChange={(e) => {
                    setBillPage(1);
                    setBillQuery(e.target.value);
                  }}
                  placeholder="Search bill no / SL no…"
                  className={`${inputCls} max-w-xs`}
                />
                <div className="text-[11px] font-semibold text-slate-500">
                  {billsLoading
                    ? "Loading…"
                    : `Unallocated: ₹${unallocated.toFixed(2)}`}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                <div className="max-h-64 overflow-auto no-scrollbar">
                  {billsLoading ? (
                    <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading sales…
                    </div>
                  ) : bills.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">
                      No outstanding credit sales.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-[#1e3a5f] sticky top-0">
                        <tr>
                          {[
                            "Date",
                            "Bill No",
                            "Grand",
                            "Paid",
                            "Remaining",
                            "Allocate",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 text-left last:text-right"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bills.map((b) => {
                          const cap = Math.max(0, Number(b.remainingDue || 0));
                          const val = Number(allocs[b.id] || 0);
                          return (
                            <tr
                              key={b.id}
                              className="hover:bg-slate-50/60 transition-colors"
                            >
                              <td className="px-4 py-2.5 text-slate-600 text-xs">
                                {new Date(b.saleDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2.5 font-medium text-slate-800 text-xs">
                                {b.billNo || b.slNo || "—"}
                              </td>
                              <td className="px-4 py-2.5 text-slate-600 text-xs">
                                ₹{b.grandAmount.toFixed(2)}
                              </td>
                              <td className="px-4 py-2.5 text-slate-600 text-xs">
                                ₹{Number(b.paidAmount || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-2.5 text-xs font-semibold text-rose-600">
                                ₹{cap.toFixed(2)}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={val ? String(val) : ""}
                                  onChange={(e) =>
                                    setAlloc(
                                      b.id,
                                      Number(e.target.value || 0),
                                      cap,
                                    )
                                  }
                                  onFocus={(e) => e.currentTarget.select()}
                                  className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-right text-xs text-slate-800 outline-none shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/15"
                                  placeholder="0.00"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                {billPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-t border-slate-200/80">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Page {billPage} of {billPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={billPage <= 1}
                        onClick={() => setBillPage((p) => Math.max(1, p - 1))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        disabled={billPage >= billPages}
                        onClick={() =>
                          setBillPage((p) => Math.min(billPages, p + 1))
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Transaction History */}
          <SectionCard
            icon={Activity}
            title="Transaction History"
            iconColor="text-cyan-300"
          >
            {loading ? (
              <div className="py-10 flex items-center justify-center gap-2 text-slate-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading ledger…
              </div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No transactions yet.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#1e3a5f] sticky top-0">
                    <tr>
                      {[
                        "Date",
                        "Type",
                        "Status",
                        "Amount",
                        "Sign",
                        "Ref / Cheque No",
                        "Notes",
                        "",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 text-left"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => {
                      const isPendingCheque =
                        r.paymentStatus === "PENDING_CHEQUE";
                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-slate-50/60 transition-colors ${isPendingCheque ? "bg-amber-50/40" : ""}`}
                        >
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(r.date).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <KindBadge kind={r.kind} />
                          </td>
                          <td className="px-4 py-3">
                            {r.kind === "RECEIPT" ? (
                              <PaymentStatusBadge status={r.paymentStatus} />
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                            ₹{Number(r.amount || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-sm font-bold ${isPendingCheque ? "text-slate-400" : r.sign > 0 ? "text-rose-600" : "text-emerald-600"}`}
                            >
                              {isPendingCheque ? "~" : r.sign > 0 ? "+" : "−"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            <div>{r.refNo || r.refId || "—"}</div>
                            {r.chequeNo && (
                              <div className="text-[11px] text-amber-600 font-medium mt-0.5">
                                Chq: {r.chequeNo}
                              </div>
                            )}
                            {r.chequeClearanceDate && (
                              <div className="text-[10px] text-slate-400">
                                Valid till:{" "}
                                {new Date(
                                  r.chequeClearanceDate,
                                ).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {r.notes || "—"}
                          </td>
                          <td className="px-4 py-3">
                            {isPendingCheque && (
                              <button
                                onClick={() => handleMarkReceived(r.id)}
                                disabled={markingId === r.id}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition cursor-pointer whitespace-nowrap"
                              >
                                {markingId === r.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                                Mark Received
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Footer pagination */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 py-4 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400 font-medium">
            Page {page} of {pages} · {total} transactions
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
            >
              Prev
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
