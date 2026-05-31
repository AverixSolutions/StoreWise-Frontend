// src/components/products/ProductsTable.tsx
"use client";

import { useEffect, useState } from "react";
import { Edit2, Eye, Layers, PackagePlus, Trash2 } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Pagination from "@/components/ui/Pagination";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import { platform } from "@/platform";
import type { ProductListResult, ProductSummary } from "@/platform/types";

type Product = ProductSummary;
type ProductsTableVariant = "compact" | "report";

interface ProductsTableProps {
  onAdd?: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onManageBatches: (product: Product) => void;
  onView: (product: Product) => void;
  refreshTrigger: number;
  nameFilter?: string;
  categoryFilter?: string;
  brandFilter?: string;
  subcategoryFilter?: string;
  taxFilter?: string;
  variant?: ProductsTableVariant;
  pageSize?: number;
  showAddButton?: boolean;
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
      className={`overflow-hidden rounded-xl border border-slate-200/80 bg-white ${className}`}
    >
      {children}
    </div>
  );
}

function money(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return `Rs. ${Number(value).toFixed(2)}`;
}

function emptyValue(value?: string | null) {
  return value && value.trim() ? value : "-";
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200/60">
        {stock}
      </span>
    );
  }

  if (stock <= 5) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 ring-1 ring-amber-200/60">
        {stock}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200/60">
      {stock}
    </span>
  );
}

function CodeChip({ product }: { product: Product }) {
  return (
    <div className="flex flex-wrap items-center">
      <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
        {product.code}
      </span>
    </div>
  );
}

function ProductNameCell({
  product,
  variant,
}: {
  product: Product;
  variant: ProductsTableVariant;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold text-slate-900">
        {product.name}
      </p>
    </div>
  );
}

