// src/app/dashboard/purchase/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PurchaseNavigation from "@/components/purchase/PurchaseNavigation";
import BillDetailsSection from "@/components/purchase/BillDetailsSection";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import SupplierFormModal from "@/components/suppliers/SupplierFormModal";
import HoldsModal from "@/components/purchase/HoldsModal";
import PurchaseReportsModal from "@/components/purchase/PurchaseReportsModal";
import PromptModal from "@/components/ui/PromptModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ValidationModal from "@/components/ui/ValidationModal";
import { HeaderForm, ItemRow, Product } from "@/components/purchase/types";
import {
  createEmptyRow,
  calcRow,
  validatePurchaseBill,
  mapItems,
  round2,
  headerFromPurchaseDb,
  rowsFromDbItems,
} from "@/components/purchase/utils";

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
    purchaseType:
      saved?.purchaseType === "CASH" || saved?.purchaseType === "CREDIT"
        ? saved.purchaseType
        : "CREDIT",
  };
}

export default function PurchasePage() {
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
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);

  // A) Track which purchase is being edited
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
              barcode: product.barcode || product.code,
              rate: Number(product.costPrice) || 0,
              salePrice:
                r.profitPercent && r.profitPercent > 0
                  ? r.salePrice
                  : product.salePrice != null
                  ? Number(product.salePrice)
                  : 0,
            }
      )
    );
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

  async function handleOpenReturnFromReport(returnId: string) {
    sessionStorage.setItem("openPurchaseReturnId", returnId);
    router.push("/dashboard/purchase-return");
  }

  const handleSave = async () => {
    const items = mapItems(rows);
    const errs = validatePurchaseBill(header, items);
    if (errs.length) {
      setValidationMsgs(errs);
      setValidationOpen(true);
      return false;
    }

    if (editingPurchaseId) {
      // UPDATE flow
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

      const res = await (window as any).electronAPI.updatePurchase(payload);
      if (res?.success) {
        alert("✅ Updated!");
        setEditingPurchaseId(null);
        resetAll();
        return true;
      } else {
        alert("Update failed: " + (res?.error || "Unknown error"));
        return false;
      }
    }

    // CREATE flow
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

    const res = await (window as any).electronAPI.createPurchase(
      purchase,
      items
    );

    if (res?.success) {
      alert(`✅ Saved! SlNo: ${res.slNo}, Total: ${res.totalAmount}`);

      try {
        const peek = await (window as any).electronAPI.getNextPurchaseSlNo(
          licenseId
        );
        setNextEntryNo(peek?.nextSlNo ?? null);
      } catch {}

      if (priceUpdateSettings.updatePricesAfterSave) {
        const priceUpdates = rows
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
    }
    return false;
  };

  const handleCancel = () => {
    const ok = confirm("Discard current bill?");
    if (ok) resetAll();
  };

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
      }))
    ),
  ]);

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
      purchaseType: "CREDIT",
    });
    setRows([createEmptyRow(1)]);
    setEditingPurchaseId(null);
    setEditingSlNo(null);
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
            requireSupplier
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

      {/* Leave confirm modal */}
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

      {/* Validation modal */}
      <ValidationModal
        isOpen={validationOpen}
        messages={validationMsgs}
        onClose={() => setValidationOpen(false)}
      />
    </div>
  );
}
