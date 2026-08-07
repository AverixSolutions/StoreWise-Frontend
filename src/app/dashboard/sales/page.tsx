// src/app/dashboard/sales/page.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, X } from "lucide-react";
import SalesNavigation from "@/components/sales/SalesNavigation";
import BillDetailsSection from "@/components/sales/BillDetailsSection";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import HoldsModal from "@/components/sales/HoldsModal";
import SalesReportsModal from "@/components/sales/SalesReportsModal";
import SalesOffersPanel from "@/components/sales/SalesOffersPanel";
import SalesEntrySettingsModal from "@/components/sales/SalesEntrySettingsModal";
import {
  DEFAULT_SALES_UI_SETTINGS,
  loadSalesUiSettings,
  saveSalesUiSettings,
  type SalesUiSettings,
} from "@/components/sales/salesUiSettings";
import PromptModal from "@/components/ui/PromptModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ValidationModal from "@/components/ui/ValidationModal";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import OperationFeedbackModal, {
  type OperationFeedbackTone,
} from "@/components/ui/OperationFeedbackModal";
import BatchSelectModal from "@/components/purchase/BatchSelectModal";
import { calculateOffers } from "@/components/sales/offerEngine";
import type { OfferEngineResult } from "@/components/sales/offerEngine";
import {
  HeaderForm,
  ItemRow,
  Customer,
  BatchInfo,
} from "@/components/sales/types";
import {
  createEmptyRow,
  calcRow,
  validateSaleBill,
  mapItems,
  round2,
} from "@/components/sales/utils";
import { printSaleBill } from "@/lib/print/printSaleBill";
import { platform } from "@/platform";
import type {
  OfferRecord,
  OfferTargetProductRecord,
  QuotationRow,
  RateTypeRecord,
} from "@/platform/types";
import {
  findDefaultRateType,
  orderActiveRateTypes,
  resolveNamedRate,
} from "@/lib/rates/rateResolution";
import { isSyncEnabled } from "@/platform/mode";
import { canUseBarcode } from "@/lib/session/runtimeSession";
import { SyncManager } from "@/sync/SyncManager";
import { useSyncStatus } from "@/sync/SyncProvider";
import { focusCell } from "@/components/purchase/keyboardGrid";
import type { PurchaseUiSettings } from "@/components/purchase/purchaseUiSettings";

const offerClearPatch: Partial<ItemRow> = {
  originalRate: null,
  originalSalePrice: null,
  appliedRate: null,
  offerId: null,
  offerName: null,
  offerType: null,
  offerDiscountAmount: 0,
  offerMessage: null,
  offerMeta: null,
};

function offerRowsSignature(rows: ItemRow[]) {
  return JSON.stringify(
    rows.map((r) => ({
      id: r.productId,
      q: r.quantity,
      rate: r.rate,
      originalRate: r.originalRate,
      appliedRate: r.appliedRate,
      offerId: r.offerId,
      offerDiscountAmount: r.offerDiscountAmount,
      billedValue: r.billedValue,
    })),
  );
}

function summarizeSavedOffers(rows: ItemRow[]): OfferEngineResult {
  const map = new Map<string, any>();
  for (const row of rows) {
    if (!row.offerId) continue;
    const current = map.get(row.offerId) || {
      offerId: row.offerId,
      offerName: row.offerName || "Saved offer",
      offerType: row.offerType || "OFFER",
      savings: 0,
      rowIndexes: [],
      message: row.offerMessage || "Saved offer snapshot",
    };
    current.savings = round2(
      current.savings + Number(row.offerDiscountAmount || 0),
    );
    current.rowIndexes.push(Number(row.lineNo || 1) - 1);
    map.set(row.offerId, current);
  }
  const appliedOffers = Array.from(map.values());
  return {
    rows,
    appliedOffers,
    eligibleOffers: [],
    eligibleRationBenefits: [],
    rationWarnings: [],
    validationWarnings: [],
    totalOfferSavings: round2(
      appliedOffers.reduce((sum, offer) => sum + offer.savings, 0),
    ),
  };
}

function parseDisabledOfferIds(raw?: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
    if (Array.isArray(parsed?.disabledOfferIds)) {
      return parsed.disabledOfferIds.map(String);
    }
  } catch {}
  return [];
}

function offerOverridesJson(ids: string[]) {
  return JSON.stringify({ disabledOfferIds: Array.from(new Set(ids)) });
}

function formatQuotationDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN");
}

function getQuotationGrandTotal(row: QuotationRow) {
  return Math.max(0, Number(row.totalAmount || 0) - Number(row.discount || 0));
}

function formatQuotationOption(row: QuotationRow) {
  const no =
    row.quotationNo ||
    (row.slNo != null ? `QT-${String(row.slNo).padStart(4, "0")}` : row.id);
  const customer = row.customerName || "No customer";
  const date = formatQuotationDate(row.quotationDate);
  const amount = getQuotationGrandTotal(row).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  });
  return [no, customer, date, `Rs. ${amount}`].filter(Boolean).join(" | ");
}

function toSaleTaxPercent(value: unknown): ItemRow["taxPercent"] {
  const tax = String(value || "NT");
  return ["NT", "P5", "P12", "P18", "P28"].includes(tax)
    ? (tax as ItemRow["taxPercent"])
    : "NT";
}

function toDiscountType(value: unknown): ItemRow["discountType"] {
  return value === "PCT" ? "PCT" : "ABS";
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
      originalRate: r.originalRate,
      appliedRate: r.appliedRate,
      offerId: r.offerId,
      offerName: r.offerName,
      offerType: r.offerType,
      offerDiscountAmount: r.offerDiscountAmount,
      offerMeta: r.offerMeta,
      rateTypeId: r.rateTypeId,
      rateTypeCode: r.rateTypeCode,
      rateTypeName: r.rateTypeName,
      rateSource: r.rateSource,
    })),
  });
}

// Unified finalize-after-successful-save flow
function queueSalesFocus(getTarget: () => HTMLElement | null) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const target = getTarget();
      if (!target) return;
      target.focus({ preventScroll: true });
      if (target instanceof HTMLInputElement) target.select();
    });
  });
}

function visibleSalesHeaderFields(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-sales-header-focus]"),
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

type FeedbackChoice = "primary" | "secondary";

type SalesFeedbackState = {
  tone: OperationFeedbackTone;
  title: string;
  message: string;
  primaryText: string;
  secondaryText?: string;
};

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runPostSavePrint({
  shouldPrint,
  printFn,
}: {
  shouldPrint: boolean;
  printFn?: () => Promise<any>;
}): Promise<string | null> {
  if (!shouldPrint || !printFn) return null;
  try {
    const result = await printFn();
    if (result?.success === false) {
      return String(
        result?.error || "The sale was saved, but printing failed.",
      );
    }
    return null;
  } catch (error: any) {
    return `The sale was saved, but printing failed: ${String(
      error?.message || error,
    )}`;
  }
}

