// src/components/products/ProductsTable.tsx
"use client";

import { useState, useEffect } from "react";
import Pagination from "../ui/Pagination";
import TableSkeleton from "../ui/TableSkeleton";
import EmptyState from "../ui/EmptyState";
import { PackagePlus, Edit2, Trash2 } from "lucide-react";

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
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  refreshTrigger: number;
  nameFilter?: string;
  categoryFilter?: string;
}

export default function ProductsTable({
  onEdit,
  onDelete,
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
    try {
      const licenseId = localStorage.getItem("licenseId") || "demo-license";

      let result: { products: Product[]; total: number };
      if (nameFilter || categoryFilter) {
        result = await window.electronAPI.getFilteredProducts(
          licenseId,
          { name: nameFilter || null, category: categoryFilter || null },
          { page, pageSize }
        );
      } else {
        result = await window.electronAPI.getProducts(licenseId, {
          page,
          pageSize,
        });
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
    return <TableSkeleton columns={10} rows={6} />;
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="No Products Found"
        description="Add your first product to get started with your inventory."
        icon={<PackagePlus size={32} />}
        action={
          <button
            onClick={() => onEdit(null as any)}
            className="mt-4 bg-averix-red-dark text-white px-6 py-3 rounded-lg hover:bg-averix-red-accent transition-colors font-medium"
          >
            Add Product
          </button>
        }
      />
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-averix-red-dark to-averix-red-accent">
              {[
                { key: "code", label: "Code", width: "w-24" },
                { key: "name", label: "Product Name", width: "w-48" },
                { key: "brand", label: "Brand", width: "w-32" },
                { key: "category", label: "Category", width: "w-32" },
                { key: "barcode", label: "Barcode", width: "w-36" },
                { key: "unit", label: "Unit", width: "w-20" },
                { key: "cost", label: "Cost Price", width: "w-28" },
                { key: "sale", label: "Sale Price", width: "w-28" },
                { key: "stock", label: "Stock", width: "w-20" },
                { key: "actions", label: "Actions", width: "w-24" },
              ].map((col) => (
                <th
                  key={col.key}
                  className={`${col.width} px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((product, idx) => (
              <tr
                key={product.id}
                className={`transition-all duration-200 hover:bg-blue-50/30 ${
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                }`}
              >
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-mono font-medium">
                    {product.code}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900 text-sm">
                    {product.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-600 text-sm">
                    {product.brand || "—"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-600 text-sm">
                    {product.category || "—"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-500 text-xs font-mono">
                    {product.barcode || "—"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                    {product.unit}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-900 font-medium text-sm">
                    ₹{product.costPrice.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-green-700 font-medium text-sm">
                    {product.salePrice
                      ? `₹${product.salePrice.toFixed(2)}`
                      : "—"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                      product.stock <= 5
                        ? "bg-red-100 text-red-800"
                        : product.stock <= 20
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {product.stock}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(product)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 transition-all duration-200"
                      title="Edit Product"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id, product.name)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:scale-105 transition-all duration-200"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}
