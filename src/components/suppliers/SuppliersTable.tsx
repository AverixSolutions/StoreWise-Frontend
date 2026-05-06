// src/components/suppliers/SuppliersTable.tsx
"use client";

import { useState, useEffect } from "react";
import {
  UserPlus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Loader2,
  ReceiptIndianRupee,
  Truck,
  ArrowLeft,
} from "lucide-react";
import Pagination from "../ui/Pagination";
import TableSkeleton from "../ui/TableSkeleton";
import SearchableDropdown from "../ui/SearchableDropdown";
import SupplierFormModal from "./SupplierFormModal";
import LedgerModal from "../ledger/SupplierLedgerModal";
import { platform } from "@/platform";
import { SyncManager } from "@/sync/SyncManager";
import { isSyncEnabled } from "@/platform/mode";

interface Supplier {
  id: string;
  code?: string;
  codeNumber?: number;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  department?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  category?: string;
  native?: string;
  language?: string;
  aadhaar?: string;
  pan?: string;
  license1?: string;
  license2?: string;
  settlementDays?: number;
  creditLimit?: number;
  openingBalance?: number;
  notes?: string;
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
function DeleteModal({
  supplierName,
  onConfirm,
  onCancel,
  confirming,
}: {
  supplierName: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(3,10,24,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50">
          <Trash2 className="h-5 w-5 text-rose-600" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">
          Delete Supplier?
        </h3>
        <p className="mt-1.5 text-sm text-slate-500">
          Are you sure you want to delete{" "}
          <strong className="text-slate-700">
            &ldquo;{supplierName}&rdquo;
          </strong>
          ? This action cannot be undone.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer transition"
          >
            {confirming ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SuppliersTable({ onBack }: { onBack?: () => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [nameFilter, setNameFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [debouncedName, setDebouncedName] = useState(nameFilter);
  const [debouncedCategory, setDebouncedCategory] = useState(categoryFilter);

  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(nameFilter), 250);
    return () => clearTimeout(t);
  }, [nameFilter]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCategory(categoryFilter), 250);
    return () => clearTimeout(t);
  }, [categoryFilter]);

  const [nameOptions, setNameOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const licenseId = localStorage.getItem("licenseId") || "demo-license";
    (async () => {
      try {
        if ((window as any).electronAPI) {
          const { names, categories } = await (
            window as any
          ).electronAPI.getSupplierDistincts(licenseId);
          setNameOptions(names || []);
          setCategoryOptions(categories || []);
        }
      } catch (e) {
        console.error("distinct suppliers failed", e);
      }
    })();
  }, []);

  const loadSuppliers = async (phase: "initial" | "refetch" = "refetch") => {
    try {
      if (phase === "initial") setLoading(true);
      else setIsRefetching(true);

      const licenseId = localStorage.getItem("licenseId") || "demo-license";
      const result = await platform.listSuppliers?.(licenseId, {
        q: debouncedName || "",
        page,
        pageSize,
      });
      setSuppliers(
        (result?.suppliers ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code ?? undefined,
          codeNumber: s.codeNumber ?? undefined,
          phone: s.phone ?? undefined,
          email: s.email ?? undefined,
          gstin: s.gstin ?? undefined,
          department: (s as any).department ?? undefined,
          addressLine1: s.addressLine1 ?? undefined,
          addressLine2: s.addressLine2 ?? undefined,
          city: s.city ?? undefined,
          state: s.state ?? undefined,
          pincode: s.pincode ?? undefined,
          category: s.category ?? undefined,
          native: (s as any).native ?? undefined,
          language: (s as any).language ?? undefined,
          aadhaar: (s as any).aadhaar ?? undefined,
          pan: (s as any).pan ?? undefined,
          license1: (s as any).license1 ?? undefined,
          license2: (s as any).license2 ?? undefined,
          settlementDays: s.settlementDays ?? undefined,
          creditLimit: s.creditLimit ?? undefined,
          openingBalance: s.openingBalance ?? undefined,
          notes: s.notes ?? undefined,
        })) as Supplier[],
      );
      setTotal(result?.total ?? 0);
    } catch (error) {
      console.error("Error loading suppliers:", error);
    } finally {
      if (firstLoad) {
        setFirstLoad(false);
        setLoading(false);
      }
      setIsRefetching(false);
    }
  };

  useEffect(() => {
    loadSuppliers("initial");
  }, []);
  useEffect(() => {
    if (!firstLoad) loadSuppliers("refetch");
  }, [debouncedName, debouncedCategory, page, pageSize]);
  useEffect(() => {
    setPage(1);
  }, [nameFilter, categoryFilter]);

  const refreshDistincts = async () => {
    try {
      const licenseId = localStorage.getItem("licenseId") || "demo-license";
      if ((window as any).electronAPI) {
        const { names, categories } = await (
          window as any
        ).electronAPI.getSupplierDistincts(licenseId);
        setNameOptions(names || []);
        setCategoryOptions(categories || []);
      }
    } catch (e) {
      console.error("distinct suppliers failed", e);
    }
  };

  const handleAdd = () => {
    setEditSupplier(null);
    setIsModalOpen(true);
  };

  const handleEdit = (s: Supplier) => {
    setEditSupplier(s);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await platform.deleteSupplier?.(deleteTarget.id);
      if (result?.success) {
        if (isSyncEnabled()) {
          SyncManager.pushEntity("supplier").catch(() => {});
        }
        loadSuppliers("refetch");
        refreshDistincts();
      } else {
        alert(result?.error || "Failed to delete supplier");
      }
    } catch (e) {
      alert("Failed to delete supplier");
      console.error(e);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleModalSuccess = () => {
    loadSuppliers("refetch");
    refreshDistincts();
  };

  const TABLE_HEADERS = [
    "Code",
    "Supplier Name",
    "Contact",
    "GSTIN",
    "Department",
    "Location",
    "Actions",
  ];

  if (firstLoad && loading) {
    return (
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)]">
          <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-white">
            Suppliers
          </h1>
        </section>
        <TableSkeleton columns={7} rows={6} />
      </div>
    );
  }

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          supplierName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          confirming={deleting}
        />
      )}

      <div className="space-y-4">
        {/* ── Hero Banner ── */}
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)] md:px-6 md:py-6">
          <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-300">
                <Truck className="h-3 w-3" />
                Supplier Management
              </div>
              <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-white md:text-[30px]">
                Supplier{" "}
                <span className="bg-gradient-to-r from-[#20b7ff] to-[#b026ff] bg-clip-text text-transparent">
                  Database
                </span>
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                Manage your supplier contacts, balances and purchase info.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {onBack && (
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Master
                </button>
              )}
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(32,183,255,0.22)] hover:opacity-90 transition cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                Add Supplier
              </button>
            </div>
          </div>
        </section>

        {/* ── Filters ── */}
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)] overflow-hidden">
          <div className="flex items-center gap-3 bg-[#1e3a5f] px-5 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
              Filters
            </span>
            {isRefetching && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white/50" />
            )}
          </div>
          <div className="bg-slate-50/60 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <SearchableDropdown
                  value={nameFilter}
                  onChange={setNameFilter}
                  options={nameOptions.map((n) => ({ value: n, label: n }))}
                  placeholder="Filter by supplier name"
                />
              </div>
              <div className="flex-1">
                <SearchableDropdown
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={categoryOptions.map((c) => ({ value: c, label: c }))}
                  placeholder="Filter by category"
                />
              </div>
              {(nameFilter || categoryFilter) && (
                <button
                  onClick={() => {
                    setNameFilter("");
                    setCategoryFilter("");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Table / Empty ── */}
        {suppliers.length === 0 && !isRefetching ? (
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)] overflow-hidden">
            <div className="flex items-center gap-3 bg-[#1e3a5f] px-5 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
                0 suppliers
              </span>
            </div>
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                <Truck className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                No suppliers found
              </p>
              <p className="text-xs text-slate-400">
                Add your first supplier to get started.
              </p>
              <button
                onClick={handleAdd}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(32,183,255,0.18)] hover:opacity-90 transition cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                Add Supplier
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)] overflow-hidden transition-opacity duration-200 ${
              isRefetching ? "opacity-90" : "opacity-100"
            }`}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 bg-[#1e3a5f]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                {total} supplier{total !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/20 transition cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Supplier</span>
              </button>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {TABLE_HEADERS.map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 first:pl-5 ${
                          h === "Actions" ? "text-right pr-5" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/90">
                  {suppliers.map((s, idx) => (
                    <tr
                      key={s.id}
                      className={`group transition-colors hover:bg-violet-50/30 ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      }`}
                    >
                      {/* Code */}
                      <td className="pl-5 pr-4 py-3">
                        <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 font-mono tracking-wide">
                          {s.code || "—"}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-semibold text-slate-800">
                          {s.name}
                        </div>
                        {s.category && (
                          <div className="text-xs text-slate-400 truncate max-w-[180px]">
                            {s.category}
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {s.phone && (
                            <div className="flex items-center gap-1.5 text-[12px] text-slate-600">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {s.phone}
                            </div>
                          )}
                          {s.email && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <Mail className="w-3 h-3" />
                              {s.email}
                            </div>
                          )}
                          {!s.phone && !s.email && (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </div>
                      </td>

                      {/* GSTIN */}
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-mono text-slate-500">
                          {s.gstin || "—"}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3">
                        {s.department ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            {s.department}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-[12px] text-slate-500">
                        {s.city && s.state
                          ? `${s.city}, ${s.state}`
                          : s.city || s.state || "—"}
                      </td>

                      {/* Actions */}
                      <td className="py-3 pl-4 pr-5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setLedgerSupplier({ id: s.id, name: s.name });
                              setLedgerOpen(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600 transition hover:border-emerald-200 hover:bg-emerald-50 cursor-pointer"
                            title="Ledger"
                          >
                            <ReceiptIndianRupee className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleEdit(s)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50 cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(s)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="block md:hidden">
              <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {total} suppliers
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <div
                    key={s.id}
                    className="px-4 py-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 font-mono">
                            {s.code || "—"}
                          </span>
                          <p className="truncate text-[14px] font-semibold text-slate-900">
                            {s.name}
                          </p>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {s.phone && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Phone className="w-3 h-3" />
                              {s.phone}
                            </span>
                          )}
                          {s.department && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              {s.department}
                            </span>
                          )}
                          {(s.city || s.state) && (
                            <span className="text-[10px] text-slate-400">
                              {s.city && s.state
                                ? `${s.city}, ${s.state}`
                                : s.city || s.state}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setLedgerSupplier({ id: s.id, name: s.name });
                            setLedgerOpen(true);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600"
                        >
                          <ReceiptIndianRupee className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(s)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Pagination
              page={page}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Ledger modal */}
      {ledgerOpen && ledgerSupplier && (
        <LedgerModal
          isOpen={ledgerOpen}
          onClose={() => setLedgerOpen(false)}
          licenseId={localStorage.getItem("licenseId") || "demo-license"}
          supplierId={ledgerSupplier.id}
          supplierName={ledgerSupplier.name}
        />
      )}

      {/* Form modal */}
      {isModalOpen && (
        <SupplierFormModal
          isOpen={isModalOpen}
          editSupplier={editSupplier}
          onClose={() => {
            setIsModalOpen(false);
            setEditSupplier(null);
          }}
          onSuccess={handleModalSuccess}
        />
      )}
    </>
  );
}
