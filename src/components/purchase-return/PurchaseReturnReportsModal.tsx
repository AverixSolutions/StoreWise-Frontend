//src/components/purchase-return/PurchaseReturnReportsModal.tsx
"use client";
import { useEffect, useState } from "react";
import {
  X,
  Search,
  Calendar,
  RotateCcw,
  Trash2,
  ExternalLink,
} from "lucide-react";

type Row = {
  id: string;
  slNo: number | null;
  billNo?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  dateIso: string; // returnDate
  entryTime?: string | null;
  totalAmount: number;
  discount: number;
  purchaseType: "CASH" | "CREDIT";
  isDeleted?: boolean;
};

export interface PurchaseReturnReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseId: string;
  suppliers: Array<{ id: string; name: string }>;
  onOpenPurchaseReturn: (id: string) => void;
}

export default function PurchaseReturnReportsModal({
  isOpen,
  onClose,
  licenseId,
  suppliers,
  onOpenPurchaseReturn,
}: PurchaseReturnReportsModalProps) {
  const [q, setQ] = useState("");
  const [supplierId, setSupplierId] = useState<string | "">("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const filters = {
        q,
        supplierId: supplierId || null,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
        dateTo: dateTo ? new Date(dateTo).toISOString() : null,
        page,
        pageSize,
      };

      const res = await (window as any).electronAPI.listPurchaseReturns(
        licenseId,
        filters
      );
      const mapped: Row[] = (res.rows || res.returns || []).map((r: any) => ({
        id: r.id,
        slNo: r.slNo ?? null,
        billNo: r.billNo,
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        dateIso: r.returnDate,
        entryTime: r.entryTime,
        totalAmount: Number(r.totalAmount || 0),
        discount: Number(r.discount || 0),
        purchaseType: r.purchaseType || "CREDIT",
        isDeleted: !!r.deletedAt,
      }));
      setRows(mapped);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, page, pageSize]);

  function resetAndRefresh() {
    setPage(1);
    refresh();
  }

  async function handleDelete(id: string) {
    const ok = confirm("Soft delete this purchase return?");
    if (!ok) return;
    await (window as any).electronAPI.deletePurchaseReturn(id);
    refresh();
  }

  function openRow(row: Row) {
    onOpenPurchaseReturn(row.id);
    onClose();
  }

  if (!isOpen) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="text-base font-semibold">Purchase Return Reports</div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-100 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                className="w-full h-9 pl-8 pr-2 border border-gray-300 rounded-md text-sm"
                placeholder="Search bill no / supplier"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resetAndRefresh()}
              />
            </div>

            <div>
              <select
                className="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">All suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                className="w-full h-9 pl-8 pr-2 border border-gray-300 rounded-md text-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                className="w-full h-9 pl-8 pr-2 border border-gray-300 rounded-md text-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex justify-between items-center">
            <div className="text-xs text-gray-500">
              {supplierId
                ? `Filtering by: ${
                    suppliers.find((s) => s.id === supplierId)?.name || ""
                  }`
                : "All suppliers"}
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetAndRefresh}
                className="px-3 h-9 rounded-md border border-gray-300 text-sm hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Refresh
              </button>
              <button
                onClick={() => {
                  setQ("");
                  setSupplierId("");
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                  refresh();
                }}
                className="px-3 h-9 rounded-md bg-gray-800 text-white text-sm hover:bg-black"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 py-4 overflow-auto max-h-[55vh]">
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No records</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Bill No</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-center">Type</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2">{r.slNo ?? "—"}</td>
                    <td className="px-3 py-2">{r.billNo || "—"}</td>
                    <td className="px-3 py-2">{r.supplierName || "—"}</td>
                    <td className="px-3 py-2">
                      {new Date(r.dateIso).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      ₹ {Number(r.totalAmount).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${
                          r.purchaseType === "CASH"
                            ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                            : "border-blue-300 text-blue-700 bg-blue-50"
                        }`}
                      >
                        {r.purchaseType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          className="px-2.5 py-1.5 rounded-md bg-averix-red-dark text-white text-xs hover:bg-averix-red-accent inline-flex items-center gap-1"
                          onClick={() => openRow(r)}
                          title="Open in editor"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </button>
                        <button
                          className="px-2.5 py-1.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-xs hover:bg-red-100 inline-flex items-center gap-1"
                          onClick={() => handleDelete(r.id)}
                          title="Soft delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer / Pagination */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            {total} record{total === 1 ? "" : "s"}
          </span>
          <div className="inline-flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 h-8 rounded-md border border-gray-300 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm px-2 py-1 rounded bg-white border border-gray-200">
              {page} / {pageCount}
            </span>
            <button
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 h-8 rounded-md border border-gray-300 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
