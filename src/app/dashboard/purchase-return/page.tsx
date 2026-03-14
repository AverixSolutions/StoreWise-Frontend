// src/app/dashboard/purchase-return/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "@/components/purchase/utils";
import ValidationModal from "@/components/ui/ValidationModal";
import PurchaseReturnReportsModal from "@/components/purchase-return/PurchaseReturnReportsModal";
import BatchSelectModal from "@/components/purchase/BatchSelectModal";

export default function PurchaseReturnPage() {
  const router = useRouter();

  const licenseId =
    typeof window !== "undefined" ? localStorage.getItem("licenseId")! : "";
  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("userName") || "U1"
      : "U1";

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);

  // ✅ CHANGE 1: Added editing state
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
  });

  const [rows, setRows] = useState<ItemRow[]>([createEmptyRow(1)]);
  const [isDirty, setIsDirty] = useState(false);
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

  useEffect(() => {
    (async () => {
      const res = await (window as any).electronAPI.getProducts(licenseId, {
        page: 1,
        pageSize: 200,
      });
      setProducts(res.products);
    })();

    (async () => {
      const res = await (window as any).electronAPI.getNextPurchaseReturnSlNo(
        licenseId,
      );
      setNextEntryNo(res?.nextSlNo ?? 1);
    })();
  }, [licenseId]);

  useEffect(() => {
    (async () => {
      const { suppliers: sups } = await (
        window as any
      ).electronAPI.listSuppliers(licenseId, { q: "", page: 1, pageSize: 100 });
      setSuppliers(sups.map((s: any) => ({ id: s.id, name: s.name })));
    })();
  }, [licenseId]);

  useEffect(() => {
    setHeader((s) =>
      !s.supplier && s.purchaseType === "CREDIT"
        ? { ...s, purchaseType: "CASH" }
        : s,
    );
  }, [header.supplier]);

  const handleSelectProduct = async (rowIndex: number, productId: string) => {
    const product = await (window as any).electronAPI.getProduct(productId);
    if (!product) return;

    const batchesRes = await (window as any).electronAPI.listBarcodesForProduct(
      licenseId,
      productId,
    );

    const liveBatches = (batchesRes?.rows || [])
      .filter((b: any) => Number(b.stock || 0) > 0)
      .map((b: any) => ({
        id: b.id,
        barcode: b.barcode,
        batchNo: b.batchNo,
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
      barcode: "",
      batchNo: "",
      mfgDate: null,
      expiryDate: null,
      mrp: null,
      rate: Number(product.costPrice) || 0,
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
                barcode: b.barcode || "",
                batchNo: b.batchNo ?? null,
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
      const batchesRes = await (
        window as any
      ).electronAPI.listBarcodesForProduct(licenseId, productId);

      const liveBatches = (batchesRes?.rows || [])
        .filter((b: any) => Number(b.stock || 0) > 0)
        .map((b: any) => ({
          id: b.id,
          barcode: b.barcode,
          batchNo: b.batchNo,
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
      console.error("Failed to load return batches", e);
    }
  };

  // ✅ CHANGE 2: handleOpenPurchaseReturnFromReport loader function
  async function handleOpenPurchaseReturnFromReport(returnId: string) {
    if (suppliers.length === 0) {
      const { suppliers: sups } = await (
        window as any
      ).electronAPI.listSuppliers(licenseId, { q: "", page: 1, pageSize: 100 });
      setSuppliers(sups.map((s: any) => ({ id: s.id, name: s.name })));
    }

    const res = await (window as any).electronAPI.getPurchaseReturnFull(
      returnId,
    );

    if (!res?.success) {
      setValidationMsgs(["Failed to load purchase return."]);
      setValidationOpen(true);
      return;
    }

    const ret = res.purchaseReturn;
    const items = res.items || [];

    const supplier = ret.supplierId
      ? suppliers.find((s) => s.id === ret.supplierId) || {
          id: ret.supplierId,
          name: ret.supplierName || "",
        }
      : null;

    const nextHeader: HeaderForm = {
      billNo: ret.billNo || "",
      supplier,
      department: ret.department || "",
      debitAccount: ret.debitAccount || "",
      natureOfEntry: ret.natureOfEntry || "",
      purchaseDate: ret.returnDate || new Date().toISOString(),
      entryTime: ret.entryTime || ret.returnDate || new Date().toISOString(),
      discount: Number(ret.discount || 0),
      purchaseType: ret.purchaseType === "CREDIT" ? "CREDIT" : "CASH",
    };

    const nextRows: ItemRow[] = items.map((it: any, i: number) => ({
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
      discountType: it.discountType || "ABS",
      discount: Number(it.discount) || 0,
      profitPercent: 0,
      salePrice: it.salePrice ?? null,
      profit: it.profit ?? null,
      totalCost: Number(it.totalCost) || 0,
      billedValue: Number(it.billedValue || 0),
      batchNo: it.batchNo ?? null,
      mfgDate: it.mfgDate ?? null,
      expiryDate: it.expiryDate ?? null,
      lineType: "VALUED",
      unitBilled: it.quantity
        ? Number(it.billedValue || 0) / Number(it.quantity || 1)
        : 0,
    }));

    setHeader(nextHeader);
    setRows(nextRows);
    setEditingReturnId(returnId);
    setEditingSlNo(ret.slNo ?? null);
    setShowReports(false);
    setIsDirty(false);
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

  function showPurchaseReturnError(err: any) {
    const raw = String(err?.message || err || "Unknown error");

    if (raw.includes("not enough stock") || raw.includes("Insufficient")) {
      setValidationMsgs([
        "Selected batch does not have enough stock for this return quantity.",
        "Reduce quantity or choose another batch.",
      ]);
      setValidationOpen(true);
      return;
    }

    setValidationMsgs([
      "Something went wrong while saving the purchase return.",
    ]);
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

    const payload = {
      header: {
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
      },
      items,
    };

    try {
      const res = await (window as any).electronAPI.createPurchaseReturn(
        payload,
      );

      if (res?.success) {
        alert(`✅ Return Saved! SlNo: ${res.slNo}, Total: ${res.totalAmount}`);

        try {
          const peek = await (
            window as any
          ).electronAPI.getNextPurchaseReturnSlNo(licenseId);
          setNextEntryNo(peek?.nextSlNo ?? null);
        } catch {}

        resetAll();
        return true;
      }

      showPurchaseReturnError(res?.error || "Save failed");
      return false;
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

  // ✅ CHANGE 5: resetAll now clears editing state too
  function resetAll() {
    setHeader({
      billNo: "",
      supplier: null,
      department: "",
      debitAccount: "",
      natureOfEntry: "",
      purchaseDate: new Date().toISOString(),
      entryTime: new Date().toISOString(),
      discount: 0,
      purchaseType: "CASH",
    });
    setRows([createEmptyRow(1)]);
    setEditingReturnId(null);
    setEditingSlNo(null);
    setIsDirty(false);
  }

  async function saveHold(title?: string) {
    const payload = {
      id: undefined as string | undefined,
      licenseId,
      userId,
      title: title || undefined,
      header,
      rows,
    };
    const res = await (window as any).electronAPI.savePurchaseReturnHold(
      payload,
    );
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
    const res = await (window as any).electronAPI.getPurchaseReturnHold(holdId);
    if (res?.success && res.hold) {
      setHeader(res.hold.header);
      setRows(res.hold.rows);
      setShowHolds(false);
      setIsDirty(true);
    }
  }

  useEffect(() => {
    setIsDirty(true);
  }, [
    JSON.stringify(header),
    JSON.stringify(
      rows.map((r) => ({
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
    ),
  ]);

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

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <PurchaseNavigation onNavigate={tryNavigate} title="Purchase Return" />

      <div className="flex-1 min-h-0 overflow-hidden p-0">
        <div className="grid h-full grid-cols-[300px_1fr]">
          <BillDetailsSection
            header={header}
            setHeader={setHeader}
            suppliers={suppliers}
            setShowSupplierModal={() => {}}
            subTotal={subTotal}
            grandTotal={grandTotal}
            onSave={handleSave}
            onCancel={handleCancel}
            // ✅ CHANGE 4: Show editing slNo when viewing a saved return
            entryNo={
              editingReturnId
                ? (editingSlNo ?? undefined)
                : (nextEntryNo ?? undefined)
            }
            requireSupplier={header.purchaseType === "CREDIT"}
          />

          <ItemsTableSection
            rows={rows}
            products={products}
            onSelectProduct={handleSelectProduct}
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
          // ✅ CHANGE 3: Wire up real loader instead of console.log
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
        onAddNewBatch={() => {
          setBatchPicker(null);
        }}
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
