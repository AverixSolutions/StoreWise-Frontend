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
} from "lucide-react";
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
  openingId?: string;
}

export default function SalesReportsModal({
  isOpen,
  onClose,
  licenseId,
  customers,
  onOpenSale,
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

  async function handleDelete(id: string) {
    const ok = confirm("Soft delete this entry?");
    if (!ok) return;
    await platform.deleteSale?.(id);
    if (isSyncEnabled()) {
      SyncManager.pushEntity("sale").catch(() => {});
      SyncManager.pushEntity("saleItem").catch(() => {});
      SyncManager.pushEntity("customerTransaction").catch(() => {});
      SyncManager.pushEntity("cashTransaction").catch(() => {});
      SyncManager.pushEntity("product").catch(() => {});
    }
    refresh();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(4,8,20,0.72)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl"
        style={{
          background: "#fff",
          border: "1px solid rgba(93,135,201,0.22)",
          boxShadow:
            "0 0 0 1px rgba(32,183,255,0.08), 0 32px 64px rgba(4,8,20,0.5), 0 8px 24px rgba(32,183,255,0.1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{
            background: "linear-gradient(135deg, #0e172a 0%, #13203a 100%)",
            borderBottom: "1px solid rgba(93,135,201,0.18)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(32,183,255,0.18), rgba(176,38,255,0.14))",
                border: "1px solid rgba(93,135,201,0.28)",
              }}
            >
              <ShoppingCart className="w-4 h-4" style={{ color: "#20b7ff" }} />
            </div>
            <div>
              <div
                className="text-sm font-semibold tracking-wide"
                style={{ color: "#f8fafc" }}
              >
                Sales Reports
              </div>
              <div className="text-xs" style={{ color: "#8ea3c7" }}>
                {total > 0
                  ? `${total} record${total === 1 ? "" : "s"} found`
                  : "All sales"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "#8ea3c7" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {openingId && (
          <div
            className="px-6 py-2 text-xs flex items-center gap-2 shrink-0"
            style={{
              background: "rgba(32,183,255,0.08)",
              borderBottom: "1px solid rgba(32,183,255,0.18)",
              color: "#20b7ff",
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#20b7ff" }}
            />
            Opening sale{" "}
            <span className="font-medium font-mono">{openingId}</span>…
          </div>
        )}

        {/* Filters */}
        <div
          className="px-6 py-4 shrink-0"
          style={{ background: "#f8fafc", borderBottom: "1px solid #e8edf5" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: "#8ea3c7" }}
              />
              <input
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg outline-none transition-all"
                style={{
                  background: "#fff",
                  border: "1px solid #dbe7ff",
                  color: "#1e2d4a",
                }}
                placeholder="Bill no / customer…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resetAndRefresh()}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#20b7ff")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#dbe7ff")}
              />
            </div>
            <select
              className="w-full h-9 px-3 text-sm rounded-lg outline-none transition-all"
              style={{
                background: "#fff",
                border: "1px solid #dbe7ff",
                color: "#1e2d4a",
              }}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#20b7ff")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#dbe7ff")}
            >
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <Calendar
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: "#8ea3c7" }}
              />
              <input
                type="date"
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg outline-none transition-all"
                style={{
                  background: "#fff",
                  border: "1px solid #dbe7ff",
                  color: "#1e2d4a",
                }}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#20b7ff")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#dbe7ff")}
              />
            </div>
            <div className="relative">
              <Calendar
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: "#8ea3c7" }}
              />
              <input
                type="date"
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg outline-none transition-all"
                style={{
                  background: "#fff",
                  border: "1px solid #dbe7ff",
                  color: "#1e2d4a",
                }}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#20b7ff")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#dbe7ff")}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs" style={{ color: "#8ea3c7" }}>
              {customerId
                ? `Customer: ${customers.find((c) => c.id === customerId)?.name ?? ""}`
                : "Showing all customers"}
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetAndRefresh}
                className="h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                style={{
                  background: "#fff",
                  border: "1px solid #dbe7ff",
                  color: "#1e2d4a",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "#20b7ff")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "#dbe7ff")
                }
              >
                <RotateCcw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button
                onClick={() => {
                  setQ("");
                  setCustomerId("");
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                  setTimeout(() => refresh(), 0);
                }}
                className="h-8 px-3 rounded-lg text-xs font-medium transition-all"
                style={{
                  background:
                    "linear-gradient(135deg, #0e172a 0%, #182745 100%)",
                  color: "#dbe7ff",
                  border: "1px solid rgba(93,135,201,0.28)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "linear-gradient(135deg, #13203a 0%, #1e3055 100%)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    "linear-gradient(135deg, #0e172a 0%, #182745 100%)")
                }
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div
          className="overflow-auto flex-1 px-6 py-4"
          style={{ minHeight: 0 }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg
                className="animate-spin w-7 h-7"
                viewBox="0 0 24 24"
                style={{ color: "#20b7ff" }}
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
              <span className="text-sm" style={{ color: "#8ea3c7" }}>
                Loading sales…
              </span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <ShoppingCart
                className="w-10 h-10 opacity-30"
                style={{ color: "#8ea3c7" }}
              />
              <span className="text-sm" style={{ color: "#8ea3c7" }}>
                No records found
              </span>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr
                  style={{
                    background:
                      "linear-gradient(135deg, #0e172a 0%, #13203a 100%)",
                  }}
                >
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
                      className={`px-4 py-2.5 text-xs font-semibold tracking-wider first:rounded-tl-lg last:rounded-tr-lg ${i >= 4 ? "text-right" : "text-left"} ${i === 5 ? "text-center" : ""}`}
                      style={{ color: "#8ea3c7" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="transition-colors"
                    style={{
                      borderBottom: "1px solid #e8edf5",
                      background: idx % 2 === 0 ? "#fff" : "#f8fafc",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(32,183,255,0.04)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        idx % 2 === 0 ? "#fff" : "#f8fafc")
                    }
                  >
                    <td
                      className="px-4 py-2.5 text-xs font-mono"
                      style={{ color: "#8ea3c7" }}
                    >
                      {r.slNo ?? "—"}
                    </td>
                    <td
                      className="px-4 py-2.5 font-medium text-xs font-mono"
                      style={{ color: "#1e2d4a" }}
                    >
                      {r.billNo || "—"}
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs"
                      style={{ color: "#3d5a80" }}
                    >
                      {r.customerName || "—"}
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs"
                      style={{ color: "#3d5a80" }}
                    >
                      {new Date(r.dateIso).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td
                      className="px-4 py-2.5 text-right text-xs font-semibold font-mono"
                      style={{ color: "#0e172a" }}
                    >
                      ₹ {Number(r.totalAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className="px-2 py-0.5 text-xs rounded-full font-medium"
                        style={
                          r.saleType === "CASH"
                            ? {
                                background: "rgba(34,197,94,0.1)",
                                color: "#15803d",
                                border: "1px solid rgba(34,197,94,0.25)",
                              }
                            : {
                                background: "rgba(32,183,255,0.1)",
                                color: "#0369a1",
                                border: "1px solid rgba(32,183,255,0.25)",
                              }
                        }
                      >
                        {r.saleType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          disabled={Boolean(openingId)}
                          onClick={() => (openingId ? null : onOpenSale(r.id))}
                          className="h-7 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all"
                          style={
                            openingId === r.id
                              ? {
                                  background: "#e8edf5",
                                  color: "#8ea3c7",
                                  cursor: "wait",
                                  border: "1px solid #dbe7ff",
                                }
                              : {
                                  background:
                                    "linear-gradient(135deg, #0e172a, #182745)",
                                  color: "#20b7ff",
                                  border: "1px solid rgba(32,183,255,0.28)",
                                }
                          }
                        >
                          {openingId === r.id ? (
                            <>
                              <svg
                                className="animate-spin h-3 w-3"
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
                              <ExternalLink className="w-3 h-3" /> Open
                            </>
                          )}
                        </button>
                        <button
                          disabled={Boolean(openingId)}
                          onClick={() => handleDelete(r.id)}
                          className="h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-all"
                          style={{
                            background: "rgba(239,68,68,0.06)",
                            color: "#dc2626",
                            border: "1px solid rgba(239,68,68,0.2)",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "rgba(239,68,68,0.12)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              "rgba(239,68,68,0.06)")
                          }
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 shrink-0 flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, #0e172a 0%, #13203a 100%)",
            borderTop: "1px solid rgba(93,135,201,0.18)",
          }}
        >
          <span className="text-xs" style={{ color: "#8ea3c7" }}>
            {total} record{total === 1 ? "" : "s"}
          </span>
          <div className="inline-flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 px-3 rounded-md text-xs font-medium transition-all disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(93,135,201,0.28)",
                color: "#dbe7ff",
              }}
            >
              Prev
            </button>
            <span
              className="text-xs px-3 h-7 flex items-center rounded-md font-mono"
              style={{
                background: "rgba(32,183,255,0.1)",
                border: "1px solid rgba(32,183,255,0.22)",
                color: "#20b7ff",
              }}
            >
              {page} / {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-3 rounded-md text-xs font-medium transition-all disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(93,135,201,0.28)",
                color: "#dbe7ff",
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
