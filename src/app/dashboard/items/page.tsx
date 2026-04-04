// src/app/dashboard/items/page.tsx
"use client";

import { useState, useEffect } from "react";
import ProductsTable from "@/components/products/ProductsTable";
import ProductFormModal from "@/components/products/ProductFormModal";
import ProductBatchesDrawer from "@/components/products/ProductBatchesDrawer";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import BarcodePrintCenterButton from "@/components/barcodes/BarcodePrintCenterButton";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import { Package, Plus, ScanBarcode, X } from "lucide-react";

interface Product {
  id: string;
  code: string;
  name: string;
  brand?: string;
  category?: string;
  barcode?: string | null;
  unit: string;
  tax: string;
  hsn?: string;
  costPrice: number;
  salePrice?: number;
  stock: number;
}

export default function ItemsPage() {
  const [isClient, setIsClient] = useState(false);
  const [licenseId, setLicenseId] = useState("");
  const [shopName, setShopName] = useState("My Shop");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [nameFilter, setNameFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProductId, setBatchProductId] = useState<string | null>(null);
  const [batchProductName, setBatchProductName] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    setIsClient(true);
    setLicenseId(getActiveLicenseId());
    setShopName(localStorage.getItem("shopName") || "My Shop");
  }, []);

  useEffect(() => {
    if (!isClient || !licenseId) return;
    platform
      .getProducts(licenseId, { page: 1, pageSize: 1000 })
      .then((result: any) => {
        setProductNames(result.products.map((p: any) => p.name));
        setCategories(
          Array.from(
            new Set(
              result.products
                .map((p: any) => p.category)
                .filter((c: string | undefined): c is string => !!c),
            ),
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleAddProduct();
      }
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleAddProduct();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isClient]);

  if (!isClient) return null;

  const hasFilters = nameFilter || categoryFilter;

  return (
    <div className="space-y-4">
      {/* ── Hero Header ── */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)] md:px-6 md:py-6">
        <div className="pointer-events-none absolute -left-12 top-0 h-32 w-32 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-fuchsia-500/12 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              KYNFLOW • ITEMS MANAGEMENT
            </div>
            <h1 className="text-[26px] font-semibold tracking-[-0.05em] text-white md:text-[32px]">
              Inventory catalog.{" "}
              <span className="kyn-brand-text">Products in control.</span>
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Manage your products, pricing, batches and barcode assignments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <BarcodePrintCenterButton
              licenseId={licenseId}
              defaultShopName={shopName}
              buttonText="Print Barcodes"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition hover:bg-white/[0.12]"
            />
            <button
              onClick={handleAddProduct}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(255,255,255,0.12)] transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </button>
          </div>
        </div>
      </section>

      {/* ── Filters ── */}
      <section className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchableDropdown
            value={nameFilter}
            onChange={setNameFilter}
            options={productNames.map((p) => ({ value: p, label: p }))}
            placeholder="Filter by product name"
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <SearchableDropdown
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categories.map((c) => ({ value: c, label: c }))}
            placeholder="Filter by category"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setNameFilter("");
              setCategoryFilter("");
            }}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-kyn-border bg-kyn-surface px-3 py-2.5 text-sm font-medium text-kyn-text-muted transition hover:text-kyn-text"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </section>

      {/* ── Table ── */}
      <ProductsTable
        onAdd={handleAddProduct}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        onManageBatches={(p) => openBatches(p.id, p.name)}
        refreshTrigger={refreshTrigger}
        nameFilter={nameFilter}
        categoryFilter={categoryFilter}
      />

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleFormSuccess}
        editProduct={editProduct}
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
    </div>
  );
}
