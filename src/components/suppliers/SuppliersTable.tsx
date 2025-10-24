// src/components/suppliers/SuppliersTable.tsx
"use client";

import { useState, useEffect } from "react";
import { UserPlus, Edit2, Trash2, Phone, Mail, Loader2 } from "lucide-react";
import Pagination from "../ui/Pagination";
import TableSkeleton from "../ui/TableSkeleton";
import EmptyState from "../ui/EmptyState";
import SupplierFormModal from "./SupplierFormModal";
import SearchableDropdown from "../ui/SearchableDropdown";
import LedgerModal from "../ledger/SupplierLedgerModal";
import { ReceiptIndianRupee } from "lucide-react";

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

  // Filters
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

  // Filter options
  const [nameOptions, setNameOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Load filter options
  useEffect(() => {
    const licenseId = localStorage.getItem("licenseId") || "demo-license";
    (async () => {
      try {
        const { names, categories } = await (
          window as any
        ).electronAPI.getSupplierDistincts(licenseId);
        setNameOptions(names || []);
        setCategoryOptions(categories || []);
      } catch (e) {
        console.error("distinct suppliers failed", e);
      }
    })();
  }, []);

  const loadSuppliers = async (phase: "initial" | "refetch" = "refetch") => {
    try {
      if (phase === "initial") {
        setLoading(true);
      } else {
        setIsRefetching(true);
      }
      const licenseId = localStorage.getItem("licenseId") || "demo-license";

      const result = await (window as any).electronAPI.listSuppliers(
        licenseId,
        {
          name: debouncedName || "",
          category: debouncedCategory || "",
          page,
          pageSize,
        }
      );

      setSuppliers(result.suppliers);
      setTotal(result.total);
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
    if (!firstLoad) {
      loadSuppliers("refetch");
    }
  }, [debouncedName, debouncedCategory, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [nameFilter, categoryFilter]);

  const handleAddSupplier = () => {
    setEditSupplier(null);
    setIsModalOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete supplier "${name}"?`)) {
      try {
        await (window as any).electronAPI.deleteSupplier(id);
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
      const { names, categories } = await (
        window as any
      ).electronAPI.getSupplierDistincts(licenseId);
      setNameOptions(names || []);
      setCategoryOptions(categories || []);
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
          <h2 className="text-2xl font-bold text-gray-900">
            Suppliers Management
          </h2>
        </div>
        <TableSkeleton columns={8} rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Suppliers Management
            </h2>
            <p className="text-gray-600 mt-1">
              Manage your supplier database and contacts
            </p>
          </div>
          {isRefetching && (
            <Loader2
              className="w-4 h-4 animate-spin text-gray-400"
              aria-label="Loading"
            />
          )}
        </div>
        <button
          onClick={handleAddSupplier}
          className="inline-flex items-center gap-2 px-4 py-2 bg-averix-red-dark text-white rounded-lg hover:bg-averix-red-darker transition-colors font-medium"
        >
          <UserPlus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Name dropdown */}
          <SearchableDropdown
            value={nameFilter}
            onChange={setNameFilter}
            options={nameOptions.map((n) => ({ value: n, label: n }))}
            placeholder="Filter by supplier name"
          />

          {/* Category dropdown */}
          <SearchableDropdown
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions.map((c) => ({ value: c, label: c }))}
            placeholder="Filter by category"
          />

          {(nameFilter || categoryFilter) && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {suppliers.length === 0 && !isRefetching ? (
        <EmptyState
          title="No Suppliers Found"
          description="Add your first supplier to get started with purchase management."
          icon={<UserPlus size={32} />}
          action={
            <button
              onClick={handleAddSupplier}
              className="mt-4 bg-averix-red-dark text-white px-6 py-3 rounded-lg hover:bg-averix-red-accent transition-colors font-medium"
            >
              Add Supplier
            </button>
          }
        />
      ) : (
        <div
          className={`bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-opacity duration-200 ${
            isRefetching ? "opacity-95" : "opacity-100"
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-averix-red-dark to-averix-red-accent">
                  {[
                    { key: "code", label: "Code", width: "w-24" },
                    { key: "name", label: "Supplier Name", width: "w-48" },
                    { key: "contact", label: "Contact", width: "w-40" },
                    { key: "gstin", label: "GSTIN", width: "w-32" },
                    { key: "department", label: "Department", width: "w-28" },
                    { key: "location", label: "Location", width: "w-32" },
                    { key: "actions", label: "Actions", width: "w-24" },
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
                {suppliers.map((supplier, idx) => (
                  <tr
                    key={supplier.id}
                    className={`transition-all duration-200 hover:bg-blue-50/30 ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-mono font-medium">
                        {supplier.code || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">
                          {supplier.name}
                        </div>
                        {supplier.category && (
                          <div className="text-xs text-gray-500">
                            {supplier.category}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {supplier.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Mail className="w-3 h-3" />
                            {supplier.email}
                          </div>
                        )}
                        {!supplier.phone && !supplier.email && (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600 text-sm font-mono">
                        {supplier.gstin || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600 text-sm">
                        {supplier.department || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {supplier.city && supplier.state
                          ? `${supplier.city}, ${supplier.state}`
                          : supplier.city || supplier.state || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setLedgerSupplier({
                              id: supplier.id,
                              name: supplier.name,
                            });
                            setLedgerOpen(true);
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-105 transition-all"
                          title="Ledger"
                        >
                          <ReceiptIndianRupee className="w-4 h-4" />
                        </button>

                        {ledgerOpen && ledgerSupplier && (
                          <LedgerModal
                            isOpen={ledgerOpen}
                            onClose={() => setLedgerOpen(false)}
                            licenseId={
                              localStorage.getItem("licenseId") ||
                              "demo-license"
                            }
                            supplierId={ledgerSupplier.id}
                            supplierName={ledgerSupplier.name}
                          />
                        )}
                        <button
                          onClick={() => handleEditSupplier(supplier)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 transition-all duration-200"
                          title="Edit Supplier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteSupplier(supplier.id, supplier.name)
                          }
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:scale-105 transition-all duration-200"
                          title="Delete Supplier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modal */}
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

// Balance component
function SupplierBalance({ supplierId }: { supplierId: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const licenseId = localStorage.getItem("licenseId")!;
        const { balance: bal } = await (
          window as any
        ).electronAPI.getSupplierSummary(licenseId, supplierId);
        setBalance(Number(bal));
      } catch (error) {
        console.error("Error loading supplier balance:", error);
        setBalance(0);
      } finally {
        setLoading(false);
      }
    };

    loadBalance();
  }, [supplierId]);

  if (loading) {
    return <span className="text-gray-400">Loading...</span>;
  }

  if (balance === null || balance === 0) {
    return <span className="text-gray-500 font-medium">₹0.00</span>;
  }

  return (
    <span
      className={`font-medium text-sm ${
        balance > 0
          ? "text-red-600" // We owe them
          : "text-green-600" // They owe us or advance
      }`}
    >
      {balance > 0
        ? `₹${balance.toFixed(2)}`
        : `₹${Math.abs(balance).toFixed(2)}`}
    </span>
  );
}
