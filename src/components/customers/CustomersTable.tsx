// src/components/customers/CustomersTable.tsx
"use client";

import { useEffect, useState } from "react";
import { UserPlus, Edit2, Trash2, Phone, Mail, Loader2 } from "lucide-react";
import Pagination from "../ui/Pagination";
import TableSkeleton from "../ui/TableSkeleton";
import EmptyState from "../ui/EmptyState";
import SearchableDropdown from "../ui/SearchableDropdown";
import CustomerFormModal from "./CustomerFormModal";

interface Customer {
  id: string;
  code?: string;
  codeNumber?: number;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  category?: string;
  city?: string;
  state?: string;
  openingBalance?: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  // Filters
  const [nameFilter, setNameFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [debouncedName, setDebouncedName] = useState(nameFilter);
  const [debouncedCategory, setDebouncedCategory] = useState(categoryFilter);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(nameFilter), 250);
    return () => clearTimeout(t);
  }, [nameFilter]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCategory(categoryFilter), 250);
    return () => clearTimeout(t);
  }, [categoryFilter]);

  // Distinct options
  const [nameOptions, setNameOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Load distincts
  useEffect(() => {
    const licenseId = localStorage.getItem("licenseId") || "demo-license";
    (async () => {
      try {
        const { names, categories } = await (
          window as any
        ).electronAPI.getCustomerDistincts(licenseId);
        setNameOptions(names || []);
        setCategoryOptions(categories || []);
      } catch (e) {
        console.error("distinct customers failed", e);
      }
    })();
  }, []);

  const loadCustomers = async (phase: "initial" | "refetch" = "refetch") => {
    try {
      if (phase === "initial") setLoading(true);
      else setIsRefetching(true);

      const licenseId = localStorage.getItem("licenseId") || "demo-license";
      const result = await (window as any).electronAPI.listCustomers(
        licenseId,
        {
          name: debouncedName || "",
          category: debouncedCategory || "",
          page,
          pageSize,
        }
      );

      setCustomers(result.customers);
      setTotal(result.total);
    } catch (e) {
      console.error("Error loading customers:", e);
    } finally {
      if (firstLoad) {
        setFirstLoad(false);
        setLoading(false);
      }
      setIsRefetching(false);
    }
  };

  useEffect(() => {
    loadCustomers("initial");
  }, []);

  useEffect(() => {
    if (!firstLoad) loadCustomers("refetch");
  }, [debouncedName, debouncedCategory, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [nameFilter, categoryFilter]);

  const refreshDistincts = async () => {
    try {
      const licenseId = localStorage.getItem("licenseId") || "demo-license";
      const { names, categories } = await (
        window as any
      ).electronAPI.getCustomerDistincts(licenseId);
      setNameOptions(names || []);
      setCategoryOptions(categories || []);
    } catch (e) {
      console.error("distinct customers failed", e);
    }
  };

  const handleAdd = () => {
    setEditCustomer(null);
    setIsModalOpen(true);
  };

  const handleEdit = (c: Customer) => {
    setEditCustomer(c);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete customer "${name}"?`)) return;
    try {
      await (window as any).electronAPI.deleteCustomer(id);
      loadCustomers("refetch");
      refreshDistincts();
    } catch (e) {
      alert("Failed to delete customer");
      console.error(e);
    }
  };

  const handleModalSuccess = () => {
    loadCustomers("refetch");
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
            Customers Management
          </h2>
        </div>
        <TableSkeleton columns={7} rows={6} />
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
              Customers Management
            </h2>
            <p className="text-gray-600 mt-1">
              Manage your customer database and contacts
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
          onClick={handleAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-averix-red-dark text-white rounded-lg hover:bg-averix-red-darker transition-colors font-medium"
        >
          <UserPlus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <SearchableDropdown
            value={nameFilter}
            onChange={setNameFilter}
            options={nameOptions.map((n) => ({ value: n, label: n }))}
            placeholder="Filter by customer name"
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
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {customers.length === 0 && !isRefetching ? (
        <EmptyState
          title="No Customers Found"
          description="Add your first customer to get started with sales."
          icon={<UserPlus size={32} />}
          action={
            <button
              onClick={handleAdd}
              className="mt-4 bg-averix-red-dark text-white px-6 py-3 rounded-lg hover:bg-averix-red-accent transition-colors font-medium"
            >
              Add Customer
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
                    { key: "name", label: "Customer Name", width: "w-48" },
                    { key: "contact", label: "Contact", width: "w-40" },
                    { key: "gstin", label: "GSTIN", width: "w-32" },
                    { key: "category", label: "Category", width: "w-28" },
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
                {customers.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`transition-all duration-200 hover:bg-blue-50/30 ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-mono font-medium">
                        {c.code || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">
                          {c.name}
                        </div>
                        {c.category && (
                          <div className="text-xs text-gray-500">
                            {c.category}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {c.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Mail className="w-3 h-3" />
                            {c.email}
                          </div>
                        )}
                        {!c.phone && !c.email && (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600 text-sm font-mono">
                        {c.gstin || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600 text-sm">
                        {c.category || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {c.city && c.state
                          ? `${c.city}, ${c.state}`
                          : c.city || c.state || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(c)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 transition-all duration-200"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:scale-105 transition-all duration-200"
                          title="Delete Customer"
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
        <CustomerFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleModalSuccess}
          editCustomer={editCustomer}
        />
      )}
    </div>
  );
}
