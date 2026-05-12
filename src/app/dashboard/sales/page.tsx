// src/app/dashboard/sales/page.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SalesNavigation from "@/components/sales/SalesNavigation";
import BillDetailsSection from "@/components/sales/BillDetailsSection";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import HoldsModal from "@/components/sales/HoldsModal";
import SalesReportsModal from "@/components/sales/SalesReportsModal";
import PromptModal from "@/components/ui/PromptModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ValidationModal from "@/components/ui/ValidationModal";
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
  validateSaleBill,
  mapItems,
  round2,
} from "@/components/sales/utils";
import { printSaleBill } from "@/lib/print/printSaleBill";
import { platform } from "@/platform";
import { isSyncEnabled } from "@/platform/mode";
import { canUseBarcode } from "@/lib/session/runtimeSession";
import { SyncManager } from "@/sync/SyncManager";
import { useSyncStatus } from "@/sync/SyncProvider";

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
  });

  const [rows, setRows] = useState<ItemRow[]>([createEmptyRow(1)]);
  const [isDirty, setIsDirty] = useState(false);
  const initialSnapshot = useRef<string | null>(null);

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

  useEffect(() => {
    if (!isClient) return;
    pullNow("sale");
    pullNow("saleItem");
    (async () => {
      const res = await platform.getProducts(licenseId, {
        page: 1,
        pageSize: 200,
      });
      setProducts(res.products);
    })();
    (async () => {
      const res = await platform.peekNextSaleSlNo?.(licenseId);
      setNextEntryNo(res?.nextSlNo ?? 1);
    })();
  }, [licenseId, isClient]);

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
    };
    window.addEventListener("kynflow:sync:updated", handler);
    return () => {
      window.removeEventListener("kynflow:sync:updated", handler);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [isClient, licenseId, editingSaleId]);

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

  const loadCustomers = async () => {
    const res = await platform.listCustomers?.(licenseId, {
      q: "",
      page: 1,
      pageSize: 100,
    });
    setCustomers(
      (res?.customers ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        mobile: c.phone ?? null,
        gstin: c.gstin ?? null,
        address:
          [c.addressLine1, c.addressLine2, c.city, c.state]
            .filter(Boolean)
            .join(", ") || null,
      })),
    );
  };

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
    const res = await platform.saveSaleHold?.({
      id: undefined,
      licenseId,
      userId,
      title: title || undefined,
      header,
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
    setDefaultHoldTitle(header.billNo || "");
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
        customer,
      };
      const nextRows = res.hold.rows;

      setHeader(nextHeader);
      setRows(nextRows);
      setShowHolds(false);

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
    }));

    setHeader(nextHeader);
    setRows(nextRows);
    setEditingSaleId(id);
    setEditingSlNo(sale.slNo ?? null);
    setShowReports(false);

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
    const items = mapItems(rows);
    const errs = validateSaleBill(header, items);
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
          licenseId,
          saleType: header.saleType,
        },
        items,
      };
      try {
        const res = await platform.updateSale?.(payload);

        if (res?.success) {
          if (isSyncEnabled()) {
            SyncManager.pushEntity("sale").catch(() => {});
            SyncManager.pushEntity("saleItem").catch(() => {});
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
      licenseId,
      userId,
      saleType: header.saleType,
    };
    try {
      const res = await platform.createSale?.(sale, items);

      if (res?.success) {
        if (isSyncEnabled()) {
          SyncManager.pushEntity("sale").catch(() => {});
          SyncManager.pushEntity("saleItem").catch(() => {});
        }
        const shouldPrint = confirm(
          `✅ Saved! SlNo: ${res.slNo}, Total: ${res.totalAmount}\n\nOpen print preview now?`,
        );

        setEditingSaleId(res.saleId || null);
        setEditingSlNo(res.slNo ?? null);

        initialSnapshot.current = makeSnapshot(header, rows);
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
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
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

  return (
    <div className="flex h-screen flex-col bg-kyn-bg text-kyn-text">
      <SalesNavigation onNavigate={tryNavigate} title="Sales" />
      <div className="flex-1 min-h-0 overflow-hidden p-0">
        {editingSaleId && (
          <div className="px-4 py-2 border-b border-kyn-border bg-kyn-surface flex items-center gap-3">
            <span className="text-sm text-kyn-text-muted">Saved bill open</span>

            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await printSaleBill(editingSaleId, {
                    preview: true,
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
        <div
          className={[
            "grid overflow-hidden transition-all duration-200",
            editingSaleId ? "h-[calc(100%-41px)]" : "h-full",
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
            entryNo={
              editingSaleId
                ? (editingSlNo ?? undefined)
                : (nextEntryNo ?? undefined)
            }
            requireCustomer={header.saleType === "CREDIT"}
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
            onHold={() => {
              setDefaultHoldTitle(header.billNo || "");
              setShowTitlePrompt(true);
            }}
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
