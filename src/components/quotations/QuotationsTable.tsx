// src/components/quotations/QuotationsTable.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { platform } from "@/platform";
import type { QuotationRow } from "@/platform/types";

const STATUS_BADGE: Record<
  string,
  { label: string; cls: string; dot: string }
> = {
  DRAFT: {
    label: "Draft",
    cls: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
  SENT: {
    label: "Sent",
    cls: "bg-sky-50 text-sky-600",
    dot: "bg-sky-500",
  },
  CONVERTED: {
    label: "Converted",
    cls: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  EXPIRED: {
    label: "Expired",
    cls: "bg-rose-50 text-rose-600",
    dot: "bg-rose-400",
  },
};

interface Props {
  licenseId: string;
  onNew: () => void;
  onView: (id: string) => void;
  refreshKey?: number;
}

export default function QuotationsTable({
  licenseId,
  onNew,
  onView,
  refreshKey,
}: Props) {
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platform.listQuotations?.(licenseId, {
        q: q || undefined,
        status: (status || null) as any,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo: dateTo
          ? new Date(
              new Date(dateTo).getTime() + 24 * 60 * 60 * 1000,
            ).toISOString()
          : undefined,
        page,
        pageSize,
      });
      setRows((res?.rows as QuotationRow[]) ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [licenseId, q, status, dateFrom, dateTo, page, pageSize, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [q, status, dateFrom, dateTo, refreshKey]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              className="h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 w-56 transition shadow-sm"
              placeholder="Search quotation or customer…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <select
            className="h-9 px-3 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition shadow-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="CONVERTED">Converted</option>
            <option value="EXPIRED">Expired</option>
          </select>

          {/* Date range */}
          <input
            type="date"
            className="h-9 px-3 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition shadow-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            className="h-9 px-3 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition shadow-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        {/* New button — matches other pages' CTA style */}
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition cursor-pointer shadow-[0_4px_14px_rgba(32,183,255,0.25)] bg-gradient-to-r from-[#20b7ff] to-[#6a8fff] hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          New Quotation
        </button>
      </div>

      {/* ── Table card ── */}
      <div className="overflow-x-auto rounded-[20px] border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-widest">
              <th className="px-4 py-3 text-left w-32 font-semibold">
                Quotation No
              </th>
              <th className="px-4 py-3 text-left w-28 font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Customer</th>
              <th className="px-4 py-3 text-right w-32 font-semibold">
                Amount
              </th>
              <th className="px-4 py-3 text-center w-28 font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                      <FileText className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                      No quotations found
                    </p>
                    <p className="text-xs text-slate-400">
                      Create your first quotation to get started
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const badge =
                  STATUS_BADGE[row.status ?? "DRAFT"] ?? STATUS_BADGE["DRAFT"];
                const grandTotal = Math.max(
                  0,
                  Number(row.totalAmount || 0) - Number(row.discount || 0),
                );
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-sky-50/40 cursor-pointer transition-colors"
                    onClick={() => onView(row.id)}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-800 tracking-tight">
                      {row.quotationNo ??
                        `QT-${String(row.slNo).padStart(4, "0")}`}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {row.quotationDate
                        ? new Date(row.quotationDate).toLocaleDateString(
                            "en-IN",
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.customerName || (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 font-[tabular-nums]">
                      ₹
                      {grandTotal.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.cls}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}
                        />
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span className="text-xs text-slate-400">
            {total} quotation{total !== 1 ? "s" : ""} total
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 rounded-lg bg-slate-100 text-xs font-medium text-slate-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
