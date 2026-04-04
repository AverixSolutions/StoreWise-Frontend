// src/components/products/ProductsTable.tsx
"use client";

import { useState, useEffect } from "react";
import Pagination from "../ui/Pagination";
import TableSkeleton from "../ui/TableSkeleton";
import EmptyState from "../ui/EmptyState";
import { PackagePlus, Edit2, Trash2, Layers } from "lucide-react";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";

interface Product {
  id: string;
  code: string;
  name: string;
  brand?: string;
  category?: string;
  barcode?: string | null;
  unit: string;
  tax: string;
  costPrice: number;
  salePrice?: number;
  stock: number;
}

interface ProductsTableProps {
  onAdd: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onManageBatches: (product: Product) => void;
  refreshTrigger: number;
  nameFilter?: string;
  categoryFilter?: string;
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
      className={`rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,250,252,0.78))] shadow-[0_18px_45px_rgba(3,10,24,0.08)] backdrop-blur ${className}`}
    >
      {children}
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
}: ProductsTableProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const licenseId = getActiveLicenseId();
      let result: { products: Product[]; total: number };

      if (nameFilter || categoryFilter) {
        result = await platform.getFilteredProducts(
          licenseId,
          { name: nameFilter || null, category: categoryFilter || null },
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
  }, [refreshTrigger, nameFilter, categoryFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [nameFilter, categoryFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        const result = await platform.deleteProduct(id);
        if (!result?.success)
          throw new Error((result as any)?.error || "Delete failed");
        onDelete(id);
        loadProducts();
      } catch (error: any) {
        alert(`Failed to delete product: ${error?.message || "Unknown error"}`);
      }
    }
  };

  if (loading) return <TableSkeleton columns={10} rows={6} />;

  if (products.length === 0) {
    return (
      <Surface className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,rgba(32,183,255,0.10),rgba(176,38,255,0.10))]">
          <PackagePlus className="h-8 w-8 text-slate-500" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">
          No Products Found
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Add your first product to start building your inventory catalog.
        </p>
        <button
          onClick={onAdd}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Add Product
        </button>
      </Surface>
    );
  }

  return (
    <Surface className="overflow-hidden">
      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-white/60">
              {[
                "Code",
                "Product Name",
                "Brand",
                "Category",
                "Barcode",
                "Unit",
                "Cost",
                "Sale",
                "Stock",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {products.map((product) => (
              <tr
                key={product.id}
                className="group transition-colors hover:bg-white/70"
              >
                <td className="px-5 py-3.5">
                  <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-600">
                    {product.code}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm font-medium text-slate-900">
                    {product.name}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm text-slate-500">
                  {product.brand || "—"}
                </td>
                <td className="px-5 py-3.5 text-sm text-slate-500">
                  {product.category || "—"}
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                  {product.barcode || "—"}
                </td>
                <td className="px-5 py-3.5">
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-700">
                    {product.unit}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm font-medium text-slate-900">
                  ₹{product.costPrice.toFixed(2)}
                </td>
                <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600">
                  {product.salePrice ? `₹${product.salePrice.toFixed(2)}` : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      product.stock <= 0
                        ? "bg-rose-100 text-rose-700"
                        : product.stock <= 5
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {product.stock}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onManageBatches(product)}
                      title="Manage Batches"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-fuchsia-500 transition hover:border-fuchsia-200 hover:bg-fuchsia-50"
                    >
                      <Layers className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onEdit(product)}
                      title="Edit"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id, product.name)}
                      title="Delete"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile card list ── */}
      <div className="block md:hidden divide-y divide-slate-100/80">
        {products.map((product) => (
          <div key={product.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500">
                    {product.code}
                  </span>
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                    {product.unit}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      product.stock <= 0
                        ? "bg-rose-100 text-rose-700"
                        : product.stock <= 5
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {product.stock} in stock
                  </span>
                </div>
                <p className="mt-2 text-[15px] font-semibold text-slate-900 leading-tight">
                  {product.name}
                </p>
                {(product.brand || product.category) && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {[product.brand, product.category]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-sm">
                  <span className="text-slate-500">
                    Cost{" "}
                    <span className="font-medium text-slate-900">
                      ₹{product.costPrice.toFixed(2)}
                    </span>
                  </span>
                  {product.salePrice && (
                    <span className="text-slate-500">
                      Sale{" "}
                      <span className="font-semibold text-emerald-600">
                        ₹{product.salePrice.toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>
                {product.barcode && (
                  <p className="mt-1 font-mono text-[10px] text-slate-400">
                    {product.barcode}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={() => onManageBatches(product)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-fuchsia-500 transition hover:border-fuchsia-200 hover:bg-fuchsia-50"
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onEdit(product)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(product.id, product.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100/80">
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>
    </Surface>
  );
}