export default function SalesPage() {
  const router = useRouter();
  const { pullNow } = useSyncStatus();

  const [isClient, setIsClient] = useState(false);
  const [licenseId, setLicenseId] = useState("demo-license");
  const [userId, setUserId] = useState("admin");

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== "undefined") {
      setLicenseId(localStorage.getItem("licenseId") || "demo-license");
      setUserId(localStorage.getItem("userName") || "admin");
      setSalesUiSettings(loadSalesUiSettings());
    }
  }, []);

  const [products, setProducts] = useState<any[]>([]);
  const [rateTypes, setRateTypes] = useState<RateTypeRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);

  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingSlNo, setEditingSlNo] = useState<number | null>(null);
  const [billDetailsOpen, setBillDetailsOpen] = useState(true);

  const [transactionTypes, setTransactionTypes] = useState<
    Array<{ id: string; name: string; isDefault: number }>
  >([]);

  const [header, setHeader] = useState<HeaderForm>({
    billNo: "",
    customer: null,
    department: "",
    debitAccount: "",
    natureOfEntry: "",
    saleDate: new Date().toISOString(),
    entryTime: new Date().toISOString(),
    discount: 0,
    saleType: "CASH",
    typeId: null,
    offerSummaryJson: null,
    offerSavings: 0,
    offerOverridesJson: null,
  });

  const [rows, setRows] = useState<ItemRow[]>([createEmptyRow(1)]);
  const rowsRef = useRef(rows);
  const headerRef = useRef(header);
  const editingSaleIdRef = useRef(editingSaleId);
  const billDetailsOpenRef = useRef(billDetailsOpen);
  const handleSaveRef = useRef<() => Promise<boolean>>(async () => false);
  const handleCancelRef = useRef<() => void>(() => {});
  const handleHoldRef = useRef<() => void>(() => {});
  const [activeOffers, setActiveOffers] = useState<OfferRecord[]>([]);
  const [offerTargets, setOfferTargets] = useState<OfferTargetProductRecord[]>(
    [],
  );
  const [disabledOfferIds, setDisabledOfferIds] = useState<string[]>([]);
  const [offersOpen, setOffersOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialSnapshot = useRef<string | null>(null);
  const initialQuotationParamLoaded = useRef(false);

  const [quotationOptions, setQuotationOptions] = useState<QuotationRow[]>([]);
  const [quotationOptionsLoading, setQuotationOptionsLoading] = useState(false);
  const [quotationOptionsError, setQuotationOptionsError] = useState<
    string | null
  >(null);
  const quotationOptionsLoadingRef = useRef(false);
  const [quotationLoadingId, setQuotationLoadingId] = useState<string | null>(
    null,
  );
  const [sourceQuotationId, setSourceQuotationId] = useState<string | null>(
    null,
  );
  const [sourceQuotationNo, setSourceQuotationNo] = useState<string | null>(
    null,
  );
  const [quotationWarning, setQuotationWarning] = useState<string | null>(null);
  const [pendingQuotationId, setPendingQuotationId] = useState<string | null>(
    null,
  );
  const [quotationReplaceConfirmOpen, setQuotationReplaceConfirmOpen] =
    useState(false);

  const [showHolds, setShowHolds] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showSalesSettings, setShowSalesSettings] = useState(false);
  const [salesUiSettings, setSalesUiSettings] = useState<SalesUiSettings>(
    DEFAULT_SALES_UI_SETTINGS,
  );
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const [defaultHoldTitle, setDefaultHoldTitle] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationMsgs, setValidationMsgs] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<SalesFeedbackState | null>(null);
  const feedbackResolveRef = useRef<((choice: FeedbackChoice) => void) | null>(
    null,
  );
  const [batchPicker, setBatchPicker] = useState<{
    rowIndex: number;
    productId: string;
    batches: BatchInfo[];
    productName?: string;
    nextBarcode: string;
  } | null>(null);

  // NEW: Cancel confirmation modal
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const barcodeEnabled = isClient ? canUseBarcode() : true;

  useEffect(() => {
    rowsRef.current = rows;
    headerRef.current = header;
    editingSaleIdRef.current = editingSaleId;
    billDetailsOpenRef.current = billDetailsOpen;
  });

  const requestFeedback = useCallback(
    (nextFeedback: SalesFeedbackState) =>
      new Promise<FeedbackChoice>((resolve) => {
        if (feedbackResolveRef.current) {
          feedbackResolveRef.current("secondary");
        }
        feedbackResolveRef.current = resolve;
        setFeedback(nextFeedback);
      }),
    [],
  );

  const settleFeedback = useCallback((choice: FeedbackChoice) => {
    const resolve = feedbackResolveRef.current;
    feedbackResolveRef.current = null;
    setFeedback(null);
    resolve?.(choice);
  }, []);

  useEffect(
    () => () => {
      feedbackResolveRef.current?.("secondary");
      feedbackResolveRef.current = null;
    },
    [],
  );

  const itemGridUiSettings = useMemo<PurchaseUiSettings>(
    () => ({
      showTransactionType: salesUiSettings.showTransactionType,
      showPurchaseTime: salesUiSettings.showSaleTime,
      showEntryDate: salesUiSettings.showEntryDate,
      showDepartment: salesUiSettings.showDepartment,
      showDebitAccount: salesUiSettings.showDebitAccount,
      showNatureOfEntry: salesUiSettings.showNatureOfEntry,
      showHeaderDiscount: salesUiSettings.showHeaderDiscount,
      showUnit: salesUiSettings.showUnit,
      showTax: salesUiSettings.showTax,
      showLineDiscount: salesUiSettings.showLineDiscount,
      showSellingRates: true,
      showMrp: salesUiSettings.showMrp,
      showLineType: salesUiSettings.showLineType,
      showMfgDate: salesUiSettings.showMfgDate,
      showExpiryDate: salesUiSettings.showExpiryDate,
      showUnitBilled: salesUiSettings.showUnitBilled,
    }),
    [salesUiSettings],
  );

  async function handlePrintBill() {
    if (!editingSaleId) return;
    try {
      const res = await printSaleBill(editingSaleId);
      if (!res?.success) {
        await requestFeedback({
          tone: "error",
          title: "Print failed",
          message: String(res?.error || "The saved sale could not be printed."),
          primaryText: "Close",
        });
      }
    } catch (error: any) {
      await requestFeedback({
        tone: "error",
        title: "Print failed",
        message: String(
          error?.message || "The saved sale could not be printed.",
        ),
        primaryText: "Close",
      });
    }
  }

  const loadQuotationOptions = useCallback(
    async (showLoading = true) => {
      if (!isClient || !licenseId || !platform.listQuotations) {
        quotationOptionsLoadingRef.current = false;
        setQuotationOptionsLoading(false);
        setQuotationOptions([]);
        setQuotationOptionsError("Quotation loading is unavailable.");
        return;
      }
      if (quotationOptionsLoadingRef.current) return;

      quotationOptionsLoadingRef.current = true;
      if (showLoading) setQuotationOptionsLoading(true);
      setQuotationOptionsError(null);

      try {
        const [draftRes, sentRes] = await Promise.all([
          withTimeout(
            platform.listQuotations(licenseId, {
              status: "DRAFT",
              page: 1,
              pageSize: 5000,
            }),
            12000,
            "Quotation loading timed out. Please retry.",
          ),
          withTimeout(
            platform.listQuotations(licenseId, {
              status: "SENT",
              page: 1,
              pageSize: 5000,
            }),
            12000,
            "Quotation loading timed out. Please retry.",
          ),
        ]);

        const byId = new Map<string, QuotationRow>();
        for (const row of [
          ...(draftRes?.rows || []),
          ...(sentRes?.rows || []),
        ]) {
          if (
            row?.id &&
            !row.deletedAt &&
            (row.status === "DRAFT" || row.status === "SENT")
          ) {
            byId.set(row.id, row);
          }
        }

        setQuotationOptions(
          Array.from(byId.values()).sort((a, b) => {
            const bd = new Date(b.quotationDate || 0).getTime();
            const ad = new Date(a.quotationDate || 0).getTime();
            if (bd !== ad) return bd - ad;
            return Number(b.slNo || 0) - Number(a.slNo || 0);
          }),
        );
      } catch (error: any) {
        console.error("Failed to load quotation options", error);
        setQuotationOptions([]);
        setQuotationOptionsError(
          String(error?.message || "Could not load quotations. Please retry."),
        );
      } finally {
        quotationOptionsLoadingRef.current = false;
        setQuotationOptionsLoading(false);
      }
    },
    [isClient, licenseId],
  );

  useEffect(() => {
    if (!isClient) return;
    pullNow("sale");
    pullNow("saleItem");
    pullNow("offer");
    pullNow("offerTargetProduct");
    pullNow("quotation");
    pullNow("quotationItem");
    (async () => {
      const [productRes, rateTypeRes] = await Promise.all([
        platform.getProducts(licenseId, {
          page: 1,
          pageSize: 5000,
        }),
        platform.listRateTypes(licenseId, false),
      ]);
      setProducts(productRes.products);
      setRateTypes(orderActiveRateTypes(rateTypeRes.rows || []));
    })();
    (async () => {
      const res = await platform.peekNextSaleSlNo?.(licenseId);
      setNextEntryNo(res?.nextSlNo ?? 1);
    })();
  }, [licenseId, isClient]);

  const resolveProductRatePatch = useCallback(
    async (
      productId: string,
      batchId: string | null,
      legacyRate: number | null | undefined,
    ): Promise<Partial<ItemRow>> => {
      const activeTypes = orderActiveRateTypes(rateTypes);
      if (!activeTypes.length) {
        const amount = Number(legacyRate || 0);
        return {
          rate: amount,
          salePrice: amount,
          rateTypeId: null,
          rateTypeCode: null,
          rateTypeName: "Legacy",
          rateSource: "LEGACY",
          availableRates: [],
        };
      }

      const [productRateRes, batchRateRes] = await Promise.all([
        platform.listProductRates(licenseId, productId),
        batchId
          ? platform.listProductBatchRates(licenseId, productId, batchId)
          : Promise.resolve({ success: true, rows: [] }),
      ]);
      const productRates = productRateRes.rows || [];
      const batchRates = batchRateRes.rows || [];
      const availableRates = activeTypes.map((rateType) => {
        const resolved = resolveNamedRate({
          rateType,
          productRates,
          batchRates,
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
      const defaultType = findDefaultRateType(activeTypes) || activeTypes[0];
      const selected = availableRates.find(
        (rate) => rate.rateTypeId === defaultType.id,
      );
      return {
        rate: selected?.amount ?? 0,
        salePrice: selected?.amount ?? null,
        rateTypeId: defaultType.id,
        rateTypeCode: defaultType.code,
        rateTypeName: defaultType.name,
        rateSource: "MASTER",
        availableRates,
      };
    },
    [licenseId, rateTypes],
  );

  useEffect(() => {
    loadQuotationOptions();
  }, [loadQuotationOptions]);

  useEffect(() => {
    if (!isClient) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await platform.listActiveOffers?.(
          licenseId,
          header.saleDate,
        );
        const offers = (((res as any)?.offers || res?.rows || []) ??
          []) as OfferRecord[];
        const targetGroups = await Promise.all(
          offers.map(async (offer) => {
            const targetRes = await platform.listOfferTargetProducts?.(
              offer.id,
            );
            return targetRes?.rows || [];
          }),
        );
        const productNames = new Map(products.map((p) => [p.id, p.name]));
        const targets = targetGroups.flat().map((target: any) => ({
          ...target,
          productName: target.productName || productNames.get(target.productId),
        }));
        if (!cancelled) {
          setActiveOffers(offers.filter((offer) => !offer.deletedAt));
          setOfferTargets(targets);
        }
      } catch (e) {
        console.error("Failed to load active offers", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isClient, licenseId, header.saleDate, products]);

  useEffect(() => {
    if (!isClient) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: Event) => {
      const { entity } = (e as CustomEvent<{ entity: string; count: number }>)
        .detail;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (entity === "sale" && !editingSaleId) {
        debounceTimer = setTimeout(() => {
          platform.peekNextSaleSlNo?.(licenseId).then((res) => {
            setNextEntryNo(res?.nextSlNo ?? null);
          });
        }, 150);
      }
      if (entity === "offer" || entity === "offerTargetProduct") {
        debounceTimer = setTimeout(async () => {
          const res = await platform.listActiveOffers?.(
            licenseId,
            header.saleDate,
          );
          const offers = (((res as any)?.offers || res?.rows || []) ??
            []) as OfferRecord[];
          const targetGroups = await Promise.all(
            offers.map(async (offer) => {
              const targetRes = await platform.listOfferTargetProducts?.(
                offer.id,
              );
              return targetRes?.rows || [];
            }),
          );
          setActiveOffers(offers.filter((offer) => !offer.deletedAt));
          setOfferTargets(targetGroups.flat() as OfferTargetProductRecord[]);
        }, 150);
      }
      if (entity === "quotation" || entity === "quotationItem") {
        debounceTimer = setTimeout(() => {
          loadQuotationOptions(false);
        }, 150);
      }
    };
    window.addEventListener("kynflow:sync:updated", handler);
    return () => {
      window.removeEventListener("kynflow:sync:updated", handler);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [
    isClient,
    licenseId,
    editingSaleId,
    header.saleDate,
    loadQuotationOptions,
  ]);

  useEffect(() => {
    loadCustomers();
  }, [showCustomerModal]);

  useEffect(() => {
    if (!isClient) return;
    platform.listTransactionTypes?.(licenseId, "sale").then((res) => {
      if (!res?.success) return;
      const types = (res.rows ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        isDefault: t.isDefault,
      }));
      setTransactionTypes(types);
      setHeader((prev) => {
        if (prev.typeId) return prev;
        const def = types.find(
          (t: { id: string; name: string; isDefault: number }) =>
            t.isDefault === 1,
        );
        return def ? { ...prev, typeId: def.id } : prev;
      });
    });
  }, [licenseId, isClient]);

  const loadCustomers = async (): Promise<Customer[]> => {
    const res = await platform.listCustomers?.(licenseId, {
      q: "",
      page: 1,
      pageSize: 100,
    });
    const mapped = (res?.customers ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      mobile: c.phone ?? null,
      gstin: c.gstin ?? null,
      address:
        [c.addressLine1, c.addressLine2, c.city, c.state]
          .filter(Boolean)
          .join(", ") || null,
    }));
    setCustomers(mapped);
    return mapped;
  };

  function showValidation(messages: string[]) {
    setValidationMsgs(messages);
    setValidationOpen(true);
  }

  function clearLoadedQuotationSource() {
    setSourceQuotationId(null);
    setSourceQuotationNo(null);
    setQuotationWarning(null);
  }

  async function retryQuotationLink() {
    if (!sourceQuotationId || !editingSaleId) return;

    if (!platform.markQuotationConverted) {
      const message =
        "Quotation linking is not available in this runtime. The sale is already saved; do not create another sale for this quotation.";
      setQuotationWarning(message);
      showValidation([message]);
      return;
    }

    setQuotationLoadingId(sourceQuotationId);
    try {
      const result = await platform.markQuotationConverted(
        sourceQuotationId,
        editingSaleId,
      );
      if (!result?.success) {
        throw new Error(result?.error || "Quotation status update failed.");
      }

      if (isSyncEnabled()) {
        SyncManager.pushEntity("quotation").catch(() => {});
      }

      clearLoadedQuotationSource();
      void loadQuotationOptions(false);
      await requestFeedback({
        tone: "success",
        title: "Quotation linked",
        message: "The saved sale is now linked to the quotation.",
        primaryText: "Done",
      });
    } catch (error: any) {
      const message =
        error?.message ||
        "Quotation linking failed. The sale is already saved; do not create another sale for this quotation.";
      setQuotationWarning(message);
      showValidation([
        "The sale is already saved.",
        message,
        "Retry the quotation link instead of creating another sale.",
      ]);
    } finally {
      setQuotationLoadingId(null);
    }
  }

  async function loadQuotationIntoSales(quotationId: string) {
    if (!platform.getQuotationFull) {
      showValidation(["Quotation loading is not available in this runtime."]);
      return;
    }

    if (editingSaleId) {
      showValidation(["Start a new bill before loading a quotation."]);
      return;
    }

    setQuotationLoadingId(quotationId);
    setQuotationWarning(null);

    try {
      const res = await platform.getQuotationFull(quotationId);
      if (!res?.success || !res.quotation) {
        showValidation([res?.error || "Quotation not found."]);
        return;
      }

      const quotation = res.quotation as any;
      const quotationStatus = String(quotation.status || "");
      if (!["DRAFT", "SENT"].includes(quotationStatus)) {
        const message =
          quotationStatus === "CONVERTED"
            ? "This quotation has already been converted."
            : quotationStatus === "EXPIRED"
              ? "Expired quotations cannot be loaded into Sales."
              : "Only draft or sent quotations can be loaded into Sales.";
        showValidation([message]);
        return;
      }

      const quotationItems = (res.items || []).filter(
        (item: any) => item?.productId && !item.deletedAt,
      );
      const hasValidItem = quotationItems.some(
        (item: any) => Number(item.quantity || 0) > 0,
      );
      if (!quotationItems.length || !hasValidItem) {
        showValidation(["Selected quotation has no valid items to load."]);
        return;
      }

      let customerPool = customers;
      if (quotation.customerId && customerPool.length === 0) {
        customerPool = await loadCustomers();
      }

      const customer = quotation.customerId
        ? customerPool.find((c) => c.id === quotation.customerId) || {
            id: quotation.customerId,
            name: quotation.customerName || quotation.customerId,
          }
        : null;

      const productById = new Map(products.map((p) => [p.id, p]));
      const unresolvedProductIds = Array.from(
        new Set<string>(
          quotationItems
            .map((item: any) => String(item.productId || ""))
            .filter(
              (productId: string) => productId && !productById.has(productId),
            ),
        ),
      );

      if (unresolvedProductIds.length > 0) {
        const resolvedProducts = await Promise.all(
          unresolvedProductIds.map(async (productId) => {
            try {
              return await platform.getProduct(productId);
            } catch {
              return null;
            }
          }),
        );

        const hydratedProducts = resolvedProducts.filter(
          (product): product is NonNullable<typeof product> => Boolean(product),
        );

        for (const product of hydratedProducts) {
          productById.set(product.id, product);
        }

        if (hydratedProducts.length > 0) {
          setProducts((current) => {
            const merged = new Map(
              current.map((product) => [product.id, product]),
            );
            for (const product of hydratedProducts) {
              merged.set(product.id, product);
            }
            return Array.from(merged.values());
          });
        }
      }

      const missingProductItems = quotationItems.filter(
        (item: any) => !productById.has(item.productId),
      );
      if (missingProductItems.length > 0) {
        const missingLabels = missingProductItems
          .slice(0, 5)
          .map(
            (item: any) =>
              item.productName || item.productCode || item.productId,
          );

        showValidation([
          "Quotation cannot be loaded because one or more products are missing from the current catalog.",
          `Missing: ${missingLabels.join(", ")}`,
          "Restore or sync these products, then open the quotation again.",
        ]);
        return;
      }

      const nextRows = quotationItems.map((item: any, index: number) => {
        const product = productById.get(item.productId);
        return calcRow({
          lineNo: item.lineNo ?? index + 1,
          productId: item.productId,
          code: item.productCode || product?.code || "",
          barcode: item.barcode ?? "",
          name: item.productName || product?.name || item.productId,
          unit: (item.unit || product?.unit || "NOS") as ItemRow["unit"],
          rate: Number(item.rate) || 0,
          quantity: Number(item.quantity) || 0,
          mrp: item.mrp ?? null,
          taxPercent: toSaleTaxPercent(item.taxPercent),
          discountType: toDiscountType(item.discountType),
          discount: Number(item.discount) || 0,
          profitPercent: 0,
          salePrice: item.salePrice ?? null,
          profit: item.profit ?? null,
          totalCost: Number(item.totalCost) || 0,
          billedValue: Number(item.billedValue) || 0,
          batchId: item.batchId ?? null,
          batchNo: item.batchNo ?? null,
          purchaseBatchNo: item.purchaseBatchNo ?? item.batchNo ?? null,
          mfgDate: item.mfgDate ?? null,
          expiryDate: item.expiryDate ?? null,
          lineType: item.isFree ? "FREE" : "VALUED",
          unitBilled: 0,
          rateTypeId: item.rateTypeId ?? null,
          rateTypeCode: item.rateTypeCode ?? null,
          rateTypeName: item.rateTypeName ?? null,
          rateSource: item.rateSource ?? "LEGACY",
          availableRates: item.rateTypeId
            ? [
                {
                  rateTypeId: item.rateTypeId,
                  code: item.rateTypeCode || "",
                  name: item.rateTypeName || item.rateTypeCode || "Saved rate",
                  amount: Number(item.rate),
                  configured: true,
                },
              ]
            : [],
          ...offerClearPatch,
        });
      });

      const now = new Date().toISOString();
      const quotationNo =
        quotation.quotationNo ||
        (quotation.slNo != null
          ? `QT-${String(quotation.slNo).padStart(4, "0")}`
          : quotation.id || quotationId);
      const nextHeader: HeaderForm = {
        billNo: "",
        customer,
        department: quotation.department || "",
        debitAccount: quotation.debitAccount || "",
        natureOfEntry: quotation.natureOfEntry || "",
        saleDate: now,
        entryTime: now,
        discount: Number(quotation.discount || 0),
        saleType: header.saleType || "CASH",
        typeId: header.typeId ?? null,
        offerSummaryJson: null,
        offerSavings: 0,
        offerOverridesJson: null,
      };

      initialSnapshot.current = makeSnapshot(header, rows);
      setHeader(nextHeader);
      setRows(nextRows);
      setEditingSaleId(null);
      setEditingSlNo(null);
      billDetailsOpenRef.current = true;
      setBillDetailsOpen(true);
      setDisabledOfferIds([]);
      setOffersOpen(false);
      setSourceQuotationId(quotation.id || quotationId);
      setSourceQuotationNo(quotationNo);
      setQuotationWarning(null);
      setIsDirty(true);
    } catch (err: any) {
      showValidation([
        err?.message || "Failed to load the selected quotation into Sales.",
      ]);
    } finally {
      setQuotationLoadingId(null);
    }
  }

  function requestLoadQuotation(quotationId: string) {
    if (!quotationId || quotationId === sourceQuotationId) return;
    if (editingSaleId) {
      showValidation(["Start a new bill before loading a quotation."]);
      return;
    }
    if (isDirty) {
      setPendingQuotationId(quotationId);
      setQuotationReplaceConfirmOpen(true);
      return;
    }
    void loadQuotationIntoSales(quotationId);
  }

  useEffect(() => {
    if (
      !isClient ||
      initialQuotationParamLoaded.current ||
      typeof window === "undefined"
    ) {
      return;
    }

    const quotationId = new URLSearchParams(window.location.search).get(
      "quotationId",
    );
    if (!quotationId) return;

    initialQuotationParamLoaded.current = true;
    requestLoadQuotation(quotationId);
  }, [isClient]);

  const handleSelectProduct = async (rowIndex: number, productId: string) => {
    const product = await platform.getProduct(productId);
    if (!product) return;

    const batchesRes = barcodeEnabled
      ? await platform.listBarcodesForProduct?.(licenseId, productId)
      : await platform.listBatchesForProduct(productId, false);

    const liveBatches: BatchInfo[] = (batchesRes?.rows || [])
      .filter((b: any) => Number(b.stock || 0) > 0)
      .map((b: any) => ({
        id: b.id,
        barcode: barcodeEnabled ? b.barcode : "",
        batchNo: b.batchNo,
        purchaseBatchNo: b.purchaseBatchNo || b.batchNo,
        mfgDate: b.mfgDate,
        expiryDate: b.expiryDate,
        mrp: b.mrp,
        salePrice: b.salePrice,
        costPrice: b.costPrice,
        stock: b.stock,
      }));

    const selectedBatchId = liveBatches.length === 1 ? liveBatches[0].id : null;
    const ratePatch = await resolveProductRatePatch(
      productId,
      selectedBatchId,
      product.salePrice,
    );

    // Base row fill
    const basePatch = {
      productId,
      code: product.code,
      name: product.name,
      unit: product.unit,
      taxPercent: product.tax,
      barcode: "",
      batchNo: "",
      mfgDate: null,
      expiryDate: null,
      mrp: null,
      ...ratePatch,
      ...offerClearPatch,
    };

    // Case 1: exactly one live batch -> auto select it
    if (liveBatches.length === 1) {
      const b = liveBatches[0];

      setRows((prev) =>
        prev.map((r, i) =>
          i !== rowIndex
            ? r
            : {
                ...r,
                ...basePatch,
                batchId: b.id,
                barcode: barcodeEnabled ? b.barcode || "" : "",
                batchNo: b.batchNo ?? null,
                purchaseBatchNo: b.purchaseBatchNo ?? b.batchNo ?? null,
                mfgDate: b.mfgDate ?? null,
                expiryDate: b.expiryDate ?? null,
                mrp: b.mrp ?? null,
              },
        ),
      );
      return;
    }

    // Case 2: multiple live batches -> open picker
    if (liveBatches.length > 1) {
      setRows((prev) =>
        prev.map((r, i) => (i !== rowIndex ? r : { ...r, ...basePatch })),
      );

      setBatchPicker({
        rowIndex,
        productId,
        batches: liveBatches,
        productName: product.name,
        nextBarcode: "",
      });
      return;
    }

    // Case 3: no live batch -> fallback
    setRows((prev) =>
      prev.map((r, i) =>
        i !== rowIndex
          ? r
          : {
              ...r,
              ...basePatch,
              batchId: null,
              batchNo: null,
              purchaseBatchNo: null,
              mfgDate: null,
              expiryDate: null,
              mrp: null,
              barcode: barcodeEnabled
                ? product.barcode || product.code || ""
                : "",
            },
      ),
    );
  };

  const handleRequestBatchSelect = async (
    rowIndex: number,
    explicitProductId?: string,
  ) => {
    const row = rows[rowIndex];
    const productId = explicitProductId || row?.productId;
    if (!productId) return;

    try {
      const batchesRes = barcodeEnabled
        ? await platform.listBarcodesForProduct?.(licenseId, productId)
        : await platform.listBatchesForProduct(productId, false);

      const liveBatches: BatchInfo[] = (batchesRes?.rows || [])
        .filter((b: any) => Number(b.stock || 0) > 0)
        .map((b: any) => ({
          id: b.id,
          barcode: barcodeEnabled ? b.barcode : "",
          batchNo: b.batchNo,
          purchaseBatchNo: b.purchaseBatchNo || b.batchNo,
          mfgDate: b.mfgDate,
          expiryDate: b.expiryDate,
          mrp: b.mrp,
          salePrice: b.salePrice,
          costPrice: b.costPrice,
          stock: b.stock,
        }));

      if (!liveBatches.length) return;

      const productName =
        products.find((p) => p.id === productId)?.name || row?.name;

      setBatchPicker({
        rowIndex,
        productId,
        batches: liveBatches,
        productName,
        nextBarcode: "",
      });
    } catch (e) {
      console.error("Failed to load sales batches", e);
    }
  };

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

  async function saveHold(title?: string) {
    const holdHeader = {
      ...header,
      billNo: header.billNo || billNoPreview,
      offerSummaryJson: JSON.stringify({
        appliedOffers: offerResult.appliedOffers,
        eligibleOffers: offerResult.eligibleOffers,
        totalOfferSavings: offerResult.totalOfferSavings,
      }),
      offerSavings: offerResult.totalOfferSavings,
      offerOverridesJson: offerOverridesJson(disabledOfferIds),
    };
    const res = await platform.saveSaleHold?.({
      id: undefined,
      licenseId,
      userId,
      title: title || undefined,
      header: holdHeader,
      rows,
    });
    if (res?.success) {
      // Push to server so web can see it immediately
      if (isSyncEnabled()) {
        SyncManager.pushEntity("saleHold").catch(() => {});
      }

      await requestFeedback({
        tone: "success",
        title: "Sale held",
        message: `Saved as hold #${res.holdNo}${title ? ` • ${title}` : ""}.`,
        primaryText: "Open holds",
      });
      resetAll();
      setShowHolds(true);
      return;
    }

    await requestFeedback({
      tone: "error",
      title: "Hold failed",
      message: String(res?.error || "The current sale could not be held."),
      primaryText: "Close",
    });
  }

  function handleHold() {
    setDefaultHoldTitle(header.billNo || billNoPreview || "");
    setShowTitlePrompt(true);
  }

  function handleShowHolds() {
    setShowHolds(true);
  }

  async function handleResumeHold(holdId: string) {
    if (customers.length === 0) await loadCustomers();
    const res = await platform.getSaleHold?.(holdId);
    if (res?.success && res.hold) {
      const raw = (res.hold.header as any)?.customer;
      let customer: HeaderForm["customer"] = null;
      if (raw) {
        if (typeof raw === "string") {
          customer = customers.find((c) => c.id === raw) || null;
        } else if (raw.id) {
          const m = customers.find((c) => c.id === raw.id);
          customer = m ? m : { id: raw.id, name: raw.name ?? "" };
        }
      }
      const nextHeader: HeaderForm = {
        billNo: (res.hold.header as any)?.billNo ?? "",
        department: (res.hold.header as any)?.department ?? "",
        debitAccount: (res.hold.header as any)?.debitAccount ?? "",
        natureOfEntry: (res.hold.header as any)?.natureOfEntry ?? "",
        saleDate:
          (res.hold.header as any)?.saleDate ?? new Date().toISOString(),
        entryTime:
          (res.hold.header as any)?.entryTime ?? new Date().toISOString(),
        discount: (res.hold.header as any)?.discount ?? 0,
        saleType: (res.hold.header as any)?.saleType ?? "CASH",
        typeId: (res.hold.header as any)?.typeId ?? null,
        offerSummaryJson: (res.hold.header as any)?.offerSummaryJson ?? null,
        offerSavings: Number((res.hold.header as any)?.offerSavings || 0),
        offerOverridesJson:
          (res.hold.header as any)?.offerOverridesJson ?? null,
        customer,
      };
      const nextRows = res.hold.rows;

      setHeader(nextHeader);
      setRows(nextRows);
      setDisabledOfferIds(
        parseDisabledOfferIds(nextHeader.offerOverridesJson || null),
      );
      setShowHolds(false);
      clearLoadedQuotationSource();

      initialSnapshot.current = makeSnapshot(nextHeader, nextRows);
      setIsDirty(false);
    }
  }

  async function handleOpenSaleFromReport(id: string) {
    if (customers.length === 0) await loadCustomers();
    const res = await platform.getSaleFull?.(id);
    if (!res?.success || !res.sale || !res.items) {
      await requestFeedback({
        tone: "error",
        title: "Sale could not be opened",
        message: String(res?.error || "Failed to load the selected sale."),
        primaryText: "Close",
      });
      return;
    }
    const sale = res.sale as any;
    const items = res.items;
    const cust = sale.customerId
      ? customers.find((c) => c.id === sale.customerId) || {
          id: sale.customerId,
          name: sale.customerName || "",
        }
      : null;
    const nextHeader = {
      billNo: sale.billNo || "",
      customer: cust,
      department: sale.department || "",
      debitAccount: sale.debitAccount || "",
      natureOfEntry: sale.natureOfEntry || "",
      saleDate: sale.saleDate,
      entryTime: sale.entryTime || sale.saleDate,
      discount: Number(sale.discount || 0),
      saleType: sale.saleType === "CREDIT" ? "CREDIT" : "CASH",
      typeId: sale.typeId || null,
      offerSummaryJson: sale.offerSummaryJson || null,
      offerSavings: Number(sale.offerSavings || 0),
      offerOverridesJson: sale.offerOverridesJson || null,
    } as HeaderForm;

    const nextRows = items.map((it: any, i: number) => ({
      lineNo: it.lineNo ?? i + 1,
      productId: it.productId,
      code: "",
      barcode: it.barcode ?? "",
      name: "",
      unit: it.unit,
      rate: Number(it.rate) || 0,
      quantity: Number(it.quantity) || 0,
      mrp: it.mrp ?? null,
      taxPercent: it.taxPercent,
      discountType: it.discountType,
      discount: Number(it.discount) || 0,
      profitPercent: 0,
      salePrice: it.salePrice ?? null,
      profit: it.profit ?? null,
      totalCost: Number(it.totalCost) || 0,
      billedValue: Number(it.billedValue) || 0,
      batchId: it.batchId ?? null,
      batchNo: it.batchNo ?? null,
      purchaseBatchNo: it.purchaseBatchNo ?? it.batchNo ?? null,
      mfgDate: it.mfgDate ?? null,
      expiryDate: it.expiryDate ?? null,
      lineType: (it.isFree ? "FREE" : "VALUED") as any,
      unitBilled: it.quantity
        ? Number(it.billedValue || 0) / Number(it.quantity || 1)
        : 0,
      originalRate: it.originalRate ?? null,
      originalSalePrice: it.originalSalePrice ?? null,
      appliedRate: it.appliedRate ?? null,
      offerId: it.offerId ?? null,
      offerName: it.offerName ?? null,
      offerType: it.offerType ?? null,
      offerDiscountAmount: Number(it.offerDiscountAmount || 0),
      offerMessage: it.offerName ? String(it.offerType || "Offer") : null,
      offerMeta: it.offerMeta ?? null,
      rateTypeId: it.rateTypeId ?? null,
      rateTypeCode: it.rateTypeCode ?? null,
      rateTypeName: it.rateTypeName ?? null,
      rateSource: it.rateSource ?? "LEGACY",
      availableRates: it.rateTypeId
        ? [
            {
              rateTypeId: it.rateTypeId,
              code: it.rateTypeCode || "",
              name: it.rateTypeName || it.rateTypeCode || "Saved rate",
              amount: Number(it.rate),
              configured: true,
            },
          ]
        : [],
    }));

    setHeader(nextHeader);
    setRows(nextRows);
    setDisabledOfferIds(parseDisabledOfferIds(nextHeader.offerOverridesJson));
    setEditingSaleId(id);
    setEditingSlNo(sale.slNo ?? null);
    setShowReports(false);
    setShowSalesSettings(false);
    setIsMobileSheetOpen(false);
    clearLoadedQuotationSource();

    initialSnapshot.current = makeSnapshot(nextHeader, nextRows);
    setIsDirty(false);
  }

  function showSaleError(err: any) {
    const raw = String(err?.message || err || "Unknown error");

    if (raw.includes("Insufficient batch stock")) {
      const availableMatch = raw.match(/Available:\s*(\d+)/i);
      const requiredMatch = raw.match(/Required:\s*(\d+)/i);

      const available = availableMatch ? availableMatch[1] : null;
      const required = requiredMatch ? requiredMatch[1] : null;

      if (available && required) {
        setValidationMsgs([
          `Selected batch has only ${available} stock, but you entered ${required}.`,
          "Reduce quantity or choose another batch.",
        ]);
      } else {
        setValidationMsgs([
          "Selected batch does not have enough stock for this quantity.",
          "Reduce quantity or choose another batch.",
        ]);
      }

      setValidationOpen(true);
      return;
    }

    setValidationMsgs(["Something went wrong while saving the sale."]);
    setValidationOpen(true);
  }

  const handleSave = async () => {
    const finalOfferResult = editingSaleId
      ? summarizeSavedOffers(rows)
      : calculateOffers({
          header,
          rows,
          offers: activeOffers,
          targets: offerTargets,
          saleDateTime: header.saleDate || header.entryTime,
          customer: header.customer,
          disabledOfferIds,
        });
    const finalRows = editingSaleId ? rows : finalOfferResult.rows;
    if (
      !editingSaleId &&
      offerRowsSignature(rows) !== offerRowsSignature(finalRows)
    ) {
      setRows(finalRows);
    }
    const items = mapItems(finalRows);
    const offerSummaryJson = JSON.stringify({
      appliedOffers: finalOfferResult.appliedOffers,
      eligibleOffers: finalOfferResult.eligibleOffers,
      totalOfferSavings: finalOfferResult.totalOfferSavings,
      savedAt: new Date().toISOString(),
    });
    const currentOfferOverridesJson = offerOverridesJson(disabledOfferIds);
    const errs = validateSaleBill(
      header,
      items,
      finalOfferResult.validationWarnings,
    );
    if (errs.length) {
      setValidationMsgs(errs);
      setValidationOpen(true);
      return false;
    }

    if (editingSaleId) {
      const payload = {
        id: editingSaleId,
        header: {
          billNo: header.billNo || null,
          customerId: header.customer?.id || null,
          customerName: header.customer?.name || null,
          department: header.department || null,
          debitAccount: header.debitAccount || null,
          natureOfEntry: header.natureOfEntry || null,
          saleDate: header.saleDate,
          entryTime: header.entryTime,
          discount: header.discount || 0,
          offerSummaryJson,
          offerSavings: finalOfferResult.totalOfferSavings,
          offerOverridesJson: currentOfferOverridesJson,
          licenseId,
          saleType: header.saleType,
          typeId: header.typeId ?? null,
        },
        items,
      };
      try {
        const res = await platform.updateSale?.(payload);

        if (res?.success) {
          if (isSyncEnabled()) {
            SyncManager.pushEntity("sale").catch(() => {});
            SyncManager.pushEntity("saleItem").catch(() => {});
            SyncManager.pushEntity("customerTransaction").catch(() => {});
            SyncManager.pushEntity("cashTransaction").catch(() => {});
            SyncManager.pushEntity("product").catch(() => {});
          }
          await requestFeedback({
            tone: "success",
            title: "Sale updated",
            message: "The saved sale was updated successfully.",
            primaryText: "Done",
          });
          setEditingSaleId(null);
          resetAll();
          return true;
        }

        showSaleError(res?.error || "Update failed");
        return false;
      } catch (err) {
        showSaleError(err);
        return false;
      }
    }

    const sale = {
      billNo: header.billNo || null,
      customerId: header.customer?.id || null,
      customerName: header.customer?.name || null,
      customerMobile: header.customer?.mobile || null,
      customerGstin: header.customer?.gstin || null,
      customerAddress: header.customer?.address || null,
      department: header.department || null,
      debitAccount: header.debitAccount || null,
      natureOfEntry: header.natureOfEntry || null,
      saleDate: header.saleDate,
      entryTime: header.entryTime,
      discount: header.discount || 0,
      offerSummaryJson,
      offerSavings: finalOfferResult.totalOfferSavings,
      offerOverridesJson: currentOfferOverridesJson,
      licenseId,
      userId,
      saleType: header.saleType,
      typeId: header.typeId ?? null,
    };
    try {
      const res = await platform.createSale?.(sale, items);

      if (res?.success) {
        let quotationMarkedConverted = false;
        let quotationMarkError = "";
        if (sourceQuotationId) {
          if (!res.saleId) {
            quotationMarkError =
              "Sale was saved, but no sale id was returned for quotation linking.";
          } else if (!platform.markQuotationConverted) {
            quotationMarkError =
              "Sale was saved, but quotation status update is not available in this runtime.";
          } else {
            for (
              let attempt = 1;
              attempt <= 3 && !quotationMarkedConverted;
              attempt += 1
            ) {
              try {
                const markRes = await platform.markQuotationConverted(
                  sourceQuotationId,
                  res.saleId,
                );
                if (markRes?.success) {
                  quotationMarkedConverted = true;
                  quotationMarkError = "";
                } else {
                  quotationMarkError =
                    markRes?.error || "Quotation status update failed.";
                }
              } catch (err: any) {
                quotationMarkError =
                  err?.message || "Quotation status update failed.";
              }

              if (!quotationMarkedConverted && attempt < 3) {
                await new Promise((resolve) =>
                  setTimeout(resolve, attempt * 250),
                );
              }
            }
          }
        }

        if (isSyncEnabled()) {
          SyncManager.pushEntity("sale").catch(() => {});
          SyncManager.pushEntity("saleItem").catch(() => {});
          SyncManager.pushEntity("customerTransaction").catch(() => {});
          SyncManager.pushEntity("cashTransaction").catch(() => {});
          SyncManager.pushEntity("product").catch(() => {});
          if (sourceQuotationId && quotationMarkedConverted) {
            SyncManager.pushEntity("quotation").catch(() => {});
            SyncManager.pushEntity("quotationItem").catch(() => {});
          }
        }
        let quotationLinkWarning = "";
        if (sourceQuotationId && !quotationMarkedConverted) {
          quotationLinkWarning =
            "The sale is already saved, but the quotation link failed. Do not create another sale for this quotation. Use Retry link." +
            (quotationMarkError ? ` ${quotationMarkError}` : "");
          setQuotationWarning(quotationLinkWarning);
        }

        const savedHeader = {
          ...header,
          billNo: (res as any).billNo || billNoPreview,
          offerSummaryJson,
          offerSavings: finalOfferResult.totalOfferSavings,
          offerOverridesJson: currentOfferOverridesJson,
        };
        setHeader(savedHeader);
        setEditingSaleId(res.saleId || null);
        setEditingSlNo(res.slNo ?? null);
        if (quotationMarkedConverted) {
          clearLoadedQuotationSource();
          void loadQuotationOptions(false);
        }

        initialSnapshot.current = makeSnapshot(savedHeader, finalRows);
        setIsDirty(false);

        const savedTotal = Number(res.totalAmount ?? grandTotal).toLocaleString(
          "en-IN",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        );
        const savedLabel =
          (res as any).billNo ||
          billNoPreview ||
          (res.slNo != null ? `Sale #${res.slNo}` : "Sale");
        const feedbackChoice = await requestFeedback({
          tone: quotationLinkWarning ? "warning" : "success",
          title: quotationLinkWarning
            ? "Sale saved — quotation link pending"
            : "Sale saved",
          message: `${savedLabel}\nTotal: ₹${savedTotal}${
            quotationLinkWarning ? `\n\n${quotationLinkWarning}` : ""
          }`,
          primaryText: res.saleId ? "Print now" : "Done",
          secondaryText: res.saleId ? "Done" : undefined,
        });
        const shouldPrint = Boolean(res.saleId && feedbackChoice === "primary");

        const printError = await runPostSavePrint({
          shouldPrint,
          printFn: res.saleId ? () => printSaleBill(res.saleId!) : undefined,
        });
        if (printError) {
          await requestFeedback({
            tone: "warning",
            title: "Sale saved, print failed",
            message: printError,
            primaryText: "Close",
          });
        }

        try {
          const peek = await platform.peekNextSaleSlNo?.(licenseId);
          setNextEntryNo(peek?.nextSlNo ?? null);
        } catch {}

        return true;
      }

      showSaleError(res?.error || "Save failed");
      return false;
    } catch (err) {
      showSaleError(err);
      return false;
    }
  };

  // FIXED: Use modal instead of raw confirm
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

  // STRENGTHENED: Clear ALL auxiliary state
  function resetAll() {
    const freshHeader: HeaderForm = {
      billNo: "",
      customer: null,
      department: "",
      debitAccount: "",
      natureOfEntry: "",
      saleDate: new Date().toISOString(),
      entryTime: new Date().toISOString(),
      discount: 0,
      saleType: "CASH",
      typeId: null,
      offerSummaryJson: null,
      offerSavings: 0,
      offerOverridesJson: null,
    };
    const defType = transactionTypes.find(
      (t: { id: string; name: string; isDefault: number }) => t.isDefault === 1,
    );
    if (defType) freshHeader.typeId = defType.id;
    const freshRows = [createEmptyRow(1)];

    setHeader(freshHeader);
    setRows(freshRows);
    setEditingSaleId(null);
    setEditingSlNo(null);
    billDetailsOpenRef.current = true;
    setBillDetailsOpen(true);
    setDisabledOfferIds([]);
    setOffersOpen(false);
    clearLoadedQuotationSource();

    // Clear all modals and auxiliary state
    setShowHolds(false);
    setShowReports(false);
    setShowSalesSettings(false);
    setIsMobileSheetOpen(false);
    setShowTitlePrompt(false);
    setDefaultHoldTitle("");
    setShowCustomerModal(false);
    setBatchPicker(null);
    setValidationMsgs([]);
    setValidationOpen(false);
    setLeaveOpen(false);
    setPendingPath(null);
    setCancelConfirmOpen(false);
    setPendingQuotationId(null);
    setQuotationReplaceConfirmOpen(false);

    initialSnapshot.current = makeSnapshot(freshHeader, freshRows);
    setIsDirty(false);
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

  const focusBillDetails = useCallback(() => {
    billDetailsOpenRef.current = true;
    setBillDetailsOpen(true);
    queueSalesFocus(() => {
      const billNo = document.getElementById("bill-details-billno");
      const root = billNo?.closest<HTMLElement>("section");
      return (
        root?.querySelector<HTMLElement>(
          '[data-sales-header-focus="customer"]',
        ) ?? billNo
      );
    });
  }, []);

  const toggleBillDetails = useCallback(() => {
    const nextOpen = !billDetailsOpenRef.current;
    billDetailsOpenRef.current = nextOpen;
    setBillDetailsOpen(nextOpen);
  }, []);

  const focusLastBillDetail = useCallback(() => {
    billDetailsOpenRef.current = true;
    setBillDetailsOpen(true);
    queueSalesFocus(() => {
      const billNo = document.getElementById("bill-details-billno");
      const root = billNo?.closest<HTMLElement>("section");
      if (!root) return billNo;
      const fields = visibleSalesHeaderFields(root);
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
      window.requestAnimationFrame(() => focusCell(targetRowIndex, "product"));
    });
  }, []);

  const requestPrintCurrentSale = useCallback(() => {
    const saleId = editingSaleIdRef.current;
    if (!saleId) {
      setValidationMsgs(["Save the sale before printing."]);
      setValidationOpen(true);
      return;
    }
    void printSaleBill(saleId)
      .then((result) => {
        if (!result?.success) {
          setValidationMsgs([result?.error || "Print failed."]);
          setValidationOpen(true);
        }
      })
      .catch((error: any) => {
        setValidationMsgs([`Print failed: ${String(error?.message || error)}`]);
        setValidationOpen(true);
      });
  }, []);

  const hasBlockingOverlay =
    showSalesSettings ||
    showCustomerModal ||
    showHolds ||
    showReports ||
    showTitlePrompt ||
    Boolean(batchPicker) ||
    Boolean(feedback) ||
    validationOpen ||
    cancelConfirmOpen ||
    leaveOpen ||
    quotationReplaceConfirmOpen ||
    offersOpen ||
    isMobileSheetOpen;

  useEffect(() => {
    handleSaveRef.current = handleSave;
    handleCancelRef.current = handleCancel;
    handleHoldRef.current = handleHold;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || hasBlockingOverlay) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const togglePanel =
        modifier && (event.code === "Backslash" || key === "\\" || key === "|");

      if (event.code === "F4" || event.key === "F4") {
        event.preventDefault();
        event.stopPropagation();
        focusBillDetails();
        return;
      }
      if (togglePanel) {
        event.preventDefault();
        event.stopPropagation();
        toggleBillDetails();
        return;
      }
      if (event.defaultPrevented || event.altKey) return;

      if (modifier && key === "s") {
        event.preventDefault();
        if (!billDetailsOpenRef.current && !headerRef.current.customer) {
          focusBillDetails();
          return;
        }
        void handleSaveRef.current();
        return;
      }
      if (modifier && key === "p") {
        event.preventDefault();
        requestPrintCurrentSale();
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
      } else if (event.key === "F6") {
        event.preventDefault();
        setShowReports(true);
      } else if (event.key === "F7") {
        event.preventDefault();
        setShowSalesSettings(true);
      } else if (event.key === "F8") {
        event.preventDefault();
        if (!editingSaleIdRef.current) setShowHolds(true);
      } else if (event.key === "F9") {
        event.preventDefault();
        if (!editingSaleIdRef.current) handleHoldRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    focusBillDetails,
    focusItemEntry,
    hasBlockingOverlay,
    requestPrintCurrentSale,
    toggleBillDetails,
  ]);

  function updateRow(index: number, patch: Partial<ItemRow>) {
    const shouldClearOffer =
      "productId" in patch ||
      "batchId" in patch ||
      "rate" in patch ||
      "salePrice" in patch ||
      "lineType" in patch;
    const manualRate =
      "rate" in patch && !("rateTypeId" in patch) && !("rateSource" in patch);
    const normalizedPatch: Partial<ItemRow> = manualRate
      ? {
          ...patch,
          rateTypeId: null,
          rateTypeCode: null,
          rateTypeName: "Custom",
          rateSource: "CUSTOM",
        }
      : patch;
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              ...(shouldClearOffer ? offerClearPatch : {}),
              ...normalizedPatch,
            }
          : r,
      ),
    );
  }

  const billNoPreview = useMemo(() => {
    if (editingSaleId) return header.billNo || "";
    return String(nextEntryNo ?? 1).padStart(5, "0");
  }, [editingSaleId, header.billNo, nextEntryNo]);

  const offerResult = useMemo(() => {
    if (editingSaleId) return summarizeSavedOffers(rows);
    return calculateOffers({
      header,
      rows,
      offers: activeOffers,
      targets: offerTargets,
      saleDateTime: header.saleDate || header.entryTime,
      customer: header.customer,
      disabledOfferIds,
    });
  }, [
    editingSaleId,
    rows,
    header,
    activeOffers,
    offerTargets,
    disabledOfferIds,
  ]);

  useEffect(() => {
    if (editingSaleId) return;
    if (offerRowsSignature(rows) === offerRowsSignature(offerResult.rows)) {
      return;
    }
    setRows(offerResult.rows);
  }, [editingSaleId, rows, offerResult.rows]);

  function setOfferEnabledForBill(offerId: string, enabled: boolean) {
    setDisabledOfferIds((prev) => {
      const next = enabled
        ? prev.filter((id) => id !== offerId)
        : Array.from(new Set([...prev, offerId]));
      setHeader((current) => ({
        ...current,
        offerOverridesJson: offerOverridesJson(next),
      }));
      return next;
    });
  }

  async function addRationProductToBill(
    productId: string,
    suggestedQty?: number | null,
  ) {
    let targetIndex = rows.findIndex((row) => !row.productId);
    if (targetIndex < 0) {
      targetIndex = rows.length;
      setRows((prev) => [...prev, createEmptyRow(prev.length + 1)]);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    await handleSelectProduct(targetIndex, productId);
    const qty = Math.max(1, Number(suggestedQty || 1));
    setRows((prev) =>
      prev.map((row, index) =>
        index === targetIndex ? { ...row, quantity: qty } : row,
      ),
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

  if (!isClient) return null;

  const quotationPickerDisabled =
    quotationOptionsLoading ||
    Boolean(quotationLoadingId) ||
    Boolean(editingSaleId);
  const quotationPickerPlaceholder = quotationOptionsLoading
    ? "Loading quotations..."
    : quotationOptionsError
      ? "Quotation load failed"
      : quotationOptions.length
        ? "Search quotation..."
        : "No draft / sent quotations";

  const quotationSelector = (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="relative">
        <SearchableDropdown
          value={sourceQuotationId || ""}
          onChange={(value) => {
            if (!value) {
              clearLoadedQuotationSource();
              return;
            }
            requestLoadQuotation(value);
          }}
          options={quotationOptions.map((quotation) => ({
            value: quotation.id,
            label: formatQuotationOption(quotation),
          }))}
          placeholder={quotationPickerPlaceholder}
          autoOpenOnFocus={false}
          className="w-[160px] sm:w-[260px] lg:w-[340px] [&_button]:!h-8 [&_button]:!rounded-lg [&_button]:!border-white/15 [&_button]:!bg-white/10 [&_button]:!px-2.5 [&_button]:!py-1 [&_button_span]:!text-xs [&_button_span]:!font-medium [&_button_span]:!text-white [&_button_svg]:!text-white/60"
          controlClassName="disabled:cursor-not-allowed disabled:opacity-60"
          inputClassName="h-8 text-xs"
          optionClassName="text-xs"
          menuClassName="text-xs"
          buttonProps={{
            disabled: quotationPickerDisabled,
            className: "disabled:cursor-not-allowed disabled:opacity-60",
            title: editingSaleId
              ? "Start a new bill before loading a quotation"
              : "Search and load a draft or sent quotation",
            "aria-label": "Search and load quotation",
          }}
        />
        {(quotationOptionsLoading || Boolean(quotationLoadingId)) && (
          <LoaderCircle className="pointer-events-none absolute right-7 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-cyan-200" />
        )}
      </div>

      {quotationOptionsError && !quotationOptionsLoading && !editingSaleId ? (
        <button
          type="button"
          onClick={() => void loadQuotationOptions()}
          title="Retry loading quotations"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-300/40 bg-amber-300/10 text-amber-100 transition hover:bg-amber-300/20"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {sourceQuotationId && (
        <button
          type="button"
          onClick={clearLoadedQuotationSource}
          title="Clear loaded quotation source"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/75 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-kyn-bg text-kyn-text">
      <SalesNavigation
        onNavigate={tryNavigate}
        title="Sales"
        rightSlot={quotationSelector}
        keyboardEnabled={!hasBlockingOverlay}
        savedBillOpen={Boolean(editingSaleId)}
        onPrintBill={requestPrintCurrentSale}
        onNewBill={handleCancel}
      />
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-0">
        {sourceQuotationId && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                Loaded from quotation {sourceQuotationNo || sourceQuotationId}
              </span>
              {editingSaleId ? (
                <button
                  type="button"
                  onClick={() => void retryQuotationLink()}
                  disabled={quotationLoadingId === sourceQuotationId}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {quotationLoadingId === sourceQuotationId
                    ? "Retrying..."
                    : "Retry link"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={clearLoadedQuotationSource}
                  className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-white px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear source
                </button>
              )}
            </div>
            {quotationWarning && (
              <div className="mt-1 text-xs text-amber-700">
                {quotationWarning}
              </div>
            )}
          </div>
        )}
        <div
          className={[
            "grid flex-1 min-h-0 overflow-hidden transition-all duration-200",
            "grid-cols-1",
            billDetailsOpen
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
              customers={customers}
              setShowCustomerModal={setShowCustomerModal}
              subTotal={subTotal}
              grandTotal={grandTotal}
              onSave={handleSave}
              onCancel={handleCancel}
              billNoPreview={billNoPreview}
              offerSavings={offerResult.totalOfferSavings}
              entryNo={
                editingSaleId
                  ? (editingSlNo ?? undefined)
                  : (nextEntryNo ?? undefined)
              }
              requireCustomer
              isEditing={Boolean(editingSaleId)}
              isOpen={billDetailsOpen}
              onToggle={toggleBillDetails}
              transactionTypes={transactionTypes}
              uiSettings={salesUiSettings}
              onFocusItems={focusItemEntry}
            />
          </div>
          <ItemsTableSection
            mode="SALE"
            rows={rows}
            products={products}
            onSelectProduct={handleSelectProduct}
            barcodeEnabled={barcodeEnabled}
            onUpdateRow={updateRow}
            onAddRow={addRow}
            onRemoveRow={removeRow}
            subTotal={subTotal}
            grandTotal={grandTotal}
            headerDiscount={header.discount}
            totalOfferSavings={offerResult.totalOfferSavings}
            offersSlot={
              <SalesOffersPanel
                isOpen={offersOpen}
                onOpenChange={setOffersOpen}
                result={offerResult}
                disabledOfferIds={disabledOfferIds}
                onToggleOffer={setOfferEnabledForBill}
                onAddRationProduct={addRationProductToBill}
              />
            }
            onHold={() => {
              setDefaultHoldTitle(header.billNo || billNoPreview || "");
              setShowTitlePrompt(true);
            }}
            onPrintBill={handlePrintBill}
            canPrint={Boolean(editingSaleId)}
            onShowHolds={() => setShowHolds(true)}
            onShowReports={() => setShowReports(true)}
            showHoldControls={!editingSaleId}
            uiSettings={itemGridUiSettings}
            onOpenSettings={() => setShowSalesSettings(true)}
            onFocusItems={focusItemEntry}
            onFocusBillDetails={focusBillDetails}
            onToggleBillDetails={toggleBillDetails}
            onFocusPreviousSection={focusLastBillDetail}
            onOpenMobileSheet={() => setIsMobileSheetOpen(true)}
            hasMissingFields={!header.customer}
            onRequestBatchSelect={handleRequestBatchSelect}
          />
        </div>
      </div>

      {isMobileSheetOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMobileSheetOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
              <span className="font-semibold text-slate-800">
                Sales Bill Details
              </span>
              <button
                type="button"
                onClick={() => setIsMobileSheetOpen(false)}
                className="text-xl leading-none text-slate-500 hover:text-slate-700"
              >
                ×
              </button>
            </div>
            <BillDetailsSection
              header={header}
              setHeader={setHeader}
              customers={customers}
              setShowCustomerModal={setShowCustomerModal}
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
              billNoPreview={billNoPreview}
              offerSavings={offerResult.totalOfferSavings}
              entryNo={
                editingSaleId
                  ? (editingSlNo ?? undefined)
                  : (nextEntryNo ?? undefined)
              }
              requireCustomer
              isEditing={Boolean(editingSaleId)}
              isOpen
              onToggle={() => setIsMobileSheetOpen(false)}
              transactionTypes={transactionTypes}
              uiSettings={salesUiSettings}
              onFocusItems={focusItemEntry}
            />
          </div>
        </div>
      ) : null}

      <SalesEntrySettingsModal
        open={showSalesSettings}
        settings={salesUiSettings}
        onClose={() => setShowSalesSettings(false)}
        onSave={(nextSettings) => {
          setSalesUiSettings(nextSettings);
          saveSalesUiSettings(nextSettings);
        }}
      />

      {showCustomerModal && (
        <CustomerFormModal
          isOpen={showCustomerModal}
          onClose={() => setShowCustomerModal(false)}
          onSuccess={() => {
            setShowCustomerModal(false);
            loadCustomers();
          }}
        />
      )}

      <HoldsModal
        isOpen={showHolds}
        onClose={() => setShowHolds(false)}
        licenseId={licenseId}
        onResume={handleResumeHold}
      />

      <SalesReportsModal
        isOpen={showReports}
        onClose={() => setShowReports(false)}
        licenseId={licenseId}
        customers={customers}
        onOpenSale={handleOpenSaleFromReport}
        onReturnSale={(id) => {
          setShowReports(false);
          void tryNavigate(`/dashboard/sales-return?saleId=${id}`);
        }}
      />

      <BatchSelectModal
        isOpen={Boolean(batchPicker)}
        onClose={() => {
          const rowIndex = batchPicker?.rowIndex;
          setBatchPicker(null);
          if (rowIndex != null) {
            setTimeout(() => focusCell(rowIndex, "product"), 0);
          }
        }}
        batches={batchPicker?.batches || []}
        productName={batchPicker?.productName}
        nextBarcode=""
        allowCreateNew={false}
        barcodeEnabled={barcodeEnabled}
        onSelect={(batch) => {
          if (!batchPicker) return;

          const rowIndex = batchPicker.rowIndex;

          if (!batch) {
            setBatchPicker(null);
            setTimeout(() => focusCell(rowIndex, "product"), 0);
            return;
          }

          void resolveProductRatePatch(
            batchPicker.productId,
            batch.id,
            batch.salePrice,
          )
            .then((ratePatch) => {
              setRows((prev) =>
                prev.map((r, i) =>
                  i !== rowIndex
                    ? r
                    : {
                        ...r,
                        batchId: batch.id,
                        barcode: barcodeEnabled ? batch.barcode || "" : "",
                        batchNo: batch.batchNo ?? null,
                        purchaseBatchNo:
                          batch.purchaseBatchNo ?? batch.batchNo ?? null,
                        mfgDate: batch.mfgDate ?? null,
                        expiryDate: batch.expiryDate ?? null,
                        mrp: batch.mrp ?? null,
                        ...ratePatch,
                        ...offerClearPatch,
                      },
                ),
              );
            })
            .catch((error) => {
              console.error("Failed to resolve the selected batch rate", error);
            })
            .finally(() => {
              setBatchPicker(null);
              setTimeout(() => focusCell(rowIndex, "quantity"), 0);
            });
        }}
        onAddNewBatch={() => {
          const rowIndex = batchPicker?.rowIndex;
          setBatchPicker(null);
          if (rowIndex != null) {
            setTimeout(() => focusCell(rowIndex, "product"), 0);
          }
        }}
      />

      <PromptModal
        isOpen={showTitlePrompt}
        title="Save as Hold"
        label="Optional title"
        placeholder="e.g., Evening sales"
        defaultValue={defaultHoldTitle}
        confirmText="Save Hold"
        onCancel={() => setShowTitlePrompt(false)}
        onConfirm={(v) => {
          setShowTitlePrompt(false);
          saveHold(v.trim());
        }}
      />

      <ConfirmModal
        isOpen={quotationReplaceConfirmOpen}
        title="Replace current bill?"
        message="Loading this quotation will replace the current sales bill fields and items."
        confirmText="Load quotation"
        cancelText="Keep current bill"
        onConfirm={() => {
          const id = pendingQuotationId;
          setQuotationReplaceConfirmOpen(false);
          setPendingQuotationId(null);
          if (id) void loadQuotationIntoSales(id);
        }}
        onCancel={() => {
          setQuotationReplaceConfirmOpen(false);
          setPendingQuotationId(null);
        }}
      />

      {/* FIXED: Proper cancel confirmation modal */}
      <ConfirmModal
        isOpen={cancelConfirmOpen}
        title="Discard current bill?"
        message="You have unsaved changes in this sales entry. Do you really want to clear everything?"
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

      <ConfirmModal
        isOpen={leaveOpen}
        title="Leave this page?"
        message={
          "You have unsaved changes.\n\n• Save & Exit: save the bill and go.\n• Discard: leave without saving.\n• Cancel: stay on this page."
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
          }
        }}
        onCancel={() => {
          setLeaveOpen(false);
          setPendingPath(null);
        }}
      />

      <OperationFeedbackModal
        isOpen={Boolean(feedback)}
        tone={feedback?.tone || "info"}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        primaryText={feedback?.primaryText || "Close"}
        secondaryText={feedback?.secondaryText}
        onPrimary={() => settleFeedback("primary")}
        onSecondary={
          feedback?.secondaryText
            ? () => settleFeedback("secondary")
            : undefined
        }
        onClose={() =>
          settleFeedback(feedback?.secondaryText ? "secondary" : "primary")
        }
      />

      <ValidationModal
        isOpen={validationOpen}
        messages={validationMsgs}
        onClose={() => setValidationOpen(false)}
      />
    </div>
  );
}
