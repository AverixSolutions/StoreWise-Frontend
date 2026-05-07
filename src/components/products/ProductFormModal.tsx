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
  Sparkles,
} from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import type {
  ProductInput,
  ProductSummary,
  ProductImagePayload,
  UnitCode,
  TaxCode,
  CategoryRecord,
} from "@/platform/types";
import { useToast } from "../ui/ToastProvider";
import { uploadProductImage } from "@/lib/uploadImage";
import { getActiveToken } from "@/lib/session/runtimeSession";

type Product = ProductSummary;

interface BarcodeEntry {
  id: string;
  barcode: string;
  isGenerated: boolean;
  saved: boolean;
  batchId?: string;
}

interface BulkRow {
  shortCode?: string;
  name: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  productName?: string;
  model?: string;
  size?: string;
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
  categoryRecords?: CategoryRecord[];
}

// ── Picker option type ───────────────────────────────────────────────────────

type PickerOption = {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  isSubcategory: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildPickerOptions(categories: CategoryRecord[]): PickerOption[] {
  const childIds = new Set(
    categories.filter((c) => c.parentId).map((c) => c.parentId!),
  );

  const standalone = categories
    .filter((c) => !c.parentId && !childIds.has(c.id))
    .map(
      (c): PickerOption => ({
        id: c.id,
        name: c.name,
        parentId: null,
        parentName: null,
        isSubcategory: false,
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const subcats = categories
    .filter((c) => c.parentId)
    .map((c): PickerOption => {
      const parent = categories.find((p) => p.id === c.parentId);
      return {
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        parentName: parent?.name ?? "",
        isSubcategory: true,
      };
    })
    .sort(
      (a, b) =>
        (a.parentName ?? "").localeCompare(b.parentName ?? "") ||
        a.name.localeCompare(b.name),
    );

  return [...standalone, ...subcats];
}

function buildAutoName(
  brand: string,
  productName: string,
  model: string,
  size: string,
): string {
  return [brand, productName, model, size]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}

function fileToProductImagePayload(file: File): Promise<{
  payload: ProductImagePayload;
  previewUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowed.includes(file.type)) {
      reject(new Error("Only JPG, PNG, and WEBP images are allowed"));
      return;
    }

    const maxSizeMb = 3;
    if (file.size > maxSizeMb * 1024 * 1024) {
      reject(new Error(`Image must be below ${maxSizeMb}MB`));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.split(",")[1];

      if (!base64) {
        reject(new Error("Failed to read image"));
        return;
      }

      resolve({
        previewUrl: dataUrl,
        payload: {
          base64,
          mimeType: file.type as ProductImagePayload["mimeType"],
          fileName: file.name,
        },
      });
    };

    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10";

const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400";

const BULK_FORMAT = `shortCode,category,subcategory,brand,productName,model,size,name,unit,tax,hsn,costPrice,salePrice
APL,Electronics,Smartphones,Apple,iPhone,14 Pro,128GB,Apple iPhone 14 Pro 128GB,NOS,P18,8517,75000,89999
MILK,Dairy,,Amul,Milk,,500ml,Amul Milk 500ml,NOS,P5,0401,28,32`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  editProduct,
  existingCategories = [],
  existingBrands = [],
  categoryRecords = [],
}: ProductFormModalProps) {
  const { showToast } = useToast();

  // ── Basic product fields ──
  const [code, setCode] = useState<string>("00001");
  const [shortCode, setShortCode] = useState("");
  const [productImage, setProductImage] = useState<ProductImagePayload | null>(
    null,
  );
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [size, setSize] = useState("");
  const [name, setName] = useState(""); // auto-generated item name
  const [nameAutoMode, setNameAutoMode] = useState(true);

  // ── Category / subcategory ──
  const [allCategories, setAllCategories] =
    useState<CategoryRecord[]>(categoryRecords);
  const [, setPickerSelectedId] = useState<string>("");
  const [category, setCategory] = useState(""); // parent category string (derived)
  const [subcategory, setSubcategory] = useState(""); // subcategory string (derived)

  const [unitOptions, setUnitOptions] = useState<
    { value: string; label: string }[]
  >([
    { value: "NOS", label: "Numbers (NOS)" },
    { value: "KG", label: "Kilograms (KG)" },
    { value: "LTR", label: "Liters (LTR)" },
    { value: "MTR", label: "Meters (MTR)" },
  ]);

  // ── Other product fields ──
  const [unit, setUnit] = useState<UnitCode>("NOS");
  const [tax, setTax] = useState<TaxCode>("P5");
  const [hsn, setHsn] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");

  // ── Barcode state ──
  const [barcodeEntries, setBarcodeEntries] = useState<BarcodeEntry[]>([]);
  const [customBarcodeInput, setCustomBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [nextBarcodePreview, setNextBarcodePreview] = useState("00001");

  const [saveMode, setSaveMode] = useState<"close" | "addAnother">("close");
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");

  // ── Bulk state ──
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkParsed, setBulkParsed] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);

  const licenseId = typeof window !== "undefined" ? getActiveLicenseId() : "";

  // ── Refs ──
  const categoryRef = useRef<HTMLButtonElement>(null);
  const subcategoryDropdownRef = useRef<HTMLButtonElement>(null);
  const subcategoryInputRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLButtonElement>(null);
  const productNameRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const sizeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const shortCodeRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLButtonElement>(null);
  const taxRef = useRef<HTMLButtonElement>(null);
  const hsnRef = useRef<HTMLInputElement>(null);
  const costRef = useRef<HTMLInputElement>(null);
  const saleRef = useRef<HTMLInputElement>(null);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const IDX = {
    CATEGORY: 0,
    SUBCATEGORY: 1,
    BRAND: 2,
    PRODUCT_NAME: 3,
    MODEL: 4,
    SIZE: 5,
    NAME: 6,
    SHORT_CODE: 7,
    UNIT: 8,
    TAX: 9,
    HSN: 10,
    COST: 11,
    SALE: 12,
  } as const;

  const LAST_FIELD_INDEX = IDX.SALE;

  function getFocusTarget(index: number): HTMLElement | null {
    switch (index) {
      case IDX.CATEGORY:
        return categoryRef.current;
      case IDX.SUBCATEGORY:
        return subcategoryDropdownRef.current ?? subcategoryInputRef.current;
      case IDX.BRAND:
        return brandRef.current;
      case IDX.PRODUCT_NAME:
        return productNameRef.current;
      case IDX.MODEL:
        return modelRef.current;
      case IDX.SIZE:
        return sizeRef.current;
      case IDX.NAME:
        return nameRef.current;
      case IDX.SHORT_CODE:
        return shortCodeRef.current;
      case IDX.UNIT:
        return unitRef.current;
      case IDX.TAX:
        return taxRef.current;
      case IDX.HSN:
        return hsnRef.current;
      case IDX.COST:
        return costRef.current;
      case IDX.SALE:
        return saleRef.current;
      default:
        return null;
    }
  }

  function focusField(index: number) {
    window.setTimeout(() => {
      const target = getFocusTarget(index);
      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });

      window.setTimeout(() => {
        target.focus({ preventScroll: true });
      }, 80);
    }, 0);
  }

  function focusNext(index: number) {
    if (index >= LAST_FIELD_INDEX) {
      const form = document.getElementById(
        "product-form",
      ) as HTMLFormElement | null;
      form?.requestSubmit();
      return;
    }

    focusField(index + 1);
  }

  function focusPrev(index: number) {
    if (index <= IDX.CATEGORY) {
      focusField(IDX.CATEGORY);
      return;
    }

    focusField(index - 1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>, index: number) {
    if (e.key !== "Enter" && e.key !== "Tab") return;

    e.preventDefault();

    if (e.shiftKey) {
      focusPrev(index);
    } else {
      focusNext(index);
    }
  }

  // ── Ctrl/Cmd + S shortcut ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || activeTab !== "single") return;
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const form = document.getElementById(
          "product-form",
        ) as HTMLFormElement | null;
        form?.requestSubmit();
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, activeTab]);

  // ── Picker options derived from categories ──
  const pickerOptions = buildPickerOptions(allCategories);

  const hasCategoryMaster = allCategories.length > 0;

  const parentCategoryOptions = allCategories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const matchedTypedParent =
    parentCategoryOptions.find(
      (row) => normalizeText(row.name) === normalizeText(category),
    ) ?? null;

  const subcategoryOptionsForTypedParent = matchedTypedParent
    ? allCategories
        .filter((row) => row.parentId === matchedTypedParent.id)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const typedCategoryHasChildren = subcategoryOptionsForTypedParent.length > 0;

  // ── Auto-generate name ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!nameAutoMode) return;
    const generated = buildAutoName(brand, productName, model, size);
    setName(generated);
  }, [brand, productName, model, size, nameAutoMode]);

  // ── Category picker handler ──────────────────────────────────────────────────

  // ── Load categories on open ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || !licenseId) return;

    platform
      .listCategories(licenseId)
      .then((res) => {
        if (res.success) setAllCategories(res.rows);
      })
      .catch(() => {});

    // Load dynamic units
    platform
      .listUnits?.(licenseId)
      .then((res) => {
        if (res?.success && res.rows.length > 0) {
          setUnitOptions(
            res.rows.map((u) => ({
              value: u.code,
              label: `${u.label} (${u.code})`,
            })),
          );
        }
      })
      .catch(() => {});
  }, [isOpen, licenseId]);

  // ── Sync prop categories ────────────────────────────────────────────────────

  useEffect(() => {
    if (categoryRecords.length > 0) setAllCategories(categoryRecords);
  }, [categoryRecords]);

  // ── Open / edit setup ───────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => categoryRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    loadNextBarcodePreview();

    if (editProduct) {
      const initialProductName = editProduct.productName ?? "";
      const initialBrand = editProduct.brand ?? "";
      const initialModel = editProduct.model ?? "";
      const initialSize = editProduct.size ?? "";
      const generatedExistingName = buildAutoName(
        initialBrand,
        initialProductName,
        initialModel,
        initialSize,
      );

      setCode(editProduct.code);
      setShortCode(editProduct.shortCode ?? "");
      setProductName(initialProductName);
      setBrand(initialBrand);
      setModel(initialModel);
      setSize(initialSize);
      setName(editProduct.name);
      setNameAutoMode(editProduct.name.trim() === generatedExistingName.trim());

      // Restore category/subcategory
      restorePickerFromStrings(
        editProduct.category ?? "",
        editProduct.subcategory ?? "",
        pickerOptions,
      );

      setUnit(editProduct.unit);
      setTax(editProduct.tax);
      setHsn(editProduct.hsn ?? "");
      setCostPrice(editProduct.costPrice.toString());
      setSalePrice(editProduct.salePrice?.toString() ?? "");
      loadExistingBarcodes(editProduct.id);
      loadExistingProductImage(editProduct.id);
    } else {
      resetForm();
      platform
        .getNextCode(licenseId)
        .then((nextCode: string) => setCode(nextCode));
    }
  }, [isOpen, editProduct]);

  // When categories load, re-apply picker for edit mode
  useEffect(() => {
    if (!isOpen || !editProduct || allCategories.length === 0) return;
    const opts = buildPickerOptions(allCategories);
    restorePickerFromStrings(
      editProduct.category ?? "",
      editProduct.subcategory ?? "",
      opts,
    );
  }, [allCategories, isOpen, editProduct]);

  useEffect(() => {
    if (!isOpen) {
      setBulkText("");
      setBulkRows([]);
      setBulkParsed(false);
      setBulkDone(false);
      setActiveTab("single");
    }
  }, [isOpen]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function restorePickerFromStrings(
    catStr: string,
    subStr: string,
    opts: PickerOption[],
  ) {
    if (subStr) {
      const match = opts.find(
        (o) => o.isSubcategory && o.name === subStr && o.parentName === catStr,
      );
      if (match) {
        setPickerSelectedId(match.id);
      } else {
        setPickerSelectedId("");
      }
      setCategory(catStr);
      setSubcategory(subStr);
    } else if (catStr) {
      const match = opts.find((o) => !o.isSubcategory && o.name === catStr);
      if (match) {
        setPickerSelectedId(match.id);
      } else {
        setPickerSelectedId("");
      }
      setCategory(catStr);
      setSubcategory("");
    } else {
      setPickerSelectedId("");
      setCategory("");
      setSubcategory("");
    }
  }

  function normalizeText(value?: string | null) {
    return (value ?? "").trim().toLowerCase();
  }

  // ── Image helpers ─────────────────────────────────────────────────────────

  async function loadExistingProductImage(productId: string) {
    try {
      const dataUrl = await platform.getProductImageDataUrl?.(productId);
      setImagePreviewUrl(dataUrl || null);
      setProductImage(null);
      setImageError(null);
    } catch {
      setImagePreviewUrl(null);
      setProductImage(null);
    }
  }

  async function handleProductImageChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setImageError("Only JPG, PNG, and WEBP images are allowed");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setImageError("Image must be below 3MB");
      return;
    }

    setImageError(null);
    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file)); // instant local preview
  }

  function clearProductImageSelection() {
    setSelectedFile(null);
    setProductImage(null);
    setImagePreviewUrl(null);
    setImageError(null);
  }

  // ── Brand / Category master helpers ──────────────────────────────────────────

  async function ensureBrandMaster(brandName?: string | null) {
    const trimmedBrand = brandName?.trim();
    if (!trimmedBrand) return;

    const brandList = await platform.listBrands(licenseId);
    if (!brandList.success) {
      throw new Error(brandList.error || "Failed to load brand master");
    }

    const exists = brandList.rows.some(
      (row) => normalizeText(row.name) === normalizeText(trimmedBrand),
    );

    if (exists) return;

    const saved = await platform.saveBrand({
      licenseId,
      name: trimmedBrand,
    });

    if (!saved.success) {
      throw new Error(saved.error || "Failed to save brand to master");
    }
  }

  async function ensureCategoryMaster(
    categoryName?: string | null,
    subcategoryName?: string | null,
  ) {
    const trimmedCategory = categoryName?.trim();
    const trimmedSubcategory = subcategoryName?.trim();

    if (!trimmedCategory) return;

    let categoryList = await platform.listCategories(licenseId);
    if (!categoryList.success) {
      throw new Error(categoryList.error || "Failed to load category master");
    }

    let rows = categoryList.rows;

    let parent = rows.find(
      (row) =>
        !row.parentId &&
        normalizeText(row.name) === normalizeText(trimmedCategory),
    );

    if (!parent) {
      const savedParent = await platform.saveCategory({
        licenseId,
        name: trimmedCategory,
        parentId: null,
      });

      if (!savedParent.success) {
        throw new Error(
          savedParent.error || "Failed to save category to master",
        );
      }

      categoryList = await platform.listCategories(licenseId);
      if (!categoryList.success) {
        throw new Error(
          categoryList.error || "Failed to refresh category master",
        );
      }

      rows = categoryList.rows;
      parent = rows.find(
        (row) =>
          !row.parentId &&
          normalizeText(row.name) === normalizeText(trimmedCategory),
      );

      if (!parent) {
        throw new Error("Saved category could not be resolved");
      }
    }

    if (trimmedSubcategory) {
      const child = rows.find(
        (row) =>
          row.parentId === parent!.id &&
          normalizeText(row.name) === normalizeText(trimmedSubcategory),
      );

      if (!child) {
        const savedChild = await platform.saveCategory({
          licenseId,
          name: trimmedSubcategory,
          parentId: parent.id,
        });

        if (!savedChild.success) {
          throw new Error(
            savedChild.error || "Failed to save subcategory to master",
          );
        }

        const refreshed = await platform.listCategories(licenseId);
        if (refreshed.success) {
          setAllCategories(refreshed.rows);
        }
        return;
      }
    }

    setAllCategories(rows);
  }

  async function ensureMastersForProduct(values: {
    brand?: string | null;
    category?: string | null;
    subcategory?: string | null;
  }) {
    await ensureBrandMaster(values.brand);
    await ensureCategoryMaster(values.category, values.subcategory);
  }

  function resolveBulkCategorySelection(row: BulkRow): {
    category: string | null;
    subcategory: string | null;
    error?: string;
  } {
    const rawCategory = row.category?.trim() ?? "";
    const rawSubcategory = row.subcategory?.trim() ?? "";

    if (!rawCategory) {
      return {
        category: null,
        subcategory: null,
        error: "Category is required",
      };
    }

    if (!hasCategoryMaster) {
      return {
        category: rawCategory,
        subcategory: rawSubcategory || null,
      };
    }

    const parents = allCategories.filter((c) => !c.parentId);
    const children = allCategories.filter((c) => !!c.parentId);

    const matchedParent =
      parents.find(
        (parent) => normalizeText(parent.name) === normalizeText(rawCategory),
      ) ?? null;

    if (!matchedParent) {
      return {
        category: rawCategory,
        subcategory: rawSubcategory || null,
      };
    }

    const existingChildren = children.filter(
      (child) => child.parentId === matchedParent.id,
    );

    if (existingChildren.length > 0) {
      if (!rawSubcategory) {
        return {
          category: null,
          subcategory: null,
          error: `Subcategory is required for ${matchedParent.name}`,
        };
      }

      const matchedChild = existingChildren.find(
        (child) => normalizeText(child.name) === normalizeText(rawSubcategory),
      );

      if (matchedChild) {
        return {
          category: matchedParent.name,
          subcategory: matchedChild.name,
        };
      }

      return {
        category: matchedParent.name,
        subcategory: rawSubcategory,
      };
    }

    return {
      category: matchedParent.name,
      subcategory: rawSubcategory || null,
    };
  }

  async function loadNextBarcodePreview() {
    try {
      const res = await platform.peekNextBarcode?.(licenseId);
      setNextBarcodePreview(res?.barcode ?? "00001");
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
    setShortCode("");
    setProductImage(null);
    setImagePreviewUrl(null);
    setImageError(null);
    setProductName("");
    setBrand("");
    setModel("");
    setSize("");
    setName("");
    setNameAutoMode(true);
    setPickerSelectedId("");
    setCategory("");
    setSubcategory("");
    setUnit("NOS");
    setTax("P5");
    setHsn("");
    setCostPrice("");
    setSalePrice("");
    setBarcodeEntries([]);
    setCustomBarcodeInput("");
    setBarcodeError(null);
  }

  // ── Barcodes ──────────────────────────────────────────────────────────────────

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

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!licenseId) throw new Error("No active license found. Login again.");

      const trimmedProductName = productName.trim();
      const trimmedName = name.trim();
      const trimmedBrand = brand.trim();
      const trimmedCategory = category.trim();
      const trimmedSubcategory = subcategory.trim();
      const trimmedShortCode = shortCode.trim().toUpperCase();

      if (!trimmedName) throw new Error("Item name is required");

      if (!trimmedCategory) {
        throw new Error("Category is required");
      }

      if (
        hasCategoryMaster &&
        typedCategoryHasChildren &&
        !trimmedSubcategory
      ) {
        throw new Error(
          `Subcategory is required for ${matchedTypedParent?.name ?? trimmedCategory}`,
        );
      }

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

      await ensureMastersForProduct({
        brand: trimmedBrand || null,
        category: trimmedCategory || null,
        subcategory: trimmedSubcategory || null,
      });

      // ── Upload image to R2 if a new file was selected ──
      let imagePath: string | null = (editProduct as any)?.imagePath ?? null;
      if (selectedFile) {
        const token = getActiveToken();
        if (!token) throw new Error("Not authenticated");
        const { publicUrl } = await uploadProductImage(
          selectedFile,
          licenseId,
          token,
        );
        imagePath = publicUrl;
      }

      const productData: ProductInput = {
        licenseId,
        code,
        codeNumber: parseInt(code, 10),
        shortCode: trimmedShortCode || null,
        name: trimmedName,
        brand: trimmedBrand || null,
        category: trimmedCategory || null,
        subcategory: trimmedSubcategory || null,
        productName: trimmedProductName || null,
        model: model.trim() || null,
        size: size.trim() || null,
        unit,
        tax,
        hsn: hsn.trim() || null,
        costPrice: parsedCostPrice,
        salePrice: parsedSalePrice,
        imagePath, // ← R2 URL (or null)
        image: null, // ← base64 no longer used
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
        requestAnimationFrame(() => categoryRef.current?.focus());
        return;
      }

      onClose();
    } catch (error: any) {
      showToast("error", error?.message || "Failed to save product.");
    }
  };

  // ── Bulk helpers ──────────────────────────────────────────────────────────────

  function parseBulkText(text: string): BulkRow[] {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return [];
    const firstLine = lines[0].toLowerCase();
    // Detect if first line is a header (contains "shortcode" or "name" or "category")
    const startIdx =
      firstLine.includes("shortcode") ||
      firstLine.includes("name") ||
      firstLine.includes("category")
        ? 1
        : 0;
    const rows: BulkRow[] = [];
    const validUnitCodes = unitOptions.map((u) => u.value);
    const validTaxes: TaxCode[] = ["NT", "P5", "P12", "P18", "P28"];

    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      // New column order: shortCode,category,subcategory,brand,productName,model,size,name,unit,tax,hsn,costPrice,salePrice
      const [
        rShortCode,
        rCategory,
        rSubcategory,
        rBrand,
        rProductName,
        rModel,
        rSize,
        rName,
        rUnit,
        rTax,
        rHsn,
        rCost,
        rSale,
      ] = cols;

      // Require at least productName or name
      if (!rProductName && !rName) continue;

      const upperUnit = rUnit?.toUpperCase() ?? "";
      const unitVal = (
        validUnitCodes.includes(upperUnit) ? upperUnit : "NOS"
      ) as UnitCode;
      const taxVal = validTaxes.includes(rTax?.toUpperCase() as TaxCode)
        ? (rTax.toUpperCase() as TaxCode)
        : "NT";

      rows.push({
        shortCode: rShortCode ? rShortCode.toUpperCase() : undefined,
        name: rName || "",
        brand: rBrand || undefined,
        category: rCategory || undefined,
        subcategory: rSubcategory || undefined,
        productName: rProductName || undefined,
        model: rModel || undefined,
        size: rSize || undefined,
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
        const r = updated[i];

        const trimmedProductName = r.productName?.trim() ?? "";
        const generatedName = buildAutoName(
          r.brand ?? "",
          trimmedProductName,
          r.model ?? "",
          r.size ?? "",
        );
        const fallbackName = r.name?.trim() ?? "";
        const finalName = fallbackName || generatedName || trimmedProductName;

        if (!finalName) {
          throw new Error(`Row ${i + 1}: Item name could not be generated`);
        }

        const resolvedCategory = resolveBulkCategorySelection(r);
        if (resolvedCategory.error) {
          throw new Error(`Row ${i + 1}: ${resolvedCategory.error}`);
        }

        const trimmedBrand = r.brand?.trim() || null;
        const trimmedShortCode = r.shortCode?.trim().toUpperCase() || null;

        await ensureMastersForProduct({
          brand: trimmedBrand,
          category: resolvedCategory.category,
          subcategory: resolvedCategory.subcategory,
        });

        const productData: ProductInput = {
          licenseId,
          code: nextCode,
          codeNumber: parseInt(nextCode, 10),
          shortCode: trimmedShortCode,
          name: finalName,
          brand: trimmedBrand,
          category: resolvedCategory.category,
          subcategory: resolvedCategory.subcategory,
          productName: trimmedProductName || null,
          model: r.model?.trim() || null,
          size: r.size?.trim() || null,
          unit: r.unit,
          tax: r.tax,
          hsn: r.hsn?.trim() || null,
          costPrice: r.costPrice,
          salePrice: r.salePrice ?? null,
        };

        const result = await platform.createProduct(productData);
        if (!result?.success) {
          throw new Error(result?.error || "Create failed");
        }

        updated[i] = {
          ...updated[i],
          name: finalName,
          category: resolvedCategory.category ?? undefined,
          subcategory: resolvedCategory.subcategory ?? undefined,
          _status: "success",
          _error: undefined,
        };
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

    const successCount = updated.filter((r) => r._status === "success").length;
    if (successCount > 0) {
      onSuccess();
    } else {
      showToast("error", "No products were imported.");
    }
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        e.stopPropagation();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-2xl sm:rounded-[24px] rounded-t-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.97))] shadow-[0_-10px_60px_rgba(3,10,24,0.18)] backdrop-blur overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-4 py-3.5 text-white shrink-0">
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
            <button
              type="button"
              onClick={onClose}
              tabIndex={-1}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Tab switcher ── */}
        {!editProduct && (
          <div className="shrink-0 flex gap-1 border-b border-slate-100 bg-white/60 px-4 pt-2 pb-0">
            {(["single", "bulk"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                tabIndex={-1}
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

        {/* ── Single item form ── */}
        {activeTab === "single" ? (
          <form
            id="product-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto scroll-pt-24 scroll-pb-36 px-4 py-4 sm:px-5 sm:py-4 space-y-3.5 no-scrollbar"
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

            {/* ── Row 1: Category / Subcategory ── */}
            <div>
              {allCategories.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>
                        Category <span className="text-rose-400">*</span>
                      </label>
                      <SearchableDropdown
                        ref={categoryRef}
                        value={category}
                        onChange={(val) => {
                          const nextCategory = val ?? "";
                          const changed =
                            normalizeText(nextCategory) !==
                            normalizeText(category);

                          setCategory(nextCategory);
                          setPickerSelectedId("");

                          if (changed) {
                            setSubcategory("");
                          }
                        }}
                        options={parentCategoryOptions.map((row) => ({
                          value: row.name,
                          label: row.name,
                        }))}
                        placeholder="Pick or type category"
                        allowCustom
                        autoOpenOnFocus={false}
                        onEnter={(dir) => {
                          if (dir === -1) {
                            focusPrev(IDX.CATEGORY);
                          } else {
                            focusNext(IDX.CATEGORY);
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        Subcategory
                        {typedCategoryHasChildren && (
                          <span className="text-rose-400"> *</span>
                        )}
                      </label>
                      <SearchableDropdown
                        ref={subcategoryDropdownRef}
                        value={subcategory}
                        onChange={(val) => {
                          setSubcategory(val ?? "");
                          setPickerSelectedId("");
                        }}
                        options={subcategoryOptionsForTypedParent.map(
                          (row) => ({
                            value: row.name,
                            label: row.name,
                          }),
                        )}
                        placeholder={
                          typedCategoryHasChildren
                            ? "Pick or type subcategory"
                            : "Optional subcategory"
                        }
                        allowCustom
                        autoOpenOnFocus={false}
                        onEnter={(dir) => {
                          if (dir === -1) {
                            focusPrev(IDX.SUBCATEGORY);
                          } else {
                            focusNext(IDX.SUBCATEGORY);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {category && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Selected:
                      </span>
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {category}
                      </span>
                      {subcategory && (
                        <>
                          <span className="text-slate-300 text-[10px]">›</span>
                          <span className="rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                            {subcategory}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      Category <span className="text-rose-400">*</span>
                    </label>
                    <SearchableDropdown
                      ref={categoryRef}
                      value={category}
                      onChange={(val) => {
                        setCategory(val);
                        setSubcategory("");
                      }}
                      options={existingCategories.map((c) => ({
                        value: c,
                        label: c,
                      }))}
                      placeholder="Enter or pick category"
                      allowCustom
                      autoOpenOnFocus={false}
                      onEnter={(dir) => {
                        if (dir === -1) {
                          focusPrev(IDX.CATEGORY);
                        } else {
                          focusNext(IDX.CATEGORY);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Subcategory</label>
                    <input
                      ref={subcategoryInputRef}
                      type="text"
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, IDX.SUBCATEGORY)}
                      placeholder="Optional subcategory"
                      className={fieldClass}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Row 2: Brand + Product Name ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Brand</label>
                <SearchableDropdown
                  ref={brandRef}
                  value={brand}
                  onChange={setBrand}
                  options={existingBrands.map((b) => ({ value: b, label: b }))}
                  placeholder="e.g. Apple, Nike"
                  allowCustom
                  autoOpenOnFocus={false}
                  onEnter={(dir) => {
                    if (dir === -1) {
                      focusPrev(IDX.BRAND);
                    } else {
                      focusNext(IDX.BRAND);
                    }
                  }}
                />
              </div>

              <div>
                <label className={labelClass}>Product Name</label>
                <input
                  ref={productNameRef}
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, IDX.PRODUCT_NAME)}
                  placeholder="e.g. Toothpaste, iPhone"
                  className={fieldClass}
                />
              </div>
            </div>

            {/* ── Row 3: Model + Size ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Model / Variant</label>
                <input
                  ref={modelRef}
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, IDX.MODEL)}
                  placeholder="e.g. Pro, Mini, Ultra"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Size / Qty</label>
                <input
                  ref={sizeRef}
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, IDX.SIZE)}
                  placeholder="e.g. 500g, 60ml, 1L"
                  className={fieldClass}
                />
              </div>
            </div>

            {/* ── Row 4: Item Name ── */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className={labelClass}>
                  Item Name <span className="text-rose-400">*</span>
                </label>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setNameAutoMode(true);
                    const generated = buildAutoName(
                      brand,
                      productName,
                      model,
                      size,
                    );
                    setName(generated);
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition ${
                    nameAutoMode
                      ? "bg-cyan-100 text-cyan-700"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {nameAutoMode ? "Auto" : "Set Auto"}
                </button>
              </div>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameAutoMode(false);
                }}
                onKeyDown={(e) => handleKeyDown(e, IDX.NAME)}
                required
                placeholder="Auto-filled from Brand + Product + Model + Size"
                className={fieldClass}
              />
              {nameAutoMode && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Auto-generates from Brand · Product Name · Model · Size
                </p>
              )}
            </div>

            {/* ── Row 5: Short Code + Unit + Tax + Image ── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={labelClass}>Short Code</label>
                  <input
                    ref={shortCodeRef}
                    type="text"
                    value={shortCode}
                    onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => handleKeyDown(e, IDX.SHORT_CODE)}
                    placeholder="e.g. APL, MILK, RICE-5KG"
                    maxLength={24}
                    className={fieldClass}
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Easy billing/search code. Example: Apple = APL.
                  </p>
                </div>

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
                      onEnter={() => focusNext(IDX.UNIT)}
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
                      onEnter={() => focusNext(IDX.TAX)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Item Image</label>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => productImageInputRef.current?.click()}
                  className="group flex h-[116px] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 transition hover:border-cyan-300 hover:bg-cyan-50/40"
                >
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt="Product preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <Upload className="h-5 w-5" />
                      <span className="text-[10px] font-semibold">Upload</span>
                    </div>
                  )}
                </button>

                <input
                  ref={productImageInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handleProductImageChange}
                />

                {productImage && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={clearProductImageSelection}
                    className="mt-1 text-[10px] font-semibold text-rose-500 hover:text-rose-600"
                  >
                    Clear selected image
                  </button>
                )}

                {imageError && (
                  <p className="mt-1 text-[10px] font-medium text-rose-500">
                    {imageError}
                  </p>
                )}
              </div>
            </div>

            {/* ── Row 7: HSN ── */}
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

            {/* ── Row 8: Pricing ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Cost Price</label>
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
                    min="0"
                    step="1"
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
                    step="1"
                    placeholder="0.00"
                    className={`${fieldClass} pl-7`}
                  />
                </div>
              </div>
            </div>

            {/* ── Row 8: Barcodes ── */}
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
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                          entry.isGenerated
                            ? "bg-cyan-100 text-cyan-800"
                            : "bg-fuchsia-100 text-fuchsia-800"
                        }`}
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
                        tabIndex={-1}
                        onClick={() => removeBarcode(entry)}
                        className="ml-auto flex h-5 w-5 items-center justify-center rounded-md text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={addGeneratedBarcode}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-cyan-700 sm:h-auto sm:justify-start sm:px-2.5 sm:py-1.5"
                >
                  <Zap className="h-3 w-3" /> Reserve {nextBarcodePreview}
                </button>
                <div className="flex w-full items-center gap-1.5 sm:min-w-[160px] sm:flex-1">
                  <input
                    tabIndex={-1}
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
                    className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10 sm:h-7 sm:px-2.5"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={addCustomBarcode}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl bg-slate-800 px-3 text-[11px] font-semibold text-white transition hover:bg-slate-700 sm:h-7 sm:px-2.5"
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
          /* ── Bulk tab ── */
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-4 space-y-4 no-scrollbar">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                CSV Format
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-slate-600">
                {BULK_FORMAT}
              </pre>
              <p className="mt-2 text-[11px] text-slate-400">
                Units: {unitOptions.map((u) => u.value).join(" / ")} · Tax: NT /
                P5 / P12 / P18 / P28 · shortCode is optional
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

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:justify-start"
              >
                <Upload className="h-4 w-4" /> Upload CSV File
              </button>
              <button
                type="button"
                onClick={handleBulkParse}
                disabled={!bulkText.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40 sm:justify-start"
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

                {/* Mobile cards */}
                <div className="space-y-2 sm:hidden">
                  {bulkRows.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border px-3 py-3 ${
                        r._status === "success"
                          ? "border-emerald-200 bg-emerald-50"
                          : r._status === "error"
                            ? "border-rose-200 bg-rose-50"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {r.name || r.productName}
                          </p>
                          {r.shortCode && (
                            <span className="mt-0.5 inline-block rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                              {r.shortCode}
                            </span>
                          )}
                          <p className="mt-1 text-xs text-slate-500">
                            {[r.brand, r.category, r.subcategory]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {r._status === "success" && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                          {r._status === "error" && (
                            <AlertCircle className="h-4 w-4 text-rose-500" />
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                          <span className="block text-slate-400">Unit</span>
                          <span className="font-medium text-slate-700">
                            {r.unit}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                          <span className="block text-slate-400">Tax</span>
                          <span className="font-medium text-slate-700">
                            {r.tax}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                          <span className="block text-slate-400">Cost</span>
                          <span className="font-medium text-slate-700">
                            ₹{r.costPrice}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                          <span className="block text-slate-400">Sale</span>
                          <span className="font-medium text-emerald-600">
                            {r.salePrice ? `₹${r.salePrice}` : "—"}
                          </span>
                        </div>
                      </div>
                      {r._error && (
                        <p className="mt-2 text-[11px] text-rose-500">
                          {r._error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-xl border border-slate-200 sm:block">
                  <table className="w-full min-w-[600px] text-xs">
                    <thead className="bg-[#1e3a5f]">
                      <tr>
                        {[
                          "Short Code",
                          "Name",
                          "Brand",
                          "Category",
                          "Sub",
                          "Model",
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
                          <td className="px-3 py-2">
                            {r.shortCode ? (
                              <span className="rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-700">
                                {r.shortCode}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {r.name || r.productName}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {r.brand || "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {r.category || "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {r.subcategory || "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {r.model || r.size
                              ? [r.model, r.size].filter(Boolean).join(" / ")
                              : "—"}
                          </td>
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

        {/* ── Footer ── */}
        {activeTab === "single" && (
          <div className="shrink-0 border-t border-slate-100 bg-white/95 backdrop-blur px-4 pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                tabIndex={-1}
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
              >
                Cancel
              </button>
              {!editProduct && (
                <button
                  type="submit"
                  tabIndex={-1}
                  form="product-form"
                  onClick={() => setSaveMode("addAnother")}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
                >
                  Save & Add Another
                </button>
              )}
              <button
                type="submit"
                tabIndex={-1}
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
