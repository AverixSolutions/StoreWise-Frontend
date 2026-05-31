// src/app/dashboard/items/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ClipboardPaste, Search, X } from "lucide-react";
import BarcodePrintCenterButton from "@/components/barcodes/BarcodePrintCenterButton";
import ProductBatchesDrawer from "@/components/products/ProductBatchesDrawer";
import ProductFormModal from "@/components/products/ProductFormModal";
import ProductFormPanel from "@/components/products/ProductFormPanel";
import ProductsTable from "@/components/products/ProductsTable";
import ProductViewModal from "@/components/products/ProductViewModal";
import { useProductFilterOptions } from "@/components/products/useProductFilterOptions";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import {
  canUseBarcode,
  getActiveLicenseId,
} from "@/lib/session/runtimeSession";
import { useSyncStatus } from "@/sync/SyncProvider";
import type { ProductSummary } from "@/platform/types";

type Product = ProductSummary;

export default function ItemsPage() {
  const router = useRouter();
  const { pullNow } = useSyncStatus();
  const searchRef = useRef<HTMLInputElement>(null);

  const [isClient, setIsClient] = useState(false);
  const [isDesktopWorkspace, setIsDesktopWorkspace] = useState(false);
  const [licenseId, setLicenseId] = useState("");
  const [shopName, setShopName] = useState("My Shop");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [isMobileFormOpen, setIsMobileFormOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProductId, setBatchProductId] = useState<string | null>(null);
  const [batchProductName, setBatchProductName] = useState<string | undefined>(
    undefined,
  );
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [barcodePrintOpen, setBarcodePrintOpen] = useState(false);
  const [isBulkFormOpen, setIsBulkFormOpen] = useState(false);

  const { categories, brands, categoryRecords } = useProductFilterOptions({
    licenseId,
    refreshTrigger,
    enabled: isClient,
  });

  useEffect(() => {
    setIsClient(true);
    setLicenseId(getActiveLicenseId());
    setShopName(localStorage.getItem("shopName") || "My Shop");
    setRefreshTrigger((value) => value + 1);

    pullNow("product");
    pullNow("category");
    pullNow("brand");
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setIsDesktopWorkspace(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;

    const handleShortcut = (event: KeyboardEvent) => {
      const modalOrDrawerOpen =
        isMobileFormOpen || isBulkFormOpen || batchOpen || isViewOpen;

      if (modalOrDrawerOpen) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleAddProduct();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isClient, isMobileFormOpen, batchOpen, isViewOpen, isDesktopWorkspace]);

  useEffect(() => {
    if (!isClient) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (event: Event) => {
      const { entity } = (
        event as CustomEvent<{ entity: string; count: number }>
      ).detail;

      if (entity === "product" || entity === "category" || entity === "brand") {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          setRefreshTrigger((value) => value + 1);
        }, 100);
      }
    };

    window.addEventListener("kynflow:sync:updated", handler);
    return () => {
      window.removeEventListener("kynflow:sync:updated", handler);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [isClient]);

  if (!isClient) return null;

  const barcodeEnabled = canUseBarcode();
  const hasFilters = searchQuery || categoryFilter;

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("");
  };

  function handleAddProduct() {
    setEditProduct(null);
    if (!isDesktopWorkspace) {
      setIsMobileFormOpen(true);
    }
  }

  function handleBulkAdd() {
    setEditProduct(null);
    setIsBulkFormOpen(true);
  }

  function handleEditProduct(product: Product) {
    setEditProduct(product);
    if (!isDesktopWorkspace) {
      setIsMobileFormOpen(true);
    }
  }

  function handleFormSuccess() {
    setRefreshTrigger((value) => value + 1);
  }

  function clearActiveForm() {
    setEditProduct(null);
    setIsMobileFormOpen(false);
  }

  function openBatches(product: Product) {
    setBatchProductId(product.id);
    setBatchProductName(product.name);
    setBatchOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 pb-10 md:pb-0 xl:h-full xl:overflow-hidden">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_58%,#16213d_100%)] px-5 py-4 text-white shadow-[0_8px_20px_rgba(7,12,24,0.10)] md:px-6 xl:shrink-0">
        <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-[30px]">
              Product catalog.{" "}
              <span className="kyn-brand-text">Fast and organized.</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {barcodeEnabled && (
              <BarcodePrintCenterButton
                licenseId={licenseId}
                defaultShopName={shopName}
                buttonText="Print Barcodes"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
                open={barcodePrintOpen}
                onOpen={() => setBarcodePrintOpen(true)}
                onClose={() => setBarcodePrintOpen(false)}
              />
            )}

            <button
              type="button"
              onClick={() => router.push("/dashboard/entries")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <button
              type="button"
              onClick={handleBulkAdd}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.12] cursor-pointer"
            >
              <ClipboardPaste className="h-4 w-4" />
              Bulk Add
            </button>
          </div>
        </div>
      </section>

      <div className="grid min-h-0 gap-4 xl:h-[calc(100dvh-150px)] xl:grid-cols-[minmax(460px,2fr)_minmax(0,3fr)]">
        <section className="min-w-0 space-y-3 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:space-y-0 xl:gap-3">
          <div className="rounded-[16px] border border-slate-200 bg-white/85 p-2 shadow-sm xl:shrink-0">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_34px] xl:items-center">
              <div className="relative min-w-0 flex-1 xl:min-w-[150px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search item name or short code (Ctrl/Cmd + F)"
                  className="h-[34px] w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-9 text-xs text-slate-800 shadow-sm outline-none placeholder:text-slate-400 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
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

              <div className="min-w-0">
                <SearchableDropdown
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={categories.map((category) => ({
                    value: category,
                    label: category,
                  }))}
                  placeholder="Category"
                  autoOpenOnFocus={false}
                  buttonProps={{
                    className:
                      "h-[34px] w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:rounded-xl xl:pr-1">
            <ProductsTable
              variant="compact"
              pageSize={10}
              showAddButton
              onAdd={handleAddProduct}
              onEdit={handleEditProduct}
              onDelete={() => setRefreshTrigger((value) => value + 1)}
              onView={(product) => {
                setViewProduct(product);
                setIsViewOpen(true);
              }}
              onManageBatches={openBatches}
              refreshTrigger={refreshTrigger}
              nameFilter={searchQuery}
              categoryFilter={categoryFilter}
            />
          </div>
        </section>

        {isDesktopWorkspace && (
          <aside className="hidden h-full min-h-0 xl:block">
            <ProductFormPanel
              mode="embedded"
              formId="product-form-embedded"
              editProduct={editProduct}
              existingCategories={categories}
              existingBrands={brands}
              categoryRecords={categoryRecords}
              onSuccess={handleFormSuccess}
              onClear={clearActiveForm}
              onCancel={clearActiveForm}
            />
          </aside>
        )}
      </div>

      <ProductFormModal
        isOpen={isMobileFormOpen}
        onClose={clearActiveForm}
        onSuccess={handleFormSuccess}
        editProduct={editProduct}
        existingCategories={categories}
        existingBrands={brands}
        categoryRecords={categoryRecords}
      />

      <ProductFormModal
        isOpen={isBulkFormOpen}
        onClose={() => setIsBulkFormOpen(false)}
        onSuccess={() => {
          setRefreshTrigger((value) => value + 1);
        }}
        editProduct={null}
        existingCategories={categories}
        existingBrands={brands}
        categoryRecords={categoryRecords}
        initialTab="bulk"
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
