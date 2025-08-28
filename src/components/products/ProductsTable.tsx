// src/components/ui/ProductsTable.tsx
"use client";

import { useState, useEffect } from "react";

interface Product {
  id: string;
  code: string;
  name: string;
  brand?: string;
  category?: string;
  unit: string;
  tax: string;
  costPrice: number;
  salePrice?: number;
  stock: number;
}

interface ProductsTableProps {
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  refreshTrigger: number;
}

export default function ProductsTable({
  onEdit,
  onDelete,
  refreshTrigger,
}: ProductsTableProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    try {
      const licenseId = localStorage.getItem("licenseId") || "demo-license";
      const productList = await window.electronAPI.getProducts(licenseId);
      setProducts(productList);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [refreshTrigger]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await window.electronAPI.deleteProduct(id);
        onDelete(id);
        loadProducts();
      } catch (error) {
        alert("Failed to delete product");
        console.error("Error deleting product:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-averix-red-dark"></div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">
          No products found. Add your first product to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full bg-white rounded-lg shadow-sm border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Code
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Name
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Brand
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Category
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Unit
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Cost Price
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Sale Price
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Stock
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-mono text-gray-900">
                {product.code}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                {product.name}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {product.brand || "-"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {product.category || "-"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {product.unit}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                ₹{product.costPrice.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {product.salePrice ? `₹${product.salePrice.toFixed(2)}` : "-"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {product.stock}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => onEdit(product)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="Edit"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(product.id, product.name)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Delete"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
