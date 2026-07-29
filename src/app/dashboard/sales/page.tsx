// src/app/dashboard/sales/page.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import SalesNavigation from "@/components/sales/SalesNavigation";
import BillDetailsSection from "@/components/sales/BillDetailsSection";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import HoldsModal from "@/components/sales/HoldsModal";
import SalesReportsModal from "@/components/sales/SalesReportsModal";
import SalesOffersPanel from "@/components/sales/SalesOffersPanel";
import PromptModal from "@/components/ui/PromptModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ValidationModal from "@/components/ui/ValidationModal";
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
} from "@/platform/types";
import { isSyncEnabled } from "@/platform/mode";
import { canUseBarcode } from "@/lib/session/runtimeSession";
import { SyncManager } from "@/sync/SyncManager";
import { useSyncStatus } from "@/sync/SyncProvider";

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
    })),
  });
}

// Unified finalize-after-successful-save flow
async function finalizeAfterSuccessfulSale({
  shouldPrint,
  printFn,
}: {
  shouldPrint: boolean;
  printFn?: () => Promise<any>;
}) {
  try {
    if (shouldPrint && printFn) {
      await printFn();
    }
  } catch (e) {
    alert("Saved, but print failed: " + String((e as any)?.message || e));
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
    }
  }, []);

  const [products, setProducts] = useState<any[]>([]);
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
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const [defaultHoldTitle, setDefaultHoldTitle] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationMsgs, setValidationMsgs] = useState<string[]>([]);
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

  async function handlePrintBill() {
    if (!editingSaleId) return;
    try {
      const res = await printSaleBill(editingSaleId, { preview: false });
      if (!res?.success) alert(res?.error || "Print failed");
    } catch (e: any) {
      alert("Print failed: " + String(e?.message || e));
    }
  }

  const loadQuotationOptions = useCallback(async () => {
    if (!isClient || !licenseId || !platform.listQuotations) return;
    setQuotationOptionsLoading(true);
    try {
      const [draftRes, sentRes] = await Promise.all([
        platform.listQuotations(licenseId, {
          status: "DRAFT",
          page: 1,
          pageSize: 5000,
        }),
        platform.listQuotations(licenseId, {
          status: "SENT",
          page: 1,
          pageSize: 5000,
        }),
      ]);

      const byId = new Map<string, QuotationRow>();
      for (const row of [...(draftRes?.rows || []), ...(sentRes?.rows || [])]) {
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
    } catch (e) {
      console.error("Failed to load quotation options", e);
      setQuotationOptions([]);
    } finally {
      setQuotationOptionsLoading(false);
    }
  }, [isClient, licenseId]);

  useEffect(() => {
    if (!isClient) return;
    pullNow("sale");
    pullNow("saleItem");
    pullNow("offer");
    pullNow("offerTargetProduct");
    pullNow("quotation");
    pullNow("quotationItem");
    (async () => {
      const res = await platform.getProducts(licenseId, {
        page: 1,
        pageSize: 5000,
      });
      setProducts(res.products);
    })();
    (async () => {
      const res = await platform.peekNextSaleSlNo?.(licenseId);
      setNextEntryNo(res?.nextSlNo ?? 1);
    })();
  }, [licenseId, isClient]);

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
          loadQuotationOptions();
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
      void loadQuotationOptions();
      alert("Quotation linked to the saved sale.");
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
              (productId: string) =>
                productId && !productById.has(productId),
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
            const merged = new Map(current.map((product) => [product.id, product]));
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
      rate: Number(product.salePrice) || 0,
      salePrice:
        product.salePrice != null && !Number.isNaN(Number(product.salePrice))
          ? Number(product.salePrice)
          : 0,
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
                rate:
                  b.costPrice != null && !Number.isNaN(Number(b.costPrice))
                    ? Number(b.costPrice)
                    : Number(product.costPrice) || 0,
                salePrice:
                  b.salePrice != null && !Number.isNaN(Number(b.salePrice))
                    ? Number(b.salePrice)
                    : Number(product.salePrice) || 0,
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
      alert(`✅ Held as #${res.holdNo}${title ? ` • ${title}` : ""}`);

      // Push to server so web can see it immediately
      if (isSyncEnabled()) {
        SyncManager.pushEntity("saleHold").catch(() => {});
      }

      resetAll();
      setShowHolds(true);
    }
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
    if (!res?.success || !res.sale || !res.items)
      return alert("Failed to load sale");
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
    }));

    setHeader(nextHeader);
    setRows(nextRows);
    setDisabledOfferIds(parseDisabledOfferIds(nextHeader.offerOverridesJson));
    setEditingSaleId(id);
    setEditingSlNo(sale.slNo ?? null);
    setShowReports(false);
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
          alert("✅ Updated!");
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
        if (sourceQuotationId && !quotationMarkedConverted) {
          const warning =
            "The sale is already saved, but the quotation link failed. Do not create another sale for this quotation. Use Retry link." +
            (quotationMarkError ? ` ${quotationMarkError}` : "");
          setQuotationWarning(warning);
          alert(warning);
        }
        const shouldPrint = confirm(
          `✅ Saved! SlNo: ${res.slNo}, Total: ${res.totalAmount}\n\nOpen print preview now?`,
        );

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
          void loadQuotationOptions();
        }

        initialSnapshot.current = makeSnapshot(savedHeader, finalRows);
        setIsDirty(false);

        await finalizeAfterSuccessfulSale({
          shouldPrint,
          printFn: res.saleId
            ? () => printSaleBill(res.saleId!, { preview: true })
            : undefined,
        });

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
    setDisabledOfferIds([]);
    setOffersOpen(false);
    clearLoadedQuotationSource();

    // Clear all modals and auxiliary state
    setShowHolds(false);
    setShowReports(false);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [header, rows]);

  function updateRow(index: number, patch: Partial<ItemRow>) {
    const shouldClearOffer =
      "productId" in patch ||
      "batchId" in patch ||
      "rate" in patch ||
      "salePrice" in patch ||
      "lineType" in patch;
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, ...(shouldClearOffer ? offerClearPatch : {}), ...patch }
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

  const quotationSelector = (
    <div className="flex min-w-0 items-center gap-1.5">
      <select
        value={sourceQuotationId || ""}
        disabled={
          quotationOptionsLoading ||
          Boolean(quotationLoadingId) ||
          Boolean(editingSaleId)
        }
        onChange={(e) => requestLoadQuotation(e.target.value)}
        title={
          editingSaleId
            ? "Start a new bill before loading a quotation"
            : "Load quotation into this sales bill"
        }
        className="h-8 w-[160px] rounded-lg border border-white/15 bg-white/10 px-2 text-xs font-medium text-white outline-none transition focus:border-cyan-300 sm:w-[260px] lg:w-[340px] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option className="text-slate-900" value="">
          {quotationOptionsLoading
            ? "Loading quotations..."
            : "Load quotation..."}
        </option>
        {quotationOptions.map((quotation) => (
          <option
            className="text-slate-900"
            key={quotation.id}
            value={quotation.id}
          >
            {formatQuotationOption(quotation)}
          </option>
        ))}
      </select>
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
      />
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-0">
        {editingSaleId && (
          <div className="px-4 py-2 border-b border-kyn-border bg-kyn-surface flex items-center gap-3">
            <span className="text-sm text-kyn-text-muted">Saved bill open</span>

            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await printSaleBill(editingSaleId, {
                    preview: false,
                  });
                  if (!res?.success) alert(res?.error || "Print failed");
                } catch (e: any) {
                  alert("Print failed: " + String(e?.message || e));
                }
              }}
              className="px-3 py-1.5 rounded bg-kyn-primary/20 text-kyn-text hover:bg-kyn-primary/30 transition"
            >
              Print Bill
            </button>

            <button
              type="button"
              onClick={() => resetAll()}
              className="px-3 py-1.5 rounded border border-kyn-border bg-kyn-surface-2 text-kyn-text-soft hover:bg-kyn-surface-3"
            >
              New Bill
            </button>
          </div>
        )}
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
              ? "md:grid-cols-[240px_1fr] lg:grid-cols-[300px_1fr]"
              : "md:grid-cols-[40px_1fr]  lg:grid-cols-[40px_1fr]",
          ]
            .join(" ")
            .trim()}
        >
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
            onToggle={() => setBillDetailsOpen((v) => !v)}
            transactionTypes={transactionTypes}
          />
          <ItemsTableSection
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
            onRequestBatchSelect={handleRequestBatchSelect}
          />
        </div>
      </div>

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
          if (!batchPicker) return;

          const rowIndex = batchPicker.rowIndex;

          if (!batch) {
            setBatchPicker(null);
            return;
          }

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
                    rate:
                      batch.costPrice != null &&
                      !Number.isNaN(Number(batch.costPrice))
                        ? Number(batch.costPrice)
                        : r.rate,
                    salePrice:
                      batch.salePrice != null &&
                      !Number.isNaN(Number(batch.salePrice))
                        ? Number(batch.salePrice)
                        : r.salePrice,
                    ...offerClearPatch,
                  },
            ),
          );

          setBatchPicker(null);
        }}
        onAddNewBatch={() => {
          setBatchPicker(null);
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

      <ValidationModal
        isOpen={validationOpen}
        messages={validationMsgs}
        onClose={() => setValidationOpen(false)}
      />
    </div>
  );
}
