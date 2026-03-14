// src/app/dashboard/sales-return/page.tsx
"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SalesNavigation from "@/components/sales/SalesNavigation";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import SalesReturnReportsModal from "@/components/sales-return/SalesReturnReportsModal";
import PromptModal from "@/components/ui/PromptModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ValidationModal from "@/components/ui/ValidationModal";
import BillDetailsSectionReturn from "@/components/sales-return/BillDetailsSectionReturn";
import BatchSelectModal from "@/components/purchase/BatchSelectModal";
import {
  HeaderForm,
  ItemRow,
  Customer,
  BatchInfo,
} from "@/components/sales/type";
import {
  createEmptyRow,
  calcRow,
  mapItems,
  validateSaleBill,
} from "@/components/sales/utils";

export default function SalesReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");

  const licenseId =
    typeof window !== "undefined"
      ? localStorage.getItem("licenseId") || "demo-license"
      : "demo-license";
  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("userName") || "U1"
      : "U1";

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);

  // Edit / Open states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | undefined>(undefined);

  // Batch picker state
  const [batchPicker, setBatchPicker] = useState<{
    rowIndex: number;
    productId: string;
    batches: BatchInfo[];
    productName?: string;
    nextBarcode: string;
  } | null>(null);

  // editor state
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
  const [didMount, setDidMount] = useState(false);

  const [showReports, setShowReports] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationMsgs, setValidationMsgs] = useState<string[]>([]);

  const handleOpenSaleReturn = useCallback(
    (id: string) => {
      setShowReports(false);
      router.push(`/dashboard/sales-return?open=${id}`);
    },
    [router],
  );

  // Load products + next SL No
  useEffect(() => {
    (async () => {
      const res = await (window as any).electronAPI.getProducts(licenseId, {
        page: 1,
        pageSize: 200,
      });
      setProducts(res.products);
    })();
    (async () => {
      const res = await (window as any).electronAPI.getNextSaleReturnSlNo(
        licenseId,
      );
      setNextEntryNo(res?.nextSlNo ?? 1);
    })();
  }, [licenseId]);

  // Customers
  useEffect(() => {
    loadCustomers();
  }, [showCustomerModal]);

  const loadCustomers = async () => {
    const { customers: cs } = await (window as any).electronAPI.listCustomers(
      licenseId,
      { q: "", page: 1, pageSize: 100 },
    );
    setCustomers(cs.map((c: any) => ({ id: c.id, name: c.name })));
  };

  // Load selected sale return for Edit Mode
  useEffect(() => {
    if (!openId) return;

    let cancelled = false;

    (async () => {
      try {
        setOpeningId(openId);

        const res = await (window as any).electronAPI.getSaleReturnFull(openId);
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
                code: "",
                name: "",
                barcode: it.barcode || "",
                batchNo: it.batchNo || "",
                mfgDate: it.mfgDate || null,
                expiryDate: it.expiryDate || null,
                quantity: Number(it.quantity || 0),
                unit: it.unit || "",
                rate: Number(it.rate || 0),
                mrp: it.mrp != null ? Number(it.mrp) : null,
                taxPercent: it.taxPercent || "NT",
                taxAmount: Number(it.taxAmount || 0),
                discount: Number(it.discount || 0),
                discountType: it.discountType || "ABS",
                salePrice:
                  it.salePrice != null
                    ? Number(it.salePrice)
                    : Number(it.rate || 0),
                profit: it.profit != null ? Number(it.profit) : 0,
                totalCost: Number(it.totalCost || 0),
                billedValue: Number(it.billedValue || 0),
                effectiveUnitValue: Number(it.effectiveUnitValue || 0),
                appliedQuantity: Number(it.appliedQuantity || it.quantity || 0),
                overReturnQuantity: Number(it.overReturnQuantity || 0),
                overReturnReason: it.overReturnReason || null,
              } as ItemRow),
            )
          : [createEmptyRow(1)];

        if (cancelled) return;

        setEditingId(sr.id);
        setHeader({
          billNo: sr.billNo || "",
          customer: mappedCustomer,
          department: sr.department || "",
          debitAccount: sr.debitAccount || "",
          natureOfEntry: sr.natureOfEntry || "",
          saleDate: sr.returnDate || new Date().toISOString(),
          entryTime: sr.entryTime || new Date().toISOString(),
          discount: Number(sr.discount || 0),
          saleType: sr.saleType || "CASH",
        });
        setRows(mappedRows);
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

  // Batch-aware handleSelectProduct
  const handleSelectProduct = async (rowIndex: number, productId: string) => {
    const product = await (window as any).electronAPI.getProduct(productId);
    if (!product) return;

    const batchesRes = await (window as any).electronAPI.listBarcodesForProduct(
      licenseId,
      productId,
    );

    const liveBatches: BatchInfo[] = (batchesRes?.rows || [])
      .filter((b: any) => Number(b.stock || 0) > 0)
      .map((b: any) => ({
        id: b.id,
        barcode: b.barcode,
        batchNo: b.batchNo,
        mfgDate: b.mfgDate,
        expiryDate: b.expiryDate,
        mrp: b.mrp,
        salePrice: b.salePrice,
        stock: b.stock,
      }));

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
    };

    // Only one live batch -> auto select
    if (liveBatches.length === 1) {
      const b = liveBatches[0];
      setRows((prev) =>
        prev.map((r, i) =>
          i !== rowIndex
            ? r
            : {
                ...r,
                ...basePatch,
                barcode: b.barcode || "",
                batchNo: b.batchNo ?? null,
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

    // Multiple batches -> let user choose
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

    // No batch -> fallback to product barcode/code
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

  // Manual batch re-select (F2 / Ctrl+B)
  const handleRequestBatchSelect = async (
    rowIndex: number,
    explicitProductId?: string,
  ) => {
    const row = rows[rowIndex];
    const productId = explicitProductId || row?.productId;
    if (!productId) return;

    try {
      const batchesRes = await (
        window as any
      ).electronAPI.listBarcodesForProduct(licenseId, productId);

      const liveBatches: BatchInfo[] = (batchesRes?.rows || [])
        .filter((b: any) => Number(b.stock || 0) > 0)
        .map((b: any) => ({
          id: b.id,
          barcode: b.barcode,
          batchNo: b.batchNo,
          mfgDate: b.mfgDate,
          expiryDate: b.expiryDate,
          mrp: b.mrp,
          salePrice: b.salePrice,
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
      console.error("Failed to load sales return batches", e);
    }
  };

  // line calc
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

  // list utils
  const addRow = () =>
    setRows((prev) => [...prev, createEmptyRow(prev.length + 1)]);
  const removeRow = (index: number) =>
    setRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, lineNo: i + 1 })),
    );

  // SAVE
  const handleSave = async () => {
    const items = mapItems(rows);
    const errs = validateSaleBill(header, items);
    if (errs.length) {
      setValidationMsgs(errs);
      setValidationOpen(true);
      return false;
    }

    const payload = {
      header: {
        id: editingId || undefined,
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
      },
      items,
    };

    const res = editingId
      ? await (window as any).electronAPI.updateSaleReturn(payload)
      : await (window as any).electronAPI.createSaleReturn(payload);

    if (res?.success) {
      alert(
        `✅ Return ${editingId ? "updated" : "saved"}! ${!editingId ? `SlNo: ${res.slNo}, ` : ""}Total: ${(res.totalAmount ?? grandTotal).toFixed(2)}`,
      );
      try {
        const peek = await (window as any).electronAPI.getNextSaleReturnSlNo(
          licenseId,
        );
        setNextEntryNo(peek?.nextSlNo ?? null);
      } catch {}
      resetAll();
      return true;
    }
    alert("Failed to save sale return.");
    return false;
  };

  const handleCancel = () => {
    const ok = confirm("Discard changes to this return?");
    if (ok) resetAll();
  };

  // dirty guard
  useEffect(() => {
    if (!didMount) {
      setDidMount(true);
      return;
    }
    setIsDirty(true);
  }, [header, rows]);

  function resetAll() {
    setHeader({
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
    setRows([createEmptyRow(1)]);
    setIsDirty(false);
    setEditingId(null);
    router.replace("/dashboard/sales-return"); // Clears the ?open= query param
  }

  // leave guard (browser)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Ctrl/Cmd+S
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

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <SalesNavigation
        onNavigate={tryNavigate}
        title={`Sales Return ${editingId ? "(Edit)" : ""}`}
      />

      <div className="flex-1 min-h-0 overflow-hidden p-0">
        <div className="grid h-full grid-cols-[300px_1fr]">
          <BillDetailsSectionReturn
            header={header}
            setHeader={setHeader}
            customers={customers}
            setShowCustomerModal={setShowCustomerModal}
            subTotal={subTotal}
            grandTotal={grandTotal}
            onSave={handleSave}
            onCancel={handleCancel}
            entryNo={nextEntryNo ?? undefined}
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
                    barcode: batch.barcode || "",
                    batchNo: batch.batchNo ?? null,
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
          // sales return must never create a new batch from UI
          setBatchPicker(null);
        }}
      />

      {/* Leave-guard modal */}
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
