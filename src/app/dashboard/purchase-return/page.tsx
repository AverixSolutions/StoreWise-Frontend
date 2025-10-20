// src/app/purchase-return/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PurchaseNavigation from "@/components/purchase/PurchaseNavigation";
import BillDetailsSection from "@/components/purchase/BillDetailsSection";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import PromptModal from "@/components/ui/PromptModal";
import ReturnHoldsModal from "@/components/purchase-return/ReturnHoldsModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { HeaderForm, ItemRow, Product } from "@/components/purchase/types";
import {
  createEmptyRow,
  calcRow,
  validateReturnBill,
  mapItems,
} from "@/components/purchase/utils";
import ValidationModal from "@/components/ui/ValidationModal";
import PurchaseReturnReportsModal from "@/components/purchase-return/PurchaseReturnReportsModal";
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
        licenseId
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
        : s
    );
  }, [header.supplier]);

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

  // Recalc
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

  // Save Return
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

    const res = await (window as any).electronAPI.createPurchaseReturn(payload);

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
    return false;
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
    setIsDirty(false);
  }

  // Hold functionality
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
      payload
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

  // Mark dirty when fields change
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
      }))
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

  // Ctrl/⌘+S
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
            setShowSupplierModal={() => {
              /* optional for returns */
            }}
            subTotal={subTotal}
            grandTotal={grandTotal}
            onSave={handleSave}
            onCancel={handleCancel}
            entryNo={nextEntryNo ?? undefined}
            requireSupplier={false}
          />

          {/* Right: Items table */}
          <ItemsTableSection
            rows={rows}
            products={products}
            onSelectProduct={handleSelectProduct}
            onUpdateRow={(index, patch) =>
              setRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
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
          />
        </div>
      </div>

      {showReports && (
        <PurchaseReturnReportsModal
          isOpen={showReports}
          onClose={() => setShowReports(false)}
          licenseId={licenseId}
          suppliers={suppliers}
          onOpenPurchaseReturn={(id) => {
            // TODO: load this return into the editor if you support that
            // e.g. router.push(`/dashboard/purchase-return?returnId=${id}`)
            console.log("Open purchase return:", id);
          }}
        />
      )}

      <ReturnHoldsModal
        isOpen={showHolds}
        onClose={() => setShowHolds(false)}
        licenseId={licenseId}
        onResume={handleResumeHold}
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

      {/* Leave confirm modal */}
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
          } else if (ok && !pendingPath) {
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
