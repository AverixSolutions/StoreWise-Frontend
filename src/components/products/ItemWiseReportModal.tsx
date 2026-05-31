// src/components/products/ItemWiseReportModal.tsx
"use client";

import { useRef, useState } from "react";
import { Maximize2, Minimize2, PackageSearch, Search, X } from "lucide-react";
import ProductsTable from "@/components/products/ProductsTable";
import ProductBatchesDrawer from "@/components/products/ProductBatchesDrawer";
import ProductFormModal from "@/components/products/ProductFormModal";
import ProductViewModal from "@/components/products/ProductViewModal";
import { useProductFilterOptions } from "@/components/products/useProductFilterOptions";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import type { ProductSummary } from "@/platform/types";

type Product = ProductSummary;

const TAX_OPTIONS = [
  { value: "NT", label: "NT - No Tax" },
  { value: "P5", label: "P5 - 5%" },
  { value: "P12", label: "P12 - 12%" },
  { value: "P18", label: "P18 - 18%" },
  { value: "P28", label: "P28 - 28%" },
];

export default function ItemWiseReportModal({
  isOpen,
  onClose,
  licenseId,
}: {
  isOpen: boolean;
  onClose: () => void;
  licenseId: string;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [taxFilter, setTaxFilter] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProductId, setBatchProductId] = useState<string | null>(null);
  const [batchProductName, setBatchProductName] = useState<string | undefined>(
    undefined,
  );
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const [isMaximized, setIsMaximized] = useState(true);

  const { categories, brands, subcategories, categoryRecords } =
    useProductFilterOptions({
      licenseId,
      refreshTrigger,
      enabled: isOpen,
    });

  if (!isOpen) return null;

  const hasFilters =
    searchQuery ||
    categoryFilter ||
    brandFilter ||
    subcategoryFilter ||
    taxFilter;

  const clearAll = () => {
    setSearchQuery("");
    setCategoryFilter("");
    setBrandFilter("");
    setSubcategoryFilter("");
    setTaxFilter("");
  };

  const openBatches = (product: Product) => {
    setBatchProductId(product.id);
    setBatchProductName(product.name);
    setBatchOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditProduct(product);
    setIsFormOpen(true);
  };

  const toggleMaximized = () => {
    setIsMaximized((value) => !value);
  };

  const panelSizeClass = isMaximized
    ? "h-[calc(100dvh-16px)] w-[calc(100vw-16px)] rounded-[24px]"
    : "h-[86dvh] w-[min(1180px,calc(100vw-32px))] rounded-[24px]";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-md sm:p-4">
      <div
        className={`flex flex-col overflow-hidden border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.99))] shadow-[0_24px_90px_rgba(2,6,23,0.32)] transition-[width,height,border-radius,box-shadow] duration-200 ${panelSizeClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative shrink-0 overflow-hidden bg-[linear-gradient(135deg,#07101f_0%,#0f1a31_58%,#17213c_100%)] px-3 py-1.5 text-white sm:px-4">
          <div className="pointer-events-none absolute -left-8 top-0 h-24 w-24 rounded-full bg-cyan-400/15 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-2xl" />

          <div className="relative flex items-center justify-between gap-3">
            {/* Left — traffic lights + title */}
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
              </div>

              <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                <PackageSearch className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                <span className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white">
                  Item Wise Report
                </span>
                <span className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-white/35 sm:inline">
                  · Stock Report
                </span>
              </div>
            </div>

            {/* Right — maximize/restore + close */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMaximized}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                title={isMaximized ? "Restore window" : "Maximize window"}
              >
                {isMaximized ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-rose-500/80"
                title="Close"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 space-y-3 overflow-y-auto scrollbar-none bg-slate-50/80 px-3 py-3 sm:px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <section className="rounded-[18px] border border-slate-200 bg-white/85 p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by name or short code"
                  className="h-[42px] w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={clearAll}
                disabled={!hasFilters}
                className="inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SearchableDropdown
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categories.map((category) => ({
                  value: category,
                  label: category,
                }))}
                placeholder="All categories"
                autoOpenOnFocus={false}
                buttonProps={{
                  className:
                    "h-[42px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10",
                }}
              />

              <SearchableDropdown
                value={brandFilter}
                onChange={setBrandFilter}
                options={brands.map((brand) => ({
                  value: brand,
                  label: brand,
                }))}
                placeholder="All brands"
                autoOpenOnFocus={false}
                buttonProps={{
                  className:
                    "h-[42px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10",
                }}
              />

              <SearchableDropdown
                value={subcategoryFilter}
                onChange={setSubcategoryFilter}
                options={subcategories.map((subcategory) => ({
                  value: subcategory,
                  label: subcategory,
                }))}
                placeholder="All subcategories"
                autoOpenOnFocus={false}
                buttonProps={{
                  className:
                    "h-[42px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10",
                }}
              />

              <SearchableDropdown
                value={taxFilter}
                onChange={setTaxFilter}
                options={TAX_OPTIONS}
                placeholder="All tax rates"
                autoOpenOnFocus={false}
                buttonProps={{
                  className:
                    "h-[42px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10",
                }}
              />
            </div>
          </section>

          <ProductsTable
            variant="report"
            pageSize={12}
            showAddButton={false}
            onEdit={openEdit}
            onDelete={() => setRefreshTrigger((value) => value + 1)}
            onView={(product) => {
              setViewProduct(product);
              setIsViewOpen(true);
            }}
            onManageBatches={openBatches}
            refreshTrigger={refreshTrigger}
            nameFilter={searchQuery}
            categoryFilter={categoryFilter}
            brandFilter={brandFilter}
            subcategoryFilter={subcategoryFilter}
            taxFilter={taxFilter}
          />
        </div>
      </div>

      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditProduct(null);
        }}
        onSuccess={() => setRefreshTrigger((value) => value + 1)}
        editProduct={editProduct}
        existingCategories={categories}
        existingBrands={brands}
        categoryRecords={categoryRecords}
      />

      <ProductBatchesDrawer
        open={batchOpen}
        onClose={() => {
          setBatchOpen(false);
          setBatchProductId(null);
          setBatchProductName(undefined);
          setRefreshTrigger((value) => value + 1);
        }}
        productId={batchProductId}
        productName={batchProductName}
        licenseId={licenseId}
      />

      <ProductViewModal
        open={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setViewProduct(null);
        }}
        product={viewProduct}
      />
    </div>
  );
}
