// src/app/dashboard/sales-return/page.tsx
"use client";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { platform } from "@/platform";
import { isSyncEnabled } from "@/platform/mode";
import { SyncManager } from "@/sync/SyncManager";
import { useRouter, useSearchParams } from "next/navigation";
import SalesNavigation from "@/components/sales/SalesNavigation";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import SalesReturnReportsModal from "@/components/sales-return/SalesReturnReportsModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ValidationModal from "@/components/ui/ValidationModal";
import BillDetailsSectionReturn from "@/components/sales-return/BillDetailsSectionReturn";
import BatchSelectModal from "@/components/purchase/BatchSelectModal";
import {
  HeaderForm,
  ItemRow,
  Customer,
  BatchInfo,
} from "@/components/sales/types";
import {
  createEmptyRow,
  calcRow,
  mapItems,
  validateSaleBill,
} from "@/components/sales/utils";

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
    })),
  });
}

// Unified finalize-after-successful-save flow
async function finalizeAfterSuccessfulSaleReturn({
  resetFn,
}: {
  resetFn: () => void;
}) {
  resetFn();

  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-cell="0:product"]`);
    el?.focus();
  }, 50);
}

function SalesReturnPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");

  const [isClient, setIsClient] = useState(false);
  const [licenseId, setLicenseId] = useState("demo-license");
  const [userId, setUserId] = useState("U1");

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSlNo, setEditingSlNo] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<string | undefined>(undefined);

  const [batchPicker, setBatchPicker] = useState<{
    rowIndex: number;
    productId: string;
    batches: BatchInfo[];
    productName?: string;
    nextBarcode: string;
  } | null>(null);

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
  });
  const [rows, setRows] = useState<ItemRow[]>([createEmptyRow(1)]);
  const [isDirty, setIsDirty] = useState(false);
  const initialSnapshot = useRef<string | null>(null);

  const [showReports, setShowReports] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationMsgs, setValidationMsgs] = useState<string[]>([]);

  // NEW: Cancel confirmation modal
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    setIsClient(true);

    if (typeof window !== "undefined") {
      setLicenseId(localStorage.getItem("licenseId") || "demo-license");
      setUserId(localStorage.getItem("userName") || "U1");
    }
  }, []);

  const handleOpenSaleReturn = useCallback(
    (id: string) => {
      setShowReports(false);
      router.push(`/dashboard/sales-return?open=${id}`);
    },
    [router],
  );

  useEffect(() => {
    if (!isClient) return;

    (async () => {
      const res = await platform.getProducts(licenseId, {
        page: 1,
        pageSize: 200,
      });
      setProducts(res.products);
    })();
    (async () => {
      const res = await platform.peekNextSaleReturnSlNo?.(licenseId);
      setNextEntryNo(res?.nextSlNo ?? 1);
    })();
  }, [licenseId, isClient]);

  useEffect(() => {
    loadCustomers();
  }, [showCustomerModal]);

  const loadCustomers = async () => {
    const res = await platform.listCustomers?.(licenseId, {
      q: "",
      page: 1,
      pageSize: 100,
    });
    const { customers: cs } = res ?? { customers: [] };
    setCustomers(cs.map((c: any) => ({ id: c.id, name: c.name })));
  };

  useEffect(() => {
    if (!openId) return;

    let cancelled = false;

    (async () => {
      try {
        setOpeningId(openId);

        const res = await platform.getSaleReturnFull?.(openId);
        if (!res?.success || !res?.saleReturn) return;

        const sr = res.saleReturn;
        const dbItems = res.items || [];

        const mappedCustomer =
          sr.customerId && sr.customerName
            ? { id: sr.customerId, name: sr.customerName }
            : null;

        const mappedRows = dbItems.length
          ? dbItems.map((it: any, idx: number) =>
              calcRow({
                lineNo: it.lineNo || idx + 1,
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
                unit: it.unit || "",
                rate: Number(it.rate || 0),
                mrp: it.mrp != null ? Number(it.mrp) : null,
                taxPercent: it.taxPercent || "NT",
                discount: Number(it.discount || 0),
                discountType: it.discountType || "ABS",
                salePrice:
                  it.salePrice != null
                    ? Number(it.salePrice)
                    : Number(it.rate || 0),
                profit: it.profit != null ? Number(it.profit) : 0,
                totalCost: Number(it.totalCost || 0),
                billedValue: Number(it.billedValue || 0),
                lineType: "VALUED",
              } as ItemRow),
            )
          : [createEmptyRow(1)];

        if (cancelled) return;

        setEditingId(sr.id);
        setEditingSlNo(sr.slNo ?? null);

        const nextHeader: HeaderForm = {
          billNo: sr.billNo || "",
          customer: mappedCustomer,
          department: sr.department || "",
          debitAccount: sr.debitAccount || "",
          natureOfEntry: sr.natureOfEntry || "",
          saleDate: sr.returnDate || new Date().toISOString(),
          entryTime: sr.entryTime || new Date().toISOString(),
          discount: Number(sr.discount || 0),
          saleType: sr.saleType || "CASH",
        };

        setHeader(nextHeader);
        setRows(mappedRows);
        initialSnapshot.current = makeSnapshot(nextHeader, mappedRows);
        setIsDirty(false);
      } catch (err) {
        console.error("Failed to open sale return", err);
      } finally {
        if (!cancelled) setOpeningId(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openId]);

  const handleSelectProduct = async (rowIndex: number, productId: string) => {
    const product = await platform.getProduct(productId);
    if (!product) return;

    const batchesRes = await platform.listBarcodesForProduct?.(
      licenseId,
      productId,
    );

    const liveBatches: BatchInfo[] = (batchesRes?.rows || []).map((b: any) => ({
      id: b.id,
      barcode: b.barcode,
      batchNo: b.batchNo,
      purchaseBatchNo: b.purchaseBatchNo || b.batchNo,
      mfgDate: b.mfgDate,
      expiryDate: b.expiryDate,
      mrp: b.mrp,
      salePrice: b.salePrice,
      costPrice: b.costPrice,
      stock: b.stock,
    }));

    const basePatch = {
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
      rate: Number(product.salePrice) || 0,
      salePrice:
        product.salePrice != null && !Number.isNaN(Number(product.salePrice))
          ? Number(product.salePrice)
          : 0,
    };

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
                barcode: b.barcode || "",
                batchNo: b.batchNo ?? null,
                purchaseBatchNo: b.purchaseBatchNo ?? b.batchNo ?? null,
                mfgDate: b.mfgDate ?? null,
                expiryDate: b.expiryDate ?? null,
                mrp: b.mrp ?? null,
                rate:
                  b.salePrice != null && !Number.isNaN(Number(b.salePrice))
                    ? Number(b.salePrice)
                    : Number(product.salePrice) || 0,
                salePrice:
                  b.salePrice != null && !Number.isNaN(Number(b.salePrice))
                    ? Number(b.salePrice)
                    : Number(product.salePrice) || 0,
              },
        ),
      );
      return;
    }

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

    setRows((prev) =>
      prev.map((r, i) =>
        i !== rowIndex
          ? r
          : {
              ...r,
              ...basePatch,
              barcode: product.barcode || product.code || "",
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
      const batchesRes = await platform.listBarcodesForProduct?.(
        licenseId,
        productId,
      );

      const liveBatches: BatchInfo[] = (batchesRes?.rows || []).map(
        (b: any) => ({
          id: b.id,
          barcode: b.barcode,
          batchNo: b.batchNo,
          purchaseBatchNo: b.purchaseBatchNo || b.batchNo,
          mfgDate: b.mfgDate,
          expiryDate: b.expiryDate,
          mrp: b.mrp,
          salePrice: b.salePrice,
          costPrice: b.costPrice,
          stock: b.stock,
        }),
      );

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
      console.error("Failed to load sales return batches", e);
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

  const handleSave = async () => {
    const items = mapItems(rows);
    const errs = validateSaleBill(header, items);

    if (errs.length) {
      setValidationMsgs(errs);
      setValidationOpen(true);
      return false;
    }

    const headerPayload = {
      userId,
      licenseId,
      customerId: header.customer?.id || null,
      customerName: header.customer?.name || null,
      billNo: header.billNo || null,
      department: header.department || null,
      debitAccount: header.debitAccount || null,
      natureOfEntry: header.natureOfEntry || null,
      returnDate: header.saleDate,
      entryTime: header.entryTime,
      discount: header.discount || 0,
      saleType: header.saleType,
    };

    if (editingId) {
      const res = await platform.updateSaleReturn?.({
        id: editingId,
        header: headerPayload,
        items,
      });
      if (res?.success) {
        if (isSyncEnabled())
          SyncManager.pushEntity("saleReturn").catch(() => {});
        alert(
          `✅ Return updated! Total: ${(res.totalAmount ?? grandTotal).toFixed(2)}`,
        );
        try {
          const peek = await platform.peekNextSaleReturnSlNo?.(licenseId);
          setNextEntryNo(peek?.nextSlNo ?? null);
        } catch {}
        await finalizeAfterSuccessfulSaleReturn({ resetFn: resetAll });
        return true;
      }
      setValidationMsgs([res?.error || "Failed to update sale return."]);
      setValidationOpen(true);
      return false;
    }

    const res = await platform.createSaleReturn?.({
      header: headerPayload,
      items,
    });
    if (res?.success) {
      if (isSyncEnabled()) SyncManager.pushEntity("saleReturn").catch(() => {});
      alert(
        `✅ Return saved! SlNo: ${res.slNo}, Total: ${(res.totalAmount ?? grandTotal).toFixed(2)}`,
      );
      setEditingId(res.returnId || null);
      setEditingSlNo(res.slNo ?? null);
      initialSnapshot.current = makeSnapshot(header, rows);
      setIsDirty(false);
      try {
        const peek = await platform.peekNextSaleReturnSlNo?.(licenseId);
        setNextEntryNo(peek?.nextSlNo ?? null);
      } catch {}
      return true;
    }

    setValidationMsgs([res?.error || "Failed to save sale return."]);
    setValidationOpen(true);
    return false;
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
    };

    const freshRows = [createEmptyRow(1)];

    setHeader(freshHeader);
    setRows(freshRows);
    setIsDirty(false);
    setEditingId(null);
    setEditingSlNo(null);

    // Clear all modals and auxiliary state
    setShowReports(false);
    setShowCustomerModal(false);
    setBatchPicker(null);
    setValidationMsgs([]);
    setValidationOpen(false);
    setLeaveOpen(false);
    setPendingPath(null);
    setCancelConfirmOpen(false);

    initialSnapshot.current = makeSnapshot(freshHeader, freshRows);
    router.replace("/dashboard/sales-return");
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
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  async function tryNavigate(path: string) {
    if (!isDirty) return router.push(path);
    setPendingPath(path);
    setLeaveOpen(true);
  }

  // Return null until client-side hydration is complete
  if (!isClient) return null;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <SalesNavigation
        onNavigate={tryNavigate}
        title={`Sales Return ${editingId ? "(Edit)" : ""}`}
      />

      <div className="flex-1 min-h-0 overflow-hidden p-0">
        {editingId && (
          <div className="px-4 py-2 border-b bg-white flex items-center gap-3">
            <span className="text-sm text-gray-500">Saved return open</span>

            <button
              type="button"
              onClick={() => resetAll()}
              className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm"
            >
              New Return
            </button>
          </div>
        )}

        <div
          className={`grid ${editingId ? "h-[calc(100%-41px)]" : "h-full"} grid-cols-[300px_1fr]`}
        >
          <BillDetailsSectionReturn
            header={header}
            setHeader={setHeader}
            customers={customers}
            setShowCustomerModal={setShowCustomerModal}
            subTotal={subTotal}
            grandTotal={grandTotal}
            onSave={handleSave}
            onCancel={handleCancel}
            entryNo={
              editingId
                ? (editingSlNo ?? undefined)
                : (nextEntryNo ?? undefined)
            }
            requireCustomer={header.saleType === "CREDIT"}
          />

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
            showHoldControls={false}
            onShowReports={() => setShowReports(true)}
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

      <SalesReturnReportsModal
        isOpen={showReports}
        onClose={() => setShowReports(false)}
        licenseId={licenseId}
        customers={customers}
        onOpenSaleReturn={handleOpenSaleReturn}
        openingId={openingId}
      />

      <BatchSelectModal
        isOpen={Boolean(batchPicker)}
        onClose={() => setBatchPicker(null)}
        batches={batchPicker?.batches || []}
        productName={batchPicker?.productName}
        nextBarcode=""
        allowCreateNew={false}
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
                    barcode: batch.barcode || "",
                    batchNo: batch.batchNo ?? null,
                    purchaseBatchNo:
                      batch.purchaseBatchNo ?? batch.batchNo ?? null,
                    mfgDate: batch.mfgDate ?? null,
                    expiryDate: batch.expiryDate ?? null,
                    mrp: batch.mrp ?? null,
                    rate:
                      batch.salePrice != null &&
                      !Number.isNaN(Number(batch.salePrice))
                        ? Number(batch.salePrice)
                        : r.rate,
                    salePrice:
                      batch.salePrice != null &&
                      !Number.isNaN(Number(batch.salePrice))
                        ? Number(batch.salePrice)
                        : r.salePrice,
                  },
            ),
          );

          setBatchPicker(null);
        }}
        onAddNewBatch={() => {
          setBatchPicker(null);
        }}
      />

      {/* FIXED: Proper cancel confirmation modal */}
      <ConfirmModal
        isOpen={cancelConfirmOpen}
        title="Discard current return?"
        message="You have unsaved changes in this sales return entry. Do you really want to clear everything?"
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
          "You have unsaved changes.\n\n• Save & Exit: save and leave.\n• Discard: leave without saving.\n• Cancel: stay."
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

export default function SalesReturnPage() {
  return (
    <Suspense fallback={null}>
      <SalesReturnPageInner />
    </Suspense>
  );
}