function ActionButtons({
  product,
  onView,
  onManageBatches,
  onEdit,
  onDelete,
}: {
  product: Product;
  onView: (product: Product) => void;
  onManageBatches: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => onView(product)}
        title="View"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <Eye className="h-3 w-3" />
      </button>
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
        onClick={() => onDelete(product.id, product.name)}
        title="Delete"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function ProductsTable({
  onAdd,
  onEdit,
  onDelete,
  onManageBatches,
  onView,
  refreshTrigger,
  nameFilter = "",
  categoryFilter = "",
  brandFilter = "",
  subcategoryFilter = "",
  taxFilter = "",
  variant = "report",
  pageSize = 12,
  showAddButton = true,
}: ProductsTableProps) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProducts = async () => {
    if (products.length === 0) {
      setLoading(true);
    } else {
      setFetching(true);
    }

    try {
      const licenseId = getActiveLicenseId();
      let result: ProductListResult;

      if (
        nameFilter ||
        categoryFilter ||
        brandFilter ||
        subcategoryFilter ||
        taxFilter
      ) {
        result = await platform.getFilteredProducts(
          licenseId,
          {
            name: nameFilter || null,
            category: categoryFilter || null,
            brand: brandFilter || null,
            subcategory: subcategoryFilter || null,
            tax: taxFilter || null,
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
      setFetching(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [
    refreshTrigger,
    nameFilter,
    categoryFilter,
    brandFilter,
    subcategoryFilter,
    taxFilter,
    page,
    pageSize,
  ]);

  useEffect(() => {
    setPage(1);
  }, [nameFilter, categoryFilter, brandFilter, subcategoryFilter, taxFilter]);

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    const target = deleteTarget;
    setDeleting(true);

    try {
      const result = await platform.deleteProduct(target.id);

      if (!result?.success) {
        throw new Error((result as any)?.error || "Delete failed");
      }

      onDelete(target.id);
      setDeleteTarget(null);
      await loadProducts();
      showToast("success", `Product "${target.name}" deleted successfully.`);
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

  // Change 2: compact skeleton uses 3 columns instead of 5
  if (loading) {
    return <TableSkeleton columns={variant === "report" ? 11 : 3} rows={6} />;
  }

  if (products.length === 0) {
    return (
      <Surface className="flex h-full min-h-[430px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,rgba(32,183,255,0.10),rgba(176,38,255,0.10))]">
          <PackagePlus className="h-7 w-7 text-slate-400" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-800">
          No Products Found
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Add your first product to start building your inventory catalog.
        </p>
        {showAddButton && onAdd && (
          <button
            onClick={onAdd}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#1e3a5f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16304f]"
          >
            Add Product
          </button>
        )}
      </Surface>
    );
  }

  // Change 1: compact headers reduced to 3
  const compactHeaders = ["Code", "Product", "Actions"];
  const reportHeaders = [
    "Code",
    "Product Name",
    "Brand",
    "Category",
    "Subcategory",
    "Unit",
    "Tax",
    "Cost",
    "Sale",
    "Stock",
    "Actions",
  ];
  const headers = variant === "compact" ? compactHeaders : reportHeaders;

  return (
    <Surface
      className={`flex h-full min-h-[430px] flex-col transition-opacity duration-150 ${
        fetching ? "pointer-events-none opacity-50" : "opacity-100"
      }`}
    >
      <div className="no-scrollbar hidden min-h-0 flex-1 overflow-y-auto md:block">
        <table
          className={`w-full ${variant === "compact" ? "min-w-[340px]" : "min-w-[960px]"}`}
        >
          <thead>
            <tr className="bg-[#1e3a5f]">
              {headers.map((header) => (
                <th
                  key={header}
                  className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 first:pl-4 last:pr-4 ${
                    header === "Actions" ? "text-right" : "text-left"
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/90">
            {products.map((product, index) => (
              <tr
                key={product.id}
                className={`group transition-colors hover:bg-slate-50/80 ${
                  index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                }`}
              >
                {/* Change 4: compact row — Code, Name, Actions only */}
                {variant === "compact" ? (
                  <>
                    <td className="w-[68px] py-2.5 pl-3 pr-1.5">
                      <CodeChip product={product} />
                    </td>

                    <td className="min-w-0 px-1.5 py-2.5">
                      <ProductNameCell product={product} variant={variant} />
                    </td>

                    <td className="w-[124px] py-2.5 pl-1.5 pr-3">
                      <ActionButtons
                        product={product}
                        onView={onView}
                        onManageBatches={onManageBatches}
                        onEdit={onEdit}
                        onDelete={handleDeleteClick}
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2.5 pl-4 pr-3">
                      <CodeChip product={product} />
                    </td>
                    <td className="px-3 py-2.5">
                      <ProductNameCell product={product} variant={variant} />
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-slate-500">
                      {emptyValue(product.brand)}
                    </td>
                    <td className="px-3 py-2.5">
                      {product.category ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {product.category}
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {product.subcategory ? (
                        <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 ring-1 ring-cyan-200/70">
                          {product.subcategory}
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                        {product.unit}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-400">
                      {product.tax}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] font-medium text-slate-700">
                      {money(product.costPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] font-semibold text-emerald-600">
                      {money(product.salePrice)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StockBadge stock={product.stock} />
                    </td>
                    <td className="py-2.5 pl-3 pr-4">
                      <ActionButtons
                        product={product}
                        onView={onView}
                        onManageBatches={onManageBatches}
                        onEdit={onEdit}
                        onDelete={handleDeleteClick}
                      />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="no-scrollbar block min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100 md:hidden">
        <div className="bg-[#1e3a5f] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            {total} Products
          </p>
        </div>

        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50/70"
          >
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">
              {product.name}
            </p>

            <ActionButtons
              product={product}
              onView={onView}
              onManageBatches={onManageBatches}
              onEdit={onEdit}
              onDelete={handleDeleteClick}
            />
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white">
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel="products"
        />
      </div>

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
