"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { platform } from "@/platform";
import { isSyncEnabled } from "@/platform/mode";
import { SyncManager } from "@/sync/SyncManager";
import SalesNavigation from "@/components/sales/SalesNavigation";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ValidationModal from "@/components/ui/ValidationModal";
import BatchSelectModal from "@/components/purchase/BatchSelectModal";
import SalesReturnReportsModal from "@/components/sales-return/SalesReturnReportsModal";
import BillDetailsSectionReturn from "@/components/sales-return/BillDetailsSectionReturn";
import SalesReturnItemsTable from "@/components/sales-return/SalesReturnItemsTable";
import SalesReturnSourceDetailsModal from "@/components/sales-return/SalesReturnSourceDetailsModal";
import SalesReturnEntrySettingsModal from "@/components/sales-return/SalesReturnEntrySettingsModal";
import { focusSalesReturnCell } from "@/components/sales-return/keyboardGrid";
import {
  loadSalesReturnUiSettings,
  saveSalesReturnUiSettings,
  type SalesReturnUiSettings,
} from "@/components/sales-return/salesReturnUiSettings";
import type {
  SalesReturnHeader,
  SalesReturnItemRow,
  SourceSaleOption,
} from "@/components/sales-return/types";
import type { BatchInfo, Customer, ItemRow } from "@/components/sales/types";
import { calcRow, createEmptyRow } from "@/components/sales/utils";
import type {
  RateTypeRecord,
  SaleReturnItemInput,
  SaleReturnSourceResult,
} from "@/platform/types";
import {
  findDefaultRateType,
  orderActiveRateTypes,
  resolveNamedRate,
} from "@/lib/rates/rateResolution";
import { canUseBarcode } from "@/lib/session/runtimeSession";
import { printSalesReturn } from "@/lib/print/printSalesReturn";

function freshHeader(): SalesReturnHeader {
  return {
    billNo: "",
    customer: null,
    department: "",
    debitAccount: "",
    natureOfEntry: "",
    saleDate: new Date().toISOString(),
    entryTime: new Date().toISOString(),
    discount: 0,
    saleType: "CASH",
    sourceSaleId: null,
  };
}
function freshRow(lineNo = 1): SalesReturnItemRow {
  return createEmptyRow(lineNo) as SalesReturnItemRow;
}
function snapshot(
  sourceSaleId: string | null,
  header: SalesReturnHeader,
  rows: SalesReturnItemRow[],
) {
  return JSON.stringify({
    sourceSaleId,
    header,
    rows: rows.map((r) => ({
      productId: r.productId,
      sourceSaleItemId: r.sourceSaleItemId,
      batchId: r.batchId,
      batchNo: r.batchNo,
      barcode: r.barcode,
      quantity: r.quantity,
      unit: r.unit,
      rate: r.rate,
      mrp: r.mrp,
      taxPercent: r.taxPercent,
      discountType: r.discountType,
      discount: r.discount,
      rateTypeId: r.rateTypeId,
      rateTypeName: r.rateTypeName,
      rateSource: r.rateSource,
    })),
  });
}
function mapManualSavedItem(it: any, index: number): SalesReturnItemRow {
  return calcRow({
    lineNo: it.lineNo || index + 1,
    productId: it.productId || "",
    code: it.productCode || "",
    name: it.productName || "",
    barcode: it.barcode || "",
    batchId: it.batchId ?? null,
    batchNo: it.batchNo || "",
    purchaseBatchNo: it.purchaseBatchNo || it.batchNo || "",
    mfgDate: it.mfgDate || null,
    expiryDate: it.expiryDate || null,
    quantity: Number(it.quantity || 0),
    unit: it.unit || "NOS",
    rate: Number(it.rate || 0),
    mrp: it.mrp != null ? Number(it.mrp) : null,
    taxPercent: it.taxPercent || "NT",
    discount: Number(it.discount || 0),
    discountType: it.discountType === "PCT" ? "PCT" : "ABS",
    salePrice:
      it.salePrice != null ? Number(it.salePrice) : Number(it.rate || 0),
    profit: it.profit != null ? Number(it.profit) : 0,
    totalCost: Number(it.totalCost || 0),
    billedValue: Number(it.billedValue || 0),
    lineType: "VALUED",
    rateTypeId: it.rateTypeId ?? null,
    rateTypeCode: it.rateTypeCode ?? null,
    rateTypeName: it.rateTypeName ?? null,
    rateSource: it.rateSource ?? "LEGACY",
    sourceSaleItemId: it.sourceSaleItemId ?? null,
  } as SalesReturnItemRow) as SalesReturnItemRow;
}

function SalesReturnPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");
  const deepLinkSaleId = searchParams.get("saleId");
  const [isClient, setIsClient] = useState(false);
  const [licenseId, setLicenseId] = useState("demo-license");
  const [userId, setUserId] = useState("U1");
  const [products, setProducts] = useState<any[]>([]);
  const [rateTypes, setRateTypes] = useState<RateTypeRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [header, setHeader] = useState<SalesReturnHeader>(freshHeader);
  const [rows, setRows] = useState<SalesReturnItemRow[]>([freshRow()]);
  const [sourceSaleId, setSourceSaleId] = useState<string | null>(null);
  const [sourceSales, setSourceSales] = useState<SourceSaleOption[]>([]);
  const [sourceSalesLoading, setSourceSalesLoading] = useState(false);
  const [sourceData, setSourceData] = useState<SaleReturnSourceResult | null>(
    null,
  );
  const sourceDeepLinkLoaded = useRef<string | null>(null);
  const initialItemFocusDone = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSlNo, setEditingSlNo] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<string | undefined>();
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);
  const [billDetailsOpen, setBillDetailsOpen] = useState(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [uiSettings, setUiSettings] = useState<SalesReturnUiSettings>(() =>
    loadSalesReturnUiSettings(),
  );
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationMsgs, setValidationMsgs] = useState<string[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [batchPicker, setBatchPicker] = useState<{
    rowIndex: number;
    productId: string;
    batches: BatchInfo[];
    productName?: string;
  } | null>(null);
  const initialSnapshot = useRef<string>(
    snapshot(null, freshHeader(), [freshRow()]),
  );
  const barcodeEnabled = isClient ? canUseBarcode() : true;

  useEffect(() => {
    setIsClient(true);
    setLicenseId(localStorage.getItem("licenseId") || "demo-license");
    setUserId(localStorage.getItem("userName") || "U1");
    setUiSettings(loadSalesReturnUiSettings());
  }, []);

  useEffect(() => {
    if (!isClient || openId || deepLinkSaleId || initialItemFocusDone.current) {
      return;
    }

    initialItemFocusDone.current = true;
    const timer = window.setTimeout(
      () => focusSalesReturnCell(0, "product"),
      80,
    );
    return () => window.clearTimeout(timer);
  }, [isClient, openId, deepLinkSaleId]);

  const loadCustomers = useCallback(async () => {
    const res = await platform.listCustomers?.(licenseId, {
      q: "",
      page: 1,
      pageSize: 300,
    });
    setCustomers(
      (res?.customers || []).map((c: any) => ({ id: c.id, name: c.name })),
    );
  }, [licenseId]);
  useEffect(() => {
    if (!isClient) return;
    void loadCustomers();
    void Promise.all([
      platform.getProducts(licenseId, { page: 1, pageSize: 500 }),
      platform.listRateTypes(licenseId, false),
    ]).then(([productRes, rateTypeRes]) => {
      setProducts(productRes.products || []);
      setRateTypes(orderActiveRateTypes(rateTypeRes.rows || []));
    });
    void platform
      .peekNextSaleReturnSlNo?.(licenseId)
      .then((r) => setNextEntryNo(r?.nextSlNo ?? 1));
  }, [isClient, licenseId, loadCustomers]);

  const loadSaleBillsForCustomer = useCallback(
    async (customerId: string) => {
      if (!customerId) {
        setSourceSales([]);
        return;
      }
      setSourceSalesLoading(true);
      try {
        const res = await platform.listSales?.(licenseId, {
          customerId,
          page: 1,
          pageSize: 300,
          includeDeleted: false,
        });
        setSourceSales(
          [...(res?.rows || [])].sort(
            (a, b) =>
              new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime(),
          ),
        );
      } finally {
        setSourceSalesLoading(false);
      }
    },
    [licenseId],
  );

  const loadAvailableRates = useCallback(
    async (productId: string, batchId: string | null) => {
      const activeTypes = orderActiveRateTypes(rateTypes);
      if (!activeTypes.length) return [];

      const [productRateRes, batchRateRes] = await Promise.all([
        platform.listProductRates(licenseId, productId),
        batchId
          ? platform.listProductBatchRates(licenseId, productId, batchId)
          : Promise.resolve({ success: true, rows: [] }),
      ]);

      return activeTypes.map((rateType) => {
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
    },
    [licenseId, rateTypes],
  );

  const resolveReturnRatePatch = useCallback(
    async (
      productId: string,
      batchId: string | null,
      legacyRate: number | null | undefined,
    ): Promise<Partial<SalesReturnItemRow>> => {
      const availableRates = await loadAvailableRates(productId, batchId);
      if (!availableRates.length) {
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

      const defaultType = findDefaultRateType(orderActiveRateTypes(rateTypes));
      const selected =
        availableRates.find((rate) => rate.rateTypeId === defaultType?.id) ||
        availableRates.find((rate) => rate.configured && rate.amount != null);

      if (!selected?.configured || selected.amount == null) {
        const amount = Number(legacyRate || 0);
        return {
          rate: amount,
          salePrice: amount,
          rateTypeId: null,
          rateTypeCode: null,
          rateTypeName: "Legacy",
          rateSource: "LEGACY",
          availableRates,
        };
      }

      return {
        rate: Number(selected.amount),
        salePrice: Number(selected.amount),
        rateTypeId: selected.rateTypeId,
        rateTypeCode: selected.code,
        rateTypeName: selected.name,
        rateSource: "MASTER",
        availableRates,
      };
    },
    [loadAvailableRates, rateTypes],
  );

  const buildSourceRows = useCallback(
    (
      source: SaleReturnSourceResult,
      savedItems: any[] = [],
    ): SalesReturnItemRow[] => {
      return (source.items || []).map((it: any, index) => {
        const saved = savedItems.find((s) => s.saleItemId === it.id);
        return calcRow({
          lineNo: it.lineNo || index + 1,
          productId: it.productId,
          code: it.productCode || "",
          name: it.productName || "",
          barcode: saved?.barcode ?? it.barcode ?? "",
          batchId: saved?.batchId ?? it.batchId ?? null,
          batchNo: saved?.batchNo ?? it.batchNo ?? "",
          purchaseBatchNo:
            saved?.purchaseBatchNo ?? it.purchaseBatchNo ?? it.batchNo ?? "",
          mfgDate: saved?.mfgDate ?? it.mfgDate ?? null,
          expiryDate: saved?.expiryDate ?? it.expiryDate ?? null,
          quantity: saved ? Number(saved.quantity || 0) : 0,
          unit: saved?.unit || it.unit || "NOS",
          rate: saved ? Number(saved.rate || 0) : Number(it.rate || 0),
          mrp:
            saved?.mrp != null
              ? Number(saved.mrp)
              : it.mrp != null
                ? Number(it.mrp)
                : null,
          taxPercent: saved?.taxPercent || it.taxPercent || "NT",
          discount: saved
            ? Number(saved.discount || 0)
            : Number(it.discount || 0),
          discountType:
            saved?.discountType === "PCT"
              ? "PCT"
              : it.discountType === "PCT"
                ? "PCT"
                : "ABS",
          salePrice:
            saved?.salePrice != null
              ? Number(saved.salePrice)
              : it.salePrice != null
                ? Number(it.salePrice)
                : Number(it.rate || 0),
          profit: saved?.profit != null ? Number(saved.profit) : 0,
          totalCost: Number(saved?.totalCost || 0),
          billedValue: Number(saved?.billedValue || 0),
          lineType: it.isFree ? "FREE" : "VALUED",
          rateTypeId: saved?.rateTypeId ?? it.rateTypeId ?? null,
          rateTypeCode: saved?.rateTypeCode ?? it.rateTypeCode ?? null,
          rateTypeName: saved?.rateTypeName ?? it.rateTypeName ?? null,
          rateSource: saved?.rateSource ?? it.rateSource ?? "LEGACY",
          availableRates:
            (saved?.rateTypeId ?? it.rateTypeId)
              ? [
                  {
                    rateTypeId: saved?.rateTypeId ?? it.rateTypeId,
                    code:
                      saved?.rateTypeCode ??
                      it.rateTypeCode ??
                      saved?.rateTypeName ??
                      it.rateTypeName ??
                      "",
                    name:
                      saved?.rateTypeName ??
                      it.rateTypeName ??
                      saved?.rateTypeCode ??
                      it.rateTypeCode ??
                      "Saved rate",
                    amount: saved
                      ? Number(saved.rate || 0)
                      : Number(it.rate || 0),
                    configured: true,
                    isDefault: false,
                  },
                ]
              : [],
          sourceSaleItemId: it.id,
          sourceBatchNo: it.batchNo || null,
          sourceRate: Number(it.rate || 0),
          sourceRateTypeId: it.rateTypeId ?? null,
          sourceRateTypeCode: it.rateTypeCode ?? null,
          sourceRateTypeName: it.rateTypeName ?? null,
          soldQuantity: Number(it.quantity || 0),
          previouslyReturnedQuantity: Number(
            it.previouslyReturnedQuantity || 0,
          ),
          remainingReturnableQuantity: Number(
            it.remainingReturnableQuantity || 0,
          ),
        } as SalesReturnItemRow) as SalesReturnItemRow;
      });
    },
    [],
  );

  const loadSourceSale = useCallback(
    async (
      saleId: string,
      opts?: { savedItems?: any[]; excludeReturnId?: string | null },
    ) => {
      const res = await platform.getSaleReturnSource?.(
        saleId,
        opts?.excludeReturnId || null,
      );
      if (!res?.success || !res.sale || !res.items) {
        setValidationMsgs([res?.error || "Source Sale could not be loaded."]);
        setValidationOpen(true);
        return null;
      }
      if (!res.sale.customerId) {
        setValidationMsgs([
          "The selected Sale is not linked to a customer and cannot be used as a source bill.",
        ]);
        setValidationOpen(true);
        return null;
      }
      setSourceSaleId(saleId);
      setSourceData(res);
      setHeader((prev) => ({
        ...prev,
        sourceSaleId: saleId,
        billNo: res.sale?.billNo || "",
        customer: {
          id: res.sale!.customerId!,
          name: res.sale!.customerName || res.sale!.customerId!,
        },
        saleType: res.sale?.saleType === "CREDIT" ? "CREDIT" : "CASH",
      }));
      const sourceRows = buildSourceRows(res, opts?.savedItems || []);
      const hydratedSourceRows = await Promise.all(
        sourceRows.map(async (row) => {
          const availableRates = await loadAvailableRates(
            row.productId,
            row.batchId || null,
          );
          const selectedSavedRate =
            row.rateTypeId && row.rateSource !== "CUSTOM"
              ? {
                  rateTypeId: row.rateTypeId,
                  code: row.rateTypeCode || row.rateTypeName || "",
                  name: row.rateTypeName || row.rateTypeCode || "Saved rate",
                  amount: Number(row.rate || 0),
                  configured: true,
                  isDefault: false,
                }
              : null;
          const mergedRates = [...availableRates];
          if (selectedSavedRate) {
            const selectedIndex = mergedRates.findIndex(
              (rate) => rate.rateTypeId === selectedSavedRate.rateTypeId,
            );
            if (selectedIndex >= 0) {
              mergedRates[selectedIndex] = selectedSavedRate;
            } else {
              mergedRates.unshift(selectedSavedRate);
            }
          }
          return {
            ...row,
            availableRates: mergedRates,
          } as SalesReturnItemRow;
        }),
      );
      setRows(hydratedSourceRows);
      await loadSaleBillsForCustomer(res.sale.customerId);
      return res;
    },
    [buildSourceRows, loadAvailableRates, loadSaleBillsForCustomer, licenseId],
  );

  useEffect(() => {
    if (!isClient || !openId) return;
    let cancelled = false;
    void (async () => {
      setOpeningId(openId);
      try {
        const res = await platform.getSaleReturnFull?.(openId);
        if (cancelled || !res?.success || !res.saleReturn) return;
        const sr: any = res.saleReturn;
        const nextHeader: SalesReturnHeader = {
          billNo: sr.billNo || "",
          customer: sr.customerId
            ? { id: sr.customerId, name: sr.customerName || sr.customerId }
            : null,
          department: sr.department || "",
          debitAccount: sr.debitAccount || "",
          natureOfEntry: sr.natureOfEntry || "",
          saleDate: sr.returnDate || new Date().toISOString(),
          entryTime: sr.entryTime || new Date().toISOString(),
          discount: Number(sr.discount || 0),
          saleType: sr.saleType === "CREDIT" ? "CREDIT" : "CASH",
          sourceSaleId: sr.saleId || null,
        };
        setEditingId(sr.id);
        setEditingSlNo(sr.slNo ?? null);
        setHeader(nextHeader);
        if (sr.saleId) {
          const source = await loadSourceSale(sr.saleId, {
            savedItems: res.items || [],
            excludeReturnId: sr.id,
          });
          if (!source) return;
          const sourceRows = buildSourceRows(source, res.items || []);
          const sourceHeader: SalesReturnHeader = {
            ...nextHeader,
            sourceSaleId: sr.saleId,
            billNo: source.sale?.billNo || nextHeader.billNo,
            customer: source.sale?.customerId
              ? {
                  id: source.sale.customerId,
                  name: source.sale.customerName || source.sale.customerId,
                }
              : nextHeader.customer,
            saleType: source.sale?.saleType === "CREDIT" ? "CREDIT" : "CASH",
          };
          initialSnapshot.current = snapshot(
            sr.saleId,
            sourceHeader,
            sourceRows,
          );
        } else {
          setSourceSaleId(null);
          setSourceData(null);
          const manualRows = (res.items || []).length
            ? (res.items || []).map(mapManualSavedItem)
            : [freshRow()];
          setRows(manualRows);
          if (sr.customerId) {
            await loadSaleBillsForCustomer(sr.customerId);
          } else {
            setSourceSales([]);
          }
          initialSnapshot.current = snapshot(null, nextHeader, manualRows);
        }
      } finally {
        if (!cancelled) setOpeningId(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isClient, openId, loadSourceSale, loadSaleBillsForCustomer]);

  useEffect(() => {
    if (
      !isClient ||
      openId ||
      !deepLinkSaleId ||
      sourceDeepLinkLoaded.current === deepLinkSaleId
    )
      return;
    sourceDeepLinkLoaded.current = deepLinkSaleId;
    void (async () => {
      const sale = await platform.getSaleFull?.(deepLinkSaleId);
      if (!sale?.success || !sale.sale) {
        setValidationMsgs(["The source Sale could not be loaded."]);
        setValidationOpen(true);
        return;
      }
      if (!sale.sale.customerId) {
        setValidationMsgs([
          "The selected Sale is not linked to a customer and cannot be used as a source bill.",
        ]);
        setValidationOpen(true);
        return;
      }
      setHeader((h) => ({
        ...h,
        customer: {
          id: sale.sale!.customerId!,
          name: sale.sale!.customerName || sale.sale!.customerId!,
        },
      }));
      await loadSaleBillsForCustomer(sale.sale.customerId);
      await loadSourceSale(deepLinkSaleId);
    })();
  }, [
    isClient,
    openId,
    deepLinkSaleId,
    loadSaleBillsForCustomer,
    loadSourceSale,
  ]);

  const subTotal = useMemo(
    () => rows.reduce((s, r) => s + Number(r.billedValue || 0), 0),
    [rows],
  );
  const grandTotal = useMemo(
    () => Math.max(0, subTotal - Number(header.discount || 0)),
    [subTotal, header.discount],
  );
  const isDirty = useMemo(
    () => snapshot(sourceSaleId, header, rows) !== initialSnapshot.current,
    [sourceSaleId, header, rows],
  );

  const onCustomerChange = useCallback(
    (id: string) => {
      const editingSourceLinked = Boolean(editingId) && Boolean(sourceSaleId);
      const nextCustomer =
        customers.find((customer) => customer.id === id) || null;

      if (editingSourceLinked && nextCustomer?.id !== header.customer?.id) {
        setValidationMsgs([
          "The customer is locked while editing a source-linked Sales Return.",
          "Start a New Return to select another customer or Sale bill.",
        ]);
        setValidationOpen(true);
        return;
      }

      const hadSourceSale = Boolean(sourceSaleId);
      setSourceSaleId(null);
      setSourceData(null);
      setShowSourceDetails(false);
      if (hadSourceSale) setRows([freshRow()]);

      setHeader((current) => ({
        ...current,
        customer: nextCustomer,
        sourceSaleId: null,
        billNo: hadSourceSale ? "" : current.billNo,
        saleType:
          !nextCustomer && current.saleType === "CREDIT"
            ? "CASH"
            : current.saleType,
      }));

      if (nextCustomer?.id) void loadSaleBillsForCustomer(nextCustomer.id);
      else setSourceSales([]);
    },
    [
      customers,
      editingId,
      sourceSaleId,
      header.customer?.id,
      loadSaleBillsForCustomer,
    ],
  );

  const clearSourceSale = useCallback(
    (clearRows = true) => {
      if (editingId && sourceSaleId) {
        setValidationMsgs([
          "The source Sale bill cannot be changed while editing.",
          "Start a New Return to select another bill.",
        ]);
        setValidationOpen(true);
        return;
      }
      setSourceSaleId(null);
      setSourceData(null);
      setShowSourceDetails(false);
      setHeader((current) => ({
        ...current,
        sourceSaleId: null,
        billNo: "",
      }));
      if (clearRows) setRows([freshRow()]);
    },
    [editingId, sourceSaleId],
  );

  const onSourceSaleChange = useCallback(
    (id: string) => {
      if (!id) {
        clearSourceSale(Boolean(sourceSaleId));
        return;
      }
      if (editingId && sourceSaleId && id !== sourceSaleId) {
        setValidationMsgs([
          "The source Sale bill cannot be changed while editing.",
          "Start a New Return to select another bill.",
        ]);
        setValidationOpen(true);
        return;
      }
      void loadSourceSale(id, { excludeReturnId: editingId });
    },
    [clearSourceSale, sourceSaleId, loadSourceSale, editingId],
  );

  const getBatches = useCallback(
    async (productId: string) => {
      const res = barcodeEnabled
        ? await platform.listBarcodesForProduct?.(licenseId, productId)
        : await platform.listBatchesForProduct(productId, false);
      return (res?.rows || []).map((b: any) => ({
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
      })) as BatchInfo[];
    },
    [barcodeEnabled, licenseId],
  );
  const handleSelectProduct = useCallback(
    async (index: number, productId: string) => {
      if (sourceSaleId) return;
      const product = await platform.getProduct(productId);
      if (!product) return;
      const batches = await getBatches(productId);
      const productRatePatch = await resolveReturnRatePatch(
        productId,
        null,
        product.salePrice,
      );
      const base: any = {
        productId,
        code: product.code,
        name: product.name,
        unit: product.unit,
        taxPercent: product.tax,
        batchId: null,
        barcode: "",
        batchNo: "",
        purchaseBatchNo: "",
        mfgDate: null,
        expiryDate: null,
        mrp: null,
        ...productRatePatch,
        sourceSaleItemId: null,
      };
      setRows((prev) =>
        prev.map((r, i) =>
          i === index
            ? (calcRow({ ...r, ...base } as ItemRow) as SalesReturnItemRow)
            : r,
        ),
      );
      if (batches.length > 0) {
        setBatchPicker({
          rowIndex: index,
          productId,
          batches,
          productName: product.name,
        });
        return;
      }

      window.setTimeout(() => focusSalesReturnCell(index, "quantity"), 20);
    },
    [sourceSaleId, getBatches, barcodeEnabled, resolveReturnRatePatch],
  );
  const handleRequestBatchSelect = useCallback(
    async (index: number, productId?: string) => {
      const row = rows[index];
      const id = productId || row?.productId;
      if (!id) return;
      const batches = await getBatches(id);
      if (!batches.length) {
        setValidationMsgs([
          "No live batch exists for this product. Create/restore the correct batch before returning into it.",
        ]);
        setValidationOpen(true);
        return;
      }
      setBatchPicker({
        rowIndex: index,
        productId: id,
        batches,
        productName: row?.name || products.find((p) => p.id === id)?.name,
      });
    },
    [rows, getBatches, products],
  );
  const updateRow = useCallback(
    (index: number, patch: Partial<SalesReturnItemRow>) => {
      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== index) return r;
          const isDirectRateEdit =
            "rate" in patch &&
            !("rateTypeId" in patch) &&
            !("rateSource" in patch);
          let normalized: Partial<SalesReturnItemRow> = isDirectRateEdit
            ? {
                ...patch,
                rateTypeId: null,
                rateTypeCode: null,
                rateTypeName: "Custom",
                rateSource: "CUSTOM" as const,
              }
            : patch;
          if (sourceSaleId && "quantity" in normalized) {
            const remaining = Math.max(
              0,
              Number(r.remainingReturnableQuantity || 0),
            );
            normalized = {
              ...normalized,
              quantity: Math.min(
                remaining,
                Math.max(0, Number(normalized.quantity || 0)),
              ),
            };
          }
          return calcRow({
            ...r,
            ...normalized,
          } as ItemRow) as SalesReturnItemRow;
        }),
      );
    },
    [sourceSaleId],
  );

  const validate = useCallback(() => {
    const errs: string[] = [];
    if (header.saleType === "CREDIT" && !header.customer)
      errs.push("CREDIT Sales Return requires a customer.");
    if (sourceSaleId && !header.customer)
      errs.push("A source-linked Sales Return requires its Sale customer.");
    const active = rows.filter(
      (r) => r.productId && Number(r.quantity || 0) > 0,
    );
    if (!active.length)
      errs.push("Enter a return quantity for at least one item.");
    active.forEach((r, i) => {
      if (Number(r.quantity || 0) <= 0)
        errs.push(`Row ${i + 1}: quantity must be greater than zero.`);
      if (!r.unit) errs.push(`Row ${i + 1}: unit is required.`);
      if (Number(r.rate || 0) < 0)
        errs.push(`Row ${i + 1}: Return Rate cannot be negative.`);
      if (sourceSaleId) {
        if (!r.sourceSaleItemId)
          errs.push(`Row ${i + 1}: source Sale item link is missing.`);
        const remaining = Number(r.remainingReturnableQuantity || 0);
        if (Number(r.quantity || 0) > remaining + 1e-9)
          errs.push(
            `Row ${i + 1}: return quantity ${r.quantity} exceeds remaining sold quantity ${remaining}.`,
          );
      }
    });
    return errs;
  }, [header, sourceSaleId, rows]);
  const mapItems = useCallback(
    (): SaleReturnItemInput[] =>
      rows
        .filter((r) => r.productId && Number(r.quantity || 0) > 0)
        .map((r, index) => ({
          productId: r.productId,
          saleItemId: sourceSaleId ? r.sourceSaleItemId || null : null,
          barcode: r.barcode || null,
          quantity: Number(r.quantity || 0),
          unit: String(r.unit || "NOS"),
          rate: Number(r.rate || 0),
          mrp: r.mrp == null ? null : Number(r.mrp),
          taxPercent: String(r.taxPercent || "NT"),
          discount: Number(r.discount || 0),
          discountType: r.discountType === "PCT" ? "PCT" : "ABS",
          salePrice: r.salePrice == null ? null : Number(r.salePrice),
          batchNo: r.batchNo || null,
          mfgDate: r.mfgDate || null,
          expiryDate: r.expiryDate || null,
          lineNo: index + 1,
          batchId: r.batchId || null,
          profitPercent: Number(r.profitPercent || 0),
          rateTypeId: r.rateTypeId || null,
          rateTypeCode: r.rateTypeCode || null,
          rateTypeName: r.rateTypeName || null,
          rateSource: r.rateSource || "LEGACY",
        })),
    [rows, sourceSaleId],
  );

  const handleSave = useCallback(async () => {
    if (saving) return false;
    const errs = validate();
    if (errs.length) {
      setValidationMsgs(errs);
      setValidationOpen(true);
      return false;
    }
    setSaving(true);
    try {
      const payloadHeader = {
        userId,
        licenseId,
        saleId: sourceSaleId,
        customerId: header.customer?.id || null,
        customerName: header.customer?.name || null,
        billNo: header.billNo || null,
        department: header.department || null,
        debitAccount: header.debitAccount || null,
        natureOfEntry: header.natureOfEntry || null,
        returnDate: header.saleDate,
        entryTime: header.entryTime,
        discount: Number(header.discount || 0),
        saleType: header.saleType,
      };
      const items = mapItems();
      const res = editingId
        ? await platform.updateSaleReturn?.({
            id: editingId,
            header: payloadHeader,
            items,
          })
        : await platform.createSaleReturn?.({ header: payloadHeader, items });
      if (!res?.success) {
        setValidationMsgs([res?.error || "Failed to save Sales Return."]);
        setValidationOpen(true);
        return false;
      }
      const savedId = editingId || res.returnId || null;
      setEditingId(savedId);
      if (!editingId) setEditingSlNo((res as any).slNo ?? null);
      setFeedback(
        `${editingId ? "Sales Return updated" : "Sales Return saved"}. Total Rs. ${Number((res as any).totalAmount ?? grandTotal).toFixed(2)}`,
      );
      initialSnapshot.current = snapshot(sourceSaleId, header, rows);
      if (isSyncEnabled()) {
        for (const entity of [
          "saleReturn",
          "saleReturnItem",
          "customerTransaction",
          "cashTransaction",
          "product",
        ] as const)
          SyncManager.pushEntity(entity as any).catch(() => {});
      }
      void platform
        .peekNextSaleReturnSlNo?.(licenseId)
        .then((r) => setNextEntryNo(r?.nextSlNo ?? null));
      if (sourceSaleId && savedId)
        void loadSourceSale(sourceSaleId, {
          savedItems: items,
          excludeReturnId: savedId,
        });
      return true;
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    validate,
    userId,
    licenseId,
    sourceSaleId,
    header,
    mapItems,
    editingId,
    grandTotal,
    rows,
    loadSourceSale,
  ]);

  const resetAll = useCallback(() => {
    const h = freshHeader();
    const r = [freshRow()];
    setHeader(h);
    setRows(r);
    setSourceSaleId(null);
    setSourceData(null);
    setSourceSales([]);
    setEditingId(null);
    setEditingSlNo(null);
    setShowReports(false);
    setShowSourceDetails(false);
    setShowSettings(false);
    setIsMobileSheetOpen(false);
    setBatchPicker(null);
    setValidationOpen(false);
    setFeedback(null);
    initialSnapshot.current = snapshot(null, h, r);
    router.replace("/dashboard/sales-return");
    window.setTimeout(() => focusSalesReturnCell(0, "product"), 30);
  }, [router]);
  const printCurrent = useCallback(async () => {
    if (!editingId) {
      setValidationMsgs(["Save the Sales Return before printing."]);
      setValidationOpen(true);
      return;
    }
    try {
      await printSalesReturn(editingId, licenseId);
    } catch (err: any) {
      setValidationMsgs([String(err?.message || err)]);
      setValidationOpen(true);
    }
  }, [editingId, licenseId]);
  const tryNavigate = useCallback(
    (path: string) => {
      if (!isDirty) return router.push(path);
      setPendingPath(path);
      setLeaveOpen(true);
    },
    [isDirty, router],
  );

  const focusItemEntry = useCallback(() => {
    if (sourceSaleId) {
      const sourceRowIndex = rows.findIndex(
        (row) =>
          row.productId && Number(row.remainingReturnableQuantity || 0) > 0,
      );
      const targetRowIndex = sourceRowIndex >= 0 ? sourceRowIndex : 0;
      focusSalesReturnCell(targetRowIndex, "quantity");
      return;
    }

    const targetRowIndex = Math.max(
      0,
      rows.findIndex((row) => !row.productId),
    );
    focusSalesReturnCell(targetRowIndex, "product");
  }, [rows, sourceSaleId]);

  const focusBillDetails = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setIsMobileSheetOpen(true);
    } else {
      setBillDetailsOpen(true);
    }
    window.setTimeout(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-sr-header-focus="customer"], [data-sr-header-focus="sourceSale"]',
        ),
      ).find(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getClientRects().length > 0,
      );
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, 0);
  }, []);

  const focusLastBillDetail = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setIsMobileSheetOpen(true);
    } else {
      setBillDetailsOpen(true);
    }

    window.setTimeout(() => {
      const focusables = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sr-header-focus]"),
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getClientRects().length > 0,
      );
      const target = focusables[focusables.length - 1];
      target?.focus({ preventScroll: true });
      if (target instanceof HTMLInputElement) {
        try {
          target.select();
        } catch {}
      }
      target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, 0);
  }, []);

  const toggleBillDetails = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setIsMobileSheetOpen((current) => !current);
      return;
    }
    setBillDetailsOpen((current) => !current);
  }, []);

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [isDirty]);
  const hasBlockingOverlay =
    showSettings ||
    showSourceDetails ||
    showReports ||
    validationOpen ||
    discardOpen ||
    leaveOpen ||
    showCustomerModal ||
    Boolean(batchPicker);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || hasBlockingOverlay) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const toggleBillDetailsShortcut =
        ctrl && (e.code === "Backslash" || key === "\\" || key === "|");

      if (toggleBillDetailsShortcut) {
        e.preventDefault();
        e.stopPropagation();
        toggleBillDetails();
        return;
      }

      if (ctrl && key === "s") {
        e.preventDefault();
        void handleSave();
        return;
      }

      if (ctrl && key === "n") {
        e.preventDefault();
        if (isDirty) setDiscardOpen(true);
        else resetAll();
        return;
      }

      if (ctrl && key === "p") {
        e.preventDefault();
        void printCurrent();
        return;
      }

      if (e.key === "F4") {
        e.preventDefault();
        focusBillDetails();
        return;
      }

      if (e.key === "F5") {
        e.preventDefault();
        if (sourceData) setShowSourceDetails(true);
        return;
      }

      if (e.key === "F6") {
        e.preventDefault();
        setShowReports(true);
        return;
      }

      if (e.key === "F7") {
        e.preventDefault();
        setShowSettings(true);
        return;
      }

      if (e.key === "F3") {
        e.preventDefault();
        focusItemEntry();
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        const active = document.activeElement as HTMLElement | null;
        const cell = active?.closest<HTMLElement>("[data-cell]");
        const token = cell?.dataset.cell || "";
        const parsedRow = Number(token.split(":")[0]);
        const fallbackRow = sourceSaleId
          ? Math.max(
              0,
              rows.findIndex(
                (row) =>
                  row.productId &&
                  Number(row.remainingReturnableQuantity || 0) > 0,
              ),
            )
          : Math.max(
              0,
              rows.findIndex((row) => Boolean(row.productId)),
            );
        const rowIndex = Number.isFinite(parsedRow) ? parsedRow : fallbackRow;
        void handleRequestBatchSelect(rowIndex);
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    handleSave,
    hasBlockingOverlay,
    isDirty,
    resetAll,
    printCurrent,
    toggleBillDetails,
    focusBillDetails,
    focusItemEntry,
    sourceData,
    sourceSaleId,
    rows,
    handleRequestBatchSelect,
  ]);

  if (!isClient) return null;

  const requiredHeaderMissing =
    header.saleType === "CREDIT" && !header.customer;

  return (
    <div className="flex h-screen flex-col bg-kyn-bg text-kyn-text">
      <SalesNavigation
        onNavigate={tryNavigate}
        title="Sales Return"
        keyboardEnabled={!hasBlockingOverlay}
        savedBillOpen={Boolean(editingId)}
        onPrintBill={printCurrent}
        onNewBill={() => (isDirty ? setDiscardOpen(true) : resetAll())}
      />

      <div className="min-h-0 flex-1 overflow-hidden p-0">
        <div
          className={[
            "grid h-full overflow-hidden transition-all duration-200",
            "grid-cols-1",
            billDetailsOpen
              ? "md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]"
              : "md:grid-cols-[44px_1fr] lg:grid-cols-[44px_1fr]",
          ]
            .join(" ")
            .trim()}
        >
          <div className="hidden min-h-0 overflow-hidden md:flex md:flex-col">
            <BillDetailsSectionReturn
              expanded={billDetailsOpen}
              onToggle={toggleBillDetails}
              header={header}
              setHeader={setHeader}
              customers={customers}
              onCustomerChange={onCustomerChange}
              setShowCustomerModal={setShowCustomerModal}
              sourceSales={sourceSales}
              sourceSalesLoading={sourceSalesLoading}
              sourceSaleId={sourceSaleId}
              onSourceSaleChange={onSourceSaleChange}
              subTotal={subTotal}
              grandTotal={grandTotal}
              entryNo={
                editingId
                  ? (editingSlNo ?? undefined)
                  : (nextEntryNo ?? undefined)
              }
              settings={uiSettings}
              onSave={handleSave}
              onCancel={() => (isDirty ? setDiscardOpen(true) : resetAll())}
              isEditing={Boolean(editingId)}
              saving={saving}
              onFocusItems={focusItemEntry}
            />
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden bg-white">
            <SalesReturnItemsTable
              sourceLinked={Boolean(sourceSaleId)}
              rows={rows}
              products={products}
              settings={uiSettings}
              barcodeEnabled={barcodeEnabled}
              onSelectProduct={handleSelectProduct}
              onUpdateRow={updateRow}
              onAddRow={() =>
                setRows((prev) => [...prev, freshRow(prev.length + 1)])
              }
              onRemoveRow={(index) =>
                setRows((prev) =>
                  prev
                    .filter((_, i) => i !== index)
                    .map((row, i) => ({ ...row, lineNo: i + 1 })),
                )
              }
              onRequestBatchSelect={handleRequestBatchSelect}
              onOpenMobileSheet={() => setIsMobileSheetOpen(true)}
              hasMissingFields={requiredHeaderMissing}
              onOpenSettings={() => setShowSettings(true)}
              onOpenDetails={
                sourceData ? () => setShowSourceDetails(true) : undefined
              }
              onShowReports={() => setShowReports(true)}
              onPrintBill={printCurrent}
              canPrint={Boolean(editingId)}
              onFocusBillDetails={focusBillDetails}
              onToggleBillDetails={toggleBillDetails}
              onFocusItems={focusItemEntry}
              onFocusPreviousSection={focusLastBillDetail}
            />
          </div>
        </div>
      </div>

      {isMobileSheetOpen ? (
        <div className="fixed inset-0 z-[900] md:hidden">
          <button
            type="button"
            aria-label="Close Bill Details"
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMobileSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Sales Return
                </p>
                <h3 className="text-sm font-semibold text-slate-800">
                  Bill Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSheetOpen(false)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Close
              </button>
            </div>
            <BillDetailsSectionReturn
              expanded
              mobileSheet
              onToggle={() => setIsMobileSheetOpen(false)}
              header={header}
              setHeader={setHeader}
              customers={customers}
              onCustomerChange={onCustomerChange}
              setShowCustomerModal={setShowCustomerModal}
              sourceSales={sourceSales}
              sourceSalesLoading={sourceSalesLoading}
              sourceSaleId={sourceSaleId}
              onSourceSaleChange={onSourceSaleChange}
              subTotal={subTotal}
              grandTotal={grandTotal}
              entryNo={
                editingId
                  ? (editingSlNo ?? undefined)
                  : (nextEntryNo ?? undefined)
              }
              settings={uiSettings}
              onSave={async () => {
                const ok = await handleSave();
                if (ok) setIsMobileSheetOpen(false);
              }}
              onCancel={() => {
                if (isDirty) {
                  setDiscardOpen(true);
                } else {
                  resetAll();
                  setIsMobileSheetOpen(false);
                }
              }}
              isEditing={Boolean(editingId)}
              saving={saving}
              onFocusItems={focusItemEntry}
            />
          </div>
        </div>
      ) : null}
      {feedback && (
        <button
          type="button"
          onClick={() => setFeedback(null)}
          className="fixed bottom-4 right-4 z-[1500] max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-xs font-semibold text-emerald-800 shadow-xl"
        >
          {feedback}
        </button>
      )}
      {showCustomerModal && (
        <CustomerFormModal
          isOpen
          onClose={() => setShowCustomerModal(false)}
          onSuccess={() => {
            setShowCustomerModal(false);
            void loadCustomers();
          }}
        />
      )}
      <SalesReturnReportsModal
        isOpen={showReports}
        onClose={() => setShowReports(false)}
        licenseId={licenseId}
        customers={customers}
        onOpenSaleReturn={(id) => {
          setShowReports(false);
          router.push(`/dashboard/sales-return?open=${id}`);
        }}
        openingId={openingId}
      />
      <SalesReturnSourceDetailsModal
        isOpen={showSourceDetails}
        source={sourceData}
        rows={rows}
        onClose={() => setShowSourceDetails(false)}
      />
      <SalesReturnEntrySettingsModal
        isOpen={showSettings}
        value={uiSettings}
        onClose={() => setShowSettings(false)}
        onApply={(value) => {
          setUiSettings(value);
          saveSalesReturnUiSettings(value);
          setShowSettings(false);
        }}
      />
      <BatchSelectModal
        isOpen={Boolean(batchPicker)}
        onClose={() => {
          const rowIndex = batchPicker?.rowIndex;
          setBatchPicker(null);
          if (rowIndex != null) {
            window.setTimeout(
              () => focusSalesReturnCell(rowIndex, "product"),
              20,
            );
          }
        }}
        batches={batchPicker?.batches || []}
        productName={batchPicker?.productName}
        nextBarcode=""
        allowCreateNew={false}
        barcodeEnabled={barcodeEnabled}
        onSelect={async (batch) => {
          if (!batchPicker || !batch) {
            setBatchPicker(null);
            return;
          }
          const i = batchPicker.rowIndex;
          const currentRow = rows[i];
          const manualRatePatch = !sourceSaleId
            ? await resolveReturnRatePatch(
                batchPicker.productId,
                batch.id,
                batch.salePrice ?? currentRow?.rate ?? 0,
              )
            : {};
          setRows((prev) =>
            prev.map((r, index) =>
              index !== i
                ? r
                : (calcRow({
                    ...r,
                    batchId: batch.id,
                    barcode: barcodeEnabled ? batch.barcode || "" : "",
                    batchNo: batch.batchNo ?? null,
                    purchaseBatchNo:
                      batch.purchaseBatchNo ?? batch.batchNo ?? null,
                    mfgDate: batch.mfgDate ?? null,
                    expiryDate: batch.expiryDate ?? null,
                    mrp: batch.mrp ?? r.mrp,
                    ...manualRatePatch,
                  } as ItemRow) as SalesReturnItemRow),
            ),
          );
          setBatchPicker(null);
          window.setTimeout(() => focusSalesReturnCell(i, "quantity"), 20);
        }}
        onAddNewBatch={() => setBatchPicker(null)}
      />
      <ConfirmModal
        isOpen={discardOpen}
        title="Start a new Sales Return?"
        message="Unsaved changes will be discarded."
        confirmText="Discard and New"
        cancelText="Keep editing"
        onConfirm={() => {
          setDiscardOpen(false);
          resetAll();
        }}
        onCancel={() => setDiscardOpen(false)}
      />
      <ConfirmModal
        isOpen={leaveOpen}
        title="Leave Sales Return?"
        message={
          "You have unsaved changes.\n\nSave & Exit saves first. Discard leaves without saving."
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

export default function SalesReturnPage() {
  return (
    <Suspense fallback={null}>
      <SalesReturnPageInner />
    </Suspense>
  );
}
