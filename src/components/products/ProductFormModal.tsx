// src/components/products/ProductFormModal.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import Dropdown from "@/components/ui/Dropdown";

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

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProduct?: Product | null;
}

export default function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  editProduct,
}: ProductFormModalProps) {
  const [code, setCode] = useState<string>("00001");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("NOS");
  const [tax, setTax] = useState("P5");
  const [hsn, setHsn] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stock, setStock] = useState("");

  const nameRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLButtonElement>(null);
  const taxRef = useRef<HTMLButtonElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const hsnRef = useRef<HTMLInputElement>(null);
  const costRef = useRef<HTMLInputElement>(null);
  const saleRef = useRef<HTMLInputElement>(null);
  const stockRef = useRef<HTMLInputElement>(null);

  const inputRefs = [
    nameRef,
    brandRef,
    unitRef,
    taxRef,
    categoryRef,
    hsnRef,
    costRef,
    saleRef,
    stockRef,
  ];

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    index: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        if (index > 0) inputRefs[index - 1].current?.focus();
      } else {
        if (index < inputRefs.length - 1) {
          inputRefs[index + 1].current?.focus();
        } else {
          (document.activeElement as HTMLElement).blur();
          const form = (e.currentTarget as HTMLElement).closest(
            "form"
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        }
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        nameRef.current?.focus();
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (editProduct) {
        // Edit mode
        setCode(editProduct.code);
        setName(editProduct.name);
        setBrand(editProduct.brand || "");
        setCategory(editProduct.category || "");
        setUnit(editProduct.unit);
        setTax(editProduct.tax);
        setHsn(editProduct.hsn || "");
        setCostPrice(editProduct.costPrice.toString());
        setSalePrice(editProduct.salePrice?.toString() || "");
        setStock(editProduct.stock.toString());
      } else {
        // Create mode
        const licenseId = localStorage.getItem("licenseId") || "demo-license";
        window.electronAPI.getNextCode(licenseId).then((nextCode: string) => {
          setCode(nextCode);
        });
        resetForm();
      }
    }
  }, [isOpen, editProduct]);

  const resetForm = () => {
    setName("");
    setBrand("");
    setCategory("");
    setUnit("NOS");
    setTax("P5");
    setHsn("");
    setCostPrice("");
    setSalePrice("");
    setStock("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const licenseId = localStorage.getItem("licenseId") || "demo-license";

    try {
      const productData = {
        licenseId,
        code,
        codeNumber: parseInt(code, 10),
        name,
        brand: brand || null,
        category: category || null,
        unit,
        tax,
        hsn: hsn || null,
        costPrice: parseFloat(costPrice),
        salePrice: salePrice ? parseFloat(salePrice) : null,
        stock: stock ? parseInt(stock, 10) : 0,
      };

      if (editProduct) {
        await window.electronAPI.updateProduct(editProduct.id, productData);
        alert("✅ Product updated successfully!");
      } else {
        await window.electronAPI.createProduct(productData);
        alert("✅ Product created successfully!");
      }

      onSuccess();
      onClose();
    } catch (error) {
      alert(
        `❌ Failed to ${
          editProduct ? "update" : "create"
        } product. Please try again.`
      );
      console.error(
        `Error ${editProduct ? "updating" : "creating"} product:`,
        error
      );
    }
  };

  const taxOptions = [
    { value: "NT", label: "No Tax (0%)" },
    { value: "P5", label: "GST 5%" },
    { value: "P12", label: "GST 12%" },
    { value: "P18", label: "GST 18%" },
    { value: "P28", label: "GST 28%" },
  ];

  const unitOptions = [
    { value: "NOS", label: "Numbers (NOS)" },
    { value: "KG", label: "Kilograms (KG)" },
    { value: "LTR", label: "Liters (LTR)" },
    { value: "MTR", label: "Meters (MTR)" },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0 transition-opacity bg-white/5 backdrop-blur-xs">
        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-xl">
          <div className="bg-gradient-to-r from-averix-red-dark to-averix-red-accent p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {editProduct ? "Edit Item" : "Add New Item"}
                </h2>
                <p className="text-averix-white opacity-90 text-sm">
                  {editProduct
                    ? "Update product information"
                    : "Create a new product in your inventory"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                }}
                className="text-white hover:text-gray-200 p-1"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Item Code */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Item Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                readOnly
                className="w-full border-2 border-gray-200 rounded-lg p-2.5 bg-gray-50 text-gray-600 font-mono text-lg"
              />
            </div>

            {/* Name and Brand */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 0)}
                  required
                  placeholder="Enter product name"
                  className="w-full border-2 border-gray-200 rounded-lg p-2.5 focus:border-averix-red-dark focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Brand
                </label>
                <input
                  ref={brandRef}
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 1)}
                  placeholder="Enter brand name"
                  className="w-full border-2 border-gray-200 rounded-lg p-2.5 focus:border-averix-red-dark focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Unit and Tax */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Unit <span className="text-red-500">*</span>
                </label>
                <Dropdown
                  ref={unitRef}
                  value={unit}
                  onChange={setUnit}
                  options={unitOptions}
                  placeholder="Select unit"
                  onEnter={() => inputRefs[3].current?.focus()}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tax Rate <span className="text-red-500">*</span>
                </label>
                <Dropdown
                  ref={taxRef}
                  value={tax}
                  onChange={setTax}
                  options={taxOptions}
                  placeholder="Select tax rate"
                  onEnter={() => inputRefs[4].current?.focus()}
                  required
                />
              </div>
            </div>

            {/* Category and HSN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category
                </label>
                <input
                  ref={categoryRef}
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 4)}
                  placeholder="Enter category"
                  className="w-full border-2 border-gray-200 rounded-lg p-2.5 focus:border-averix-red-dark focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  HSN Code
                </label>
                <input
                  ref={hsnRef}
                  type="text"
                  value={hsn}
                  onChange={(e) => setHsn(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 5)}
                  placeholder="Enter HSN code"
                  className="w-full border-2 border-gray-200 rounded-lg p-2.5 focus:border-averix-red-dark focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cost Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">
                    ₹
                  </span>
                  <input
                    ref={costRef}
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 6)}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 pl-8 focus:border-averix-red-dark focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sale Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">
                    ₹
                  </span>
                  <input
                    ref={saleRef}
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 7)}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 pl-8 focus:border-averix-red-dark focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Initial Stock
                </label>
                <input
                  ref={stockRef}
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 8)}
                  min="0"
                  placeholder="0"
                  className="w-full border-2 border-gray-200 rounded-lg p-2.5 focus:border-averix-red-dark focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  onClose();
                }}
                className="flex-1 bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-averix-red-dark to-averix-red-accent text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
              >
                {editProduct ? "Update Item" : "Save Item"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
