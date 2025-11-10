// src/components/ledger/SupplierLedgerModal.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Plus, Loader2, ListChecks, Wand2 } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";

type Tx = {
  id: string;
  kind: "PURCHASE" | "PAYMENT" | "OPENING" | "RETURN" | "ADJUSTMENT" | string;
  refId: string | null;
  refNo: string | null;
  date: string;
  amount: number;
  sign: number;
  notes?: string | null;
  createdAt: string;
};

type OutstandingBill = {
  id: string;
  slNo: number | null;
  billNo: string | null;
  purchaseDate: string;
  totalAmount: number;
  discount: number;
  purchaseType: "CREDIT" | "CASH" | string;
  grandAmount: number;
  paidAmount: number;
  remainingDue: number;
};

export default function LedgerModal({
  isOpen,
  onClose,
  licenseId,
  supplierId,
  supplierName,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  licenseId: string;
  supplierId: string;
  supplierName?: string;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [rows, setRows] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [balance, setBalance] = useState(0);

  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString());
  const [payMode, setPayMode] = useState<"CASH" | "BANK">("CASH");
  const [payNotes, setPayNotes] = useState<string>("");

  const [billWise, setBillWise] = useState<boolean>(false);
  const [billsLoading, setBillsLoading] = useState(false);
  const [bills, setBills] = useState<OutstandingBill[]>([]);
  const [billPage, setBillPage] = useState(1);
  const billPageSize = 50;
  const [billTotal, setBillTotal] = useState(0);

  // Search state with debounce
  const [billQuery, setBillQuery] = useState("");
  const [billQueryDebounced, setBillQueryDebounced] = useState("");

  const [allocs, setAllocs] = useState<Record<string, number>>({});

  const [saving, setSaving] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  // Debounce the search query
  useEffect(() => {
    const t = setTimeout(() => setBillQueryDebounced(billQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [billQuery]);

  const loadLedger = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await (window as any).electronAPI.getSupplierLedger({
        licenseId,
        supplierId,
        page,
        pageSize,
      });
      if (res?.success) {
        setRows(res.rows || []);
        setTotal(res.total || 0);
        setOpeningBalance(Number(res.openingBalance || 0));
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
      const res = await (window as any).electronAPI.getSupplierOutstandingBills(
        {
          licenseId,
          supplierId,
          page: billPage,
          pageSize: billPageSize,
          q: billQueryDebounced,
        }
      );
      if (res?.success) {
        setBills(res.rows || []);
        setBillTotal(res.total || 0);
        setAllocs((prev) => {
          const next: Record<string, number> = {};
          for (const b of res.rows || []) {
            if (prev[b.id] && prev[b.id] > 0) {
              next[b.id] = clamp(0, prev[b.id], b.remainingDue);
            }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, page, refetchKey]);

  useEffect(() => {
    if (isOpen) loadBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, billWise, billPage, billQueryDebounced, refetchKey]);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total]
  );
  const billPages = useMemo(
    () => Math.max(1, Math.ceil(billTotal / billPageSize)),
    [billTotal]
  );

  const allocSum = useMemo(
    () => Object.values(allocs).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocs]
  );

  // Use allocSum as the amount when billWise and top Amount is blank (or 0)
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

  function setAlloc(purchaseId: string, value: number, cap?: number) {
    setAllocs((prev) => ({
      ...prev,
      [purchaseId]: clamp(
        0,
        Number(value) || 0,
        cap ?? Number.MAX_SAFE_INTEGER
      ),
    }));
  }

  function clearAllocations() {
    setAllocs({});
  }

  function autoDistribute() {
    let remaining = billWise ? effectiveAmount : Number(payAmount || 0);
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

  const handleCreatePayment = async () => {
    const amount = billWise
      ? Number(payAmount || 0) > 0
        ? Number(payAmount)
        : allocSum
      : Number(payAmount || 0);

    if (!amount || amount <= 0) return;

    if (billWise) {
      if (allocSum > amount) {
        alert("Allocated amount exceeds payment amount.");
        return;
      }
      for (const b of bills) {
        const v = Number(allocs[b.id] || 0);
        if (v > b.remainingDue + 1e-6) {
          alert(
            `Allocation for bill ${
              b.billNo || b.slNo || b.id
            } exceeds remaining due`
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        licenseId,
        supplierId,
        amount,
        date: payDate,
        mode: payMode,
        notes: payNotes || null,
      };

      if (billWise) {
        payload.allocations = Object.entries(allocs)
          .filter(([, v]) => Number(v) > 0)
          .map(([purchaseId, v]) => ({ purchaseId, amount: Number(v) }));
      }

      const res = await (window as any).electronAPI.createSupplierPayment(
        payload
      );
      if (res?.success) {
        setPayAmount(0);
        setPayNotes("");
        setPayDate(new Date().toISOString());
        clearAllocations();
        setRefetchKey((k) => k + 1);
        onSaved?.();
      } else {
        alert("Payment failed: " + (res?.error || "Unknown error"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-averix-red-dark to-averix-red-vivid flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Supplier Ledger</h3>
            {supplierName && (
              <p className="text-sm text-white/90 mt-0.5">{supplierName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Compact Summary Bar */}
        <div className="px-6 py-2 bg-gray-50 border-b border-gray-100 text-sm flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-gray-600">
            <span className="font-medium">Opening:</span> ₹
            {openingBalance.toFixed(2)}
          </span>
          <span
            className={balance > 0 ? "text-averix-red-dark" : "text-green-600"}
          >
            <span className="font-medium">Current:</span>{" "}
            {balance > 0
              ? `₹${balance.toFixed(2)} (we owe)`
              : `₹${Math.abs(balance).toFixed(2)} (advance)`}
          </span>
          <span className="text-gray-600">
            <span className="font-medium">Transactions:</span> {total}
          </span>
        </div>

        {/* Payment Form */}
        <div className="px-6 py-5 bg-white border-b border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={payAmount || ""}
                onChange={(e) => setPayAmount(Number(e.target.value || 0))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-averix-red-dark transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="datetime-local"
                value={new Date(payDate).toISOString().slice(0, 16)}
                onChange={(e) =>
                  setPayDate(new Date(e.target.value).toISOString())
                }
                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-averix-red-dark transition-colors"
              />
            </div>
            <div className="w-full md:w-40">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mode
              </label>
              <Dropdown
                value={payMode}
                onChange={(v) => setPayMode(v as any)}
                options={[
                  { value: "CASH", label: "Cash" },
                  { value: "BANK", label: "Bank" },
                ]}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-averix-red-dark transition-colors"
                placeholder="Optional note"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={billWise}
                  onChange={(e) => setBillWise(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-averix-red-dark focus:ring-averix-red-dark"
                />
                <span className="text-sm font-medium text-gray-700">
                  Allocate bill-wise
                </span>
              </label>

              {billWise && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={autoDistribute}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-averix-red-dark border-2 border-averix-red-dark rounded-lg hover:bg-averix-red-dark hover:text-white transition-all"
                  >
                    <Wand2 className="w-4 h-4" />
                    Auto-distribute
                  </button>
                  <button
                    type="button"
                    onClick={clearAllocations}
                    className="px-3 py-2 text-sm font-medium text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleCreatePayment}
              disabled={!addEnabled}
              className="inline-flex items-center gap-2 px-6 py-3 bg-averix-red-dark text-white font-semibold rounded-lg hover:bg-averix-red-darker disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-averix-red-dark/30 transition-all"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Payment
            </button>
          </div>

          {/* Helper text for bill-wise mode */}
          {billWise && (
            <div className="px-4 py-2 text-xs text-gray-500">
              {Number(payAmount || 0) > 0
                ? `Using top amount: ₹${effectiveAmount.toFixed(2)}`
                : `Using allocations total: ₹${allocSum.toFixed(2)}`}
            </div>
          )}

          {/* Outstanding Bills Table */}
          {billWise && (
            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 flex items-center justify-between border-b-2 border-gray-200">
                <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-averix-red-dark" />
                  Outstanding Bills
                </div>

                <div className="flex items-center gap-3">
                  <input
                    value={billQuery}
                    onChange={(e) => {
                      setBillPage(1);
                      setBillQuery(e.target.value);
                    }}
                    placeholder="Search bill no / SL no…"
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-averix-red-light"
                  />
                  <div className="text-xs font-medium text-gray-600">
                    {billsLoading
                      ? "Loading…"
                      : `Unallocated: ₹${unallocated.toFixed(2)}`}
                  </div>
                </div>
              </div>

              <div
                className="max-h-[50vh] overflow-auto no-scrollbar"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "PageDown" && billPage < billPages)
                    setBillPage((p) => p + 1);
                  if (e.key === "PageUp" && billPage > 1)
                    setBillPage((p) => p - 1);
                }}
              >
                {billsLoading ? (
                  <div className="p-6 text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading bills…
                  </div>
                ) : bills.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No outstanding credit bills.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-left">Bill No</th>
                        <th className="p-3 text-right">Grand</th>
                        <th className="p-3 text-right">Paid</th>
                        <th className="p-3 text-right">Remaining</th>
                        <th className="p-3 text-right">Allocate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bills.map((b) => {
                        const cap = Math.max(0, Number(b.remainingDue || 0));
                        const val = Number(allocs[b.id] || 0);
                        return (
                          <tr
                            key={b.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="p-3 text-gray-700">
                              {new Date(b.purchaseDate).toLocaleDateString()}
                            </td>
                            <td className="p-3 font-medium text-gray-900">
                              {b.billNo || b.slNo || "—"}
                            </td>
                            <td className="p-3 text-right text-gray-700">
                              ₹{b.grandAmount.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-gray-700">
                              ₹{Number(b.paidAmount || 0).toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-semibold text-averix-red-dark">
                              ₹{cap.toFixed(2)}
                            </td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={val ? String(val) : ""}
                                onChange={(e) =>
                                  setAlloc(
                                    b.id,
                                    Number(e.target.value || 0),
                                    cap
                                  )
                                }
                                onFocus={(e) => e.currentTarget.select()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && addEnabled) {
                                    e.preventDefault();
                                    handleCreatePayment();
                                  }
                                }}
                                className="w-28 px-3 py-2 border-2 border-gray-200 rounded-lg text-right focus:outline-none focus:border-averix-red-dark transition-colors"
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
                <div className="px-4 py-3 bg-gray-50 border-t-2 border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {billPage} of {billPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={billPage <= 1}
                      onClick={() => setBillPage((p) => Math.max(1, p - 1))}
                      className="px-4 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                    >
                      Prev
                    </button>
                    <button
                      disabled={billPage >= billPages}
                      onClick={() =>
                        setBillPage((p) => Math.min(billPages, p + 1))
                      }
                      className="px-4 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-8 text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading ledger…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No transactions yet.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0">
                <tr className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <th className="p-4 text-left">Date</th>
                  <th className="p-4 text-left">Type</th>
                  <th className="p-4 text-left">Amount</th>
                  <th className="p-4 text-left">Sign</th>
                  <th className="p-4 text-left">Ref</th>
                  <th className="p-4 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="text-sm hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-4 text-gray-700">
                      {new Date(r.date).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                        {r.kind}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-gray-900">
                      ₹{Number(r.amount || 0).toFixed(2)}
                    </td>
                    <td
                      className={`p-4 font-bold ${
                        r.sign > 0 ? "text-averix-red-dark" : "text-green-600"
                      }`}
                    >
                      {r.sign > 0 ? "+" : "-"}
                    </td>
                    <td className="p-4 text-gray-600">
                      {r.refNo || r.refId || "—"}
                    </td>
                    <td className="p-4 text-gray-500">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Pagination */}
        <div className="px-6 py-4 bg-gray-50 border-t-2 border-gray-200 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-600">
            Page {page} of {pages}
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              Prev
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="px-4 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
