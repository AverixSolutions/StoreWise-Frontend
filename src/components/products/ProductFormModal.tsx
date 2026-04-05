// src/components/products/ProductFormModal.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Trash2,
  Tag,
  Zap,
  X,
  Upload,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import type {
  ProductInput,
  ProductSummary,
  UnitCode,
  TaxCode,
} from "@/platform/types";
import { useToast } from "../ui/ToastProvider";

type Product = ProductSummary;

interface BarcodeEntry {
  id: string;
  barcode: string;
  isGenerated: boolean;
  saved: boolean;
  batchId?: string;
}

interface BulkRow {
  name: string;
  brand?: string;
  category?: string;
  unit: UnitCode;
  tax: TaxCode;
  hsn?: string;
  costPrice: number;
  salePrice?: number;
  _status?: "pending" | "success" | "error";
  _error?: string;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProduct?: Product | null;
  existingCategories?: string[];
  existingBrands?: string[];
}

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10";

const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400";

const BULK_FORMAT = `name,brand,category,unit,tax,hsn,costPrice,salePrice
Sugar 1KG,Generic,Grocery,KG,NT,,50,60
Rice Basmati,India Gate,Grocery,KG,P5,1006,80,95`;

export default function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  editProduct,
  existingCategories = [],
  existingBrands = [],
}: ProductFormModalProps) {
  const { showToast } = useToast();

  const [code, setCode] = useState<string>("00001");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState<UnitCode>("NOS");
  const [tax, setTax] = useState<TaxCode>("P5");
  const [hsn, setHsn] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");

  const [barcodeEntries, setBarcodeEntries] = useState<BarcodeEntry[]>([]);
  const [customBarcodeInput, setCustomBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [nextBarcodePreview, setNextBarcodePreview] = useState("00001");
  const [saveMode, setSaveMode] = useState<"close" | "addAnother">("close");
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");

  // Bulk state
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkParsed, setBulkParsed] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const licenseId = typeof window !== "undefined" ? getActiveLicenseId() : "";

  const nameRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLButtonElement>(null);
  const unitRef = useRef<HTMLButtonElement>(null);
  const taxRef = useRef<HTMLButtonElement>(null);
  const categoryRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (!isOpen) {
      setBulkText("");
      setBulkRows([]);
      setBulkParsed(false);
      setBulkDone(false);
      setActiveTab("single");
    }
  }, [isOpen]);

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
    if (!res?.success) {
      setBarcodeEntries([]);
      return;
    }
    const entries: BarcodeEntry[] = (res.rows || [])
      .filter((b: any) => String(b.barcode ?? "").trim() !== "")
      .map((b: any) => ({
        id: b.id,
        barcode: String(b.barcode).trim(),
        isGenerated: /^\d{5}$/.test(String(b.barcode).trim()),
        saved: true,
        batchId: b.id,
      }));
    setBarcodeEntries(entries);
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
    if (!licenseId) {
      setBarcodeError("No active license found");
      return;
    }
    const res = await platform.reserveBarcodes?.(licenseId, 1);
    if (!res?.success || !res.barcodes?.[0]) {
      setBarcodeError("Failed to generate barcode");
      return;
    }
    const barcode = res.barcodes[0];
    if (barcodeEntries.some((e) => e.barcode === barcode)) {
      setBarcodeError("Barcode already in the list");
      return;
    }
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
        showToast("error", res?.error || "Failed to delete barcode.");
        return;
      }
    }
    setBarcodeEntries((prev) => prev.filter((e) => e.id !== entry.id));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!licenseId)
        throw new Error("No active license found. Login again before saving.");
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Product name is required");
      const parsedCostPrice = costPrice ? parseFloat(costPrice) : 0;
      const parsedSalePrice = salePrice ? parseFloat(salePrice) : null;
      if (Number.isNaN(parsedCostPrice) || parsedCostPrice < 0)
        throw new Error("Invalid cost price");
      if (
        parsedSalePrice !== null &&
        (Number.isNaN(parsedSalePrice) || parsedSalePrice < 0)
      )
        throw new Error("Invalid sale price");
      const seen = new Set<string>();
      for (const entry of barcodeEntries) {
        const value = entry.barcode.trim();
        if (!value) continue;
        if (seen.has(value))
          throw new Error(`Duplicate barcode in form: ${value}`);
        seen.add(value);
      }
      const productData: ProductInput = {
        licenseId,
        code,
        codeNumber: parseInt(code, 10),
        name: trimmedName,
        brand: brand.trim() || null,
        category: category.trim() || null,
        unit,
        tax,
        hsn: hsn.trim() || null,
        costPrice: parsedCostPrice,
        salePrice: parsedSalePrice,
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
        productId = result.productId || "";
      }
      if (!productId) throw new Error("Product id missing after save");
      for (const entry of barcodeEntries) {
        const value = entry.barcode.trim();
        if (entry.saved || !value) continue;
        const bcResult = await platform.createBarcodeForProduct?.({
          licenseId,
          productId,
          barcode: value,
          useGenerated: false,
          costPrice: parsedCostPrice,
          salePrice: parsedSalePrice,
        });
        if (!bcResult?.success)
          throw new Error(bcResult?.error || `Failed to save barcode ${value}`);
      }
      showToast(
        "success",
        `Product ${editProduct ? "updated" : "created"} successfully.`,
      );
      onSuccess();

      if (!editProduct && saveMode === "addAnother") {
        resetForm();
        const nextCode = await platform.getNextCode(licenseId);
        setCode(nextCode);
        await loadNextBarcodePreview();
        requestAnimationFrame(() => nameRef.current?.focus());
        return;
      }

      onClose();
    } catch (error: any) {
      showToast("error", error?.message || "Failed to save product.");
    }
  };

  // ── Bulk Helpers ────────────────────────────────────────────────────────
  function parseBulkText(text: string): BulkRow[] {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return [];
    const firstLine = lines[0].toLowerCase();
    const startIdx = firstLine.includes("name") ? 1 : 0;
    const rows: BulkRow[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const [rName, rBrand, rCategory, rUnit, rTax, rHsn, rCost, rSale] = cols;
      if (!rName) continue;
      const validUnits: UnitCode[] = ["NOS", "KG", "LTR", "MTR"];
      const validTaxes: TaxCode[] = ["NT", "P5", "P12", "P18", "P28"];
      const unitVal = validUnits.includes(rUnit?.toUpperCase() as UnitCode)
        ? (rUnit.toUpperCase() as UnitCode)
        : "NOS";
      const taxVal = validTaxes.includes(rTax?.toUpperCase() as TaxCode)
        ? (rTax.toUpperCase() as TaxCode)
        : "NT";
      rows.push({
        name: rName,
        brand: rBrand || undefined,
        category: rCategory || undefined,
        unit: unitVal,
        tax: taxVal,
        hsn: rHsn || undefined,
        costPrice: parseFloat(rCost) || 0,
        salePrice: rSale ? parseFloat(rSale) : undefined,
        _status: "pending",
      });
    }
    return rows;
  }

  function handleBulkParse() {
    const rows = parseBulkText(bulkText);
    setBulkRows(rows);
    setBulkParsed(true);
    setBulkDone(false);
  }

  async function handleBulkSave() {
    setBulkSaving(true);
    const updated = [...bulkRows];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i]._status === "success") continue;
      try {
        const nextCode = await platform.getNextCode(licenseId);
        const productData: ProductInput = {
          licenseId,
          code: nextCode,
          codeNumber: parseInt(nextCode, 10),
          name: updated[i].name,
          brand: updated[i].brand || null,
          category: updated[i].category || null,
          unit: updated[i].unit,
          tax: updated[i].tax,
          hsn: updated[i].hsn || null,
          costPrice: updated[i].costPrice,
          salePrice: updated[i].salePrice ?? null,
        };
        const result = await platform.createProduct(productData);
        if (!result?.success) throw new Error(result?.error || "Create failed");
        updated[i] = { ...updated[i], _status: "success", _error: undefined };
      } catch (err: any) {
        updated[i] = {
          ...updated[i],
          _status: "error",
          _error: err?.message || "Failed",
        };
      }
      setBulkRows([...updated]);
    }
    setBulkSaving(false);
    setBulkDone(true);
    onSuccess();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBulkText((ev.target?.result as string) || "");
      setBulkParsed(false);
      setBulkDone(false);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

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
      <div
        className="w-full sm:max-w-2xl sm:rounded-[24px] rounded-t-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.97))] shadow-[0_-10px_60px_rgba(3,10,24,0.18)] backdrop-blur overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header (fixed, compact) ── */}
        <div className="relative overflow-hidden rounded-t-[24px] bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-4 py-3.5 text-white shrink-0">
          <div className="pointer-events-none absolute -left-6 top-0 h-16 w-16 rounded-full bg-cyan-400/15 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full bg-fuchsia-500/15 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
              <span className="kyn-brand-pill shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/80 whitespace-nowrap">
                {editProduct ? "Edit Item" : "New Item"}
              </span>

              <h2 className="text-sm font-semibold tracking-[-0.02em] text-white truncate">
                {editProduct ? "Update product" : "Add to catalog"}
              </h2>

              <span className="hidden sm:inline-flex items-center rounded-lg bg-white/10 border border-white/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-white/70 tracking-wider">
                #{code}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Tab switcher ── */}
        {!editProduct && (
          <div className="shrink-0 flex gap-1 border-b border-slate-100 bg-white/60 px-4 pt-2 pb-0">
            {(["single", "bulk"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-slate-900 text-slate-900 bg-white"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab === "single" ? "Single Item" : "Bulk Add"}
              </button>
            ))}
          </div>
        )}

        {/* ── Scrollable body ── */}
        {activeTab === "single" ? (
          <form
            id="product-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-4 space-y-3.5 no-scrollbar"
          >
            {/* Item Code — mobile only */}
            <div className="sm:hidden flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Item Code
              </span>
              <span className="font-mono text-sm font-semibold text-slate-500">
                #{code}
              </span>
            </div>

            {/* Name + Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <SearchableDropdown
                  ref={brandRef}
                  value={brand}
                  onChange={setBrand}
                  options={existingBrands.map((b) => ({ value: b, label: b }))}
                  placeholder="Enter or pick brand"
                  allowCustom
                  autoOpenOnFocus={false}
                  onEnter={(dir) => {
                    if (dir === -1) {
                      inputRefs[IDX.NAME].current?.focus();
                    } else {
                      inputRefs[IDX.UNIT].current?.focus();
                    }
                  }}
                />
              </div>
            </div>

            {/* Unit + Tax */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  Unit <span className="text-rose-400">*</span>
                </label>
                <Dropdown
                  ref={unitRef}
                  value={unit}
                  onChange={(value) => setUnit(value as UnitCode)}
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
                  onChange={(value) => setTax(value as TaxCode)}
                  options={taxOptions}
                  placeholder="Select tax"
                  onEnter={() => inputRefs[IDX.CATEGORY].current?.focus()}
                  required
                />
              </div>
            </div>

            {/* Category + HSN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Category</label>
                <SearchableDropdown
                  ref={categoryRef}
                  value={category}
                  onChange={setCategory}
                  options={existingCategories.map((c) => ({
                    value: c,
                    label: c,
                  }))}
                  placeholder="Enter or pick category"
                  allowCustom
                  autoOpenOnFocus={false}
                  onEnter={(dir) => {
                    if (dir === -1) {
                      inputRefs[IDX.TAX].current?.focus();
                    } else {
                      inputRefs[IDX.HSN].current?.focus();
                    }
                  }}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  Cost Price <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
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
                    className={`${fieldClass} pl-7`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Sale Price</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
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
                    className={`${fieldClass} pl-7`}
                  />
                </div>
              </div>
            </div>

            {/* Barcode section */}
            <div className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg kyn-brand-chip">
                  <Tag className="h-3 w-3 text-slate-700" />
                </div>
                <span className="text-xs font-semibold text-slate-800">
                  Barcodes
                </span>
                <span className="text-[10px] text-slate-400">
                  — each = a batch
                </span>
              </div>

              {barcodeEntries.length > 0 && (
                <div className="space-y-1.5">
                  {barcodeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5"
                    >
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${entry.isGenerated ? "bg-cyan-100 text-cyan-800" : "bg-fuchsia-100 text-fuchsia-800"}`}
                      >
                        {entry.barcode}
                      </span>
                      {entry.isGenerated && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Zap className="h-2.5 w-2.5" /> generated
                        </span>
                      )}
                      {entry.saved && (
                        <span className="ml-auto mr-1 text-[10px] text-emerald-600">
                          saved
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeBarcode(entry)}
                        className="ml-auto flex h-5 w-5 items-center justify-center rounded-md text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addGeneratedBarcode}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-cyan-700"
                >
                  <Zap className="h-3 w-3" /> Reserve {nextBarcodePreview}
                </button>
                <div className="flex flex-1 min-w-[160px] items-center gap-1.5">
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
                    className="h-7 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
                  />
                  <button
                    type="button"
                    onClick={addCustomBarcode}
                    className="inline-flex h-7 items-center gap-1 rounded-xl bg-slate-800 px-2.5 text-[11px] font-semibold text-white transition hover:bg-slate-700"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
              </div>

              {barcodeError && (
                <p className="text-[11px] font-medium text-rose-500">
                  {barcodeError}
                </p>
              )}
              {barcodeEntries.length === 0 && (
                <p className="text-[11px] italic text-slate-400">
                  No barcodes added. On purchase, the next available barcode
                  will be suggested.
                </p>
              )}
            </div>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-4 space-y-4 no-scrollbar">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                CSV Format
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-slate-600">
                {BULK_FORMAT}
              </pre>
              <p className="mt-2 text-[11px] text-slate-400">
                Units: NOS / KG / LTR / MTR · Tax: NT / P5 / P12 / P18 / P28
              </p>
            </div>
            <div>
              <label className={labelClass}>Paste CSV data</label>
              <textarea
                value={bulkText}
                onChange={(e) => {
                  setBulkText(e.target.value);
                  setBulkParsed(false);
                  setBulkDone(false);
                }}
                rows={6}
                placeholder={BULK_FORMAT}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-mono text-slate-800 outline-none placeholder:text-slate-300 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10 resize-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" /> Upload CSV File
              </button>
              <button
                type="button"
                onClick={handleBulkParse}
                disabled={!bulkText.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
              >
                <ClipboardPaste className="h-4 w-4" /> Preview
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            {bulkParsed && bulkRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">
                    {bulkRows.length} products to import
                  </p>
                  {bulkDone && (
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-emerald-600">
                        {bulkRows.filter((r) => r._status === "success").length}{" "}
                        saved
                      </span>
                      {bulkRows.some((r) => r._status === "error") && (
                        <span className="ml-2 font-semibold text-rose-500">
                          {bulkRows.filter((r) => r._status === "error").length}{" "}
                          failed
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[500px] text-xs">
                    <thead className="bg-[#1e3a5f]">
                      <tr>
                        {[
                          "Name",
                          "Brand",
                          "Category",
                          "Unit",
                          "Tax",
                          "Cost",
                          "Sale",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-white/80"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkRows.map((r, i) => (
                        <tr
                          key={i}
                          className={
                            r._status === "success"
                              ? "bg-emerald-50"
                              : r._status === "error"
                                ? "bg-rose-50"
                                : "bg-white"
                          }
                        >
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {r.name}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {r.brand || "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {r.category || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700">
                              {r.unit}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{r.tax}</td>
                          <td className="px-3 py-2 text-slate-700">
                            ₹{r.costPrice}
                          </td>
                          <td className="px-3 py-2 text-emerald-600">
                            {r.salePrice ? `₹${r.salePrice}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r._status === "success" && (
                              <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                            )}
                            {r._status === "error" && (
                              <span title={r._error}>
                                <AlertCircle className="mx-auto h-3.5 w-3.5 text-rose-500" />
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!bulkDone && (
                  <button
                    type="button"
                    disabled={bulkSaving}
                    onClick={handleBulkSave}
                    className="w-full rounded-2xl bg-[#1e3a5f] py-3 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(15,23,42,0.18)] transition hover:bg-[#16304f] disabled:opacity-50"
                  >
                    {bulkSaving
                      ? `Importing… ${bulkRows.filter((r) => r._status === "success").length}/${bulkRows.length}`
                      : `Import ${bulkRows.length} Products`}
                  </button>
                )}
                {bulkDone && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Done — Close
                  </button>
                )}
              </div>
            )}
            {bulkParsed && bulkRows.length === 0 && (
              <p className="text-sm font-medium text-rose-500">
                No valid rows found. Check your format.
              </p>
            )}
          </div>
        )}

        {/* ── Footer (fixed, compact) ── */}
        {activeTab === "single" && (
          <div className="shrink-0 border-t border-slate-100 bg-white/80 backdrop-blur px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
              >
                Cancel
              </button>

              {!editProduct && (
                <button
                  type="submit"
                  form="product-form"
                  onClick={() => setSaveMode("addAnother")}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
                >
                  Save & Add Another
                </button>
              )}

              <button
                type="submit"
                form="product-form"
                onClick={() => setSaveMode("close")}
                className="flex-1 rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 active:scale-[0.98]"
              >
                {editProduct ? "Update Item" : "Save Item"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
