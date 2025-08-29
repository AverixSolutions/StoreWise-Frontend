// src/app/dashboard/items/page.tsx
"use client";

import { useState } from "react";
import ProductsTable from "@/components/products/ProductsTable";
import ProductFormModal from "@/components/products/ProductFormModal";

interface Product {
  id: string;
  code: string;
  name: string;
  brand?: string;
  category?: string;
  unit: string;
  tax: string;
  hsn?: string;
  costPrice: number;
  salePrice?: number;
  stock: number;
}

export default function ItemsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAddProduct = () => {
    setEditProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditProduct(product);
    setIsModalOpen(true);
  };

  const handleDeleteProduct = (id: string) => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditProduct(null);
  };

  const handleFormSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Items Management
            </h1>
            <p className="text-gray-600 mt-1">Manage your inventory products</p>
          </div>
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

        {/* Table Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              Product List
            </h3>
          </div>
          <div className="p-6">
            <ProductsTable
              onEdit={handleEditProduct}
              onDelete={handleDeleteProduct}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>

        {/* Modal */}
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleFormSuccess}
          editProduct={editProduct}
        />
      </div>
    </main>
  );
}
