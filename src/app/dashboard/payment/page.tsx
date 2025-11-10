// src/app/payment/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Calendar as CalendarIcon } from "lucide-react";
import SupplierLedgerModal from "@/components/ledger/SupplierLedgerModal";
import SearchableDropdown from "@/components/ui/SearchableDropdown";

type SupplierOpt = { id: string; name: string };
type PaymentRow = {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  amount: number;
  mode: "CASH" | "BANK" | string;
  notes: string | null;
  allocated: number;
  unallocated: number;
  bills?: { purchaseId: string; billRef: string }[];
};

export default function PaymentPage() {
  const licenseId =
    typeof window !== "undefined"
      ? localStorage.getItem("licenseId") || "demo-license"
      : "demo-license";

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
    [total]
  );

  const [loading, setLoading] = useState(true);

  // modal
  const [open, setOpen] = useState(false);

  // load suppliers (for dropdown)
  useEffect(() => {
    (async () => {
      const res = await (window as any).electronAPI.listSuppliers(licenseId, {
        page: 1,
        pageSize: 1000,
      });
      const opts = (res?.suppliers ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
      })) as SupplierOpt[];
      setSuppliers(opts);
    })();
  }, [licenseId]);

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await (window as any).electronAPI.listPayments({
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
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenseId, selected?.id, q, dateFrom, dateTo, page]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
          <p className="text-gray-600">
            Record supplier payments and review history
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={!selected}
          className="inline-flex items-center gap-2 px-4 py-2 bg-averix-red-dark text-white rounded-lg hover:bg-averix-red-accent transition-colors disabled:opacity-50 font-medium"
          title={!selected ? "Select a supplier first" : undefined}
        >
          <Plus className="w-4 h-4" />
          Record Payment
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-lg">
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
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={dateFrom ?? ""}
            onChange={(e) => {
              setDateFrom(e.target.value || null);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent transition-all"
            placeholder="From"
          />
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={dateTo ?? ""}
            onChange={(e) => {
              setDateTo(e.target.value || null);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent transition-all"
            placeholder="To"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search notes/supplier…"
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading payments…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {selected
                ? "No payments for this supplier."
                : "No payments recorded yet."}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-averix-red-dark to-averix-red-accent">
                  {[
                    { key: "date", label: "Date", width: "w-40" },
                    { key: "supplier", label: "Supplier", width: "w-48" },
                    { key: "mode", label: "Mode", width: "w-24" },
                    { key: "amount", label: "Amount", width: "w-32" },
                    { key: "type", label: "Type", width: "w-40" },
                    { key: "notes", label: "Notes", width: "w-48" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className={`${col.width} px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, idx) => {
                  return (
                    <tr
                      key={r.id}
                      className={`transition-all duration-200 hover:bg-blue-50/30 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 font-medium">
                          {new Date(r.date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(r.date).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 text-sm">
                          {r.supplierName || r.supplierId}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                          {r.mode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-900 font-medium text-sm">
                          ₹{Number(r.amount || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4">
                        {(r.bills?.length || 0) > 0 ||
                        Number(r.allocated || 0) > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                            Bill-wise
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                            Whole payment
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">
                          {r.notes || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="text-sm text-gray-600 font-medium">
            Page {page} of {pages}
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Record Payment modal */}
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
