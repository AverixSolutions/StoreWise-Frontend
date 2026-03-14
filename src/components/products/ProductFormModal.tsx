// src/components/products/ProductFormModal.tsx

"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, Tag, Zap } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";

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

interface BarcodeEntry {
  id: string; // temp client id
  barcode: string; // the actual barcode string
  isGenerated: boolean; // was auto-generated from sequence
  saved: boolean; // committed to DB (edit mode)
  batchId?: string; // DB batch id if saved
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

  // Barcode management
  const [barcodeEntries, setBarcodeEntries] = useState<BarcodeEntry[]>([]);
  const [customBarcodeInput, setCustomBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const licenseId =
    typeof window !== "undefined"
      ? localStorage.getItem("licenseId") || "demo-license"
      : "demo-license";

  const nameRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLButtonElement>(null);
  const taxRef = useRef<HTMLButtonElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const hsnRef = useRef<HTMLInputElement>(null);
  const costRef = useRef<HTMLInputElement>(null);
  const saleRef = useRef<HTMLInputElement>(null);

  const IDX = {
    NAME: 0,
    BRAND: 1,
    UNIT: 2,
    TAX: 3,
    CATEGORY: 4,
    HSN: 5,
    COST: 6,
    SALE: 7,
  } as const;
  const inputRefs = [
    nameRef,
    brandRef,
    unitRef,
    taxRef,
    categoryRef,
    hsnRef,
    costRef,
    saleRef,
  ];

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        if (index > 0) inputRefs[index - 1].current?.focus();
      } else {
        if (index < inputRefs.length - 1) {
          inputRefs[index + 1].current?.focus();
        } else {
          const form = (e.currentTarget as HTMLElement).closest(
            "form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        }
      }
    }
  }

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => nameRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (editProduct) {
      setCode(editProduct.code);
      setName(editProduct.name);
      setBrand(editProduct.brand || "");
      setCategory(editProduct.category || "");
      setUnit(editProduct.unit);
      setTax(editProduct.tax);
      setHsn(editProduct.hsn || "");
      setCostPrice(editProduct.costPrice.toString());
      setSalePrice(editProduct.salePrice?.toString() || "");
      // Load existing barcodes from DB
      loadExistingBarcodes(editProduct.id);
    } else {
      resetForm();
      window.electronAPI.getNextCode(licenseId).then((nextCode: string) => {
        setCode(nextCode);
      });
    }
  }, [isOpen, editProduct]);

  async function loadExistingBarcodes(productId: string) {
    const res = await (window as any).electronAPI.listBarcodesForProduct(
      licenseId,
      productId,
    );
    if (res?.success) {
      const entries: BarcodeEntry[] = (res.rows || []).map((b: any) => ({
        id: b.id,
        barcode: b.barcode || "",
        isGenerated: /^\d{5}$/.test(b.barcode || ""),
        saved: true,
        batchId: b.id,
      }));
      setBarcodeEntries(entries);
    }
  }

  function resetForm() {
    setName("");
    setBrand("");
    setCategory("");
    setUnit("NOS");
    setTax("P5");
    setHsn("");
    setCostPrice("");
    setSalePrice("");
    setBarcodeEntries([]);
    setCustomBarcodeInput("");
    setBarcodeError(null);
  }

  // Add a system-generated barcode (reserves from global sequence)
  async function addGeneratedBarcode() {
    setBarcodeError(null);
    const res = await (window as any).electronAPI.reserveBarcodes(licenseId, 1);
    if (!res?.success) {
      setBarcodeError("Failed to generate barcode");
      return;
    }
    const barcode = res.barcodes[0];
    setBarcodeEntries((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, barcode, isGenerated: true, saved: false },
    ]);
  }

  // Add a custom barcode
  function addCustomBarcode() {
    const bc = customBarcodeInput.trim();
    if (!bc) {
      setBarcodeError("Enter a barcode value");
      return;
    }
    if (barcodeEntries.some((e) => e.barcode === bc)) {
      setBarcodeError("Barcode already in the list");
      return;
    }
    setBarcodeError(null);
    setBarcodeEntries((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        barcode: bc,
        isGenerated: false,
        saved: false,
      },
    ]);
    setCustomBarcodeInput("");
  }

  // Remove a barcode entry (soft delete from DB if saved, else just remove from list)
  async function removeBarcode(entry: BarcodeEntry) {
    if (entry.saved && entry.batchId) {
      const ok = confirm(
        `Remove barcode ${entry.barcode}? Stock will also be removed.`,
      );
      if (!ok) return;
      const res = await (window as any).electronAPI.deleteBarcode(
        entry.batchId,
      );
      if (!res?.success) {
        alert("Failed to delete barcode");
        return;
      }
    }
    setBarcodeEntries((prev) => prev.filter((e) => e.id !== entry.id));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        costPrice: costPrice ? parseFloat(costPrice) : 0,
        salePrice: salePrice ? parseFloat(salePrice) : null,
      };

      let productId = "";

      if (editProduct) {
        await window.electronAPI.updateProduct(editProduct.id, productData);
        productId = editProduct.id;
      } else {
        const result = await window.electronAPI.createProduct(productData);
        productId = result?.productId || "";

        if (!productId) {
          const p = await window.electronAPI.getProductByCode(licenseId, code);
          productId = p?.id || "";
        }
      }

      // Save all unsaved barcode entries
      if (productId) {
        for (const entry of barcodeEntries) {
          if (!entry.saved && entry.barcode) {
            await (window as any).electronAPI.createBarcodeForProduct({
              licenseId,
              productId,
              barcode: entry.barcode,
              useGenerated: false, // already have the barcode string
              costPrice: costPrice ? parseFloat(costPrice) : null,
              salePrice: salePrice ? parseFloat(salePrice) : null,
            });
          }
        }
      }

      alert(`✅ Product ${editProduct ? "updated" : "created"} successfully!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`❌ ${error?.message || "Failed to save product."}`);
      console.error("ProductFormModal error:", error);
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
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0 bg-black/40 backdrop-blur-sm">
        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transform bg-white shadow-xl rounded-xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-averix-red-dark to-averix-red-accent p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {editProduct ? "Edit Item" : "Add New Item"}
                </h2>
                <p className="text-white opacity-90 text-sm">
                  {editProduct
                    ? "Update product information"
                    : "Create a new product in your inventory"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
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

          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
          >
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
                  onKeyDown={(e) => handleKeyDown(e, IDX.NAME)}
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
                  onKeyDown={(e) => handleKeyDown(e, IDX.BRAND)}
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
                  onEnter={() => inputRefs[IDX.TAX].current?.focus()}
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
                  onEnter={() => inputRefs[IDX.CATEGORY].current?.focus()}
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
                  onKeyDown={(e) => handleKeyDown(e, IDX.CATEGORY)}
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
                  onKeyDown={(e) => handleKeyDown(e, IDX.HSN)}
                  placeholder="Enter HSN code"
                  className="w-full border-2 border-gray-200 rounded-lg p-2.5 focus:border-averix-red-dark focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    onKeyDown={(e) => handleKeyDown(e, IDX.COST)}
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
                    onKeyDown={(e) => handleKeyDown(e, IDX.SALE)}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 pl-8 focus:border-averix-red-dark focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* ── BARCODE SECTION ── */}
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-averix-red-dark" />
                <span className="text-sm font-semibold text-gray-800">
                  Barcodes (Batches)
                </span>
                <span className="text-xs text-gray-500 ml-1">
                  — optional, each barcode = a batch
                </span>
              </div>

              {/* Existing + pending barcodes */}
              {barcodeEntries.length > 0 && (
                <div className="space-y-2">
                  {barcodeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                          entry.isGenerated
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {entry.barcode}
                      </span>
                      {entry.isGenerated && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> generated
                        </span>
                      )}
                      {entry.saved && (
                        <span className="text-xs text-green-600 ml-auto mr-1">
                          saved
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeBarcode(entry)}
                        className="ml-auto p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                        title="Remove barcode"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add actions */}
              <div className="flex gap-2 items-center flex-wrap">
                {/* Generate next system barcode */}
                <button
                  type="button"
                  onClick={addGeneratedBarcode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Generate Barcode
                </button>

                {/* Custom barcode input */}
                <div className="flex items-center gap-1 flex-1 min-w-[180px]">
                  <input
                    type="text"
                    value={customBarcodeInput}
                    onChange={(e) => {
                      setCustomBarcodeInput(e.target.value);
                      setBarcodeError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomBarcode();
                      }
                    }}
                    placeholder="Custom barcode (e.g. 90808909)"
                    className="flex-1 h-8 px-2 border border-gray-300 rounded-lg text-xs focus:border-averix-red-dark focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addCustomBarcode}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-700 text-white text-xs hover:bg-gray-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {barcodeError && (
                <p className="text-xs text-red-600">{barcodeError}</p>
              )}

              {barcodeEntries.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                  No barcodes added yet. A default will be auto-assigned on
                  first purchase.
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
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
