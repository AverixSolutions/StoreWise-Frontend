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

type BatchDecision = "OVERRIDE" | "NEW";

function normalizeHeaderFromHold(
  saved: Partial<HeaderForm>,
  suppliers: Array<{ id: string; name: string }>
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

export default function PurchasePage() {
  const router = useRouter();

  const initialSnapshot = useRef<string | null>(null);

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
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);

  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(
    null
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

  const [batchConflicts, setBatchConflicts] = useState<{
    rows: {
      rowIndex: number;
      productName: string;
      barcode?: string | null;
      diffs: Record<string, { current: any; proposed: any }>;
    }[];
  } | null>(null);

  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [savingAfterBatchConfirm, setSavingAfterBatchConfirm] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "openPurchaseId";
    const id = sessionStorage.getItem(key);
    if (!id) return;

    handleOpenPurchaseFromReport(id);

    sessionStorage.removeItem(key);
    setIsDirty(true);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await (window as any).electronAPI.getProducts(licenseId, {
        page: 1,
        pageSize: 200,
      });
      setProducts(res.products);
    })();

    (async () => {
      const res = await (window as any).electronAPI.getNextPurchaseSlNo(
        licenseId
      );
      setNextEntryNo(res?.nextSlNo ?? 1);
    })();
  }, [licenseId]);

  useEffect(() => {
    loadSuppliers();
  }, [showSupplierModal]);

  useEffect(() => {
    if (header.purchaseType === "CREDIT" && !header.supplier) {
      setHeader((s) => ({ ...s, purchaseType: "CASH" }));
    }
  }, [header.supplier]);

  const loadSuppliers = async () => {
    const { suppliers: sups } = await (window as any).electronAPI.listSuppliers(
      licenseId,
      { q: "", page: 1, pageSize: 100 }
    );
    setSuppliers(sups.map((s: any) => ({ id: s.id, name: s.name })));
  };

  const handleSelectProduct = async (rowIndex: number, productId: string) => {
    const product = await (window as any).electronAPI.getProduct(productId);
    if (!product) return;
    console.log("Selected product", productId, product);

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
              barcode:
                product.barcode && String(product.barcode).trim().length > 0
                  ? product.barcode
                  : product.code || "",
              rate: Number(product.costPrice) || 0,
              batchNo: "",
              mfgDate: null,
              expiryDate: null,

              mrp:
                product.mrp != null && !Number.isNaN(Number(product.mrp))
                  ? Number(product.mrp)
                  : null,
              salePrice:
                product.salePrice != null &&
                !Number.isNaN(Number(product.salePrice))
                  ? Number(product.salePrice)
                  : 0,
            }
      )
    );

    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(
        `[data-cell="${rowIndex}:barcode"]`
      );
      if (el) {
        el.focus();
        el.select();
      }
    }, 0);

    setTimeout(() => {
      handleRequestBatchSelect(rowIndex, productId);
    }, 10);
  };

  const handleRequestBatchSelect = async (
    rowIndex: number,
    explicitProductId?: string
  ) => {
    const row = rows[rowIndex];
    const productId = explicitProductId || row?.productId;

    console.log("handleRequestBatchSelect called for row", rowIndex, {
      row,
      productId,
    });

    if (!productId) return;

    try {
      const res = await (window as any).electronAPI.listBatchesForProduct(
        productId
      );

      console.log("BATCH RES for product", productId, res);

      let batches: BatchInfo[] = [];
      if (Array.isArray(res)) {
        batches = res as BatchInfo[];
      } else if (Array.isArray(res?.batches)) {
        batches = res.batches as BatchInfo[];
      } else if (Array.isArray(res?.rows)) {
        batches = res.rows as BatchInfo[];
      }

      if (batches.length === 0) {
        setTimeout(() => {
          const el = document.querySelector<HTMLInputElement>(
            `[data-cell="${rowIndex}:barcode"]`
          );
          if (el) {
            el.focus();
            el.select();
          }
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
                  barcode: b.barcode || r.barcode,
                  batchNo: b.batchNo ?? r.batchNo,
                  mfgDate: b.mfgDate ?? r.mfgDate,
                  expiryDate: b.expiryDate ?? r.expiryDate,
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
                }
          )
        );

        setTimeout(() => {
          const el = document.querySelector<HTMLInputElement>(
            `[data-cell="${rowIndex}:barcode"]`
          );
          if (el) {
            el.focus();
            el.select();
          }
        }, 50);

        return;
      }

      const productName =
        products.find((p) => p.id === productId)?.name || row?.name;

      setBatchPicker({
        rowIndex,
        productId,
        batches,
        productName,
      });
    } catch (e) {
      console.error("Failed to load product batches", e);
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
      }))
    ),
  ]);

  const subTotal = useMemo(
    () => rows.reduce((s, r) => s + (r.billedValue || 0), 0),
    [rows]
  );
  const grandTotal = useMemo(
    () => Math.max(0, subTotal - (header.discount || 0)),
    [subTotal, header.discount]
  );

  const addRow = () =>
    setRows((prev) => [...prev, createEmptyRow(prev.length + 1)]);
  const removeRow = (index: number) =>
    setRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, lineNo: i + 1 }))
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

    const res = await (window as any).electronAPI.savePurchaseHold(payload);
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

    if (!msg.includes("BARCODE_IN_USE")) return false;

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
        `Barcode "${barcode}" is already used for another product.${rowHint}`
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

    const res = await (window as any).electronAPI.getPurchaseHold(holdId);
    if (res?.success && res.hold) {
      const normalized = normalizeHeaderFromHold(res.hold.header, suppliers);
      setHeader(normalized);
      setRows(res.hold.rows);
      setShowHolds(false);
      setIsDirty(true);
    }
  }

  async function handleOpenPurchaseFromReport(purchaseId: string) {
    if (suppliers.length === 0) await loadSuppliers();

    const res = await (window as any).electronAPI.getPurchaseFull(purchaseId);
    if (!res?.success) return alert("Failed to load purchase");

    const { purchase, items } = res;

    const hdr = headerFromPurchaseDb(purchase, suppliers);
    const mappedRows = rowsFromDbItems(items);

    setHeader(hdr);
    setRows(mappedRows);
    setEditingPurchaseId(purchaseId);
    setEditingSlNo(purchase.slNo ?? null);
    setShowReports(false);
    setIsDirty(true);
  }

  async function checkBatchConflicts(
    items: ReturnType<typeof mapItems>
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
      return false;
    }

    if (header.purchaseType === "CREDIT" && !header.supplier) {
      setValidationMsgs(["Supplier is required for CREDIT purchases."]);
      setValidationOpen(true);
      return false;
    }

    if (!opts?.skipBatchCheck) {
      const conflicts = await checkBatchConflicts(items);

      if (conflicts.length > 0) {
        setBatchConflicts({ rows: conflicts });

        setBatchDecisions(
          Object.fromEntries(
            conflicts.map((c) => [c.rowIndex, "OVERRIDE" as BatchDecision])
          )
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
        const res = await (window as any).electronAPI.updatePurchase(payload);

        if (res?.success) {
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
      supplierId: header.supplier!.id,
      supplierName: header.supplier!.name,
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
      const res = await (window as any).electronAPI.createPurchase(
        purchase,
        items
      );

      if (!res?.success) {
        const msg = res?.error || "Unknown error";
        if (!handleBarcodeError({ message: msg })) {
          alert("Save failed: " + msg);
        }
        return false;
      }

      alert(`✅ Saved! SlNo: ${res.slNo}, Total: ${res.totalAmount}`);

      try {
        const peek = await (window as any).electronAPI.getNextPurchaseSlNo(
          licenseId
        );
        setNextEntryNo(peek?.nextSlNo ?? null);
      } catch {}

      if (priceUpdateSettings.updatePricesAfterSave) {
        const priceUpdates = rowsToUse
          .filter(
            (r) =>
              r.productId &&
              (priceUpdateSettings.updateCostFromPurchase ||
                (typeof r.salePrice === "number" && r.salePrice > 0) ||
                (r.profitPercent ?? 0) > 0)
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
                basePerUnit * (1 + (Number(r.profitPercent) || 0) / 100)
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
            await (window as any).electronAPI.bulkUpdateProductPrices(
              priceUpdates
            );
          } catch (e) {
            console.error("Failed to update product fields:", e);
          }
        }
      }

      resetAll();
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

  // Ctrl/⌘+S to Save
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
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
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

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <PurchaseNavigation onNavigate={tryNavigate} title="Purchase" />

      <div className="flex-1 min-h-0 overflow-hidden p-0">
        <div className="grid h-full grid-cols-[300px_1fr]">
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
                ? editingSlNo ?? undefined
                : nextEntryNo ?? undefined
            }
            requireSupplier={header.purchaseType === "CREDIT"}
            isEditing={Boolean(editingPurchaseId)}
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
            onHold={handleHold}
            onShowHolds={handleShowHolds}
            onShowReports={() => setShowReports(true)}
            showHoldControls={!editingPurchaseId}
            onRequestBatchSelect={handleRequestBatchSelect}
          />
        </div>
      </div>

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
                  className="px-3 py-1.5 rounded bg-averix-red-dark text-sm text-white hover:bg-averix-red-accent"
                  onClick={async () => {
                    if (!batchConflicts) return;

                    const indices = new Set(
                      batchConflicts.rows.map((c) => c.rowIndex)
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
        onSelect={(batch) => {
          if (!batchPicker) return;

          const rowIndex = batchPicker.rowIndex;

          if (!batch) {
            setBatchPicker(null);
            setTimeout(() => {
              const el = document.querySelector<HTMLInputElement>(
                `[data-cell="${rowIndex}:barcode"]`
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
                  }
            )
          );

          setBatchPicker(null);

          setTimeout(() => {
            const el = document.querySelector<HTMLInputElement>(
              `[data-cell="${rowIndex}:barcode"]`
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
