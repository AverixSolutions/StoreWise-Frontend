// src/components/quotations/QuotationsTable.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Pencil,
  ArrowRight,
  Printer,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { platform } from "@/platform";
import type { QuotationRow } from "@/platform/types";
import Dropdown from "@/components/ui/Dropdown";
import { printQuotation } from "@/lib/print/printQuotation";

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

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "CONVERTED", label: "Converted" },
  { value: "EXPIRED", label: "Expired" },
];

interface Props {
  licenseId: string;
  onView: (id: string) => void;
  onEdit?: (id: string) => void;
  refreshKey?: number;
}

function getConvertedSaleLabel(row: QuotationRow) {
  const saleBillNo = row.convertedSaleBillNo;
  const saleSlNo = row.convertedSaleSlNo;

  if (!row.convertedSaleId && row.status !== "CONVERTED") return "";

  if (saleBillNo) return `Sale ${saleBillNo}`;
  if (saleSlNo != null) return `Sale #${String(saleSlNo).padStart(5, "0")}`;

  return "Converted to Sale";
}

function canOpenInSales(row: QuotationRow) {
  return row.status === "DRAFT" || row.status === "SENT";
}

export default function QuotationsTable({
  licenseId,
  onView,
  onEdit,
  refreshKey,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

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

  async function handlePrint(id: string) {
    setPrintingId(id);
    try {
      await printQuotation(id, { preview: true });
    } catch (err: any) {
      alert(err?.message || "Print failed");
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div className="rounded-[18px] border border-slate-200 bg-white/85 p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(280px,2fr)_minmax(180px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)]">
          {/* Search */}
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-[38px] w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
              placeholder="Search quotation or customer…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <Dropdown
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
            buttonClassName="!h-[38px] !rounded-2xl !border-slate-200 !bg-white !px-3.5 !py-0 !text-sm !shadow-sm focus:!border-cyan-400/60 focus:!ring-4 focus:!ring-cyan-400/10"
            menuClassName="rounded-xl"
            optionClassName="!text-sm"
          />

          {/* Date From */}
          <input
            type="date"
            className="h-[38px] w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />

          {/* Date To */}
          <input
            type="date"
            className="h-[38px] w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="overflow-x-auto rounded-[20px] border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[linear-gradient(135deg,#07101f_0%,#0f1a31_58%,#17213c_100%)]">
              <th className="px-4 py-3 text-left w-32 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Quotation No
              </th>
              <th className="px-4 py-3 text-left w-28 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Date
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Customer
              </th>
              <th className="px-4 py-3 text-right w-32 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Amount
              </th>
              <th className="px-4 py-3 text-center w-28 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Status
              </th>
              <th className="px-4 py-3 text-left w-40 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Sale
              </th>
              <th className="px-4 py-3 text-right w-44 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
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
                const saleLabel = getConvertedSaleLabel(row);

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/80 ${
                      row.status === "CONVERTED"
                        ? "bg-emerald-50/20"
                        : "bg-white"
                    }`}
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
                    <td className="px-4 py-3 text-left">
                      {row.status === "CONVERTED" ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {saleLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* View */}
                        <button
                          type="button"
                          onClick={() => onView(row.id)}
                          title="View"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <Eye className="h-3 w-3" />
                        </button>

                        {/* Print */}
                        <button
                          type="button"
                          onClick={() => handlePrint(row.id)}
                          disabled={printingId === row.id}
                          title="Print"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {printingId === row.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Printer className="h-3 w-3" />
                          )}
                        </button>

                        {/* Open in Sales */}
                        {canOpenInSales(row) && (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/dashboard/sales?quotationId=${encodeURIComponent(row.id)}`,
                              )
                            }
                            title="Open in Sales"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600 transition hover:border-emerald-200 hover:bg-emerald-50"
                          >
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}

                        {/* Edit */}
                        {onEdit && row.status !== "CONVERTED" && (
                          <button
                            type="button"
                            onClick={() => onEdit(row.id)}
                            title="Edit"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
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
