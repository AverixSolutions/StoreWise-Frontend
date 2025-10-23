// src/app/dashboard/sales-return/page.tsx
"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import SalesNavigation from "@/components/sales/SalesNavigation";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import SalesReturnReportsModal from "@/components/sales-return/SalesReturnReportsModal";
import PromptModal from "@/components/ui/PromptModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ValidationModal from "@/components/ui/ValidationModal";
import BillDetailsSectionReturn from "@/components/sales-return/BillDetailsSectionReturn";
import { HeaderForm, ItemRow, Customer } from "@/components/sales/type";
import {
  createEmptyRow,
  calcRow,
  mapItems,
  validateSaleBill,
} from "@/components/sales/utils";

export default function SalesReturnPage() {
  const router = useRouter();
  const licenseId =
    typeof window !== "undefined" ? localStorage.getItem("licenseId")! : "";
  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("userName") || "U1"
      : "U1";

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [nextEntryNo, setNextEntryNo] = useState<number | null>(null);

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
    [router]
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
        licenseId
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
      { q: "", page: 1, pageSize: 100 }
    );
    setCustomers(cs.map((c: any) => ({ id: c.id, name: c.name })));
  };

  // choose product -> fill row defaults
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
              rate: Number(product.salePrice) || 0,
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

  // list utils
  const addRow = () =>
    setRows((prev) => [...prev, createEmptyRow(prev.length + 1)]);
  const removeRow = (index: number) =>
    setRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, lineNo: i + 1 }))
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

    // Map header for return API (uses returnDate)
    const payload = {
      header: {
        id: undefined,
        userId,
        licenseId,
        customerId: header.customer?.id || null,
        customerName: header.customer?.name || null,
        billNo: header.billNo || null,
        department: header.department || null,
        debitAccount: header.debitAccount || null,
        natureOfEntry: header.natureOfEntry || null,
        returnDate: header.saleDate, // <— map saleDate -> returnDate
        entryTime: header.entryTime,
        discount: header.discount || 0,
        saleType: header.saleType, // CASH vs CREDIT
      },
      items,
    };

    const res = await (window as any).electronAPI.createSaleReturn(payload);
    if (res?.success) {
      alert(
        `✅ Return saved! SlNo: ${res.slNo}, Total: ${res.totalAmount.toFixed(
          2
        )}`
      );
      try {
        const peek = await (window as any).electronAPI.getNextSaleReturnSlNo(
          licenseId
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
    const ok = confirm("Discard this return?");
    if (ok) resetAll();
  };

  // dirty guard
  useEffect(() => {
    setIsDirty(true);
  }, [JSON.stringify(header), JSON.stringify(rows)]);

  function resetAll() {
    setHeader({
      billNo: "",
      customer: null,
      department: "",
      debitAccount: "",
      natureOfEntry: "",
      saleDate: new Date().toISOString(), // maps to returnDate at save
      entryTime: new Date().toISOString(),
      discount: 0,
      saleType: "CASH",
    });
    setRows([createEmptyRow(1)]);
    setIsDirty(false);
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
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  async function tryNavigate(path: string) {
    if (!isDirty) return router.push(path);
    setPendingPath(path);
    setLeaveOpen(true);
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <SalesNavigation onNavigate={tryNavigate} title="Sales Return" />

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
            // For returns we don't have holds in DB, so hide hold controls
            showHoldControls={false}
            onShowReports={() => setShowReports(true)}
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
