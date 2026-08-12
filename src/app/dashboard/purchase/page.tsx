// src/app/dashboard/purchase/page.tsx
"use client";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import PurchaseNavigation from "@/components/purchase/PurchaseNavigation";
import BillDetailsSection from "@/components/purchase/BillDetailsSection";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import { focusCell } from "@/components/purchase/keyboardGrid";
import PurchaseEntrySettingsModal from "@/components/purchase/PurchaseEntrySettingsModal";
import {
  DEFAULT_PURCHASE_UI_SETTINGS,
  loadPurchaseUiSettings,
  savePurchaseUiSettings,
  type PurchaseUiSettings,
} from "@/components/purchase/purchaseUiSettings";
import SupplierFormModal from "@/components/suppliers/SupplierFormModal";
import HoldsModal from "@/components/purchase/HoldsModal";
import PurchaseReportsModal from "@/components/purchase/PurchaseReportsModal";
import BarcodeSelectModal from "@/components/purchase/BarcodeSelectModal";
import PromptModal from "@/components/ui/PromptModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ValidationModal from "@/components/ui/ValidationModal";
import {
  HeaderForm,
  ItemRow,
  Product,
} from "@/components/purchase/types";
import {
  createEmptyRow,
  calcRow,
  validatePurchaseBill,
  mapItems,
  round2,
  headerFromPurchaseDb,
  rowsFromDbItems,
  mergeIdenticalPurchaseRows,
} from "@/components/purchase/utils";
import BarcodePrintCenterButton from "@/components/barcodes/BarcodePrintCenterButton";
import type { PrintCenterItemRow } from "@/lib/barcode/printCenterTypes";
import { printPurchaseBill } from "@/lib/print/printPurchaseBill";
import { platform } from "@/platform";
import { canUseBarcode } from "@/lib/session/runtimeSession";
import { isSyncEnabled } from "@/platform/mode";
import { SyncManager } from "@/sync/SyncManager";
import { useSyncStatus } from "@/sync/SyncProvider";
import ProductFormModal from "@/components/products/ProductFormModal";
import type { CategoryRecord, RateTypeRecord } from "@/platform/types";
import {
  findDefaultRateType,
  orderActiveRateTypes,
  resolveNamedRate,
} from "@/lib/rates/rateResolution";

function normalizeHeaderFromHold(
  saved: Partial<HeaderForm>,
  suppliers: Array<{ id: string; name: string }>,
): HeaderForm {
  const defaults: HeaderForm = {
    billNo: "",
    supplier: null,
    department: "",
    debitAccount: "",
    natureOfEntry: "",
    purchaseDate: new Date().toISOString(),
    entryTime: new Date().toISOString(),
    discount: 0,
    purchaseType: "CREDIT",
  };

  let supplier: HeaderForm["supplier"] = null;
  const raw = (saved as any)?.supplier;
  if (raw) {
    if (typeof raw === "string") {
      supplier = suppliers.find((s) => s.id === raw) || null;
    } else if (raw.id) {
      const match = suppliers.find((s) => s.id === raw.id);
      supplier = match ? match : { id: raw.id, name: raw.name ?? "" };
    }
  }

  const coercedType =
    saved?.purchaseType === "CREDIT" && !supplier
      ? "CASH"
      : saved?.purchaseType === "CASH" || saved?.purchaseType === "CREDIT"
        ? saved.purchaseType
        : "CREDIT";

  return {
    ...defaults,
    ...saved,
    supplier,
    purchaseDate: saved?.purchaseDate
      ? new Date(saved.purchaseDate).toISOString()
      : defaults.purchaseDate,
    entryTime: saved?.entryTime
      ? new Date(saved.entryTime).toISOString()
      : defaults.entryTime,
    discount: Number.isFinite(saved?.discount as number)
      ? Math.max(0, Number(saved!.discount))
      : 0,
    purchaseType: coercedType,
  };
}

function makeSnapshot(header: HeaderForm, rows: ItemRow[]) {
  return JSON.stringify({
    header,
    rows: rows.map((r) => ({
      productId: r.productId,
      unit: r.unit,
      rate: r.rate,
      quantity: r.quantity,
      mrp: r.mrp,
      taxPercent: r.taxPercent,
      discountType: r.discountType,
      discount: r.discount,
      profitPercent: r.profitPercent,
      salePrice: r.salePrice,
      batchNo: r.batchNo,
      mfgDate: r.mfgDate,
      expiryDate: r.expiryDate,
      lineType: r.lineType,
      sellingRatesJson: r.sellingRatesJson,
    })),
  });
}

function queuePurchaseFocus(resolveTarget: () => HTMLElement | null) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const target = resolveTarget();
      if (!target) return;

      target.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      });
      target.focus({ preventScroll: true });

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        target.select();
      }
    });
  });
}

function visiblePurchaseHeaderFields(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-purchase-header-field]"),
  ).filter((element) => {
    if (element.hasAttribute("disabled")) return false;
    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  });
}

