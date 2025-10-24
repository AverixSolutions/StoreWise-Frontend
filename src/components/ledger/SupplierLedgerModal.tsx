// src/components/ledger/SupplierLedgerModal.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Plus, Loader2 } from "lucide-react";

type Tx = {
  id: string;
  kind: "PURCHASE" | "PAYMENT" | "OPENING" | "RETURN" | "ADJUSTMENT" | string;
  refId: string | null;
  refNo: string | null;
  date: string;
  amount: number;
  sign: number; // +1 = we owe more, -1 = we owe less
  notes?: string | null;
  createdAt: string;
};

export default function LedgerModal({
  isOpen,
  onClose,
  licenseId,
  supplierId,
  supplierName,
}: {
  isOpen: boolean;
  onClose: () => void;
  licenseId: string;
  supplierId: string;
  supplierName?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [rows, setRows] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [balance, setBalance] = useState(0);

  // payment form
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString());
  const [payMode, setPayMode] = useState<"CASH" | "BANK">("CASH");
  const [payNotes, setPayNotes] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const load = async () => {
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

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, page, refetchKey]);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total]
  );

  const handleCreatePayment = async () => {
    if (!payAmount || payAmount <= 0) return;
    setSaving(true);
    try {
      const res = await (window as any).electronAPI.createSupplierPayment({
        licenseId,
        supplierId,
        amount: payAmount,
        date: payDate,
        mode: payMode,
        notes: payNotes || null,
      });
      if (res?.success) {
        setPayAmount(0);
        setPayNotes("");
        setPayDate(new Date().toISOString());
        setRefetchKey((k) => k + 1);
      } else {
        alert("Payment failed: " + (res?.error || "Unknown error"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] shadow-xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Supplier Ledger
            </h3>
            {supplierName ? (
              <p className="text-sm text-gray-600">{supplierName}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-3 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Opening Balance</div>
            <div className="text-lg font-semibold">
              {openingBalance >= 0
                ? `₹${openingBalance.toFixed(2)}`
                : `-₹${Math.abs(openingBalance).toFixed(2)}`}
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Current Balance</div>
            <div
              className={`text-lg font-semibold ${
                balance > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {balance > 0
                ? `₹${balance.toFixed(2)} (we owe)`
                : `₹${Math.abs(balance).toFixed(2)} (advance)`}
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Transactions</div>
            <div className="text-lg font-semibold">{total}</div>
          </div>
        </div>

        {/* Payment form */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Amount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={payAmount || ""}
                onChange={(e) => setPayAmount(Number(e.target.value || 0))}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Date</label>
              <input
                type="datetime-local"
                value={new Date(payDate).toISOString().slice(0, 16)}
                onChange={(e) =>
                  setPayDate(new Date(e.target.value).toISOString())
                }
                className="px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Mode</label>
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value as any)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Notes</label>
              <input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Optional note"
              />
            </div>
            <button
              onClick={handleCreatePayment}
              disabled={!payAmount || saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-averix-red-dark text-white rounded-md hover:bg-averix-red-darker disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Payment
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading ledger…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No transactions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-600 uppercase">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Sign</th>
                    <th className="p-3 text-left">Ref</th>
                    <th className="p-3 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className="text-sm">
                      <td className="p-3">
                        {new Date(r.date).toLocaleString()}
                      </td>
                      <td className="p-3">{r.kind}</td>
                      <td className="p-3">
                        ₹{Number(r.amount || 0).toFixed(2)}
                      </td>
                      <td
                        className={`p-3 ${
                          r.sign > 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {r.sign > 0 ? "+" : "-"}
                      </td>
                      <td className="p-3">{r.refNo || r.refId || "—"}</td>
                      <td className="p-3 text-gray-600">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {page} of {pages}
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 border rounded-md disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="px-3 py-1.5 border rounded-md disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
