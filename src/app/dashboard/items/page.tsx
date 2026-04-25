// src/app/dashboard/items/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import ProductsTable from "@/components/products/ProductsTable";
import ProductFormModal from "@/components/products/ProductFormModal";
import ProductBatchesDrawer from "@/components/products/ProductBatchesDrawer";
import BarcodePrintCenterButton from "@/components/barcodes/BarcodePrintCenterButton";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import { Plus, Search, X } from "lucide-react";
import type {
  ProductSummary,
  CategoryRecord,
  BrandRecord,
} from "@/platform/types";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import ProductViewModal from "@/components/products/ProductViewModal";

type Product = ProductSummary;

const TAX_OPTIONS = [
  { value: "NT", label: "NT — No Tax" },
  { value: "P5", label: "P5 — 5%" },
  { value: "P12", label: "P12 — 12%" },
  { value: "P18", label: "P18 — 18%" },
  { value: "P28", label: "P28 — 28%" },
];

export default function ItemsPage() {
  const [isClient, setIsClient] = useState(false);
  const [licenseId, setLicenseId] = useState("");
  const [shopName, setShopName] = useState("My Shop");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [taxFilter, setTaxFilter] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [categoryRecords, setCategoryRecords] = useState<CategoryRecord[]>([]);

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProductId, setBatchProductId] = useState<string | null>(null);
  const [batchProductName, setBatchProductName] = useState<string | undefined>(
    undefined,
  );

  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
    setLicenseId(getActiveLicenseId());
    setShopName(localStorage.getItem("shopName") || "My Shop");
  }, []);

  useEffect(() => {
    if (!isClient || !licenseId) return;

    Promise.all([
      platform.getProducts(licenseId, { page: 1, pageSize: 1000 }),
      platform.listCategories(licenseId),
      platform.listBrands(licenseId),
    ])
      .then(([productsResult, categoriesResult, brandsResult]) => {
        setProductNames(productsResult.products.map((p: any) => p.name));

        setCategories(
          Array.from(
            new Set(
              productsResult.products
                .map((p: any) => p.category)
                .filter((c: string | undefined): c is string => !!c),
            ),
          ),
        );

        setSubcategories(
          Array.from(
            new Set(
              productsResult.products
                .map((p: any) => p.subcategory)
                .filter((s: string | undefined): s is string => !!s),
            ),
          ).sort((a, b) => a.localeCompare(b)),
        );

        if (categoriesResult.success) {
          setCategoryRecords(categoriesResult.rows);
        } else {
          setCategoryRecords([]);
        }

        const productBrands = productsResult.products
          .map((p: any) => p.brand)
          .filter((b: string | undefined): b is string => !!b);

        const masterBrands = brandsResult.success
          ? brandsResult.rows.map((row) => row.name)
          : [];

        setBrands(
          Array.from(new Set([...masterBrands, ...productBrands])).sort(
            (a, b) => a.localeCompare(b),
          ),
        );
      })
      .catch(console.error);
  }, [refreshTrigger, licenseId, isClient]);

  const handleAddProduct = () => {
    setEditProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditProduct(product);
    setIsModalOpen(true);
  };

  const handleViewProduct = (product: Product) => {
    setViewProduct(product);
    setIsViewOpen(true);
  };

  const handleDeleteProduct = (_id: string) => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditProduct(null);
  };

  const handleFormSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const openBatches = (id: string, name?: string) => {
    setBatchProductId(id);
    setBatchProductName(name);
    setBatchOpen(true);
  };

  useEffect(() => {
    if (!isClient) return;

    const handleShortcut = (e: KeyboardEvent) => {
      const modalOrDrawerOpen = isModalOpen || batchOpen || isViewOpen;

      if (modalOrDrawerOpen) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleAddProduct();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isClient, isModalOpen, batchOpen, isViewOpen]);

  if (!isClient) return null;

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

  return (
    <div className="space-y-4 pb-10 md:pb-0">
      {/* ── Hero Header ── */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)] md:px-6 md:py-6">
        <div className="pointer-events-none absolute -left-12 top-0 h-32 w-32 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-fuchsia-500/12 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              KYNFLOW • ITEMS MANAGEMENT
            </div>
            <h1 className="text-[22px] font-semibold tracking-[-0.05em] text-white md:text-[28px]">
              Inventory catalog.{" "}
              <span className="kyn-brand-text">Products in control.</span>
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-300">
              Manage your products, pricing, batches and barcode assignments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <BarcodePrintCenterButton
              licenseId={licenseId}
              defaultShopName={shopName}
              buttonText="Print Barcodes"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition hover:bg-white/[0.12] cursor-pointer"
            />
            <button
              onClick={handleAddProduct}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(255,255,255,0.12)] transition hover:bg-slate-50 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </button>
          </div>
        </div>
      </section>

      {/* ── Filter Bar ── */}
      <section className="rounded-[16px] border border-slate-300 bg-white/80 p-3 shadow-sm">
        {/* Row 1: Category, Brand, Subcategory, Tax */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Category */}
          <SearchableDropdown
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categories.map((c) => ({ value: c, label: c }))}
            placeholder="All categories"
            autoOpenOnFocus={false}
            buttonProps={{
              className:
                "h-[44px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10 cursor-pointer",
            }}
            menuClassName="rounded-2xl"
            inputClassName="text-sm"
          />

          {/* Brand */}
          <SearchableDropdown
            value={brandFilter}
            onChange={setBrandFilter}
            options={brands.map((b) => ({ value: b, label: b }))}
            placeholder="All brands"
            autoOpenOnFocus={false}
            buttonProps={{
              className:
                "h-[44px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10 cursor-pointer",
            }}
            menuClassName="rounded-2xl"
            inputClassName="text-sm"
          />

          {/* Subcategory */}
          <SearchableDropdown
            value={subcategoryFilter}
            onChange={setSubcategoryFilter}
            options={subcategories.map((s) => ({ value: s, label: s }))}
            placeholder="All subcategories"
            autoOpenOnFocus={false}
            buttonProps={{
              className:
                "h-[44px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10 cursor-pointer",
            }}
            menuClassName="rounded-2xl"
            inputClassName="text-sm"
          />

          {/* Tax */}
          <SearchableDropdown
            value={taxFilter}
            onChange={setTaxFilter}
            options={TAX_OPTIONS}
            placeholder="All tax rates"
            autoOpenOnFocus={false}
            buttonProps={{
              className:
                "h-[44px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10 cursor-pointer",
            }}
            menuClassName="rounded-2xl"
            inputClassName="text-sm"
          />
        </div>

        {/* Row 2: Search + Clear */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or short code… (Ctrl/Cmd + F)"
              className="h-[44px] w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
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

          {/* Clear */}
          <button
            type="button"
            onClick={clearAll}
            disabled={!hasFilters}
            className="inline-flex h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </section>

      {/* ── Table ── */}
      <ProductsTable
        onAdd={handleAddProduct}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        onView={handleViewProduct}
        onManageBatches={(p) => openBatches(p.id, p.name)}
        refreshTrigger={refreshTrigger}
        nameFilter={searchQuery}
        categoryFilter={categoryFilter}
        brandFilter={brandFilter}
        subcategoryFilter={subcategoryFilter}
        taxFilter={taxFilter}
      />

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleFormSuccess}
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
          setRefreshTrigger((x) => x + 1);
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
