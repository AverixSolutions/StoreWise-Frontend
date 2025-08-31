// src/components/products/ProductsTable.tsx
"use client";

import { useState, useEffect } from "react";
import Pagination from "../ui/Pagination";
import TableSkeleton from "../ui/TableSkeleton";
import EmptyState from "../ui/EmptyState";
import { PackagePlus } from "lucide-react";

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
    return <TableSkeleton columns={9} rows={6} />;
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
            className="mt-4 bg-averix-red-dark text-white px-4 py-2 rounded-lg hover:shadow"
          >
            Add Product
          </button>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
      <table className="w-full text-sm text-gray-700">
        {/* Header */}
        <thead className="bg-gradient-to-r from-averix-red-dark to-averix-red-accent text-white">
          <tr>
            {[
              "Code",
              "Name",
              "Brand",
              "Category",
              "Unit",
              "Cost Price",
              "Sale Price",
              "Stock",
              "Actions",
            ].map((heading) => (
              <th
                key={heading}
                className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-gray-100">
          {products.map((product, idx) => (
            <tr
              key={product.id}
              className={`transition-colors duration-150 ${
                idx % 2 === 0 ? "bg-white" : "bg-gray-50"
              } hover:bg-gray-100`}
            >
              <td className="px-4 py-3 text-center font-mono font-medium text-gray-900">
                {product.code}
              </td>
              <td className="px-4 py-3 text-center font-medium text-gray-900">
                {product.name}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {product.brand || "-"}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {product.category || "-"}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {product.unit}
              </td>
              <td className="px-4 py-3 text-center font-medium text-gray-700">
                ₹{product.costPrice.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-center font-medium text-gray-700">
                {product.salePrice ? `₹${product.salePrice.toFixed(2)}` : "-"}
              </td>
              <td className="px-4 py-3 text-center font-medium text-gray-700">
                {product.stock}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex justify-center space-x-2">
                  {/* Edit */}
                  <button
                    onClick={() => onEdit(product)}
                    className="p-2 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
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

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(product.id, product.name)}
                    className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
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
      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}
