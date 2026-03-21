// src/app/dashboard/items/page.tsx
"use client";

import { useState, useEffect } from "react";
import ProductsTable from "@/components/products/ProductsTable";
import ProductFormModal from "@/components/products/ProductFormModal";
import ProductBatchesDrawer from "@/components/products/ProductBatchesDrawer";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import BarcodePrintCenterButton from "@/components/barcodes/BarcodePrintCenterButton";

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
  const [licenseId, setLicenseId] = useState("demo-license");
  const [shopName, setShopName] = useState("My Shop");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [nameFilter, setNameFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProductId, setBatchProductId] = useState<string | null>(null);
  const [batchProductName, setBatchProductName] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    setIsClient(true);

    if (typeof window !== "undefined") {
      setLicenseId(localStorage.getItem("licenseId") || "demo-license");
      setShopName(localStorage.getItem("shopName") || "My Shop");
    }
  }, []);

  useEffect(() => {
    if (!isClient) return;

    window.electronAPI
      .getProducts(licenseId, { page: 1, pageSize: 1000 })
      .then((result: any) => {
        setProducts(result.products.map((p: any) => p.name));
        setCategories(
          Array.from(
            new Set(
              result.products
                .map((p: any) => p.category)
                .filter((c: string | undefined): c is string => !!c),
            ),
          ),
        );
      });
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
    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [isClient]);

  if (!isClient) return null;

  return (
    <main className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Items Management
            </h1>
            <p className="text-gray-600 mt-1">Manage your inventory products</p>
          </div>

          <div className="flex items-center gap-3">
            <BarcodePrintCenterButton
              licenseId={licenseId}
              defaultShopName={shopName}
              buttonText="Print Barcodes"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            />

            <button
              onClick={handleAddProduct}
              className="bg-gradient-to-r from-averix-red-dark to-averix-red-accent text-white font-semibold py-2.5 px-6 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center cursor-pointer"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Product
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <SearchableDropdown
            value={nameFilter}
            onChange={setNameFilter}
            options={products.map((p) => ({ value: p, label: p }))}
            placeholder="Filter by product name"
          />

          <SearchableDropdown
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categories.map((c) => ({ value: c, label: c }))}
            placeholder="Filter by category"
          />

          {(nameFilter || categoryFilter) && (
            <button
              onClick={() => {
                setNameFilter("");
                setCategoryFilter("");
              }}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-gray-700 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

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
    </main>
  );
}
