// src/app/dashboard/purchase/page.tsx
"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import PurchaseNavigation from "@/components/purchase/PurchaseNavigation";
import BillDetailsSection from "@/components/purchase/BillDetailsSection";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import SupplierFormModal from "@/components/suppliers/SupplierFormModal";
import HoldsModal from "@/components/purchase/HoldsModal";
import PurchaseReportsModal from "@/components/purchase/PurchaseReportsModal";
import BatchSelectModal from "@/components/purchase/BatchSelectModal";
import PromptModal from "@/components/ui/PromptModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ValidationModal from "@/components/ui/ValidationModal";
import {
  HeaderForm,
  ItemRow,
  Product,
  BatchInfo,
} from "@/components/purchase/types";
import {
  createEmptyRow,
  calcRow,
  validatePurchaseBill,
  mapItems,
  round2,
  headerFromPurchaseDb,
  rowsFromDbItems,
} from "@/components/purchase/utils";
import BarcodePrintCenterButton from "@/components/barcodes/BarcodePrintCenterButton";
import type { PrintCenterItemRow } from "@/lib/barcode/printCenterTypes";
import { printPurchaseBill } from "@/lib/print/printPurchaseBill";
import { platform } from "@/platform";
import { isSyncEnabled } from "@/platform/mode";
import { SyncManager } from "@/sync/SyncManager";
import { useSyncStatus } from "@/sync/SyncProvider";

type BatchDecision = "OVERRIDE" | "NEW";

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
    })),
  });
}

function isNumericBarcode(value?: string | null) {
  return !!value && /^\d+$/.test(String(value).trim());
}

