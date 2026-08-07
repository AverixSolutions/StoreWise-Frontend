// src/app/dashboard/purchase-return/page.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { platform } from "@/platform";
import { canUseBarcode } from "@/lib/session/runtimeSession";
import PurchaseNavigation from "@/components/purchase/PurchaseNavigation";
import BillDetailsSection from "@/components/purchase/BillDetailsSection";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import PromptModal from "@/components/ui/PromptModal";
import ReturnHoldsModal from "@/components/purchase-return/ReturnHoldsModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  HeaderForm,
  ItemRow,
  Product,
  BatchInfo,
  type AvailableNamedRate,
} from "@/components/purchase/types";
import {
  createEmptyRow,
  calcRow,
  validateReturnBill,
  mapItems,
  rowsFromDbItems,
  headerFromReturnDb,
} from "@/components/purchase/utils";
import ValidationModal from "@/components/ui/ValidationModal";
import PurchaseReturnReportsModal from "@/components/purchase-return/PurchaseReturnReportsModal";
import BatchSelectModal from "@/components/purchase/BatchSelectModal";
import OperationFeedbackModal, {
  type OperationFeedbackTone,
} from "@/components/ui/OperationFeedbackModal";
import PurchaseReturnEntrySettingsModal from "@/components/purchase-return/PurchaseReturnEntrySettingsModal";
import PurchaseReturnSourceDetailsModal from "@/components/purchase-return/PurchaseReturnSourceDetailsModal";
import {
  DEFAULT_PURCHASE_RETURN_UI_SETTINGS,
  loadPurchaseReturnUiSettings,
  savePurchaseReturnUiSettings,
  type PurchaseReturnUiSettings,
} from "@/components/purchase-return/purchaseReturnUiSettings";
import { focusCell } from "@/components/purchase/keyboardGrid";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import { printPurchaseReturn } from "@/lib/print/printPurchaseReturn";
import type { RateTypeRecord } from "@/platform/types";
import {
  findDefaultRateType,
  orderActiveRateTypes,
  resolveNamedRate,
} from "@/lib/rates/rateResolution";

function makeSnapshot(header: HeaderForm, rows: ItemRow[]) {
  return JSON.stringify({
    header,
    rows: rows.map((r) => ({
      productId: r.productId,
      batchId: r.batchId,
      barcode: r.barcode,
      unit: r.unit,
      rate: r.rate,
      quantity: r.quantity,
      mrp: r.mrp,
      taxPercent: r.taxPercent,
      discountType: r.discountType,
      discount: r.discount,
      salePrice: r.salePrice,
      batchNo: r.batchNo,
      purchaseBatchNo: r.purchaseBatchNo,
      mfgDate: r.mfgDate,
      expiryDate: r.expiryDate,
      lineType: r.lineType,
      sellingRatesJson: r.sellingRatesJson,
      sourcePurchaseId: r.sourcePurchaseId,
      sourcePurchaseItemId: r.sourcePurchaseItemId,
      purchasedQuantity: r.purchasedQuantity,
      previouslyReturnedQuantity: r.previouslyReturnedQuantity,
      remainingReturnableQuantity: r.remainingReturnableQuantity,
      sourceDiscountPerUnit: r.sourceDiscountPerUnit,
      sourceAvailableStock: r.sourceAvailableStock,
    })),
  });
}

function queuePurchaseReturnFocus(resolveTarget: () => HTMLElement | null) {
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

function visiblePurchaseReturnHeaderFields(root: HTMLElement) {
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

function firstVisiblePurchaseReturnField(selector: string) {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
      (element) => {
        if (element.hasAttribute("disabled")) return false;
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          element.getClientRects().length > 0
        );
      },
    ) ?? null
  );
}

type PurchaseReturnFeedbackState = {
  tone: OperationFeedbackTone;
  title: string;
  message: string;
  primaryText?: string;
};

type SourcePurchaseItem = {
  id: string;
  purchaseId: string;
  productId: string;
  productName?: string | null;
  productCode?: string | null;
  barcode?: string | null;
  quantity: number;
  unit: ItemRow["unit"];
  rate: number;
  mrp?: number | null;
  taxPercent: ItemRow["taxPercent"];
  discount?: number | null;
  discountType?: string | null;
  salePrice?: number | null;
  batchNo?: string | null;
  purchaseBatchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number | null;
  isFree?: boolean | number;
  batchId?: string | null;
  sellingRatesJson?: string | null;
  previouslyReturnedQuantity: number;
  remainingReturnableQuantity: number;
  availableStock: number;
};

type SourcePurchaseState = {
  purchase: {
    id: string;
    slNo?: number | null;
    billNo?: string | null;
    supplierId?: string | null;
    supplierName?: string | null;
    purchaseDate: string;
    totalAmount: number;
    discount?: number | null;
    purchaseType?: string | null;
    department?: string | null;
    debitAccount?: string | null;
    natureOfEntry?: string | null;
  };
  items: SourcePurchaseItem[];
};

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseSourceSellingRates(value: unknown): AvailableNamedRate[] {
  if (value == null || value === "") return [];

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];

    const raw = entry as Record<string, unknown>;
    const rateTypeId = String(
      raw.rateTypeId || raw.code || raw.name || "",
    ).trim();
    const code = String(raw.code || rateTypeId).trim();
    const name = String(raw.name || raw.code || rateTypeId).trim();

    if (!rateTypeId || !name) return [];

    const rawAmount = raw.amount;
    const amount =
      rawAmount == null || rawAmount === "" ? null : Number(rawAmount);
    const validAmount =
      amount != null && Number.isFinite(amount) ? amount : null;

    return [
      {
        rateTypeId,
        code,
        name,
        amount: validAmount,
        configured: validAmount != null,
        isDefault:
          raw.isDefault === true ||
          raw.isDefault === 1 ||
          raw.isDefault === "1",
      },
    ];
  });
}