export default function PurchasePage() {
  const router = useRouter();
  const { pullNow } = useSyncStatus();

  const initialSnapshot = useRef<string | null>(null);

  const [isClient, setIsClient] = useState(false);
  const [licenseId, setLicenseId] = useState("demo-license");
  const [userId, setUserId] = useState("admin");
  const [shopName, setShopName] = useState("My Shop");

  const [printers, setPrinters] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [rateTypes, setRateTypes] = useState<RateTypeRecord[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [productBrands, setProductBrands] = useState<string[]>([]);
  const [categoryRecords, setCategoryRecords] = useState<CategoryRecord[]>([]);
  const [suppliers, setSuppliers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);

  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(
    null,
  );

  const [header, setHeader] = useState<HeaderForm>({
    billNo: "",
    supplier: null,
    department: "",
    debitAccount: "",
    natureOfEntry: "",
    purchaseDate: new Date().toISOString(),
    entryTime: new Date().toISOString(),
    discount: 0,
    purchaseType: "CREDIT",
    typeId: null,
  });

  const [rows, setRows] = useState<ItemRow[]>([createEmptyRow(1)]);
  const [isDirty, setIsDirty] = useState(false);
  const rowsRef = useRef(rows);
  const headerRef = useRef(header);
  const editingPurchaseIdRef = useRef(editingPurchaseId);

  const [showHolds, setShowHolds] = useState(false);
  const [resumedHoldId, setResumedHoldId] = useState<string | null>(null);
  const [showReports, setShowReports] = useState(false);
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const [defaultHoldTitle, setDefaultHoldTitle] = useState<string>("");

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationMsgs, setValidationMsgs] = useState<string[]>([]);
  const [editingSlNo, setEditingSlNo] = useState<number | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [printConfirmOpen, setPrintConfirmOpen] = useState(false);
  const [pendingPrintId, setPendingPrintId] = useState<string | null>(null);
  const [showBarcodePrint, setShowBarcodePrint] = useState(false);
  const [billDetailsOpen, setBillDetailsOpen] = useState(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const billDetailsOpenRef = useRef(billDetailsOpen);
  const [showPurchaseSettings, setShowPurchaseSettings] = useState(false);
  const [purchaseUiSettings, setPurchaseUiSettings] =
    useState<PurchaseUiSettings>(DEFAULT_PURCHASE_UI_SETTINGS);

  const [transactionTypes, setTransactionTypes] = useState<
    Array<{ id: string; name: string; isDefault: number }>
  >([]);

  const barcodeEnabled = canUseBarcode();
  const [barcodePicker, setBarcodePicker] = useState<{
    rowIndex: number;
    productId: string;
    productName: string;
    itemCode: string;
    barcodes: string[];
  } | null>(null);

  useEffect(() => {
    rowsRef.current = rows;
    headerRef.current = header;
    editingPurchaseIdRef.current = editingPurchaseId;
    billDetailsOpenRef.current = billDetailsOpen;
  });

  // Initialize from localStorage
  useEffect(() => {
    setIsClient(true);

    if (typeof window !== "undefined") {
      setLicenseId(localStorage.getItem("licenseId") || "demo-license");
      setUserId(localStorage.getItem("userName") || "admin");
      setShopName(localStorage.getItem("shopName") || "My Shop");
      setPurchaseUiSettings(loadPurchaseUiSettings());
    }
  }, []);

  function getPrintCenterRowsFromPurchaseRows(): PrintCenterItemRow[] {
    if (!barcodeEnabled) return [];

    return rows
      .filter(
        (r: ItemRow) =>
          r.productId &&
          r.printBarcode !== false &&
          String(r.barcode || "").trim(),
      )
      .map((r: ItemRow) => ({
        productId: r.productId!,
        batchId: (r as any).batchId || undefined,
        itemName: r.name || "",
        barcode: String(r.barcode || "").trim(),
        batchNo: r.batchNo || null,
        salePrice:
          typeof r.salePrice === "number" && !Number.isNaN(r.salePrice)
            ? r.salePrice
            : null,
        mrp: typeof r.mrp === "number" && !Number.isNaN(r.mrp) ? r.mrp : null,
        copies: Math.max(1, Number(r.quantity || 1)),
      }));
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "openPurchaseId";
    const id = sessionStorage.getItem(key);
    if (!id) return;

    handleOpenPurchaseFromReport(id);
    sessionStorage.removeItem(key);
  }, []);

  async function reloadProductsAndMasters() {
    const [productsResult, categoriesResult, brandsResult, rateTypeResult] =
      await Promise.all([
        platform.getProducts(licenseId, { page: 1, pageSize: 1000 }),
        platform.listCategories(licenseId),
        platform.listBrands(licenseId),
        platform.listRateTypes(licenseId, false),
      ]);

    const nextProducts = productsResult.products as Product[];
    setProducts(nextProducts);
    setRateTypes(orderActiveRateTypes(rateTypeResult.rows || []));

    const productCategoryNames = nextProducts
      .map((p: any) => p.category)
      .filter((v: string | undefined): v is string => !!v);

    const productSubcategoryNames = nextProducts
      .map((p: any) => p.subcategory)
      .filter((v: string | undefined): v is string => !!v);

    if (categoriesResult.success) {
      setCategoryRecords(categoriesResult.rows);

      const masterCategoryNames = categoriesResult.rows
        .filter((row) => !row.parentId && !row.deletedAt)
        .map((row) => row.name);

      const masterSubcategoryNames = categoriesResult.rows
        .filter((row) => !!row.parentId && !row.deletedAt)
        .map((row) => row.name);

      setProductCategories(
        Array.from(
          new Set([
            ...masterCategoryNames,
            ...masterSubcategoryNames,
            ...productCategoryNames,
            ...productSubcategoryNames,
          ]),
        ).sort((a, b) => a.localeCompare(b)),
      );
    } else {
      setCategoryRecords([]);
      setProductCategories(
        Array.from(
          new Set([...productCategoryNames, ...productSubcategoryNames]),
        ).sort((a, b) => a.localeCompare(b)),
      );
    }

    const productBrandNames = nextProducts
      .map((p: any) => p.brand)
      .filter((v: string | undefined): v is string => !!v);

    const masterBrandNames = brandsResult.success
      ? brandsResult.rows.map((row) => row.name)
      : [];

    setProductBrands(
      Array.from(new Set([...masterBrandNames, ...productBrandNames])).sort(
        (a, b) => a.localeCompare(b),
      ),
    );
  }

  useEffect(() => {
    if (!isClient) return;
    pullNow("purchase");
    pullNow("purchaseItem");
    pullNow("purchaseHold");
    pullNow("supplier");
    pullNow("product");
    pullNow("category");
    pullNow("brand");

    reloadProductsAndMasters().catch(console.error);
    platform.peekNextPurchaseSlNo?.(licenseId).then((res) => {
      setNextEntryNo(res?.nextSlNo ?? 1);
    });
  }, [licenseId, isClient]);

  useEffect(() => {
    if (!isClient) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: Event) => {
      const { entity } = (e as CustomEvent<{ entity: string; count: number }>)
        .detail;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (entity === "product" || entity === "category" || entity === "brand") {
        debounceTimer = setTimeout(() => {
          reloadProductsAndMasters().catch(console.error);
        }, 150);
      }
      if (entity === "supplier") {
        debounceTimer = setTimeout(() => loadSuppliers(), 150);
      }
      if (entity === "purchase" && !editingPurchaseId) {
        debounceTimer = setTimeout(() => {
          platform.peekNextPurchaseSlNo?.(licenseId).then((res) => {
            setNextEntryNo(res?.nextSlNo ?? null);
          });
        }, 150);
      }
    };
    window.addEventListener("kynflow:sync:updated", handler);
    return () => {
      window.removeEventListener("kynflow:sync:updated", handler);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [isClient, licenseId, editingPurchaseId]);

  useEffect(() => {
    loadSuppliers();
  }, [showSupplierModal]);

  useEffect(() => {
    if (!isClient) return;
    platform.listTransactionTypes?.(licenseId, "purchase").then((res) => {
      if (!res?.success) return;
      const rows = (res.rows ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        isDefault: t.isDefault,
      }));
      setTransactionTypes(rows);
      // Auto-select default only for new (non-editing) bills with no typeId set
      setHeader((prev) => {
        if (prev.typeId) return prev;
        const def = rows.find((t) => t.isDefault === 1);
        return def ? { ...prev, typeId: def.id } : prev;
      });
    });
  }, [licenseId, isClient]);

  useEffect(() => {
    if (header.purchaseType === "CREDIT" && !header.supplier) {
      setHeader((s) => ({ ...s, purchaseType: "CASH" }));
    }
  }, [header.supplier]);

  const loadSuppliers = async () => {
    const res = await platform.listSuppliers?.(licenseId, {
      q: "",
      page: 1,
      pageSize: 100,
    });
    setSuppliers(
      (res?.suppliers ?? []).map((s) => ({ id: s.id, name: s.name })),
    );
  };

  const handleSelectProduct = async (rowIndex: number, productId: string) => {
    try {
      const [product, barcodeResult] = await Promise.all([
        platform.getProduct(productId),
        barcodeEnabled
          ? platform.listBarcodesForProduct?.(licenseId, productId)
          : Promise.resolve({ success: true, rows: [] }),
      ]);

      if (!product) return;
      const knownBarcodes = Array.from(
        new Set(
          [
            ...(barcodeResult?.rows || []).map((row: any) => row.barcode),
            ...rowsRef.current
              .filter((row) => row.productId === productId)
              .map((row) => row.barcode),
          ]
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        ),
      );
      if (barcodeEnabled && knownBarcodes.length === 0 && product.code) {
        knownBarcodes.push(product.code);
      }
      const selectedBarcode =
        barcodeEnabled && knownBarcodes.length > 0 ? knownBarcodes[0] : "";

      const sellingRatePatch = await resolvePurchaseRatePatch(
        productId,
        null,
        product.salePrice,
      );

      // First fill only base product details
      setRows((prev) =>
        prev.map((r, i) =>
          i !== rowIndex
            ? r
            : {
                ...r,
                productId,
                code: product.code,
                name: product.name,
                unit: product.unit,
                taxPercent: product.tax,
                rate: Number(product.costPrice) || 0,
                barcode: selectedBarcode,
                batchId: null,
                batchNo: "",
                purchaseBatchNo: null,
                mfgDate: null,
                expiryDate: null,
                forceNewBatch: true,
                mrp:
                  (product as any).mrp != null &&
                  !Number.isNaN(Number((product as any).mrp))
                    ? Number((product as any).mrp)
                    : null,
                ...sellingRatePatch,
              },
        ),
      );

      if (barcodeEnabled && knownBarcodes.length > 1) {
        setBarcodePicker({
          rowIndex,
          productId,
          productName: product.name,
          itemCode: product.code,
          barcodes: knownBarcodes,
        });
      }
    } catch (e) {
      console.error("Failed to select product", e);
    }
  };

  const resolvePurchaseRatePatch = useCallback(
    async (
      productId: string,
      batchId: string | null,
      legacySalePrice: number | null | undefined,
    ): Promise<Partial<ItemRow>> => {
      const activeTypes = orderActiveRateTypes(rateTypes);
      if (!activeTypes.length) {
        return {
          salePrice: Number(legacySalePrice || 0),
          availableRates: [],
          sellingRatesJson: null,
        };
      }
      const [productRateRes, batchRateRes] = await Promise.all([
        platform.listProductRates(licenseId, productId),
        batchId
          ? platform.listProductBatchRates(licenseId, productId, batchId)
          : Promise.resolve({ success: true, rows: [] }),
      ]);
      const availableRates = activeTypes.map((rateType) => {
        const resolved = resolveNamedRate({
          rateType,
          productRates: productRateRes.rows || [],
          batchRates: batchRateRes.rows || [],
        });
        return {
          rateTypeId: rateType.id,
          code: rateType.code,
          name: rateType.name,
          amount: resolved.amount,
          configured: resolved.configured,
          isDefault: rateType.isDefault,
        };
      });
      const defaultType = findDefaultRateType(activeTypes);
      const defaultValue = availableRates.find(
        (rate) => rate.rateTypeId === defaultType?.id,
      );
      return {
        salePrice: defaultValue?.amount ?? null,
        availableRates,
        sellingRatesJson: JSON.stringify(
          availableRates.map((rate) => ({
            rateTypeId: rate.rateTypeId,
            code: rate.code,
            name: rate.name,
            amount: rate.amount,
            isDefault: Boolean(rate.isDefault),
          })),
        ),
      };
    },
    [licenseId, rateTypes],
  );

  const handleRequestBatchSelect = async (
    rowIndex: number,
    explicitProductId?: string,
  ) => {
    if (!barcodeEnabled) {
      focusCell(rowIndex, "batchNo");
      return;
    }
    const row = rows[rowIndex];
    const productId = explicitProductId || row?.productId;
    if (!productId) return;
    const product = await platform.getProduct(productId);
    if (!product) return;
    const result = await platform.listBarcodesForProduct?.(licenseId, productId);
    const barcodes = Array.from(
      new Set(
        [
          ...(result?.rows || []).map((value: any) => value.barcode),
          ...rowsRef.current
            .filter((value) => value.productId === productId)
            .map((value) => value.barcode),
        ]
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    );
    if (barcodes.length === 0 && product.code) barcodes.push(product.code);
    if (barcodes.length <= 1) {
      if (
        barcodes[0] &&
        !String(rowsRef.current[rowIndex]?.barcode || "").trim()
      ) {
        updateRow(rowIndex, { barcode: barcodes[0] });
      }
      return;
    }
    setBarcodePicker({
      rowIndex,
      productId,
      productName: product.name,
      itemCode: product.code,
      barcodes,
    });
  };

  async function applyPurchaseBarcode(
    rowIndex: number,
    barcodeValue: string,
    options: { persistIfNew?: boolean } = {},
  ) {
    const row = rowsRef.current[rowIndex];
    if (!row?.productId) return false;
    const barcode = barcodeValue.trim();
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(barcode)) {
      setValidationMsgs([
        "Barcode must be 1–50 letters, numbers, hyphens, or underscores.",
      ]);
      setValidationOpen(true);
      return false;
    }

    const [barcodeOwner, itemCodeOwner] = await Promise.all([
      platform.getProductByBarcode(licenseId, barcode),
      platform.getProductByCode
        ? platform.getProductByCode(licenseId, barcode)
        : Promise.resolve(null),
    ]);
    const owner = barcodeOwner || itemCodeOwner;
    if (owner && owner.id !== row.productId) {
      setValidationMsgs([
        `Barcode "${barcode}" already belongs to ${owner.name}.`,
        "One barcode cannot identify two different items.",
      ]);
      setValidationOpen(true);
      return false;
    }
    const draftConflict = rowsRef.current.find(
      (value, index) =>
        index !== rowIndex &&
        value.productId &&
        value.productId !== row.productId &&
        String(value.barcode || "").trim() === barcode,
    );
    if (draftConflict) {
      setValidationMsgs([
        `Barcode "${barcode}" is already entered for ${draftConflict.name || "another item"} in this purchase.`,
      ]);
      setValidationOpen(true);
      return false;
    }

    if (options.persistIfNew && !barcodeOwner) {
      const saved = await platform.createBarcodeForProduct?.({
        licenseId,
        productId: row.productId,
        barcode,
        mrp: row.mrp ?? null,
        salePrice: row.salePrice ?? null,
        costPrice: row.rate ?? null,
      });
      if (!saved?.success) {
        setValidationMsgs([
          saved?.error || `Barcode "${barcode}" could not be saved.`,
        ]);
        setValidationOpen(true);
        return false;
      }
    }

    setRows((current) =>
      current.map((value, index) =>
        index === rowIndex
          ? {
              ...value,
              barcode,
              batchId: null,
              forceNewBatch: true,
            }
          : value,
      ),
    );
    return true;
  }

  async function handleBarcodeCommit(rowIndex: number) {
    if (!barcodeEnabled) return;

    const row = rows[rowIndex];
    if (!row?.productId) return;

    const typedBarcode = String(row.barcode || "").trim();
    if (!typedBarcode) return;

    try {
      await applyPurchaseBarcode(rowIndex, typedBarcode);
    } catch (e) {
      console.error("handleBarcodeCommit failed", e);
    }
  }
  useEffect(() => {
    setRows((prev) => prev.map(calcRow));
  }, [
    JSON.stringify(
      rows.map((r) => ({
        q: r.quantity,
        rate: r.rate,
        tax: r.taxPercent,
        dType: r.discountType,
        d: r.discount,
        profitPercent: r.profitPercent,
        lineType: r.lineType,
      })),
    ),
  ]);

  const subTotal = useMemo(
    () => rows.reduce((s, r) => s + (r.billedValue || 0), 0),
    [rows],
  );
  const grandTotal = useMemo(
    () => Math.max(0, subTotal - (header.discount || 0)),
    [subTotal, header.discount],
  );

  const addRow = () =>
    setRows((prev) => [...prev, createEmptyRow(prev.length + 1)]);
  const removeRow = (index: number) =>
    setRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, lineNo: i + 1 })),
    );

  const priceUpdateSettings = {
    updatePricesAfterSave: true,
    updateCostFromPurchase: true,
    updateUnitFromPurchase: true,
  };

  async function saveHold(title?: string) {
    const payload = {
      id: undefined as string | undefined,
      licenseId,
      userId,
      title: title || undefined,
      header,
      rows,
    };

    const res = await platform.savePurchaseHold?.(payload);
    if (res?.success) {
      setValidationMsgs([
        `Held as #${res.holdNo}${title ? ` • ${title}` : ""}`,
      ]);
      setValidationOpen(true);

      if (isSyncEnabled()) {
        SyncManager.pushEntity("purchaseHold").catch(() => {});
      }

      resetAll();
      setShowHolds(true);
    }
  }

  function handleHold() {
    setDefaultHoldTitle(header.billNo || "");
    setShowTitlePrompt(true);
  }

  function handleShowHolds() {
    setShowHolds(true);
  }

  function handleAddInlineProduct() {
    setShowProductModal(true);
  }

  async function handleInlineProductSuccess() {
    await reloadProductsAndMasters();
  }

  function handleBarcodeError(err: any) {
    const msg = String(err?.message || err || "");

    if (
      !msg.includes("BARCODE_IN_USE") &&
      !msg.includes(
        "UNIQUE constraint failed: product_batches.licenseId, product_batches.barcode",
      )
    ) {
      return false;
    }

    let barcode: string | null = null;
    const m = msg.match(/BARCODE_IN_USE:\s*Barcode\s+(.+?)\s+already/i);
    if (m && m[1]) {
      barcode = m[1].trim();
    }

    let rowHint = "";
    if (barcode) {
      const idx = rows.findIndex((r) => r.barcode === barcode);
      if (idx >= 0) {
        rowHint = ` (Row #${idx + 1})`;
      }
    }

    const lines: string[] = [];

    if (barcode) {
      lines.push(
        `Barcode "${barcode}" is already used for another product.${rowHint}`,
      );
    } else {
      lines.push("A barcode you entered is already used for another product.");
    }

    lines.push("Please change or clear that barcode and try again.");

    setValidationMsgs(lines);
    setValidationOpen(true);
    return true;
  }

  async function handleResumeHold(holdId: string) {
    if (suppliers.length === 0) {
      await loadSuppliers();
    }

    const res = await platform.getPurchaseHold?.(holdId);
    if (res?.success && res.hold) {
      const normalized = normalizeHeaderFromHold(res.hold.header, suppliers);
      const nextRows = res.hold.rows;

      setHeader(normalized);
      setRows(nextRows);
      setResumedHoldId(holdId);
      setShowHolds(false);

      initialSnapshot.current = makeSnapshot(normalized, nextRows);
      setIsDirty(false);
    }
  }

  async function handleOpenPurchaseFromReport(purchaseId: string) {
    if (suppliers.length === 0) await loadSuppliers();

    const res = await platform.getPurchaseFull?.(purchaseId);
    if (!res?.success) {
      setValidationMsgs(["Failed to load purchase."]);
      setValidationOpen(true);
      return;
    }

    const { purchase, items } = res;
    if (!purchase || !items) {
      setValidationMsgs(["Failed to load purchase data."]);
      setValidationOpen(true);
      return;
    }

    const hdr = headerFromPurchaseDb(purchase, suppliers);
    const mappedRows = rowsFromDbItems(items);

    setHeader(hdr);
    setRows(mappedRows);
    setEditingPurchaseId(purchaseId);
    setEditingSlNo(purchase.slNo ?? null);
    setShowReports(false);

    initialSnapshot.current = makeSnapshot(hdr, mappedRows);
    setIsDirty(false);
  }

  async function executePurchasePrint(purchaseId: string) {
    try {
      const result = await printPurchaseBill(purchaseId);

      if (!result?.success) {
        setValidationMsgs([result?.error || "Print failed"]);
        setValidationOpen(true);
        return false;
      }

      return true;
    } catch (error: any) {
      setValidationMsgs(["Print failed: " + String(error?.message || error)]);
      setValidationOpen(true);
      return false;
    }
  }

  async function handlePrintConfirm() {
    if (!pendingPrintId) return;

    const purchaseId = pendingPrintId;
    setPrintConfirmOpen(false);
    setPendingPrintId(null);
    await executePurchasePrint(purchaseId);
  }

  async function consumeResumedHoldAfterSave() {
    if (!resumedHoldId) return;

    const holdId = resumedHoldId;

    try {
      const res = await platform.deletePurchaseHold?.(holdId);

      if (res?.success) {
        setResumedHoldId(null);

        if (isSyncEnabled()) {
          SyncManager.pushEntity("purchaseHold").catch(() => {});
        }

        try {
          pullNow("purchaseHold");
        } catch {}

        return;
      }

      console.warn("Purchase saved, but hold cleanup failed:", res?.error);
    } catch (err) {
      console.warn("Purchase saved, but hold cleanup failed:", err);
    }
  }

  const handleSave = async (opts?: {
    skipBatchCheck?: boolean;
    rowsOverride?: ItemRow[];
  }) => {
    const originalRows = opts?.rowsOverride ?? rows;
    const rowsWithBarcodeDefaults = barcodeEnabled
      ? originalRows.map((row) =>
          row.productId && !String(row.barcode || "").trim()
            ? { ...row, barcode: String(row.code || "").trim() }
            : row,
        )
      : originalRows;
    const rowsToUse = mergeIdenticalPurchaseRows(rowsWithBarcodeDefaults);
    if (JSON.stringify(rowsToUse) !== JSON.stringify(originalRows)) {
      setRows(rowsToUse);
    }

    if (barcodeEnabled) {
      const draftOwnerByBarcode = new Map<string, string>();
      for (const row of rowsToUse.filter((value) => value.productId)) {
        const barcode = String(row.barcode || "").trim();
        if (!barcode) continue;
        const draftOwner = draftOwnerByBarcode.get(barcode);
        if (draftOwner && draftOwner !== row.productId) {
          setValidationMsgs([
            `Barcode "${barcode}" is assigned to two different items in this purchase.`,
          ]);
          setValidationOpen(true);
          return false;
        }
        draftOwnerByBarcode.set(barcode, row.productId);
      }
      for (const [barcode, productId] of draftOwnerByBarcode) {
        const [barcodeOwner, itemCodeOwner] = await Promise.all([
          platform.getProductByBarcode(licenseId, barcode),
          platform.getProductByCode
            ? platform.getProductByCode(licenseId, barcode)
            : Promise.resolve(null),
        ]);
        const savedOwner = barcodeOwner || itemCodeOwner;
        if (savedOwner && savedOwner.id !== productId) {
          setValidationMsgs([
            `Barcode "${barcode}" already belongs to ${savedOwner.name}.`,
          ]);
          setValidationOpen(true);
          return false;
        }
      }
    }

    const items = mapItems(rowsToUse);
    const errs = validatePurchaseBill(header, items);
    if (errs.length) {
      setValidationMsgs(errs);
      setValidationOpen(true);
      setBillDetailsOpen(true);
      return false;
    }

    if (header.purchaseType === "CREDIT" && !header.supplier) {
      setValidationMsgs(["Supplier is required for CREDIT purchases."]);
      setValidationOpen(true);
      setBillDetailsOpen(true);
      return false;
    }

    // === EDITING FLOW ===
    if (editingPurchaseId) {
      const payload = {
        id: editingPurchaseId,
        header: {
          billNo: header.billNo || null,
          supplierId: header.supplier?.id || null,
          supplierName: header.supplier?.name || null,
          supplier: header.supplier || null,
          department: header.department || null,
          debitAccount: header.debitAccount || null,
          natureOfEntry: header.natureOfEntry || null,
          purchaseDate: header.purchaseDate,
          entryTime: header.entryTime,
          discount: header.discount || 0,
          licenseId,
          purchaseType: header.purchaseType,
        },
        items,
      };

      try {
        const res = await platform.updatePurchase?.(payload);

        if (res?.success) {
          if (isSyncEnabled()) {
            SyncManager.pushEntity("purchase").catch(() => {});
            SyncManager.pushEntity("purchaseItem").catch(() => {});
          }

          setValidationMsgs(["Purchase updated successfully."]);
          setValidationOpen(true);
          setEditingPurchaseId(null);
          resetAll();
          return true;
        } else {
          const msg = res?.error || "Unknown error";
          if (!handleBarcodeError({ message: msg })) {
            setValidationMsgs(["Update failed: " + msg]);
            setValidationOpen(true);
          }
          return false;
        }
      } catch (err: any) {
        if (!handleBarcodeError(err)) {
          setValidationMsgs(["Update failed: " + String(err?.message || err)]);
          setValidationOpen(true);
        }
        return false;
      }
    }

    // === CREATE NEW PURCHASE FLOW ===
    const purchase = {
      billNo: header.billNo || null,
      supplierId: header.supplier?.id || null,
      supplierName: header.supplier?.name || null,
      department: header.department || null,
      debitAccount: header.debitAccount || null,
      natureOfEntry: header.natureOfEntry || null,
      purchaseDate: header.purchaseDate,
      entryTime: header.entryTime,
      discount: header.discount || 0,
      licenseId,
      userId,
      purchaseType: header.purchaseType,
    };

    try {
      const res = await platform.createPurchase?.(purchase, items);

      if (!res?.success) {
        const msg = res?.error || "Unknown error";
        if (!handleBarcodeError({ message: msg })) {
          setValidationMsgs(["Save failed: " + msg]);
          setValidationOpen(true);
        }
        return false;
      }

      if (isSyncEnabled()) {
        SyncManager.pushEntity("purchase").catch(() => {});
        SyncManager.pushEntity("purchaseItem").catch(() => {});
      }

      await consumeResumedHoldAfterSave();

      try {
        const peek = await platform.peekNextPurchaseSlNo?.(licenseId);
        setNextEntryNo(peek?.nextSlNo ?? null);
      } catch {}

      setEditingPurchaseId(res.purchaseId || null);
      setEditingSlNo(res.slNo ?? null);

      initialSnapshot.current = makeSnapshot(header, rowsToUse);
      setIsDirty(false);

      setPendingPrintId(res.purchaseId || null);
      setPrintConfirmOpen(true);

      if (priceUpdateSettings.updatePricesAfterSave) {
        const priceUpdates = rowsToUse
          .filter(
            (r) =>
              r.productId &&
              (priceUpdateSettings.updateCostFromPurchase ||
                (typeof r.salePrice === "number" && r.salePrice > 0) ||
                (r.profitPercent ?? 0) > 0),
          )
          .map((r) => {
            let sale = r.salePrice ?? 0;

            if ((r.profitPercent ?? 0) > 0) {
              const taxPct =
                r.taxPercent === "NT"
                  ? 0
                  : Number(String(r.taxPercent).replace("P", "")) || 0;
              const perUnitTax = r.rate * (taxPct / 100);
              const basePerUnit = r.rate + perUnitTax;
              sale = round2(
                basePerUnit * (1 + (Number(r.profitPercent) || 0) / 100),
              );
            } else if (typeof r.salePrice === "number") {
              sale = round2(r.salePrice);
            }

            return {
              productId: r.productId,
              salePrice: sale > 0 ? sale : undefined,
              costPrice: priceUpdateSettings.updateCostFromPurchase
                ? round2(r.rate)
                : undefined,
              unit: priceUpdateSettings.updateUnitFromPurchase
                ? r.unit
                : undefined,
            };
          });

        if (priceUpdates.length > 0) {
          try {
            await platform.bulkUpdateProductPrices?.(priceUpdates);
          } catch (e) {
            console.error("Failed to update product fields:", e);
          }
        }
      }

      return true;
    } catch (err: any) {
      if (!handleBarcodeError(err)) {
        setValidationMsgs(["Save failed: " + String(err?.message || err)]);
        setValidationOpen(true);
      }
      return false;
    }
  };

  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  const handleCancel = () => {
    if (!isDirty) {
      resetAll();
      return;
    }

    setCancelConfirmOpen(true);
  };

  const handleCancelRef = useRef(handleCancel);
  const handleHoldRef = useRef(handleHold);
  useEffect(() => {
    handleCancelRef.current = handleCancel;
    handleHoldRef.current = handleHold;
  });

  useEffect(() => {
    const snap = makeSnapshot(header, rows);

    if (initialSnapshot.current === null) {
      initialSnapshot.current = snap;
      setIsDirty(false);
      return;
    }

    setIsDirty(initialSnapshot.current !== snap);
  }, [header, rows]);

  function resetAll() {
    const freshHeader: HeaderForm = {
      billNo: "",
      supplier: null,
      department: "",
      debitAccount: "",
      natureOfEntry: "",
      purchaseDate: new Date().toISOString(),
      entryTime: new Date().toISOString(),
      discount: 0,
      purchaseType: "CREDIT",
      typeId: null,
    };

    const defType = transactionTypes.find((t) => t.isDefault === 1);
    if (defType) freshHeader.typeId = defType.id;

    const freshRows = [createEmptyRow(1)];

    setHeader(freshHeader);
    setRows(freshRows);
    setEditingPurchaseId(null);
    setEditingSlNo(null);
    setResumedHoldId(null);
    billDetailsOpenRef.current = true;
    setBillDetailsOpen(true);

    initialSnapshot.current = makeSnapshot(freshHeader, freshRows);
    setIsDirty(false);
  }

  const focusBillDetails = useCallback(() => {
    billDetailsOpenRef.current = true;
    setBillDetailsOpen(true);
    queuePurchaseFocus(() => document.getElementById("bill-details-billno"));
  }, []);

  const toggleBillDetails = useCallback(() => {
    const nextOpen = !billDetailsOpenRef.current;
    billDetailsOpenRef.current = nextOpen;
    setBillDetailsOpen(nextOpen);
  }, []);

  const focusLastBillDetail = useCallback(() => {
    billDetailsOpenRef.current = true;
    setBillDetailsOpen(true);
    queuePurchaseFocus(() => {
      const billNo = document.getElementById("bill-details-billno");
      const root = billNo?.closest<HTMLElement>("section");
      if (!root) return billNo;

      const fields = visiblePurchaseHeaderFields(root);
      return fields.at(-1) ?? billNo;
    });
  }, []);

  const focusItemEntry = useCallback(() => {
    const currentRows = rowsRef.current;
    let rowIndex = currentRows.findIndex((row) => !row.productId);

    if (rowIndex < 0) {
      rowIndex = currentRows.length;
      const nextRows = [...currentRows, createEmptyRow(currentRows.length + 1)];
      rowsRef.current = nextRows;
      setRows(nextRows);
    }

    const targetRowIndex = rowIndex;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        focusCell(targetRowIndex, "product");
      });
    });
  }, []);

  const requestPrintCurrentPurchase = useCallback(() => {
    const purchaseId = editingPurchaseIdRef.current;

    if (!purchaseId) {
      setValidationMsgs(["Save the purchase before printing."]);
      setValidationOpen(true);
      return;
    }

    void executePurchasePrint(purchaseId);
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const hasBlockingOverlay =
    showPurchaseSettings ||
    showSupplierModal ||
    showProductModal ||
    showHolds ||
    showReports ||
    showTitlePrompt ||
    printConfirmOpen ||
    cancelConfirmOpen ||
    leaveOpen ||
    validationOpen ||
    showBarcodePrint ||
    isMobileSheetOpen ||
    Boolean(barcodePicker);

  // Purchase keyboard map:
  // F3 Item | F4 Focus Bill Number | F6 Reports | F7 Settings | F8 Holds | F9 Hold
  // Ctrl/Cmd+S Save | Ctrl/Cmd+P Print | Ctrl/Cmd+Shift+P Barcode labels
  // Ctrl/Cmd+N New/Clear
  // Ctrl/Cmd+\ Toggle Bill Details | Ctrl/Cmd+B Back (navigation component)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || hasBlockingOverlay) return;

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const focusBillNumberShortcut = event.code === "F4" || event.key === "F4";
      const toggleBillDetailsShortcut =
        modifier && (event.code === "Backslash" || key === "\\" || key === "|");

      if (focusBillNumberShortcut) {
        event.preventDefault();
        event.stopPropagation();
        focusBillDetails();
        return;
      }

      if (toggleBillDetailsShortcut) {
        event.preventDefault();
        event.stopPropagation();
        toggleBillDetails();
        return;
      }

      if (event.defaultPrevented || event.altKey) return;

      if (modifier && key === "s") {
        event.preventDefault();
        const currentHeader = headerRef.current;
        const missingBillNo = !currentHeader.billNo?.trim();
        const missingSupplier =
          currentHeader.purchaseType === "CREDIT" && !currentHeader.supplier;

        if (!billDetailsOpenRef.current && (missingBillNo || missingSupplier)) {
          focusBillDetails();
          return;
        }

        void handleSaveRef.current();
        return;
      }

      if (modifier && event.shiftKey && key === "p" && barcodeEnabled) {
        event.preventDefault();
        setShowBarcodePrint(true);
        return;
      }

      if (modifier && key === "p") {
        event.preventDefault();
        requestPrintCurrentPurchase();
        return;
      }

      if (modifier && key === "n") {
        event.preventDefault();
        handleCancelRef.current();
        return;
      }

      if (modifier) return;

      if (event.key === "F3") {
        event.preventDefault();
        focusItemEntry();
        return;
      }

      if (event.key === "F6") {
        event.preventDefault();
        setShowReports(true);
        return;
      }

      if (event.key === "F7") {
        event.preventDefault();
        setShowPurchaseSettings(true);
        return;
      }

      if (event.key === "F8") {
        event.preventDefault();
        if (!editingPurchaseIdRef.current) setShowHolds(true);
        return;
      }

      if (event.key === "F9") {
        event.preventDefault();
        if (!editingPurchaseIdRef.current) handleHoldRef.current();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    focusBillDetails,
    focusItemEntry,
    hasBlockingOverlay,
    requestPrintCurrentPurchase,
    toggleBillDetails,
  ]);

  function updateRow(index: number, patch: Partial<ItemRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  async function tryNavigate(path: string) {
    if (!isDirty) {
      router.push(path);
      return;
    }
    setPendingPath(path);
    setLeaveOpen(true);
  }

  // Return null until client-side hydration is complete
  if (!isClient) return null;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <PurchaseNavigation
        onNavigate={tryNavigate}
        title="Purchase"
        keyboardEnabled={!hasBlockingOverlay}
        savedBillOpen={Boolean(editingPurchaseId)}
        onPrintBill={requestPrintCurrentPurchase}
        onNewBill={handleCancel}
      />

      <div className="flex-1 min-h-0 overflow-hidden p-0">
        <div
          className={[
            "grid overflow-hidden transition-all duration-200",
            "h-full",
            // Mobile: single column always
            "grid-cols-1",
            // md+: side panel visible
            billDetailsOpen
              ? "md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]"
              : "md:grid-cols-[44px_1fr] lg:grid-cols-[44px_1fr]",
          ]
            .join(" ")
            .trim()}
        >
          <div className="hidden md:flex md:flex-col md:min-h-0 md:overflow-hidden">
            <BillDetailsSection
              header={header}
              setHeader={setHeader}
              suppliers={suppliers}
              setShowSupplierModal={setShowSupplierModal}
              subTotal={subTotal}
              grandTotal={grandTotal}
              onSave={handleSave}
              onCancel={handleCancel}
              entryNo={
                editingPurchaseId
                  ? (editingSlNo ?? undefined)
                  : (nextEntryNo ?? undefined)
              }
              requireSupplier={header.purchaseType === "CREDIT"}
              isEditing={Boolean(editingPurchaseId)}
              isOpen={billDetailsOpen}
              onToggle={toggleBillDetails}
              transactionTypes={transactionTypes}
              uiSettings={purchaseUiSettings}
              onFocusItems={focusItemEntry}
            />
          </div>

          <div className="min-h-0 flex flex-col bg-white overflow-hidden">
            <ItemsTableSection
              mode="PURCHASE"
              rows={rows}
              products={products}
              rateTypes={rateTypes}
              onAddProduct={handleAddInlineProduct}
              onSelectProduct={handleSelectProduct}
              onUpdateRow={updateRow}
              onAddRow={addRow}
              onRemoveRow={removeRow}
              subTotal={subTotal}
              grandTotal={grandTotal}
              headerDiscount={header.discount}
              onHold={handleHold}
              onShowHolds={handleShowHolds}
              onShowReports={() => setShowReports(true)}
              onOpenSettings={() => setShowPurchaseSettings(true)}
              onFocusItems={focusItemEntry}
              onFocusBillDetails={focusBillDetails}
              onToggleBillDetails={toggleBillDetails}
              onFocusPreviousSection={focusLastBillDetail}
              uiSettings={purchaseUiSettings}
              showHoldControls={!editingPurchaseId}
              onRequestBatchSelect={handleRequestBatchSelect}
              onBarcodeCommit={handleBarcodeCommit}
              barcodeEnabled={barcodeEnabled}
              onOpenMobileSheet={() => setIsMobileSheetOpen(true)}
              printBarcodesSlot={
                <BarcodePrintCenterButton
                  licenseId={licenseId}
                  initialRows={
                    showBarcodePrint ? getPrintCenterRowsFromPurchaseRows() : []
                  }
                  defaultShopName={shopName}
                  buttonText=""
                  shortcut="Ctrl+Shift+P"
                  title="Barcode printing (Ctrl+Shift+P)"
                  className="inline-flex items-center gap-2 rounded-md bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                  open={showBarcodePrint}
                  onOpen={() => setShowBarcodePrint(true)}
                  onClose={() => setShowBarcodePrint(false)}
                />
              }
            />
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet for bill details */}
      {isMobileSheetOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMobileSheetOpen(false)}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
              <span className="font-semibold text-gray-800">Bill Details</span>
              <button
                onClick={() => setIsMobileSheetOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <BillDetailsSection
              header={header}
              setHeader={setHeader}
              suppliers={suppliers}
              setShowSupplierModal={setShowSupplierModal}
              subTotal={subTotal}
              grandTotal={grandTotal}
              onSave={async (opts?: any) => {
                const ok = await handleSave(opts);
                if (ok) setIsMobileSheetOpen(false);
              }}
              onCancel={() => {
                handleCancel();
                setIsMobileSheetOpen(false);
              }}
              entryNo={
                editingPurchaseId
                  ? (editingSlNo ?? undefined)
                  : (nextEntryNo ?? undefined)
              }
              requireSupplier={header.purchaseType === "CREDIT"}
              isEditing={Boolean(editingPurchaseId)}
              isOpen={true}
              onToggle={() => {}}
              transactionTypes={transactionTypes}
              uiSettings={purchaseUiSettings}
              onFocusItems={focusItemEntry}
            />
          </div>
        </div>
      )}

      <PurchaseEntrySettingsModal
        open={showPurchaseSettings}
        settings={purchaseUiSettings}
        onClose={() => setShowPurchaseSettings(false)}
        onSave={(nextSettings) => {
          setPurchaseUiSettings(nextSettings);
          savePurchaseUiSettings(nextSettings);
        }}
      />

      {/* Supplier modal */}
      {showSupplierModal && (
        <SupplierFormModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          onSuccess={() => {
            setShowSupplierModal(false);
            loadSuppliers();
          }}
        />
      )}

      <ProductFormModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSuccess={handleInlineProductSuccess}
        editProduct={null}
        existingCategories={productCategories}
        existingBrands={productBrands}
        categoryRecords={categoryRecords}
      />

      <BarcodeSelectModal
        isOpen={Boolean(barcodePicker)}
        productName={barcodePicker?.productName}
        itemCode={barcodePicker?.itemCode}
        barcodes={barcodePicker?.barcodes || []}
        onClose={() => setBarcodePicker(null)}
        onSelect={async (barcode, options) => {
          if (!barcodePicker) return;
          const rowIndex = barcodePicker.rowIndex;
          const accepted = await applyPurchaseBarcode(rowIndex, barcode, {
            persistIfNew: options.createNew,
          });
          if (!accepted) return false;
          setBarcodePicker(null);
          setTimeout(() => focusCell(rowIndex, "quantity"), 0);
          return true;
        }}
      />

      {/* Holds list */}
      <HoldsModal
        isOpen={showHolds}
        onClose={() => setShowHolds(false)}
        licenseId={licenseId}
        onResume={handleResumeHold}
      />

      {/* Reports modal */}
      <PurchaseReportsModal
        isOpen={showReports}
        onClose={() => setShowReports(false)}
        licenseId={licenseId}
        suppliers={suppliers}
        onOpenPurchase={handleOpenPurchaseFromReport}
      />

      {/* Title prompt */}
      <PromptModal
        isOpen={showTitlePrompt}
        title="Save as Hold"
        label="Optional title"
        placeholder="e.g., Afternoon stock"
        defaultValue={defaultHoldTitle}
        confirmText="Save Hold"
        onCancel={() => setShowTitlePrompt(false)}
        onConfirm={(val) => {
          setShowTitlePrompt(false);
          saveHold(val.trim());
        }}
      />

      {/* Validation modal */}
      <ValidationModal
        isOpen={validationOpen}
        messages={validationMsgs}
        onClose={() => setValidationOpen(false)}
      />

      {/* Print confirm modal */}
      <ConfirmModal
        isOpen={printConfirmOpen}
        title="Print bill?"
        message="Print this purchase using the current A4/thermal and preview settings?"
        confirmText="Print"
        cancelText="Skip"
        onConfirm={handlePrintConfirm}
        onCancel={() => {
          setPrintConfirmOpen(false);
          setPendingPrintId(null);
        }}
      />

      {/* Confirm discard current bill */}
      <ConfirmModal
        isOpen={cancelConfirmOpen}
        title="Discard current bill?"
        message="You have unsaved changes in this purchase entry. Do you really want to clear everything?"
        confirmText="Discard"
        cancelText="Keep editing"
        onConfirm={() => {
          setCancelConfirmOpen(false);
          resetAll();
        }}
        onCancel={() => {
          setCancelConfirmOpen(false);
        }}
      />

      {/* Leave page confirm modal */}
      <ConfirmModal
        isOpen={leaveOpen}
        title="Leave without saving?"
        message="You have unsaved changes in this purchase. Are you sure you want to leave this page?"
        confirmText="Leave page"
        cancelText="Stay here"
        onConfirm={() => {
          setLeaveOpen(false);
          if (pendingPath) {
            setIsDirty(false);
            router.push(pendingPath);
            setPendingPath(null);
          }
        }}
        onCancel={() => {
          setLeaveOpen(false);
          setPendingPath(null);
        }}
      />
    </div>
  );
}
