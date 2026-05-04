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
} from "lucide-react";
import Pagination from "../ui/Pagination";
import TableSkeleton from "../ui/TableSkeleton";
import EmptyState from "../ui/EmptyState";
import SupplierFormModal from "./SupplierFormModal";
import SearchableDropdown from "../ui/SearchableDropdown";
import LedgerModal from "../ledger/SupplierLedgerModal";
import { platform } from "@/platform";

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

export default function SuppliersTable() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

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

  const [firstLoad, setFirstLoad] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

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

  const handleAddSupplier = () => {
    setEditSupplier(null);
    setIsModalOpen(true);
  };
  const handleEditSupplier = (s: Supplier) => {
    setEditSupplier(s);
    setIsModalOpen(true);
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete supplier "${name}"?`)) {
      try {
        if ((window as any).electronAPI) {
          await (window as any).electronAPI.deleteSupplier(id);
        } else {
          alert("Delete supplier is only available on desktop.");
          return;
        }
        loadSuppliers("refetch");
      } catch (error) {
        alert("Failed to delete supplier");
        console.error("Error deleting supplier:", error);
      }
    }
  };

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

  const handleModalSuccess = () => {
    loadSuppliers("refetch");
    refreshDistincts();
  };
  const clearAllFilters = () => {
    setNameFilter("");
    setCategoryFilter("");
  };

  if (firstLoad && loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--kyn-text)]">
            Suppliers Management
          </h2>
        </div>
        <TableSkeleton columns={8} rows={6} />
      </div>
    );
  }

  const columns = [
    "Code",
    "Supplier Name",
    "Contact",
    "GSTIN",
    "Department",
    "Location",
    "Actions",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[var(--kyn-text)]">
              Suppliers Management
            </h2>
            <p className="text-sm mt-0.5 text-[var(--kyn-text-muted)]">
              Manage your supplier database and contacts
            </p>
          </div>
          {isRefetching && (
            <Loader2
              className="w-4 h-4 animate-spin text-[var(--kyn-text-muted)]"
              aria-label="Loading"
            />
          )}
        </div>
        <button
          onClick={handleAddSupplier}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150"
          style={{
            background:
              "linear-gradient(135deg, var(--kyn-primary), var(--kyn-secondary))",
            color: "var(--kyn-white)",
            boxShadow: "0 0 14px var(--kyn-glow-primary)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 22px var(--kyn-glow-primary), 0 0 8px var(--kyn-glow-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 14px var(--kyn-glow-primary)";
          }}
        >
          <UserPlus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--kyn-surface)",
          border: "1px solid var(--kyn-border)",
        }}
      >
        <div className="flex flex-col md:flex-row gap-3">
          <SearchableDropdown
            value={nameFilter}
            onChange={setNameFilter}
            options={nameOptions.map((n) => ({ value: n, label: n }))}
            placeholder="Filter by supplier name"
          />
          <SearchableDropdown
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions.map((c) => ({ value: c, label: c }))}
            placeholder="Filter by category"
          />
          {(nameFilter || categoryFilter) && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-sm rounded-lg transition-all duration-150"
              style={{
                background: "var(--kyn-surface-3)",
                border: "1px solid var(--kyn-border)",
                color: "var(--kyn-text-muted)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--kyn-text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--kyn-text-muted)";
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {suppliers.length === 0 && !isRefetching ? (
        <EmptyState
          title="No Suppliers Found"
          description="Add your first supplier to get started with purchase management."
          icon={<UserPlus size={32} />}
          action={
            <button
              onClick={handleAddSupplier}
              className="mt-4 px-6 py-3 text-sm font-medium rounded-lg transition-all duration-150"
              style={{
                background:
                  "linear-gradient(135deg, var(--kyn-primary), var(--kyn-secondary))",
                color: "var(--kyn-white)",
                boxShadow: "0 0 14px var(--kyn-glow-primary)",
              }}
            >
              Add Supplier
            </button>
          }
        />
      ) : (
        <div
          className={`rounded-xl overflow-hidden transition-opacity duration-200 ${isRefetching ? "opacity-90" : "opacity-100"}`}
          style={{
            background: "var(--kyn-surface)",
            border: "1px solid var(--kyn-border)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  style={{
                    background: "var(--kyn-surface-2)",
                    borderBottom: "1px solid var(--kyn-border)",
                  }}
                >
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--kyn-text-muted)" }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier, idx) => (
                  <tr
                    key={supplier.id}
                    className="transition-colors duration-100 group"
                    style={{
                      background:
                        idx % 2 === 0
                          ? "var(--kyn-surface)"
                          : "var(--kyn-surface-2)",
                      borderBottom: "1px solid var(--kyn-border)",
                    }}
                    onMouseEnter={(e) => {
                      (
                        e.currentTarget as HTMLTableRowElement
                      ).style.background = "var(--kyn-surface-3)";
                    }}
                    onMouseLeave={(e) => {
                      (
                        e.currentTarget as HTMLTableRowElement
                      ).style.background =
                        idx % 2 === 0
                          ? "var(--kyn-surface)"
                          : "var(--kyn-surface-2)";
                    }}
                  >
                    {/* Code */}
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono"
                        style={{
                          background: "var(--kyn-surface-3)",
                          border: "1px solid var(--kyn-border)",
                          color: "var(--kyn-text-muted)",
                        }}
                      >
                        {supplier.code || "—"}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-[var(--kyn-text)]">
                        {supplier.name}
                      </div>
                      {supplier.category && (
                        <div className="text-xs mt-0.5 text-[var(--kyn-text-muted)]">
                          {supplier.category}
                        </div>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-3">
                      <div className="space-y-1">
                        {supplier.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--kyn-text-soft)]">
                            <Phone className="w-3 h-3 text-[var(--kyn-text-muted)]" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--kyn-text-muted)]">
                            <Mail className="w-3 h-3" />
                            {supplier.email}
                          </div>
                        )}
                        {!supplier.phone && !supplier.email && (
                          <span className="text-[var(--kyn-text-muted)]">
                            —
                          </span>
                        )}
                      </div>
                    </td>

                    {/* GSTIN */}
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono text-[var(--kyn-text-soft)]">
                        {supplier.gstin || "—"}
                      </span>
                    </td>

                    {/* Department */}
                    <td className="px-5 py-3">
                      <span className="text-sm text-[var(--kyn-text-soft)]">
                        {supplier.department || "—"}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="px-5 py-3">
                      <span className="text-sm text-[var(--kyn-text-soft)]">
                        {supplier.city && supplier.state
                          ? `${supplier.city}, ${supplier.state}`
                          : supplier.city || supplier.state || "—"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Ledger */}
                        <ActionBtn
                          title="Ledger"
                          colorVar="var(--kyn-success)"
                          glowVar="rgba(34,197,94,0.2)"
                          onClick={() => {
                            setLedgerSupplier({
                              id: supplier.id,
                              name: supplier.name,
                            });
                            setLedgerOpen(true);
                          }}
                        >
                          <ReceiptIndianRupee className="w-3.5 h-3.5" />
                        </ActionBtn>

                        {/* Edit */}
                        <ActionBtn
                          title="Edit Supplier"
                          colorVar="var(--kyn-primary)"
                          glowVar="var(--kyn-glow-primary)"
                          onClick={() => handleEditSupplier(supplier)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </ActionBtn>

                        {/* Delete */}
                        <ActionBtn
                          title="Delete Supplier"
                          colorVar="var(--kyn-danger)"
                          glowVar="rgba(239,68,68,0.2)"
                          onClick={() =>
                            handleDeleteSupplier(supplier.id, supplier.name)
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: "1px solid var(--kyn-border)" }}>
            <Pagination
              page={page}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

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
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}

// ── Reusable icon action button ─────────────────────────────────────────────
function ActionBtn({
  children,
  title,
  colorVar,
  glowVar,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  colorVar: string;
  glowVar: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
      style={{
        background: "var(--kyn-surface-3)",
        border: "1px solid var(--kyn-border)",
        color: colorVar,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 8px ${glowVar}`;
        e.currentTarget.style.borderColor = colorVar;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--kyn-border)";
      }}
    >
      {children}
    </button>
  );
}

// ── Balance helper ──────────────────────────────────────────────────────────
function SupplierBalance({ supplierId }: { supplierId: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const licenseId = localStorage.getItem("licenseId") || "demo-license";
        const { balance: bal } = await (
          window as any
        ).electronAPI.getSupplierSummary(licenseId, supplierId);
        setBalance(Number(bal));
      } catch {
        setBalance(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [supplierId]);

  if (loading)
    return (
      <span className="text-[var(--kyn-text-muted)] text-xs">Loading…</span>
    );
  if (balance === null || balance === 0)
    return (
      <span className="text-[var(--kyn-text-muted)] text-sm font-medium">
        ₹0.00
      </span>
    );

  return (
    <span
      className="text-sm font-medium"
      style={{
        color: balance > 0 ? "var(--kyn-danger)" : "var(--kyn-success)",
      }}
    >
      ₹{Math.abs(balance).toFixed(2)}
    </span>
  );
}