function purchaseBillLabel(purchase: {
  slNo?: number | null;
  billNo?: string | null;
  purchaseDate?: string | null;
  totalAmount?: number | null;
}) {
  const reference =
    String(purchase.billNo || "").trim() ||
    (purchase.slNo != null ? `Entry #${purchase.slNo}` : "Purchase bill");
  const date = purchase.purchaseDate
    ? new Date(purchase.purchaseDate).toLocaleDateString("en-IN")
    : "";
  const total = Number(purchase.totalAmount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return [reference, date, `Rs. ${total}`].filter(Boolean).join(" - ");
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

export default function PurchaseReturnPage() {
  const router = useRouter();
  const barcodeEnabled = canUseBarcode();

  const licenseId =
    typeof window !== "undefined" ? localStorage.getItem("licenseId")! : "";
  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("userName") || "U1"
      : "U1";

  const [isBillDetailsOpen, setIsBillDetailsOpen] = useState(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [transactionTypes, setTransactionTypes] = useState<
    Array<{ id: string; name: string; isDefault: number }>
  >([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [rateTypes, setRateTypes] = useState<RateTypeRecord[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);
  const [sourcePurchaseOptions, setSourcePurchaseOptions] = useState<any[]>([]);
  const [sourcePurchase, setSourcePurchase] =
    useState<SourcePurchaseState | null>(null);
  const [sourcePurchaseLoading, setSourcePurchaseLoading] = useState(false);
  const [sourcePurchaseError, setSourcePurchaseError] = useState<string | null>(
    null,
  );
  const sourcePurchaseRequestRef = useRef(0);

  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);
  const [editingSlNo, setEditingSlNo] = useState<number | null>(null);

  const [header, setHeader] = useState<HeaderForm>({
    billNo: "",
    supplier: null,
    department: "",
    debitAccount: "",
    natureOfEntry: "",
    purchaseDate: new Date().toISOString(),
    entryTime: new Date().toISOString(),
    discount: 0,
    purchaseType: "CASH",
    typeId: null,
    sourcePurchaseId: null,
  });

  const [rows, setRows] = useState<ItemRow[]>([createEmptyRow(1)]);
  const [isDirty, setIsDirty] = useState(false);
  const initialSnapshot = useRef<string | null>(null);
  const rowsRef = useRef(rows);
  const headerRef = useRef(header);
  const editingReturnIdRef = useRef(editingReturnId);
  const billDetailsOpenRef = useRef(isBillDetailsOpen);
  const handleSaveRef = useRef<() => Promise<boolean>>(async () => false);
  const handleCancelRef = useRef<() => void>(() => {});
  const handleHoldRef = useRef<() => void>(() => {});

  const [showHolds, setShowHolds] = useState(false);
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const [defaultHoldTitle, setDefaultHoldTitle] = useState<string>("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const [validationOpen, setValidationOpen] = useState(false);
  const [validationMsgs, setValidationMsgs] = useState<string[]>([]);

  const [showReports, setShowReports] = useState(false);
  const [showPurchaseReturnSettings, setShowPurchaseReturnSettings] =
    useState(false);
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  const [purchaseReturnUiSettings, setPurchaseReturnUiSettings] =
    useState<PurchaseReturnUiSettings>(DEFAULT_PURCHASE_RETURN_UI_SETTINGS);
  const [feedback, setFeedback] = useState<PurchaseReturnFeedbackState | null>(
    null,
  );

  function showFeedback(next: PurchaseReturnFeedbackState) {
    setFeedback(next);
  }

  const [batchPicker, setBatchPicker] = useState<{
    rowIndex: number;
    productId: string;
    batches: BatchInfo[];
    productName?: string;
    nextBarcode: string;
  } | null>(null);

  useEffect(() => {
    rowsRef.current = rows;
    headerRef.current = header;
    editingReturnIdRef.current = editingReturnId;
    billDetailsOpenRef.current = isBillDetailsOpen;
  });

  useEffect(() => {
    setPurchaseReturnUiSettings(loadPurchaseReturnUiSettings());
  }, []);

  function clearSourcePurchase(clearRows = true) {
    sourcePurchaseRequestRef.current += 1;
    setSourcePurchase(null);
    setSourcePurchaseError(null);
    setShowSourceDetails(false);
    setHeader((current) => ({
      ...current,
      sourcePurchaseId: null,
      billNo: "",
      discount: 0,
    }));
    if (clearRows) {
      setRows([createEmptyRow(1)]);
    }
  }

  function handleReturnSupplierChange(
    supplier: { id: string; name: string } | null,
  ) {
    const editingSourceLinked =
      Boolean(editingReturnIdRef.current) &&
      Boolean(headerRef.current.sourcePurchaseId);

    if (editingSourceLinked) {
      setValidationMsgs([
        "The supplier is locked while editing a source-linked Purchase Return.",
        "Start a New Return to select another supplier or Purchase bill.",
      ]);
      setValidationOpen(true);
      return;
    }

    const hadSourcePurchase = Boolean(headerRef.current.sourcePurchaseId);
    sourcePurchaseRequestRef.current += 1;
    setSourcePurchase(null);
    setSourcePurchaseError(null);

    if (hadSourcePurchase) {
      setRows([createEmptyRow(1)]);
    }

    setHeader((current) => ({
      ...current,
      supplier,
      sourcePurchaseId: null,
      billNo: hadSourcePurchase ? "" : current.billNo,
      discount: hadSourcePurchase ? 0 : current.discount,
      purchaseType:
        !supplier && current.purchaseType === "CREDIT"
          ? "CASH"
          : current.purchaseType,
    }));
  }

  async function fetchSourcePurchase(
    purchaseId: string,
    excludeReturnId?: string | null,
  ): Promise<SourcePurchaseState> {
    if (!platform.getPurchaseReturnSource) {
      throw new Error("Purchase Return source-bill API is unavailable.");
    }

    const result = await platform.getPurchaseReturnSource(
      purchaseId,
      excludeReturnId || null,
    );

    if (!result?.success || !result.purchase) {
      throw new Error(result?.error || "Failed to load the Purchase bill.");
    }

    return {
      purchase: {
        ...result.purchase,
        totalAmount: Number(result.purchase.totalAmount || 0),
        discount: Number(result.purchase.discount || 0),
      },
      items: (result.items || []) as SourcePurchaseItem[],
    };
  }

  function buildRowsFromSource(
    source: SourcePurchaseState,
    existingRows: ItemRow[] = [],
  ) {
    const existingBySourceItem = new Map(
      existingRows
        .filter((row) => row.sourcePurchaseItemId)
        .map((row) => [row.sourcePurchaseItemId as string, row]),
    );

    return source.items
      .map((item, index) => {
        const existing = existingBySourceItem.get(item.id);
        const purchasedQuantity = Number(item.quantity || 0);
        const previousQuantity = Number(item.previouslyReturnedQuantity || 0);
        const remainingQuantity = Math.max(
          0,
          Number(item.remainingReturnableQuantity || 0),
        );
        const availableStock = Math.max(0, Number(item.availableStock || 0));
        const maxQuantity = Math.min(remainingQuantity, availableStock);
        const requested = existing ? Number(existing.quantity || 0) : 0;
        const quantity = Math.max(0, Math.min(requested, maxQuantity));
        const sourceDiscountPerUnit = purchasedQuantity
          ? Number(item.discount || 0) / purchasedQuantity
          : 0;
        const parsedSourceRates = parseSourceSellingRates(
          item.sellingRatesJson,
        );
        const sourceAvailableRates =
          parsedSourceRates.length > 0
            ? parsedSourceRates
            : existing?.availableRates || [];

        return calcRow({
          ...createEmptyRow(index + 1),
          lineNo: index + 1,
          productId: item.productId,
          code: item.productCode || "",
          barcode: item.barcode || "",
          name: item.productName || "",
          unit: item.unit,
          rate: Number(item.rate || 0),
          quantity,
          mrp: item.mrp ?? null,
          taxPercent: item.taxPercent,
          discountType: "ABS",
          discount: roundMoney(sourceDiscountPerUnit * quantity),
          salePrice: item.salePrice ?? null,
          batchId: item.batchId ?? null,
          batchNo: item.batchNo ?? null,
          purchaseBatchNo: item.purchaseBatchNo ?? item.batchNo ?? null,
          mfgDate: item.mfgDate ?? null,
          expiryDate: item.expiryDate ?? null,
          lineType: item.isFree ? "FREE" : "VALUED",
          availableRates: sourceAvailableRates,
          sellingRatesJson: item.sellingRatesJson ?? null,
          sourcePurchaseId: source.purchase.id,
          sourcePurchaseItemId: item.id,
          purchasedQuantity,
          previouslyReturnedQuantity: previousQuantity,
          remainingReturnableQuantity: remainingQuantity,
          sourceDiscountPerUnit,
          sourceAvailableStock: availableStock,
        });
      })
      .filter(
        (row) =>
          Number(row.remainingReturnableQuantity || 0) > 0 ||
          Number(row.quantity || 0) > 0,
      );
  }

  async function applySourcePurchase(
    purchaseId: string,
    existingRows: ItemRow[] = [],
    excludeReturnId?: string | null,
  ) {
    const requestId = ++sourcePurchaseRequestRef.current;
    setSourcePurchaseLoading(true);
    setSourcePurchaseError(null);

    try {
      const source = await fetchSourcePurchase(purchaseId, excludeReturnId);
      if (requestId !== sourcePurchaseRequestRef.current) return null;

      const selectedSupplierId = headerRef.current.supplier?.id || "";
      if (
        selectedSupplierId &&
        source.purchase.supplierId &&
        source.purchase.supplierId !== selectedSupplierId
      ) {
        throw new Error(
          "The selected Purchase bill does not belong to the chosen supplier.",
        );
      }

      const nextRows = buildRowsFromSource(source, existingRows);
      if (!nextRows.length) {
        throw new Error(
          "Every item in this Purchase bill has already been fully returned or is unavailable in stock.",
        );
      }

      setSourcePurchase(source);
      setSourcePurchaseOptions((current) => {
        if (current.some((row) => row.id === source.purchase.id))
          return current;
        return [source.purchase, ...current];
      });
      setHeader((current) => ({
        ...current,
        sourcePurchaseId: source.purchase.id,
        billNo:
          String(source.purchase.billNo || "").trim() ||
          `Purchase #${source.purchase.slNo ?? ""}`,
        supplier: source.purchase.supplierId
          ? {
              id: source.purchase.supplierId,
              name: source.purchase.supplierName || "Supplier",
            }
          : current.supplier,
        department: source.purchase.department || current.department,
        debitAccount: source.purchase.debitAccount || current.debitAccount,
        natureOfEntry: source.purchase.natureOfEntry || current.natureOfEntry,
        purchaseType:
          source.purchase.purchaseType === "CASH" ? "CASH" : "CREDIT",
      }));
      setRows(nextRows);
      return { source, rows: nextRows };
    } catch (error) {
      if (requestId !== sourcePurchaseRequestRef.current) return null;
      const message = String(
        (error as Error)?.message || "Failed to load the Purchase bill.",
      );
      setSourcePurchase(null);
      setSourcePurchaseError(message);
      setValidationMsgs([message]);
      setValidationOpen(true);
      return null;
    } finally {
      if (requestId === sourcePurchaseRequestRef.current) {
        setSourcePurchaseLoading(false);
      }
    }
  }

  function updateReturnRow(index: number, patch: Partial<ItemRow>) {
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        if (!row.sourcePurchaseItemId) {
          return { ...row, ...patch };
        }

        const next: ItemRow = { ...row };

        if (patch.quantity !== undefined) {
          const maxQuantity = Math.min(
            Math.max(0, Number(row.remainingReturnableQuantity || 0)),
            Math.max(0, Number(row.sourceAvailableStock || 0)),
          );
          const quantity = Math.max(
            0,
            Math.min(Number(patch.quantity || 0), maxQuantity),
          );
          next.quantity = quantity;
          next.discount = roundMoney(
            Number(row.sourceDiscountPerUnit || 0) * quantity,
          );
        }

        const editableSourceKeys: Array<keyof ItemRow> = [
          "batchId",
          "barcode",
          "batchNo",
          "purchaseBatchNo",
          "mfgDate",
          "expiryDate",
          "mrp",
          "salePrice",
          "availableRates",
          "sellingRatesJson",
          "sourceAvailableStock",
        ];

        editableSourceKeys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(patch, key)) {
            (next as any)[key] = (patch as any)[key];
          }
        });

        return next;
      }),
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

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const res = await platform.getProducts(licenseId, {
        page: 1,
        pageSize: 200,
      });
      setProducts(res?.products || []);
    })();

    (async () => {
      const res = await platform.peekNextPurchaseReturnSlNo?.(licenseId);
      setNextEntryNo(res?.nextSlNo ?? 1);
    })();
  }, [licenseId]);

  useEffect(() => {
    void (async () => {
      try {
        const result = await platform.listRateTypes(licenseId, false);
        setRateTypes(orderActiveRateTypes(result?.rows || []));
      } catch (error) {
        console.error("Failed to load Purchase Return rate types", error);
        setRateTypes([]);
      }
    })();
  }, [licenseId]);

  useEffect(() => {
    (async () => {
      const res = await platform.listSuppliers?.(licenseId, {
        q: "",
        page: 1,
        pageSize: 100,
      });
      setSuppliers(
        (res?.suppliers || []).map((s: any) => ({ id: s.id, name: s.name })),
      );
    })();
  }, [licenseId]);

  useEffect(() => {
    setHeader((s) =>
      !s.supplier && s.purchaseType === "CREDIT"
        ? { ...s, purchaseType: "CASH" }
        : s,
    );
  }, [header.supplier]);

  useEffect(() => {
    const supplierId = header.supplier?.id || "";
    const requestId = ++sourcePurchaseRequestRef.current;

    if (!supplierId) {
      setSourcePurchaseOptions([]);
      setSourcePurchaseLoading(false);
      setSourcePurchaseError(null);
      return;
    }

    setSourcePurchaseLoading(true);
    setSourcePurchaseError(null);

    void (async () => {
      try {
        const result = await platform.listPurchases?.(licenseId, {
          supplierId,
          page: 1,
          pageSize: 250,
          includeDeleted: false,
        });

        if (requestId !== sourcePurchaseRequestRef.current) return;
        if (!result?.success) {
          throw new Error(result?.error || "Failed to load supplier bills.");
        }

        setSourcePurchaseOptions(result.rows || []);
      } catch (error) {
        if (requestId !== sourcePurchaseRequestRef.current) return;
        setSourcePurchaseOptions([]);
        setSourcePurchaseError(
          String((error as Error)?.message || "Failed to load supplier bills."),
        );
      } finally {
        if (requestId === sourcePurchaseRequestRef.current) {
          setSourcePurchaseLoading(false);
        }
      }
    })();
  }, [header.supplier?.id, licenseId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await platform.listTransactionTypes?.(
          licenseId,
          "purchaseReturn",
        );
        if (res?.success) setTransactionTypes(res.rows);
      } catch (e) {
        console.error("Failed to fetch transaction types", e);
      }
    })();
  }, [licenseId]);

  // ── Product / batch selection ─────────────────────────────────────────────

  const resolveManualReturnRatePatch = useCallback(
    async (
      productId: string,
      batchId: string | null,
      legacySalePrice: number | null | undefined,
    ): Promise<Partial<ItemRow>> => {
      const activeTypes = orderActiveRateTypes(rateTypes);
      if (!activeTypes.length) {
        return {
          salePrice: legacySalePrice == null ? null : Number(legacySalePrice),
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
          isDefault: Boolean(rateType.isDefault),
        };
      });

      const defaultType = findDefaultRateType(activeTypes);
      const defaultValue = availableRates.find(
        (rate) => rate.rateTypeId === defaultType?.id,
      );

      return {
        salePrice:
          defaultValue?.amount ??
          (legacySalePrice == null ? null : Number(legacySalePrice)),
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

  const handleSelectProduct = async (rowIndex: number, productId: string) => {
    if (headerRef.current.sourcePurchaseId) {
      setValidationMsgs([
        "Products are locked to the selected Purchase bill.",
        "Use F2 to choose another existing batch for the same product.",
      ]);
      setValidationOpen(true);
      return;
    }

    try {
      const [product, batchesRes] = await Promise.all([
        platform.getProduct(productId),
        barcodeEnabled
          ? platform.listBarcodesForProduct?.(licenseId, productId)
          : platform.listBatchesForProduct(productId, false),
      ]);

      if (!product) return;

      const batches: BatchInfo[] = (batchesRes?.rows || [])
        .filter((batch: any) => Number(batch.stock || 0) > 0)
        .map((batch: any) => ({
          id: batch.id,
          barcode: barcodeEnabled ? batch.barcode : "",
          batchNo: batch.batchNo,
          purchaseBatchNo: batch.purchaseBatchNo || batch.batchNo,
          mfgDate: batch.mfgDate,
          expiryDate: batch.expiryDate,
          mrp: batch.mrp,
          salePrice: batch.salePrice,
          costPrice: batch.costPrice,
          stock: batch.stock,
        }));

      const ratePatch = await resolveManualReturnRatePatch(
        productId,
        null,
        product.salePrice,
      );

      setRows((currentRows) =>
        currentRows.map((row, index) =>
          index !== rowIndex
            ? row
            : {
                ...row,
                ...ratePatch,
                productId,
                code: product.code,
                name: product.name,
                unit: product.unit,
                taxPercent: product.tax,
                rate: Number(product.costPrice) || 0,
                mrp: null,
                batchId: null,
                barcode: "",
                batchNo: "",
                purchaseBatchNo: "",
                mfgDate: null,
                expiryDate: null,
                forceNewBatch: false,
                sourcePurchaseId: null,
                sourcePurchaseItemId: null,
                purchasedQuantity: 0,
                previouslyReturnedQuantity: 0,
                remainingReturnableQuantity: 0,
                sourceDiscountPerUnit: 0,
                sourceAvailableStock: 0,
              },
        ),
      );

      if (batches.length) {
        setBatchPicker({
          rowIndex,
          productId,
          batches,
          productName: product.name,
          nextBarcode: "",
        });
        return;
      }

      window.setTimeout(() => focusCell(rowIndex, "quantity"), 0);
    } catch (error) {
      console.error("Failed to select Purchase Return product", error);
      setValidationMsgs([
        String(
          (error as Error)?.message ||
            "Failed to load the selected product and its batches.",
        ),
      ]);
      setValidationOpen(true);
    }
  };

  const handleRequestBatchSelect = async (
    rowIndex: number,
    explicitProductId?: string,
  ) => {
    const row = rowsRef.current[rowIndex];
    const productId = explicitProductId || row?.productId;
    if (!productId) return;

    try {
      const batchesRes = barcodeEnabled
        ? await platform.listBarcodesForProduct?.(licenseId, productId)
        : await platform.listBatchesForProduct(productId, false);

      const liveBatches: BatchInfo[] = (batchesRes?.rows || [])
        .filter((batch: any) => Number(batch.stock || 0) > 0)
        .map((batch: any) => ({
          id: batch.id,
          barcode: barcodeEnabled ? batch.barcode : "",
          batchNo: batch.batchNo,
          purchaseBatchNo: batch.purchaseBatchNo || batch.batchNo,
          mfgDate: batch.mfgDate,
          expiryDate: batch.expiryDate,
          mrp: batch.mrp,
          salePrice: batch.salePrice,
          costPrice: batch.costPrice,
          stock: batch.stock,
        }));

      if (!liveBatches.length) {
        setValidationMsgs([
          "No batch with available stock exists for this product.",
        ]);
        setValidationOpen(true);
        return;
      }

      setBatchPicker({
        rowIndex,
        productId,
        batches: liveBatches,
        productName:
          products.find((product) => product.id === productId)?.name ||
          row?.name,
        nextBarcode: "",
      });
    } catch (error) {
      console.error("Failed to load return batches", error);
      setValidationMsgs([
        String((error as Error)?.message || "Failed to load return batches."),
      ]);
      setValidationOpen(true);
    }
  };

  async function handleBatchSelection(batch: BatchInfo | null) {
    const picker = batchPicker;
    if (!picker || !batch) {
      setBatchPicker(null);
      return;
    }

    const currentRow = rowsRef.current[picker.rowIndex];
    if (!currentRow?.productId) {
      setBatchPicker(null);
      return;
    }

    let ratePatch: Partial<ItemRow> = {};
    if (!currentRow.sourcePurchaseItemId) {
      ratePatch = await resolveManualReturnRatePatch(
        currentRow.productId,
        batch.id,
        batch.salePrice ?? currentRow.salePrice,
      );
    }

    const batchPatch: Partial<ItemRow> = {
      ...ratePatch,
      batchId: batch.id,
      barcode: barcodeEnabled ? batch.barcode || "" : "",
      batchNo: batch.batchNo ?? null,
      purchaseBatchNo: batch.purchaseBatchNo ?? batch.batchNo ?? null,
      mfgDate: batch.mfgDate ?? null,
      expiryDate: batch.expiryDate ?? null,
      mrp: batch.mrp ?? currentRow.mrp ?? null,
      sourceAvailableStock: currentRow.sourcePurchaseItemId
        ? Math.max(0, Number(batch.stock || 0))
        : currentRow.sourceAvailableStock,
    };

    if (!currentRow.sourcePurchaseItemId) {
      batchPatch.rate =
        batch.costPrice != null && Number.isFinite(Number(batch.costPrice))
          ? Number(batch.costPrice)
          : currentRow.rate;
    }

    updateReturnRow(picker.rowIndex, batchPatch);
    setBatchPicker(null);
    window.setTimeout(() => focusCell(picker.rowIndex, "quantity"), 0);
  }

  // ── Open from reports ─────────────────────────────────────────────────────

  async function handleOpenPurchaseReturnFromReport(returnId: string) {
    let supplierOptions = suppliers;
    if (supplierOptions.length === 0) {
      const res = await platform.listSuppliers?.(licenseId, {
        q: "",
        page: 1,
        pageSize: 100,
      });
      supplierOptions = (res?.suppliers || []).map((s: any) => ({
        id: s.id,
        name: s.name,
      }));
      setSuppliers(supplierOptions);
    }

    const res = await platform.getPurchaseReturnFull?.(returnId);
    if (!res?.success) {
      setValidationMsgs(["Failed to load purchase return."]);
      setValidationOpen(true);
      return;
    }

    const ret = res.purchaseReturn;
    // FIX: guard against missing purchaseReturn
    if (!ret) {
      setValidationMsgs(["Purchase return data missing."]);
      setValidationOpen(true);
      return;
    }

    const items = res.items || [];
    const nextHeader = headerFromReturnDb(ret, supplierOptions);
    const storedRows = rowsFromDbItems(items);
    let nextRows = storedRows;

    setEditingReturnId(returnId);
    setEditingSlNo(ret.slNo ?? null);
    editingReturnIdRef.current = returnId;
    headerRef.current = nextHeader;
    rowsRef.current = storedRows;

    if (ret.purchaseId) {
      const loaded = await applySourcePurchase(
        ret.purchaseId,
        storedRows,
        returnId,
      );
      if (loaded) {
        nextRows = loaded.rows;
        nextHeader.sourcePurchaseId = ret.purchaseId;
        nextHeader.billNo =
          String(loaded.source.purchase.billNo || "").trim() ||
          nextHeader.billNo;
      }
    } else {
      setSourcePurchase(null);
      setSourcePurchaseError(null);
      nextHeader.sourcePurchaseId = null;
    }

    setHeader(nextHeader);
    setRows(nextRows);
    setShowReports(false);

    initialSnapshot.current = makeSnapshot(nextHeader, nextRows);
    setIsDirty(false);
  }

  // ── Row calculations ──────────────────────────────────────────────────────

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

  const addRow = () => {
    if (headerRef.current.sourcePurchaseId) {
      setValidationMsgs([
        "Items are loaded from the selected Purchase bill.",
        "Choose another source bill to return a different product.",
      ]);
      setValidationOpen(true);
      return;
    }
    setRows((prev) => [...prev, createEmptyRow(prev.length + 1)]);
  };
  const removeRow = (index: number) =>
    setRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, lineNo: i + 1 })),
    );

  // ── Save ──────────────────────────────────────────────────────────────────

  function showPurchaseReturnError(err: any) {
    const raw = String(err?.message || err || "Unknown error");
    if (
      raw.includes("Purchase") ||
      raw.includes("return") ||
      raw.includes("batch") ||
      raw.includes("stock") ||
      raw.includes("available")
    ) {
      setValidationMsgs([raw]);
    } else {
      setValidationMsgs([
        "Something went wrong while saving the purchase return.",
      ]);
    }
    setValidationOpen(true);
  }

  const handleSave = async () => {
    const items = mapItems(rows);
    const errs = validateReturnBill(header, items);

    if (header.purchaseType === "CREDIT" && !header.supplier) {
      errs.push("Select a supplier for CREDIT Purchase Return.");
    }

    const sourceMode = Boolean(header.sourcePurchaseId);
    const activeItems = items.filter(
      (item) => item.productId && Number(item.quantity || 0) > 0,
    );

    if (sourceMode) {
      activeItems.forEach((item) => {
        if (!item.purchaseItemId) {
          errs.push(`Line ${item.lineNo}: source Purchase item is missing.`);
        }
      });

      rows
        .filter((row) => row.productId && Number(row.quantity || 0) > 0)
        .forEach((row) => {
          const maxQuantity = Math.min(
            Math.max(0, Number(row.remainingReturnableQuantity || 0)),
            Math.max(0, Number(row.sourceAvailableStock || 0)),
          );
          if (Number(row.quantity || 0) > maxQuantity) {
            errs.push(
              `Line ${row.lineNo}: return quantity cannot exceed ${maxQuantity}.`,
            );
          }
        });
    }

    if (errs.length) {
      setValidationMsgs(errs);
      setValidationOpen(true);
      return false;
    }

    const commonHeader = {
      purchaseId: header.sourcePurchaseId || null,
      returnDate: header.purchaseDate,
      entryTime: header.entryTime,
      billNo: header.billNo || null,
      supplierId: header.supplier?.id || null,
      supplierName: header.supplier?.name || null,
      department: header.department || null,
      debitAccount: header.debitAccount || null,
      natureOfEntry: header.natureOfEntry || null,
      discount: header.discount || 0,
      licenseId,
      userId,
      purchaseType: header.purchaseType,
      typeId: header.typeId || null,
    };

    try {
      if (editingReturnId) {
        // UPDATE existing return
        const res = await platform.updatePurchaseReturn?.({
          id: editingReturnId,
          header: commonHeader,
          items,
        });
        if (res?.success) {
          showFeedback({
            tone: "success",
            title: "Purchase return updated",
            message: `Return #${editingSlNo ?? ""} was updated successfully.\nTotal: Rs. ${(
              res.totalAmount ?? grandTotal
            ).toFixed(2)}`,
            primaryText: "Done",
          });
          resetAll();
          return true;
        }
        showPurchaseReturnError(res?.error || "Update failed");
        return false;
      } else {
        // CREATE new return
        const res = await platform.createPurchaseReturn?.({
          header: commonHeader,
          items,
        });
        if (res?.success) {
          showFeedback({
            tone: "success",
            title: "Purchase return saved",
            message: `Return #${res.slNo ?? ""} was saved successfully.\nTotal: Rs. ${(
              res.totalAmount ?? grandTotal
            ).toFixed(2)}`,
            primaryText: "Done",
          });
          setEditingReturnId(res.returnId || null);
          setEditingSlNo(res.slNo ?? null);
          initialSnapshot.current = makeSnapshot(header, rows);
          setIsDirty(false);
          const peek = await platform.peekNextPurchaseReturnSlNo?.(licenseId);
          setNextEntryNo(peek?.nextSlNo ?? null);
          return true;
        }
        showPurchaseReturnError(res?.error || "Save failed");
        return false;
      }
    } catch (err) {
      showPurchaseReturnError(err);
      return false;
    }
  };

  const handleCancel = () => {
    if (!isDirty) {
      resetAll();
      return;
    }
    setPendingPath(null);
    setLeaveOpen(true);
  };

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
      purchaseType: "CASH",
      typeId: null,
      sourcePurchaseId: null,
    };
    const freshRows = [createEmptyRow(1)];
    setHeader(freshHeader);
    setRows(freshRows);
    setEditingReturnId(null);
    setEditingSlNo(null);
    sourcePurchaseRequestRef.current += 1;
    setSourcePurchase(null);
    setSourcePurchaseError(null);
    setSourcePurchaseOptions([]);
    setShowSourceDetails(false);
    billDetailsOpenRef.current = true;
    setIsBillDetailsOpen(true);
    setIsMobileSheetOpen(false);
    initialSnapshot.current = makeSnapshot(freshHeader, freshRows);
    setIsDirty(false);
  }

  // ── Holds ─────────────────────────────────────────────────────────────────

  async function saveHold(title?: string) {
    const payload = {
      id: undefined as string | undefined,
      licenseId,
      userId,
      title: title || undefined,
      header,
      rows,
    };
    const res = await platform.savePurchaseReturnHold?.(payload);
    if (res?.success) {
      showFeedback({
        tone: "success",
        title: "Return held",
        message: `Saved as hold #${res.holdNo}${title ? ` - ${title}` : ""}.`,
        primaryText: "Open Holds",
      });
      setShowHolds(true);
    } else {
      showFeedback({
        tone: "error",
        title: "Hold failed",
        message: String(res?.error || "The purchase return could not be held."),
        primaryText: "Close",
      });
    }
  }

  function handleHold() {
    setDefaultHoldTitle(header.billNo || "");
    setShowTitlePrompt(true);
  }

  function handleShowHolds() {
    setShowHolds(true);
  }

  async function handleResumeHold(holdId: string) {
    const res = await platform.getPurchaseReturnHold?.(holdId);
    if (res?.success && res.hold) {
      const heldHeader = res.hold.header as HeaderForm;
      const heldRows = res.hold.rows as ItemRow[];
      let nextRows = heldRows;
      headerRef.current = heldHeader;
      rowsRef.current = heldRows;

      if (heldHeader.sourcePurchaseId) {
        const loaded = await applySourcePurchase(
          heldHeader.sourcePurchaseId,
          heldRows,
          null,
        );
        if (loaded) nextRows = loaded.rows;
      } else {
        setSourcePurchase(null);
      }

      setHeader(heldHeader);
      setRows(nextRows);
      setShowHolds(false);
      setIsDirty(true);
    }
  }

  useEffect(() => {
    handleSaveRef.current = handleSave;
    handleCancelRef.current = handleCancel;
    handleHoldRef.current = handleHold;
  });

  const focusBillDetails = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setIsMobileSheetOpen(true);
    } else {
      billDetailsOpenRef.current = true;
      setIsBillDetailsOpen(true);
    }
    queuePurchaseReturnFocus(() =>
      firstVisiblePurchaseReturnField(
        '[data-purchase-header-field="sourcePurchase"], [data-purchase-header-field="supplier"]',
      ),
    );
  }, []);

  const toggleBillDetails = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setIsMobileSheetOpen((current) => !current);
      return;
    }

    const nextOpen = !billDetailsOpenRef.current;
    billDetailsOpenRef.current = nextOpen;
    setIsBillDetailsOpen(nextOpen);
  }, []);

  const focusLastBillDetail = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setIsMobileSheetOpen(true);
    } else {
      billDetailsOpenRef.current = true;
      setIsBillDetailsOpen(true);
    }

    queuePurchaseReturnFocus(() => {
      const firstField = firstVisiblePurchaseReturnField(
        '[data-purchase-header-field="sourcePurchase"], [data-purchase-header-field="supplier"]',
      );
      const root = firstField?.closest<HTMLElement>("section");
      if (!root) return firstField;

      const fields = visiblePurchaseReturnHeaderFields(root);
      return fields.at(-1) ?? firstField;
    });
  }, []);

  const focusItemEntry = useCallback(() => {
    const currentRows = rowsRef.current;

    if (headerRef.current.sourcePurchaseId) {
      const sourceRowIndex = Math.max(
        0,
        currentRows.findIndex(
          (row) =>
            row.sourcePurchaseItemId &&
            Number(row.quantity || 0) <= 0 &&
            Number(row.remainingReturnableQuantity || 0) > 0,
        ),
      );
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          focusCell(sourceRowIndex, "quantity");
        });
      });
      return;
    }

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

  function activeReturnRowIndex() {
    const active = document.activeElement as HTMLElement | null;
    const cell = active?.closest<HTMLElement>("[data-cell]");
    const token = cell?.dataset.cell;
    const parsed = token ? Number(token.split(":")[0]) : Number.NaN;
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;

    const firstPopulated = rowsRef.current.findIndex((row) => row.productId);
    return firstPopulated >= 0 ? firstPopulated : 0;
  }

  useEffect(() => {
    if (!sourcePurchase) return;

    const sourceTotal = Number(sourcePurchase.purchase.totalAmount || 0);
    const sourceDiscount = Number(sourcePurchase.purchase.discount || 0);
    const discountRatio =
      sourceTotal > 0 ? Math.max(0, sourceDiscount / sourceTotal) : 0;
    const proportionalDiscount = roundMoney(subTotal * discountRatio);

    setHeader((current) =>
      Math.abs(Number(current.discount || 0) - proportionalDiscount) < 0.005
        ? current
        : { ...current, discount: proportionalDiscount },
    );
  }, [sourcePurchase, subTotal]);

  function renderSourcePurchaseControl() {
    const supplierSelected = Boolean(header.supplier?.id);
    const options = sourcePurchaseOptions.map((purchase) => ({
      value: purchase.id,
      label: purchaseBillLabel(purchase),
    }));

    return (
      <div>
        <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
          Purchase Bill <span className="text-slate-400">(Optional)</span>
        </label>
        <SearchableDropdown
          value={header.sourcePurchaseId || ""}
          onChange={(value) => {
            if (!value) {
              if (!editingReturnIdRef.current) clearSourcePurchase();
              return;
            }
            if (
              editingReturnIdRef.current &&
              value !== headerRef.current.sourcePurchaseId
            ) {
              setValidationMsgs([
                "The source Purchase bill cannot be changed while editing.",
                "Start a New Return to select another bill.",
              ]);
              setValidationOpen(true);
              return;
            }
            void applySourcePurchase(
              value,
              editingReturnIdRef.current ? rowsRef.current : [],
              editingReturnIdRef.current,
            );
          }}
          options={options}
          placeholder={
            !supplierSelected
              ? "Select supplier first"
              : sourcePurchaseLoading
                ? "Loading supplier bills..."
                : options.length
                  ? "Select Purchase bill..."
                  : "No Purchase bills found"
          }
          controlClassName="h-8 text-xs px-2"
          inputClassName="h-8 text-xs"
          optionClassName="text-xs"
          menuClassName="z-[1150] max-h-64 text-xs"
          buttonProps={{
            "data-purchase-header-field": "sourcePurchase",
            "aria-label": "Purchase bill",
          }}
        />
        <p
          className={`mt-1 text-[9px] leading-4 ${
            sourcePurchaseError ? "text-rose-600" : "text-slate-500"
          }`}
        >
          {sourcePurchaseError ||
            (supplierSelected
              ? "Optional: choose a bill for source-linked limits, or leave blank for manual return."
              : "Manual mode is available. Select a supplier to optionally load Purchase bills.")}
        </p>
      </div>
    );
  }

  const handlePrintPurchaseReturn = useCallback(async () => {
    const returnId = editingReturnIdRef.current;
    if (!returnId) {
      setValidationMsgs(["Save the Purchase Return before printing."]);
      setValidationOpen(true);
      return;
    }

    try {
      await printPurchaseReturn(returnId, undefined, (tone, message) => {
        if (tone === "error") {
          setValidationMsgs([message]);
          setValidationOpen(true);
          return;
        }
        if (tone === "success") {
          showFeedback({
            tone: "success",
            title: "Purchase Return printed",
            message,
            primaryText: "Done",
          });
        }
      });
    } catch (error) {
      setValidationMsgs([
        String((error as Error)?.message || "Failed to print Purchase Return."),
      ]);
      setValidationOpen(true);
    }
  }, []);

  // ── Dirty tracking + keyboard shortcuts ──────────────────────────────────

  useEffect(() => {
    const snap = makeSnapshot(header, rows);
    if (initialSnapshot.current === null) {
      initialSnapshot.current = snap;
      setIsDirty(false);
      return;
    }
    setIsDirty(initialSnapshot.current !== snap);
  }, [header, rows]);

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
    showPurchaseReturnSettings ||
    showSourceDetails ||
    showHolds ||
    showReports ||
    showTitlePrompt ||
    Boolean(batchPicker) ||
    leaveOpen ||
    validationOpen ||
    isMobileSheetOpen ||
    Boolean(feedback);

  // Purchase Return keyboard map:
  // F2 Batch | F3 Item | F4 Bill Details | F5 Source Details
  // F6 Reports | F7 Settings | F8 Holds | F9 Hold
  // Ctrl/Cmd+S Save | Ctrl/Cmd+P Print | Ctrl/Cmd+N New/Clear
  // Ctrl/Cmd+\ Toggle Bill Details | Ctrl/Cmd+B Back
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || hasBlockingOverlay) return;

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const toggleBillDetailsShortcut =
        modifier && (event.code === "Backslash" || key === "\\" || key === "|");

      if (toggleBillDetailsShortcut) {
        event.preventDefault();
        event.stopPropagation();
        toggleBillDetails();
        return;
      }

      if (event.defaultPrevented || event.altKey) return;

      if (modifier && key === "s") {
        event.preventDefault();
        void handleSaveRef.current();
        return;
      }

      if (modifier && key === "p") {
        event.preventDefault();
        void handlePrintPurchaseReturn();
        return;
      }

      if (modifier && key === "n") {
        event.preventDefault();
        handleCancelRef.current();
        return;
      }

      if (modifier) return;

      if (event.key === "F2") {
        const rowIndex = activeReturnRowIndex();
        if (rowsRef.current[rowIndex]?.productId) {
          event.preventDefault();
          void handleRequestBatchSelect(rowIndex);
        }
        return;
      }

      if (event.key === "F3") {
        event.preventDefault();
        focusItemEntry();
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        focusBillDetails();
        return;
      }

      if (event.key === "F5") {
        event.preventDefault();
        if (sourcePurchase) setShowSourceDetails(true);
        return;
      }

      if (event.key === "F6") {
        event.preventDefault();
        setShowReports(true);
        return;
      }

      if (event.key === "F7") {
        event.preventDefault();
        setShowPurchaseReturnSettings(true);
        return;
      }

      if (event.key === "F8") {
        event.preventDefault();
        if (!editingReturnIdRef.current) setShowHolds(true);
        return;
      }

      if (event.key === "F9") {
        event.preventDefault();
        if (!editingReturnIdRef.current) handleHoldRef.current();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    focusBillDetails,
    focusItemEntry,
    handlePrintPurchaseReturn,
    hasBlockingOverlay,
    sourcePurchase,
    toggleBillDetails,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <PurchaseNavigation
        onNavigate={tryNavigate}
        title="Purchase Return"
        keyboardEnabled={!hasBlockingOverlay}
        savedBillOpen={Boolean(editingReturnId)}
        onPrintBill={handlePrintPurchaseReturn}
        onNewBill={handleCancel}
        savedLabel="Saved return open"
        printLabel="Print Return"
        newLabel="New Return"
      />

      <div className="min-h-0 flex-1 overflow-hidden p-0">
        <div
          className={[
            "grid h-full overflow-hidden transition-all duration-200",
            "grid-cols-1",
            isBillDetailsOpen
              ? "md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]"
              : "md:grid-cols-[44px_1fr] lg:grid-cols-[44px_1fr]",
          ]
            .join(" ")
            .trim()}
        >
          <div className="hidden min-h-0 overflow-hidden md:flex md:flex-col">
            <BillDetailsSection
              header={header}
              setHeader={setHeader}
              suppliers={suppliers}
              setShowSupplierModal={() => {}}
              subTotal={subTotal}
              grandTotal={grandTotal}
              onSave={handleSave}
              onCancel={handleCancel}
              entryNo={
                editingReturnId
                  ? (editingSlNo ?? undefined)
                  : (nextEntryNo ?? undefined)
              }
              requireSupplier={header.purchaseType === "CREDIT"}
              isEditing={Boolean(editingReturnId)}
              showBillNoField={false}
              sourcePurchaseControl={renderSourcePurchaseControl()}
              onSupplierChange={handleReturnSupplierChange}
              isOpen={isBillDetailsOpen}
              onToggle={toggleBillDetails}
              transactionTypes={transactionTypes}
              uiSettings={purchaseReturnUiSettings}
              onFocusItems={focusItemEntry}
            />
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden bg-white">
            <ItemsTableSection
              mode="RETURN"
              rows={rows}
              products={products}
              onSelectProduct={handleSelectProduct}
              barcodeEnabled={barcodeEnabled}
              onUpdateRow={updateReturnRow}
              onAddRow={addRow}
              onRemoveRow={removeRow}
              subTotal={subTotal}
              grandTotal={grandTotal}
              headerDiscount={header.discount}
              onHold={handleHold}
              onShowHolds={handleShowHolds}
              onShowReports={() => setShowReports(true)}
              onPrintBill={handlePrintPurchaseReturn}
              canPrint={Boolean(editingReturnId)}
              onOpenSettings={() => setShowPurchaseReturnSettings(true)}
              onOpenDetails={
                sourcePurchase ? () => setShowSourceDetails(true) : undefined
              }
              detailsTitle="Source Purchase Details"
              detailsShortcut="F5"
              onFocusItems={focusItemEntry}
              onFocusBillDetails={focusBillDetails}
              onToggleBillDetails={toggleBillDetails}
              onFocusPreviousSection={focusLastBillDetail}
              uiSettings={purchaseReturnUiSettings}
              showHoldControls={!editingReturnId}
              onRequestBatchSelect={handleRequestBatchSelect}
              onOpenMobileSheet={() => setIsMobileSheetOpen(true)}
              hasMissingFields={
                header.purchaseType === "CREDIT" && !header.supplier
              }
            />
          </div>
        </div>
      </div>

      {isMobileSheetOpen && (
        <div className="fixed inset-0 z-[900] md:hidden">
          <button
            type="button"
            aria-label="Close Bill Details"
            className="absolute inset-0 bg-black/45"
            onClick={() => setIsMobileSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Purchase Return
                </p>
                <h3 className="text-sm font-semibold text-slate-800">
                  Bill Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSheetOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Close
              </button>
            </div>
            <BillDetailsSection
              header={header}
              setHeader={setHeader}
              suppliers={suppliers}
              setShowSupplierModal={() => {}}
              subTotal={subTotal}
              grandTotal={grandTotal}
              onSave={async () => {
                const ok = await handleSave();
                if (ok) setIsMobileSheetOpen(false);
              }}
              onCancel={() => {
                handleCancel();
                setIsMobileSheetOpen(false);
              }}
              entryNo={
                editingReturnId
                  ? (editingSlNo ?? undefined)
                  : (nextEntryNo ?? undefined)
              }
              requireSupplier={header.purchaseType === "CREDIT"}
              isEditing={Boolean(editingReturnId)}
              showBillNoField={false}
              sourcePurchaseControl={renderSourcePurchaseControl()}
              onSupplierChange={handleReturnSupplierChange}
              isOpen={true}
              onToggle={() => {}}
              transactionTypes={transactionTypes}
              uiSettings={purchaseReturnUiSettings}
              onFocusItems={focusItemEntry}
            />
          </div>
        </div>
      )}

      <PurchaseReturnSourceDetailsModal
        open={showSourceDetails}
        source={sourcePurchase}
        rows={rows}
        onClose={() => setShowSourceDetails(false)}
      />

      <PurchaseReturnEntrySettingsModal
        open={showPurchaseReturnSettings}
        settings={purchaseReturnUiSettings}
        onClose={() => setShowPurchaseReturnSettings(false)}
        onSave={(nextSettings) => {
          setPurchaseReturnUiSettings(nextSettings);
          savePurchaseReturnUiSettings(nextSettings);
        }}
      />

      {showReports && (
        <PurchaseReturnReportsModal
          isOpen={showReports}
          onClose={() => setShowReports(false)}
          licenseId={licenseId}
          suppliers={suppliers}
          onOpenPurchaseReturn={handleOpenPurchaseReturnFromReport}
        />
      )}

      <ReturnHoldsModal
        isOpen={showHolds}
        onClose={() => setShowHolds(false)}
        licenseId={licenseId}
        onResume={handleResumeHold}
      />

      <BatchSelectModal
        isOpen={Boolean(batchPicker)}
        onClose={() => setBatchPicker(null)}
        batches={batchPicker?.batches || []}
        productName={batchPicker?.productName}
        nextBarcode=""
        allowCreateNew={false}
        barcodeEnabled={barcodeEnabled}
        onSelect={(batch) => {
          void handleBatchSelection(batch);
        }}
        onAddNewBatch={() => setBatchPicker(null)}
      />

      <PromptModal
        isOpen={showTitlePrompt}
        title="Save Return as Hold"
        label="Optional title"
        placeholder="e.g., Damaged returns"
        defaultValue={defaultHoldTitle}
        confirmText="Save Hold"
        onCancel={() => setShowTitlePrompt(false)}
        onConfirm={(val) => {
          setShowTitlePrompt(false);
          saveHold(val.trim());
        }}
      />

      <ConfirmModal
        isOpen={leaveOpen}
        title="Leave this page?"
        message={
          "You have unsaved changes.\n\n• Save & Exit: save the return and go.\n• Discard: leave without saving.\n• Cancel: stay on this page."
        }
        confirmText="Save & Exit"
        secondaryText="Discard"
        cancelText="Cancel"
        onConfirm={async () => {
          setLeaveOpen(false);
          const ok = await handleSave();
          if (ok && pendingPath) {
            const path = pendingPath;
            setPendingPath(null);
            router.push(path);
          }
        }}
        onSecondary={() => {
          setLeaveOpen(false);
          setIsDirty(false);
          if (pendingPath) {
            const path = pendingPath;
            setPendingPath(null);
            router.push(path);
          } else {
            resetAll();
          }
        }}
        onCancel={() => {
          setLeaveOpen(false);
          setPendingPath(null);
        }}
      />

      <ValidationModal
        isOpen={validationOpen}
        messages={validationMsgs}
        onClose={() => setValidationOpen(false)}
      />

      <OperationFeedbackModal
        isOpen={Boolean(feedback)}
        tone={feedback?.tone}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        primaryText={feedback?.primaryText || "Done"}
        onPrimary={() => setFeedback(null)}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
