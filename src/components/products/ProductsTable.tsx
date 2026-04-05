// src/components/products/ProductsTable.tsx
"use client";

import { useState, useEffect } from "react";
import TableSkeleton from "../ui/TableSkeleton";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import {
  PackagePlus,
  Edit2,
  Trash2,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import type { ProductListResult, ProductSummary } from "@/platform/types";

type Product = ProductSummary;

interface ProductsTableProps {
  onAdd: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onManageBatches: (product: Product) => void;
  refreshTrigger: number;
  nameFilter?: string;
  categoryFilter?: string;
  brandFilter?: string;
}

function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)] overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0)
    return (
      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200/60">
        {stock}
      </span>
    );
  if (stock <= 5)
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 ring-1 ring-amber-200/60">
        {stock}
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200/60">
      {stock}
    </span>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  // Build page numbers array with ellipsis like the screenshot
  const getPages = () => {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push("…");
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  };

  const btnBase =
    "flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2.5 text-sm font-medium transition select-none";

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
      <span className="text-xs text-slate-400">
        Showing {Math.min((page - 1) * pageSize + 1, total)}–
        {Math.min(page * pageSize, total)} of{" "}
        <span className="font-semibold text-slate-600">{total}</span> items
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${btnBase} gap-1 border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>

        {getPages().map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`${btnBase} ${
                p === page
                  ? "bg-[#1e3a5f] text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} gap-1 border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function ProductsTable({
  onAdd,
  onEdit,
  onDelete,
  onManageBatches,
  refreshTrigger,
  nameFilter = "",
  categoryFilter = "",
  brandFilter = "",
}: ProductsTableProps) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [deleting, setDeleting] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const licenseId = getActiveLicenseId();
      let result: ProductListResult;

      if (nameFilter || categoryFilter || brandFilter) {
        result = await platform.getFilteredProducts(
          licenseId,
          {
            name: nameFilter || null,
            category: categoryFilter || null,
            brand: brandFilter || null,
          },
          { page, pageSize },
        );
      } else {
        result = await platform.getProducts(licenseId, { page, pageSize });
      }

      setProducts(result.products);
      setTotal(result.total);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [refreshTrigger, nameFilter, categoryFilter, brandFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [nameFilter, categoryFilter, brandFilter]);

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    try {
      const result = await platform.deleteProduct(deleteTarget.id);

      if (!result?.success) {
        throw new Error((result as any)?.error || "Delete failed");
      }

      onDelete(deleteTarget.id);
      setDeleteTarget(null);
      await loadProducts();
      showToast(
        "success",
        `Product "${deleteTarget.name}" deleted successfully.`,
      );
    } catch (error: any) {
      showToast(
        "error",
        error?.message
          ? `Failed to delete product: ${error.message}`
          : "Failed to delete product.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  if (loading) return <TableSkeleton columns={9} rows={6} />;

  if (products.length === 0) {
    return (
      <Surface className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,rgba(32,183,255,0.10),rgba(176,38,255,0.10))]">
          <PackagePlus className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-800">
          No Products Found
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Add your first product to start building your inventory catalog.
        </p>
        <button
          onClick={onAdd}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#1e3a5f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16304f]"
        >
          Add Product
        </button>
      </Surface>
    );
  }

  const HEADERS = [
    "Code",
    "Product Name",
    "Brand",
    "Category",
    "Batches",
    "Unit",
    "Tax",
    "Cost",
    "Sale",
    "Stock",
    "Actions",
  ];

  return (
    <Surface>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="bg-[#1e3a5f]">
              {HEADERS.map((h) => (
                <th
                  key={h}
                  className="px-3.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 first:pl-5 last:pr-5"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/90">
            {products.map((product, idx) => (
              <tr
                key={product.id}
                className={`group transition-colors hover:bg-slate-50/80 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
              >
                <td className="pl-5 pr-3 py-2.5">
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                    {product.code}
                  </span>
                </td>
                <td className="px-3.5 py-2.5">
                  <span className="text-[13px] font-medium text-slate-800">
                    {product.name}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-[12px] text-slate-500">
                  {product.brand || "—"}
                </td>
                <td className="px-3.5 py-2.5">
                  {product.category ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {product.category}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-400">
                  {product.batchCount ?? 0}
                </td>
                <td className="px-3.5 py-2.5">
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                    {product.unit}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-[11px] text-slate-400">
                  {product.tax}
                </td>
                <td className="px-3.5 py-2.5 text-[13px] font-medium text-slate-700">
                  ₹{product.costPrice.toFixed(2)}
                </td>
                <td className="px-3.5 py-2.5 text-[13px] font-semibold text-emerald-600">
                  {product.salePrice ? `₹${product.salePrice.toFixed(2)}` : "—"}
                </td>
                <td className="px-3.5 py-2.5">
                  <StockBadge stock={product.stock} />
                </td>
                <td className="py-2.5 pl-3.5 pr-5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onManageBatches(product)}
                      title="Batches"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-fuchsia-500 transition hover:border-fuchsia-200 hover:bg-fuchsia-50"
                    >
                      <Layers className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => onEdit(product)}
                      title="Edit"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteClick(product.id, product.name)
                      }
                      title="Delete"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
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

      {/* Mobile card list */}
      <div className="block md:hidden divide-y divide-slate-100">
        {/* Mobile header */}
        <div className="bg-[#1e3a5f] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            {total} Products
          </p>
        </div>
        {products.map((product) => (
          <div
            key={product.id}
            className="px-4 py-3.5 hover:bg-slate-50/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    {product.code}
                  </span>
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700">
                    {product.unit}
                  </span>
                  <StockBadge stock={product.stock} />
                </div>
                <p className="text-[14px] font-semibold text-slate-900 leading-snug">
                  {product.name}
                </p>
                {(product.brand || product.category) && (
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {[product.brand, product.category]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-xs">
                  <span className="text-slate-400">
                    Cost{" "}
                    <span className="font-semibold text-slate-700">
                      ₹{product.costPrice.toFixed(2)}
                    </span>
                  </span>
                  {product.salePrice && (
                    <span className="text-slate-400">
                      Sale{" "}
                      <span className="font-semibold text-emerald-600">
                        ₹{product.salePrice.toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <button
                  onClick={() => onManageBatches(product)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-fuchsia-500"
                >
                  <Layers className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onEdit(product)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDeleteClick(product.id, product.name)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete product?"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"?\n\nThis will also remove its live batches from the active list.`
            : ""
        }
        confirmText={deleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </Surface>
  );
}
