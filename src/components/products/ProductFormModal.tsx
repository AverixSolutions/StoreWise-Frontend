// src/components/products/ProductFormModal.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, Tag, Zap, X } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";

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
  id: string;
  barcode: string;
  isGenerated: boolean;
  saved: boolean;
  batchId?: string;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProduct?: Product | null;
}

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";

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

  const [barcodeEntries, setBarcodeEntries] = useState<BarcodeEntry[]>([]);
  const [customBarcodeInput, setCustomBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [nextBarcodePreview, setNextBarcodePreview] = useState("00001");

  const licenseId = typeof window !== "undefined" ? getActiveLicenseId() : "";

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
    loadNextBarcodePreview();
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
      loadExistingBarcodes(editProduct.id);
    } else {
      resetForm();
      platform
        .getNextCode(licenseId)
        .then((nextCode: string) => setCode(nextCode));
    }
  }, [isOpen, editProduct, licenseId]);

  async function loadNextBarcodePreview() {
    try {
      const res = await platform.peekNextBarcode?.(licenseId);
      setNextBarcodePreview(res?.barcode || "00001");
    } catch {
      setNextBarcodePreview("00001");
    }
  }

  async function loadExistingBarcodes(productId: string) {
    const res = await platform.listBarcodesForProduct?.(licenseId, productId);
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

  async function addGeneratedBarcode() {
    setBarcodeError(null);
    const res = await platform.reserveBarcodes?.(licenseId, 1);
    if (!res?.success) {
      setBarcodeError("Failed to generate barcode");
      return;
    }
    const barcode = res.barcodes[0];
    setBarcodeEntries((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, barcode, isGenerated: true, saved: false },
    ]);
    await loadNextBarcodePreview();
  }

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

  async function removeBarcode(entry: BarcodeEntry) {
    if (entry.saved && entry.batchId) {
      const ok = confirm(
        `Remove barcode ${entry.barcode}? This will delete the empty barcode entry if it has no stock.`,
      );
      if (!ok) return;
      const res = await platform.deleteBarcode?.(licenseId, entry.batchId);
      if (!res?.success) {
        alert(`Failed to delete barcode: ${res?.error || "Unknown error"}`);
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
        const result = await platform.updateProduct(
          editProduct.id,
          productData,
        );
        if (!result?.success) throw new Error(result?.error || "Update failed");
        productId = editProduct.id;
      } else {
        const result = await platform.createProduct(productData);
        if (!result?.success) throw new Error(result?.error || "Create failed");
        productId = result?.productId || "";
      }

      if (productId) {
        for (const entry of barcodeEntries) {
          if (!entry.saved && entry.barcode) {
            const bcResult = await platform.createBarcodeForProduct?.({
              licenseId,
              productId,
              barcode: entry.barcode,
              useGenerated: false,
              costPrice: costPrice ? parseFloat(costPrice) : null,
              salePrice: salePrice ? parseFloat(salePrice) : null,
            });
            if (!bcResult?.success)
              throw new Error(
                bcResult?.error || `Failed to save barcode ${entry.barcode}`,
              );
          }
        }
      }

      if (!editProduct) {
        const nextCode = await platform.getNextCode(licenseId);
        setCode(nextCode);
      }

      alert(`✅ Product ${editProduct ? "updated" : "created"} successfully!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`❌ ${error?.message || "Failed to save product."}`);
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Sheet on mobile, centered modal on sm+ */}
      <div
        className="w-full sm:max-w-2xl sm:rounded-[28px] rounded-t-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] shadow-[0_-10px_60px_rgba(3,10,24,0.18)] backdrop-blur overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden rounded-t-[28px] bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-6 py-5 text-white shrink-0">
          <div className="pointer-events-none absolute -left-8 top-0 h-24 w-24 rounded-full bg-cyan-400/15 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-2xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <div className="kyn-brand-pill mb-2 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                {editProduct ? "Edit Item" : "New Item"}
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">
                {editProduct ? "Update product" : "Add to catalog"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 no-scrollbar"
        >
          {/* Item Code (read-only) */}
          <div>
            <label className={labelClass}>Item Code</label>
            <input
              type="text"
              value={code}
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-500 outline-none"
            />
          </div>

          {/* Name + Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Product Name <span className="text-rose-400">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, IDX.NAME)}
                required
                placeholder="Enter product name"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Brand</label>
              <input
                ref={brandRef}
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, IDX.BRAND)}
                placeholder="Enter brand"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Unit + Tax */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Unit <span className="text-rose-400">*</span>
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
              <label className={labelClass}>
                Tax Rate <span className="text-rose-400">*</span>
              </label>
              <Dropdown
                ref={taxRef}
                value={tax}
                onChange={setTax}
                options={taxOptions}
                placeholder="Select tax"
                onEnter={() => inputRefs[IDX.CATEGORY].current?.focus()}
                required
              />
            </div>
          </div>

          {/* Category + HSN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category</label>
              <input
                ref={categoryRef}
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, IDX.CATEGORY)}
                placeholder="Enter category"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>HSN Code</label>
              <input
                ref={hsnRef}
                type="text"
                value={hsn}
                onChange={(e) => setHsn(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, IDX.HSN)}
                placeholder="Enter HSN"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Cost Price <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">
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
                  className={`${fieldClass} pl-8`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Sale Price</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">
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
                  className={`${fieldClass} pl-8`}
                />
              </div>
            </div>
          </div>

          {/* ── Barcode section ── */}
          <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl kyn-brand-chip">
                <Tag className="h-3.5 w-3.5 text-slate-700" />
              </div>
              <span className="text-sm font-semibold text-slate-800">
                Barcodes
              </span>
              <span className="text-xs text-slate-400">
                — each barcode = a batch
              </span>
            </div>

            {barcodeEntries.length > 0 && (
              <div className="space-y-2">
                {barcodeEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <span
                      className={`rounded-lg px-2 py-0.5 font-mono text-xs font-semibold ${
                        entry.isGenerated
                          ? "bg-cyan-100 text-cyan-800"
                          : "bg-fuchsia-100 text-fuchsia-800"
                      }`}
                    >
                      {entry.barcode}
                    </span>
                    {entry.isGenerated && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Zap className="h-3 w-3" /> generated
                      </span>
                    )}
                    {entry.saved && (
                      <span className="ml-auto mr-1 text-xs text-emerald-600">
                        saved
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeBarcode(entry)}
                      className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addGeneratedBarcode}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700"
              >
                <Zap className="h-3.5 w-3.5" />
                Reserve {nextBarcodePreview}
              </button>

              <div className="flex flex-1 min-w-[180px] items-center gap-1.5">
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
                  placeholder="Custom barcode"
                  className="h-8 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
                />
                <button
                  type="button"
                  onClick={addCustomBarcode}
                  className="inline-flex h-8 items-center gap-1 rounded-xl bg-slate-800 px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>

            {barcodeError && (
              <p className="text-xs font-medium text-rose-500">
                {barcodeError}
              </p>
            )}

            {barcodeEntries.length === 0 && (
              <p className="text-xs italic text-slate-400">
                No barcodes added. On purchase, the next available barcode will
                be suggested.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              {editProduct ? "Update Item" : "Save Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