function getNextPreviewBarcode(
  dbPeekBarcode: string,
  rows: ItemRow[],
  excludeRowIndex?: number,
) {
  const dbNum = Number(dbPeekBarcode || 0);

  const localMax = rows.reduce((max, row, idx) => {
    if (excludeRowIndex !== undefined && idx === excludeRowIndex) return max;

    const bc = String(row.barcode || "").trim();
    if (!isNumericBarcode(bc)) return max;

    const num = Number(bc);

    if (num > dbNum + 1000) return max;

    return Math.max(max, num);
  }, 0);

  const next = Math.max(dbNum, localMax + 1);
  return String(next).padStart(5, "0");
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
  });

  const [batchPicker, setBatchPicker] = useState<{
    rowIndex: number;
    productId: string;
    batches: BatchInfo[];
    productName?: string;
    nextBarcode: string;
  } | null>(null);

  const [batchDecisions, setBatchDecisions] = useState<
    Record<number, BatchDecision>
  >({});

  const [rows, setRows] = useState<ItemRow[]>([createEmptyRow(1)]);
  const [isDirty, setIsDirty] = useState(false);

  const [showHolds, setShowHolds] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const [defaultHoldTitle, setDefaultHoldTitle] = useState<string>("");

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationMsgs, setValidationMsgs] = useState<string[]>([]);
  const [editingSlNo, setEditingSlNo] = useState<number | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [showBarcodePrint, setShowBarcodePrint] = useState(false);
  const [billDetailsOpen, setBillDetailsOpen] = useState(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const [batchConflicts, setBatchConflicts] = useState<{
    rows: {
      rowIndex: number;
      productName: string;
      barcode?: string | null;
      diffs: Record<string, { current: any; proposed: any }>;
    }[];
  } | null>(null);

  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    setIsClient(true);

    if (typeof window !== "undefined") {
      setLicenseId(localStorage.getItem("licenseId") || "demo-license");
      setUserId(localStorage.getItem("userName") || "admin");
      setShopName(localStorage.getItem("shopName") || "My Shop");
    }
  }, []);

  function getPrintCenterRowsFromPurchaseRows(): PrintCenterItemRow[] {
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

  useEffect(() => {
    if (!isClient) return;
    pullNow("purchase");
    pullNow("purchaseItem");
    pullNow("supplier");
    platform.getProducts(licenseId, { page: 1, pageSize: 200 }).then((res) => {
      setProducts(res.products as Product[]);
    });
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
      if (entity === "product") {
        debounceTimer = setTimeout(() => {
          platform
            .getProducts(licenseId, { page: 1, pageSize: 200 })
            .then((res) => {
              setProducts(res.products as Product[]);
            });
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
      const [product, peekRes, batchesRes] = await Promise.all([
        platform.getProduct(productId),
        platform.peekNextBarcode?.(licenseId),
        platform.listBarcodesForProduct?.(licenseId, productId),
      ]);

      if (!product) return;

      const nextBarcode = getNextPreviewBarcode(
        peekRes?.barcode || "00000",
        rows,
        rowIndex,
      );

      const batches: BatchInfo[] = (batchesRes?.rows || []).map((b: any) => ({
        id: b.id,
        barcode: b.barcode,
        batchNo: b.batchNo,
        mfgDate: b.mfgDate,
        expiryDate: b.expiryDate,
        mrp: b.mrp,
        salePrice: b.salePrice,
        stock: b.stock,
      }));

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
                barcode: "",
                batchNo: "",
                mfgDate: null,
                expiryDate: null,
                forceNewBatch: false,
                mrp:
                  (product as any).mrp != null &&
                  !Number.isNaN(Number((product as any).mrp))
                    ? Number((product as any).mrp)
                    : null,
                salePrice:
                  product.salePrice != null &&
                  !Number.isNaN(Number(product.salePrice))
                    ? Number(product.salePrice)
                    : 0,
              },
        ),
      );

      // No existing barcodes -> suggest next barcode
      if (batches.length === 0) {
        setRows((prev) =>
          prev.map((r, i) =>
            i !== rowIndex
              ? r
              : {
                  ...r,
                  barcode: nextBarcode,
                  forceNewBatch: true,
                },
          ),
        );

        setTimeout(() => {
          const el = document.querySelector<HTMLInputElement>(
            `[data-cell="${rowIndex}:barcode"]`,
          );
          if (el) {
            el.focus();
            el.select();
          }
        }, 0);

        return;
      }

      // Exactly one existing barcode -> auto use it
      if (batches.length === 1) {
        const b = batches[0];

        setRows((prev) =>
          prev.map((r, i) =>
            i !== rowIndex
              ? r
              : {
                  ...r,
                  barcode: b.barcode || "",
                  batchNo: b.batchNo ?? "",
                  mfgDate: b.mfgDate ?? null,
                  expiryDate: b.expiryDate ?? null,
                  forceNewBatch: false,
                  mrp:
                    b.mrp != null && !Number.isNaN(Number(b.mrp))
                      ? Number(b.mrp)
                      : r.mrp,
                  salePrice:
                    b.salePrice != null && !Number.isNaN(Number(b.salePrice))
                      ? Number(b.salePrice)
                      : r.salePrice,
                },
          ),
        );

        setTimeout(() => {
          const el = document.querySelector<HTMLInputElement>(
            `[data-cell="${rowIndex}:barcode"]`,
          );
          if (el) {
            el.focus();
            el.select();
          }
        }, 0);

        return;
      }

      // Multiple existing barcodes -> let user choose
      setBatchPicker({
        rowIndex,
        productId,
        batches,
        productName: product.name,
        nextBarcode,
      });

      setTimeout(() => {
        const el = document.querySelector<HTMLInputElement>(
          `[data-cell="${rowIndex}:barcode"]`,
        );
        if (el) {
          el.focus();
          el.select();
        }
      }, 0);
    } catch (e) {
      console.error("Failed to select product", e);
    }
  };

  const handleRequestBatchSelect = async (
    rowIndex: number,
    explicitProductId?: string,
  ) => {
    const row = rows[rowIndex];
    const productId = explicitProductId || row?.productId;
    if (!productId) return;

    try {
      const [batchesRes, peekRes] = await Promise.all([
        platform.listBarcodesForProduct?.(licenseId, productId),
        platform.peekNextBarcode?.(licenseId),
      ]);

      const batches: BatchInfo[] = (batchesRes?.rows || []).map((b: any) => ({
        id: b.id,
        barcode: b.barcode,
        batchNo: b.batchNo,
        mfgDate: b.mfgDate,
        expiryDate: b.expiryDate,
        mrp: b.mrp,
        salePrice: b.salePrice,
        stock: b.stock,
      }));

      const nextBarcode = getNextPreviewBarcode(
        peekRes?.barcode || "00000",
        rows,
        rowIndex,
      );

      const productName =
        products.find((p) => p.id === productId)?.name || row?.name;

      setBatchPicker({
        rowIndex,
        productId,
        batches,
        productName,
        nextBarcode,
      });
    } catch (e) {
      console.error("Failed to load product barcodes", e);
    }
  };

  async function handleBarcodeCommit(rowIndex: number) {
    const row = rows[rowIndex];
    if (!row?.productId) return;

    const typedBarcode = String(row.barcode || "").trim();
    if (!typedBarcode) return;

    try {
      const existingProduct = await platform.getProductByBarcode(
        licenseId,
        typedBarcode,
      );

      if (
        existingProduct &&
        existingProduct.id &&
        existingProduct.id !== row.productId
      ) {
        setValidationMsgs([
          `Barcode "${typedBarcode}" already belongs to another product.`,
          "Use a different barcode or clear it.",
        ]);
        setValidationOpen(true);

        setRows((prev) =>
          prev.map((r, i) =>
            i !== rowIndex
              ? r
              : {
                  ...r,
                  barcode: "",
                },
          ),
        );
        return;
      }

      const res = await platform.listBarcodesForProduct?.(
        licenseId,
        row.productId,
      );

      const batches: BatchInfo[] = (res?.rows || []).map((b: any) => ({
        id: b.id,
        barcode: b.barcode,
        batchNo: b.batchNo,
        mfgDate: b.mfgDate,
        expiryDate: b.expiryDate,
        mrp: b.mrp,
        salePrice: b.salePrice,
        stock: b.stock,
      }));

      if (!batches.length) {
        setRows((prev) =>
          prev.map((r, i) =>
            i !== rowIndex
              ? r
              : {
                  ...r,
                  barcode: typedBarcode,
                  forceNewBatch: true,
                },
          ),
        );
        return;
      }

      const exactMatches = batches.filter(
        (b) => String(b.barcode || "").trim() === typedBarcode,
      );

      if (exactMatches.length === 1) {
        const b = exactMatches[0];

        setRows((prev) =>
          prev.map((r, i) =>
            i !== rowIndex
              ? r
              : {
                  ...r,
                  barcode: typedBarcode,
                  batchNo: b.batchNo ?? r.batchNo,
                  mfgDate: b.mfgDate ?? r.mfgDate,
                  expiryDate: b.expiryDate ?? r.expiryDate,
                  forceNewBatch: false,
                  mrp:
                    typeof r.mrp === "number" && r.mrp > 0
                      ? r.mrp
                      : b.mrp != null
                        ? Number(b.mrp)
                        : r.mrp,
                  salePrice:
                    typeof r.salePrice === "number" && r.salePrice > 0
                      ? r.salePrice
                      : b.salePrice != null
                        ? Number(b.salePrice)
                        : r.salePrice,
                },
          ),
        );

        return;
      }

      if (exactMatches.length > 1) {
        const productName =
          products.find((p) => p.id === row.productId)?.name || row.name;

        const peekRes = await platform.peekNextBarcode?.(licenseId);

        setBatchPicker({
          rowIndex,
          productId: row.productId,
          batches: exactMatches,
          productName,
          nextBarcode: getNextPreviewBarcode(
            peekRes?.barcode || "00000",
            rows,
            rowIndex,
          ),
        });
        return;
      }

      setRows((prev) =>
        prev.map((r, i) =>
          i !== rowIndex
            ? r
            : {
                ...r,
                barcode: typedBarcode,
                forceNewBatch: true,
              },
        ),
      );
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
      alert(`✅ Held as #${res.holdNo}${title ? ` • ${title}` : ""}`);
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
      setShowHolds(false);

      initialSnapshot.current = makeSnapshot(normalized, nextRows);
      setIsDirty(false);
    }
  }

  async function handleOpenPurchaseFromReport(purchaseId: string) {
    if (suppliers.length === 0) await loadSuppliers();

    const res = await platform.getPurchaseFull?.(purchaseId);
    if (!res?.success) return alert("Failed to load purchase");

    const { purchase, items } = res;
    if (!purchase || !items) return alert("Failed to load purchase data");

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

  async function checkBatchConflicts(
    items: ReturnType<typeof mapItems>,
  ): Promise<
    {
      rowIndex: number;
      productName: string;
      barcode?: string | null;
      diffs: Record<string, { current: any; proposed: any }>;
    }[]
  > {
    const conflicts: {
      rowIndex: number;
      productName: string;
      barcode?: string | null;
      diffs: Record<string, { current: any; proposed: any }>;
    }[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId) continue;

      const row = rows[i];
      if (row?.overrideBatchPrices) continue;

      if (!it.barcode) continue;

      try {
        const res = await (window as any).electronAPI.resolveProductBatch({
          licenseId,
          productId: it.productId,
          barcode: it.barcode,
          mrp: it.mrp ?? null,
          salePrice: it.salePrice ?? null,
          batchNo: it.batchNo ?? null,
          mfgDate: it.mfgDate ?? null,
          expiryDate: it.expiryDate ?? null,
        });

        if (
          res?.success &&
          res.decision === "CONFLICT_BARCODE" &&
          res.diffs &&
          Object.keys(res.diffs).length > 0
        ) {
          const productName =
            products.find((p) => p.id === it.productId)?.name ||
            `Row #${i + 1}`;

          conflicts.push({
            rowIndex: i,
            productName,
            barcode: it.barcode,
            diffs: res.diffs,
          });
        }
      } catch (err) {
        console.error("batch resolve failed for row", i + 1, err);
      }
    }

    return conflicts;
  }

  const handleSave = async (opts?: {
    skipBatchCheck?: boolean;
    rowsOverride?: ItemRow[];
  }) => {
    const rowsToUse = opts?.rowsOverride ?? rows;

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

    if (!opts?.skipBatchCheck) {
      const conflicts = await checkBatchConflicts(items);

      if (conflicts.length > 0) {
        setBatchConflicts({ rows: conflicts });

        setBatchDecisions(
          Object.fromEntries(
            conflicts.map((c) => [c.rowIndex, "OVERRIDE" as BatchDecision]),
          ),
        );

        setBatchConfirmOpen(true);
        return false;
      }
    }

    // === EDITING FLOW ===
    if (editingPurchaseId) {
      const payload = {
        id: editingPurchaseId,
        header: {
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
          alert("✅ Updated!");
          setEditingPurchaseId(null);
          resetAll();
          return true;
        } else {
          const msg = res?.error || "Unknown error";
          if (!handleBarcodeError({ message: msg })) {
            alert("Update failed: " + msg);
          }
          return false;
        }
      } catch (err: any) {
        if (!handleBarcodeError(err)) {
          alert("Update failed: " + String(err?.message || err));
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
          alert("Save failed: " + msg);
        }
        return false;
      }

      if (isSyncEnabled()) {
        SyncManager.pushEntity("purchase").catch(() => {});
        SyncManager.pushEntity("purchaseItem").catch(() => {});
      }

      try {
        const peek = await platform.peekNextPurchaseSlNo?.(licenseId);
        setNextEntryNo(peek?.nextSlNo ?? null);
      } catch {}

      const shouldPrint = confirm(
        `✅ Saved! SlNo: ${res.slNo}, Total: ${res.totalAmount}\n\nOpen print preview now?`,
      );

      setEditingPurchaseId(res.purchaseId || null);
      setEditingSlNo(res.slNo ?? null);

      initialSnapshot.current = makeSnapshot(header, rowsToUse);
      setIsDirty(false);

      if (shouldPrint && res.purchaseId) {
        try {
          await printPurchaseBill(res.purchaseId, { preview: true });
        } catch (e: any) {
          alert("Print failed: " + String(e?.message || e));
        }
      }

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
        alert("Save failed: " + String(err?.message || err));
      }
      return false;
    }
  };

  const handleCancel = () => {
    if (!isDirty) {
      resetAll();
      return;
    }

    setCancelConfirmOpen(true);
  };

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
    };

    const freshRows = [createEmptyRow(1)];

    setHeader(freshHeader);
    setRows(freshRows);
    setEditingPurchaseId(null);
    setEditingSlNo(null);
    setBillDetailsOpen(true);

    initialSnapshot.current = makeSnapshot(freshHeader, freshRows);
    setIsDirty(false);
  }

  function openBillDetailsAndFocus() {
    setBillDetailsOpen(true);
    setTimeout(() => {
      const el = document.getElementById("bill-details-billno");
      if (el) el.focus();
    }, 50);
  }

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Ctrl/⌘+S → open bill details if panel is closed, then save
  // Ctrl+\   → toggle bill details panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Toggle panel
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setBillDetailsOpen((v) => !v);
        return;
      }
      // Save — auto-open panel if required fields missing
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const missingBillNo = !header.billNo?.trim();
        const missingSupplier =
          header.purchaseType === "CREDIT" && !header.supplier;
        if (!billDetailsOpen && (missingBillNo || missingSupplier)) {
          openBillDetailsAndFocus();
          return;
        }
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [header, rows, billDetailsOpen]);

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
      <PurchaseNavigation onNavigate={tryNavigate} title="Purchase" />

      <div className="flex-1 min-h-0 overflow-hidden p-0">
        {editingPurchaseId && (
          <div className="px-4 py-2 border-b bg-slate-50 border-slate-200 flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-500">Saved bill open</span>

            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await printPurchaseBill(editingPurchaseId, {
                    preview: true,
                  });
                  if (!res?.success) alert(res?.error || "Print failed");
                } catch (e: any) {
                  alert("Print failed: " + String(e?.message || e));
                }
              }}
              className="px-3 py-1.5 rounded-md bg-[#1e3a5f] text-white text-sm hover:bg-[#16304f] transition-colors"
            >
              Print Bill
            </button>

            <BarcodePrintCenterButton
              licenseId={licenseId}
              initialRows={
                showBarcodePrint ? getPrintCenterRowsFromPurchaseRows() : []
              }
              defaultShopName={shopName}
              buttonText="Print Barcodes"
              className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              open={showBarcodePrint}
              onOpen={() => setShowBarcodePrint(true)}
              onClose={() => setShowBarcodePrint(false)}
            />

            <button
              type="button"
              onClick={() => resetAll()}
              className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              New Bill
            </button>
          </div>
        )}
        <div
          className={[
            "grid overflow-hidden transition-all duration-200",
            editingPurchaseId ? "h-[calc(100%-41px)]" : "h-full",
            // Mobile: single column always
            "grid-cols-1",
            // md+: side panel visible
            billDetailsOpen
              ? "md:grid-cols-[240px_1fr] lg:grid-cols-[300px_1fr]"
              : "md:grid-cols-[40px_1fr]  lg:grid-cols-[40px_1fr]",
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
              onToggle={() => setBillDetailsOpen((v) => !v)}
            />
          </div>

          <div className="min-h-0 flex flex-col bg-white overflow-hidden">
            <ItemsTableSection
              rows={rows}
              products={products}
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
              showHoldControls={!editingPurchaseId}
              onRequestBatchSelect={handleRequestBatchSelect}
              onBarcodeCommit={handleBarcodeCommit}
              onOpenMobileSheet={() => setIsMobileSheetOpen(true)}
              printBarcodesSlot={
                <BarcodePrintCenterButton
                  licenseId={licenseId}
                  initialRows={
                    showBarcodePrint ? getPrintCenterRowsFromPurchaseRows() : []
                  }
                  defaultShopName={shopName}
                  buttonText="Print Barcodes"
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
            />
          </div>
        </div>
      )}

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

      {/* Batch conflict modal with per-row choices */}
      {batchConfirmOpen && batchConflicts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-5 py-3 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                Batch price conflicts
              </h2>
              <p className="mt-1 text-xs text-gray-600">
                For each product, choose whether to update the existing batch
                prices or create a new batch.
              </p>
            </div>

            {/* Body */}
            <div className="px-5 py-3 overflow-auto flex-1">
              <div className="space-y-4 text-xs">
                {batchConflicts.rows.map((c) => {
                  const decision = batchDecisions[c.rowIndex] ?? "OVERRIDE";
                  return (
                    <div
                      key={c.rowIndex}
                      className="border border-gray-200 rounded-md p-3 bg-gray-50/60"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            Row #{c.rowIndex + 1} – {c.productName}
                          </div>
                          {c.barcode && (
                            <div className="text-[11px] text-gray-500">
                              Barcode: {c.barcode}
                            </div>
                          )}
                        </div>

                        {/* Per-row radio options */}
                        <div className="flex gap-3 text-[11px]">
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              className="h-3 w-3"
                              checked={decision === "OVERRIDE"}
                              onChange={() =>
                                setBatchDecisions((prev) => ({
                                  ...prev,
                                  [c.rowIndex]: "OVERRIDE",
                                }))
                              }
                            />
                            <span>Override existing batch</span>
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              className="h-3 w-3"
                              checked={decision === "NEW"}
                              onChange={() =>
                                setBatchDecisions((prev) => ({
                                  ...prev,
                                  [c.rowIndex]: "NEW",
                                }))
                              }
                            />
                            <span>Create new batch</span>
                          </label>
                        </div>
                      </div>

                      {/* Diff cards */}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {Object.entries(c.diffs).map(([field, diff]) => (
                          <div
                            key={field}
                            className="text-[11px] bg-white rounded border border-gray-200 px-2 py-1"
                          >
                            <div className="font-semibold text-gray-700">
                              {field}
                            </div>
                            <div className="text-gray-500 line-through">
                              Current: {diff.current ?? "—"}
                            </div>
                            <div className="text-emerald-700">
                              New: {diff.proposed ?? "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="px-5 py-3 border-t flex justify-between items-center gap-3">
              {/* Confirm-all helpers */}
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  className="px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setBatchDecisions((prev) => {
                      const next = { ...prev };
                      batchConflicts.rows.forEach((c) => {
                        next[c.rowIndex] = "OVERRIDE";
                      });
                      return next;
                    });
                  }}
                >
                  Override all
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setBatchDecisions((prev) => {
                      const next = { ...prev };
                      batchConflicts.rows.forEach((c) => {
                        next[c.rowIndex] = "NEW";
                      });
                      return next;
                    });
                  }}
                >
                  New batch for all
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setBatchConfirmOpen(false);
                    setBatchConflicts(null);
                    setBatchDecisions({});
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md bg-[#1e3a5f] text-sm text-white hover:bg-[#16304f] transition-colors"
                  onClick={async () => {
                    if (!batchConflicts) return;

                    const indices = new Set(
                      batchConflicts.rows.map((c) => c.rowIndex),
                    );

                    const patchedRows = rows.map((r, idx) => {
                      if (!indices.has(idx)) return r;
                      const decision =
                        batchDecisions[idx] ?? ("OVERRIDE" as BatchDecision);
                      return {
                        ...r,
                        overrideBatchPrices: decision === "OVERRIDE",
                        forceNewBatch: decision === "NEW",
                      };
                    });

                    setRows(patchedRows);

                    setBatchConfirmOpen(false);
                    setBatchConflicts(null);
                    setBatchDecisions({});

                    await handleSave({
                      skipBatchCheck: true,
                      rowsOverride: patchedRows,
                    });
                  }}
                >
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation modal */}
      <ValidationModal
        isOpen={validationOpen}
        messages={validationMsgs}
        onClose={() => setValidationOpen(false)}
      />

      {/* Batch picker modal */}
      <BatchSelectModal
        isOpen={Boolean(batchPicker)}
        onClose={() => setBatchPicker(null)}
        batches={batchPicker?.batches || []}
        productName={batchPicker?.productName}
        nextBarcode={batchPicker?.nextBarcode || ""}
        onSelect={(batch) => {
          if (!batchPicker) return;

          const rowIndex = batchPicker.rowIndex;

          if (!batch) {
            setBatchPicker(null);
            setTimeout(() => {
              const el = document.querySelector<HTMLInputElement>(
                `[data-cell="${rowIndex}:barcode"]`,
              );
              if (el) {
                el.focus();
                el.select();
              }
            }, 0);
            return;
          }

          setRows((prev) =>
            prev.map((r, i) =>
              i !== rowIndex
                ? r
                : {
                    ...r,
                    barcode: batch.barcode || r.barcode,
                    batchNo: batch.batchNo ?? r.batchNo,
                    mfgDate: batch.mfgDate ?? r.mfgDate,
                    expiryDate: batch.expiryDate ?? r.expiryDate,
                    forceNewBatch: false,
                    mrp:
                      typeof r.mrp === "number" && r.mrp > 0
                        ? r.mrp
                        : batch.mrp != null
                          ? Number(batch.mrp)
                          : r.mrp,
                    salePrice:
                      typeof r.salePrice === "number" && r.salePrice > 0
                        ? r.salePrice
                        : batch.salePrice != null
                          ? Number(batch.salePrice)
                          : r.salePrice,
                  },
            ),
          );

          setBatchPicker(null);

          setTimeout(() => {
            const el = document.querySelector<HTMLInputElement>(
              `[data-cell="${rowIndex}:barcode"]`,
            );
            if (el) {
              el.focus();
              el.select();
            }
          }, 0);
        }}
        onAddNewBatch={(barcode: string) => {
          if (!batchPicker) return;
          const rowIndex = batchPicker.rowIndex;

          setRows((prev) =>
            prev.map((r, i) =>
              i !== rowIndex
                ? r
                : {
                    ...r,
                    barcode,
                    forceNewBatch: true,
                  },
            ),
          );

          setBatchPicker(null);

          setTimeout(() => {
            const el = document.querySelector<HTMLInputElement>(
              `[data-cell="${rowIndex}:barcode"]`,
            );
            if (el) {
              el.focus();
              el.select();
            }
          }, 0);
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
