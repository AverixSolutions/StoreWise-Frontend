// src/app/dashboard/purchase-return/page.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);

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
  });

  const [rows, setRows] = useState<ItemRow[]>([createEmptyRow(1)]);
  const [isDirty, setIsDirty] = useState(false);
  const initialSnapshot = useRef<string | null>(null);

  const [showHolds, setShowHolds] = useState(false);
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const [defaultHoldTitle, setDefaultHoldTitle] = useState<string>("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const [validationOpen, setValidationOpen] = useState(false);
  const [validationMsgs, setValidationMsgs] = useState<string[]>([]);

  const [showReports, setShowReports] = useState(false);

  const [batchPicker, setBatchPicker] = useState<{
    rowIndex: number;
    productId: string;
    batches: BatchInfo[];
    productName?: string;
    nextBarcode: string;
  } | null>(null);

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

  const handleSelectProduct = async (rowIndex: number, productId: string) => {
    try {
      const [product, peekRes, batchesRes] = await Promise.all([
        platform.getProduct(productId),
        barcodeEnabled
          ? platform.peekNextBarcode?.(licenseId)
          : Promise.resolve(null),
        barcodeEnabled
          ? platform.listBarcodesForProduct?.(licenseId, productId)
          : platform.listBatchesForProduct(productId, false),
      ]);

      if (!product) return;

      const nextBarcode = getNextPreviewBarcode(
        peekRes?.barcode || "00000",
        rows,
        rowIndex,
      );

      const batches: BatchInfo[] = (batchesRes?.rows || []).map((b: any) => ({
        id: b.id,
        barcode: barcodeEnabled ? b.barcode : "",
        batchNo: b.batchNo,
        purchaseBatchNo: b.purchaseBatchNo,
        mfgDate: b.mfgDate,
        expiryDate: b.expiryDate,
        mrp: b.mrp,
        salePrice: b.salePrice,
        costPrice: b.costPrice,
        stock: b.stock,
      }));

      // FIX: Remove product.mrp (not available on ProductSummary)
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
                mrp: null, // MRP comes from batch, not product
                salePrice:
                  product.salePrice != null &&
                  !Number.isNaN(Number(product.salePrice))
                    ? Number(product.salePrice)
                    : 0,
                batchId: null,
                barcode: "",
                batchNo: "",
                purchaseBatchNo: "",
                mfgDate: null,
                expiryDate: null,
                forceNewBatch: false,
              },
        ),
      );

      if (!barcodeEnabled) {
        if (batches.length === 1) {
          const b = batches[0];
          setRows((prev) =>
            prev.map((r, i) =>
              i !== rowIndex
                ? r
                : {
                    ...r,
                    batchId: b.id,
                    batchNo: b.batchNo ?? "",
                    purchaseBatchNo: b.purchaseBatchNo ?? "",
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
          return;
        }

        if (batches.length > 1) {
          setBatchPicker({
            rowIndex,
            productId,
            batches,
            productName: product.name,
            nextBarcode: "",
          });
        }
        return;
      }

      if (batches.length === 0) {
        setRows((prev) =>
          prev.map((r, i) =>
            i !== rowIndex
              ? r
              : { ...r, barcode: nextBarcode, forceNewBatch: true },
          ),
        );
        setTimeout(() => {
          document
            .querySelector<HTMLInputElement>(
              `[data-cell="${rowIndex}:barcode"]`,
            )
            ?.focus();
        }, 0);
        return;
      }

      if (batches.length === 1) {
        const b = batches[0];
        setRows((prev) =>
          prev.map((r, i) =>
            i !== rowIndex
              ? r
              : {
                  ...r,
                  batchId: b.id,
                  barcode: b.barcode || "",
                  batchNo: b.batchNo ?? "",
                  purchaseBatchNo: b.purchaseBatchNo ?? "",
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
          document
            .querySelector<HTMLInputElement>(
              `[data-cell="${rowIndex}:barcode"]`,
            )
            ?.focus();
        }, 0);
        return;
      }

      setBatchPicker({
        rowIndex,
        productId,
        batches,
        productName: product.name,
        nextBarcode,
      });
      setTimeout(() => {
        document
          .querySelector<HTMLInputElement>(`[data-cell="${rowIndex}:barcode"]`)
          ?.focus();
      }, 0);
    } catch (e) {
      console.error("Failed to select product / load batches", e);
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
      const batchesRes = barcodeEnabled
        ? await platform.listBarcodesForProduct?.(licenseId, productId)
        : await platform.listBatchesForProduct(productId, false);
      const liveBatches = (batchesRes?.rows || [])
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
      setBatchPicker({
        rowIndex,
        productId,
        batches: liveBatches,
        productName:
          products.find((p) => p.id === productId)?.name || row?.name,
        nextBarcode: "",
      });
    } catch (e) {
      console.error("Failed to load return batches", e);
    }
  };

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
    const nextRows = rowsFromDbItems(items);

    setHeader(nextHeader);
    setRows(nextRows);
    setEditingReturnId(returnId);
    setEditingSlNo(ret.slNo ?? null);
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

  const addRow = () =>
    setRows((prev) => [...prev, createEmptyRow(prev.length + 1)]);
  const removeRow = (index: number) =>
    setRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, lineNo: i + 1 })),
    );

  // ── Save ──────────────────────────────────────────────────────────────────

  function showPurchaseReturnError(err: any) {
    const raw = String(err?.message || err || "Unknown error");
    if (raw.includes("not enough stock") || raw.includes("Insufficient")) {
      setValidationMsgs([
        "Selected batch does not have enough stock for this return quantity.",
        "Reduce quantity or choose another batch.",
      ]);
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
    if (errs.length) {
      setValidationMsgs(errs);
      setValidationOpen(true);
      return false;
    }

    const commonHeader = {
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
          alert(
            `✅ Return updated! Total: ${(res.totalAmount ?? grandTotal).toFixed(2)}`,
          );
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
          alert(
            `✅ Return saved! SlNo: ${res.slNo}, Total: ${(res.totalAmount ?? grandTotal).toFixed(2)}`,
          );
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
    };
    const freshRows = [createEmptyRow(1)];
    setHeader(freshHeader);
    setRows(freshRows);
    setEditingReturnId(null);
    setEditingSlNo(null);
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
      alert(`✅ Held as #${res.holdNo}${title ? ` • ${title}` : ""}`);
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

  async function handleResumeHold(holdId: string) {
    const res = await platform.getPurchaseReturnHold?.(holdId);
    if (res?.success && res.hold) {
      // FIX: cast header to HeaderForm
      setHeader(res.hold.header as HeaderForm);
      setRows(res.hold.rows);
      setShowHolds(false);
      setIsDirty(true);
    }
  }

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <PurchaseNavigation onNavigate={tryNavigate} title="Purchase Return" />

      <div className="flex-1 min-h-0 overflow-hidden p-0">
        {editingReturnId && (
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
          className={`grid ${editingReturnId ? "h-[calc(100%-41px)]" : "h-full"} ${
            isBillDetailsOpen ? "grid-cols-[300px_1fr]" : "grid-cols-[40px_1fr]"
          }`}
        >
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
            isOpen={isBillDetailsOpen}
            onToggle={() => setIsBillDetailsOpen(!isBillDetailsOpen)}
            transactionTypes={transactionTypes}
          />

          <ItemsTableSection
            rows={rows}
            products={products}
            onSelectProduct={handleSelectProduct}
            barcodeEnabled={barcodeEnabled}
            onUpdateRow={(index, patch) =>
              setRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
              )
            }
            onAddRow={addRow}
            onRemoveRow={removeRow}
            subTotal={subTotal}
            grandTotal={grandTotal}
            headerDiscount={header.discount}
            onHold={handleHold}
            onShowHolds={handleShowHolds}
            onShowReports={() => setShowReports(true)}
            onRequestBatchSelect={handleRequestBatchSelect}
          />
        </div>
      </div>

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
          if (!batchPicker || !batch) {
            setBatchPicker(null);
            return;
          }
          const { rowIndex } = batchPicker;
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
                  },
            ),
          );
          setBatchPicker(null);
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
    </div>
  );
}
