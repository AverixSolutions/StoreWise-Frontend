// src/components/quotations/QuotationFormModal.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  X,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Maximize2,
  Minimize2,
  Settings,
} from "lucide-react";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import Dropdown from "@/components/ui/Dropdown";
import CompactDropdown from "@/components/ui/CompactDropdown";
import { platform } from "@/platform";
import type { QuotationItemRow, RateTypeRecord } from "@/platform/types";
import {
  findDefaultRateType,
  orderActiveRateTypes,
  resolveNamedRate,
} from "@/lib/rates/rateResolution";
import { isSyncEnabled } from "@/platform/mode";
import { SyncManager } from "@/sync/SyncManager";
import QuotationEntrySettingsModal from "./QuotationEntrySettingsModal";
import {
  loadQuotationUiSettings,
  saveQuotationUiSettings,
  type QuotationUiSettings,
} from "./quotationUiSettings";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type TaxPct = "NT" | "P5" | "P12" | "P18" | "P28";
type DiscountType = "ABS" | "PCT";
type QuotationItemField =
  "product" | "qty" | "unit" | "rateType" | "rate" | "tax" | "discount";

interface ItemRow {
  lineNo: number;
  productId: string;
  name: string;
  code: string;
  barcode: string;
  unit: string;
  rate: number;
  quantity: number;
  mrp: number;
  taxPercent: TaxPct;
  discountType: DiscountType;
  discount: number;
  salePrice: number;
  totalCost: number;
  billedValue: number;
  batchId: string | null;
  batchNo: string;
  mfgDate: string | null;
  expiryDate: string | null;
  rateTypeId: string | null;
  rateTypeCode: string | null;
  rateTypeName: string | null;
  rateSource: "MASTER" | "CUSTOM" | "LEGACY";
  availableRates: Array<{
    rateTypeId: string;
    code: string;
    name: string;
    amount: number | null;
    configured: boolean;
  }>;
}

interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
  tax: TaxPct;
  salePrice?: number | null;
  mrp?: number | null;
  barcode?: string | null;
  stock?: number | null;
}

function taxToNum(t: TaxPct): number {
  return t === "NT" ? 0 : Number(t.replace("P", "")) || 0;
}

function calcRow(row: ItemRow): ItemRow {
  const qty = Math.max(0, Number(row.quantity) || 0);
  const rate = Math.max(0, Number(row.rate) || 0);
  const taxPct = taxToNum(row.taxPercent);
  const taxAmount = round2(rate * qty * (taxPct / 100));
  const totalCost = round2(rate * qty + taxAmount);
  const discountValue =
    row.discountType === "PCT"
      ? round2(totalCost * (Math.max(0, Math.min(100, row.discount)) / 100))
      : Math.max(0, Number(row.discount) || 0);
  const billedValue = round2(Math.max(0, totalCost - discountValue));
  return { ...row, totalCost, billedValue };
}

function emptyRow(lineNo: number): ItemRow {
  return {
    lineNo,
    productId: "",
    name: "",
    code: "",
    barcode: "",
    unit: "NOS",
    rate: 0,
    quantity: 0,
    mrp: 0,
    taxPercent: "NT",
    discountType: "ABS",
    discount: 0,
    salePrice: 0,
    totalCost: 0,
    billedValue: 0,
    batchId: null,
    batchNo: "",
    mfgDate: null,
    expiryDate: null,
    rateTypeId: null,
    rateTypeCode: null,
    rateTypeName: null,
    rateSource: "LEGACY",
    availableRates: [],
  };
}

function getStockBadgeClass(stock?: number | null) {
  const qty = Number(stock || 0);

  if (qty <= 0) {
    return "border-rose-200 bg-rose-50 text-rose-600";
  }

  if (qty <= 5) {
    return "border-amber-200 bg-amber-50 text-amber-600";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-600";
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  licenseId: string;
  editId?: string | null;
  onSaved: () => void;
  customers: Array<{ id: string; name: string }>;
  onAddCustomer?: () => void;
}

export default function QuotationFormModal({
  isOpen,
  onClose,
  licenseId,
  editId,
  onSaved,
  customers,
  onAddCustomer,
}: Props) {
  const isEditing = !!editId;
  const [isMaximized, setIsMaximized] = useState(true);

  const [quotationNo, setQuotationNo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [department, setDepartment] = useState("");
  const [quotationDate, setQuotationDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [status, setStatus] = useState<"DRAFT" | "SENT" | "EXPIRED">("DRAFT");
  const [rows, setRows] = useState<ItemRow[]>([emptyRow(1)]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [uiSettings, setUiSettings] = useState<QuotationUiSettings>(() =>
    loadQuotationUiSettings(),
  );
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setUiSettings(loadQuotationUiSettings());
  }, [isOpen]);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const subTotal = useMemo(
    () => rows.reduce((s, r) => s + (r.billedValue || 0), 0),
    [rows],
  );
  const [rateTypes, setRateTypes] = useState<RateTypeRecord[]>([]);
  const grandTotal = useMemo(
    () => Math.max(0, subTotal - (discount || 0)),
    [subTotal, discount],
  );

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      platform.getFilteredProducts?.(
        licenseId,
        {},
        { page: 1, pageSize: 5000 },
      ),
      platform.listRateTypes(licenseId, false),
    ]).then(([productResult, rateResult]) => {
      setProducts((productResult?.products || []) as Product[]);
      setRateTypes(orderActiveRateTypes(rateResult.rows || []));
    });
  }, [isOpen, licenseId]);

  useEffect(() => {
    if (!isOpen) return;
    setUiSettings(loadQuotationUiSettings());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && editId) {
      platform.getQuotationFull?.(editId).then((res) => {
        if (!res?.success) return;
        const q = (res as any).quotation;
        const items: QuotationItemRow[] = (res as any).items || [];
        setQuotationNo(q.quotationNo || "");
        setCustomerId(q.customerId || "");
        setCustomerName(q.customerName || "");
        setDepartment(q.department || "");
        setQuotationDate(
          q.quotationDate
            ? new Date(q.quotationDate).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        );
        setNotes(q.notes || "");
        setDiscount(Number(q.discount || 0));
        setStatus(q.status || "DRAFT");
        if (items.length) {
          setRows(
            items.map((it, idx) => {
              const prod = products.find((p) => p.id === it.productId);
              return calcRow({
                lineNo: it.lineNo ?? idx + 1,
                productId: it.productId,
                name: (it as any).productName || prod?.name || "",
                code: prod?.code || "",
                barcode: it.barcode || "",
                unit: it.unit,
                rate: Number(it.rate || 0),
                quantity: Number(it.quantity || 0),
                mrp: Number(it.mrp || 0),
                taxPercent: (it.taxPercent as TaxPct) || "NT",
                discountType: (it.discountType as DiscountType) || "ABS",
                discount: Number(it.discount || 0),
                salePrice: Number(it.salePrice || 0),
                totalCost: Number(it.totalCost || 0),
                billedValue: Number(it.billedValue || 0),
                batchId: it.batchId || null,
                batchNo: it.batchNo || "",
                mfgDate: it.mfgDate || null,
                expiryDate: it.expiryDate || null,
                rateTypeId: it.rateTypeId || null,
                rateTypeCode: it.rateTypeCode || null,
                rateTypeName: it.rateTypeName || null,
                rateSource: it.rateSource || "LEGACY",
                availableRates: it.rateTypeId
                  ? [
                      {
                        rateTypeId: it.rateTypeId,
                        code: it.rateTypeCode || "",
                        name:
                          it.rateTypeName || it.rateTypeCode || "Saved rate",
                        amount: Number(it.rate),
                        configured: true,
                      },
                    ]
                  : [],
              });
            }),
          );
        }
      });
    } else {
      setQuotationNo("");
      setCustomerId("");
      setCustomerName("");
      setDepartment("");
      setQuotationDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setDiscount(0);
      setStatus("DRAFT");
      setRows([emptyRow(1)]);
      platform.peekNextQuotationSlNo?.(licenseId).then((r) => {
        if (r?.nextQuotationNo) setQuotationNo(r.nextQuotationNo);
      });
    }
  }, [isOpen, editId, isEditing, licenseId]);

  async function selectProduct(rowIdx: number, prod: Product) {
    const activeTypes = orderActiveRateTypes(rateTypes);
    const productRateResult = await platform.listProductRates(
      licenseId,
      prod.id,
    );
    const availableRates = activeTypes.map((rateType) => {
      const resolved = resolveNamedRate({
        rateType,
        productRates: productRateResult.rows || [],
      });
      return {
        rateTypeId: rateType.id,
        code: rateType.code,
        name: rateType.name,
        amount: resolved.amount,
        configured: resolved.configured,
      };
    });
    const defaultType = findDefaultRateType(activeTypes);
    const selected = availableRates.find(
      (rate) => rate.rateTypeId === defaultType?.id,
    );
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? calcRow({
              ...r,
              productId: prod.id,
              name: prod.name,
              code: prod.code,
              barcode: prod.barcode || "",
              unit: prod.unit || "NOS",
              rate: activeTypes.length
                ? (selected?.amount ?? 0)
                : Number(prod.salePrice || prod.mrp || 0),
              mrp: Number(prod.mrp || 0),
              salePrice: activeTypes.length
                ? (selected?.amount ?? 0)
                : Number(prod.salePrice || 0),
              rateTypeId: defaultType?.id || null,
              rateTypeCode: defaultType?.code || null,
              rateTypeName: defaultType?.name || "Legacy",
              rateSource: defaultType ? "MASTER" : "LEGACY",
              availableRates,
              taxPercent: prod.tax || "NT",
              quantity: r.quantity || 1,
            })
          : r,
      ),
    );
  }

  function updateRow(rowIdx: number, patch: Partial<ItemRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? calcRow({ ...r, ...patch }) : r)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(prev.length + 1)]);
  }

  function removeRow(rowIdx: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== rowIdx);
      return next.length
        ? next.map((r, i) => ({ ...r, lineNo: i + 1 }))
        : [emptyRow(1)];
    });
  }

  const customerOptions = useMemo(() => {
    const seen = new Set<string>();

    const options = customers.flatMap((customer) => {
      const value = String(customer?.id ?? "").trim();
      const label = String(customer?.name ?? "").trim();

      if (!value || !label || seen.has(value)) return [];

      seen.add(value);
      return [{ value, label }];
    });

    const currentId = customerId.trim();
    const currentName = customerName.trim();

    // Preserve a historical saved customer label while editing even if that
    // customer is no longer present in the active master list.
    if (currentId && currentName && !seen.has(currentId)) {
      options.unshift({ value: currentId, label: currentName });
    }

    return options;
  }, [customers, customerId, customerName]);

  useEffect(() => {
    if (!isOpen || isEditing || !customerId) return;

    const hasValidOption = customerOptions.some(
      (option) => option.value === customerId,
    );

    if (!hasValidOption) {
      setCustomerId("");
      setCustomerName("");
    }
  }, [customerId, customerOptions, isEditing, isOpen]);

  function selectCustomer(id: string) {
    const cleanId = String(id ?? "").trim();
    const selected = customerOptions.find((option) => option.value === cleanId);

    if (!cleanId || !selected?.label.trim()) {
      setCustomerId("");
      setCustomerName("");
      return;
    }

    setCustomerId(cleanId);
    setCustomerName(selected.label.trim());
  }

  async function handleSave() {
    const validRows = rows.filter((r) => r.productId && r.quantity > 0);
    if (!validRows.length) {
      setErrors(["Add at least one item with quantity > 0."]);
      return;
    }
    const missingRate = validRows.find(
      (row) =>
        row.rateSource === "MASTER" &&
        !row.availableRates.find(
          (rate) => rate.rateTypeId === row.rateTypeId && rate.configured,
        ),
    );
    if (missingRate) {
      setErrors([
        `Line ${missingRate.lineNo}: the selected named rate is not configured.`,
      ]);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      const header = {
        licenseId,
        quotationNo,
        customerId: customerId || null,
        customerName: customerName || null,
        department: department || null,
        quotationDate: new Date(quotationDate).toISOString(),
        discount,
        status,
        notes: notes || null,
      };
      const items = validRows.map((r, i) => ({
        productId: r.productId,
        barcode: r.barcode || null,
        quantity: r.quantity,
        unit: r.unit,
        rate: r.rate,
        mrp: r.mrp || null,
        taxPercent: r.taxPercent,
        taxAmount: round2(r.totalCost - r.rate * r.quantity),
        discount: r.discount,
        discountType: r.discountType,
        salePrice: r.salePrice || null,
        totalCost: r.totalCost,
        billedValue: r.billedValue,
        batchNo: r.batchNo || null,
        batchId: r.batchId || null,
        mfgDate: r.mfgDate || null,
        expiryDate: r.expiryDate || null,
        lineNo: i + 1,
        rateTypeId: r.rateTypeId,
        rateTypeCode: r.rateTypeCode,
        rateTypeName: r.rateTypeName,
        rateSource: r.rateSource,
      }));

      let res;
      if (isEditing && editId) {
        res = await platform.updateQuotation?.({
          id: editId,
          header: header as any,
          items: items as any,
        });
      } else {
        res = await platform.createQuotation?.(header as any, items as any);
      }

      if (!res?.success) {
        setErrors([(res as any)?.error || "Save failed"]);
        return;
      }

      if (isSyncEnabled()) {
        SyncManager.pushEntity("quotation").catch(() => {});
        SyncManager.pushEntity("quotationItem").catch(() => {});
      }
      onSaved();
    } catch (err: any) {
      setErrors([err.message || "Save failed"]);
    } finally {
      setSaving(false);
    }
  }

  function focusBillDetails() {
    const input = modalRef.current?.querySelector<HTMLInputElement>(
      '[data-quotation-focus="details"]',
    );
    input?.focus({ preventScroll: true });
    input?.select();
  }

  function getVisibleItemFields(): QuotationItemField[] {
    const fields: QuotationItemField[] = ["product", "qty"];
    if (uiSettings.showUnit) fields.push("unit");
    fields.push("rateType", "rate");
    if (uiSettings.showTax) fields.push("tax");
    if (uiSettings.showLineDiscount) fields.push("discount");
    return fields;
  }

  function focusQuotationItemCell(
    rowIndex: number,
    field: QuotationItemField,
  ): boolean {
    const root = modalRef.current;
    if (!root) return false;

    const target = root.querySelector<HTMLElement>(
      `[data-quotation-row="${rowIndex}"][data-quotation-field="${field}"]`,
    );
    if (!target) return false;

    target.focus({ preventScroll: true });
    if (target instanceof HTMLInputElement) {
      try {
        target.select();
      } catch {}
    }

    const container = target.closest<HTMLElement>(
      "[data-quotation-grid-scroll]",
    );
    if (!container) {
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      return true;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const leftSafe = containerRect.left + 12;
    const rightSafe = containerRect.right - 12;

    if (targetRect.left < leftSafe) {
      container.scrollLeft += targetRect.left - leftSafe;
    } else if (targetRect.right > rightSafe) {
      container.scrollLeft += targetRect.right - rightSafe;
    }

    return true;
  }

  function moveQuotationItemCell(
    rowIndex: number,
    field: QuotationItemField,
    direction: 1 | -1,
  ) {
    const fields = getVisibleItemFields();
    const fieldIndex = fields.indexOf(field);
    if (fieldIndex < 0) return;

    let nextFieldIndex = fieldIndex + direction;
    let nextRowIndex = rowIndex;

    if (nextFieldIndex >= fields.length) {
      nextFieldIndex = 0;
      nextRowIndex += 1;
    } else if (nextFieldIndex < 0) {
      nextFieldIndex = fields.length - 1;
      nextRowIndex -= 1;
    }

    if (nextRowIndex < 0) return;

    if (nextRowIndex >= rows.length) {
      if (direction < 0) return;
      setRows((current) => [...current, emptyRow(current.length + 1)]);
    }

    const nextField = fields[nextFieldIndex];
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        focusQuotationItemCell(nextRowIndex, nextField);
      });
    });
  }

  function handleItemMoveKey(
    event: ReactKeyboardEvent<HTMLElement>,
    rowIndex: number,
    field: QuotationItemField,
  ) {
    const isMoveKey =
      event.key === "Enter" ||
      event.key === "NumpadEnter" ||
      event.key === "Tab";
    if (!isMoveKey) return;

    event.preventDefault();
    event.stopPropagation();
    moveQuotationItemCell(rowIndex, field, event.shiftKey ? -1 : 1);
  }

  function focusItemEntry() {
    let rowIndex = rows.findIndex((row) => !row.productId);
    if (rowIndex < 0) {
      rowIndex = rows.length;
      setRows((current) => [...current, emptyRow(current.length + 1)]);
    }

    const targetRow = rowIndex;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        focusQuotationItemCell(targetRow, "product");
      });
    });
  }

  function focusRelativeControl(target: HTMLElement, backwards: boolean) {
    const root = modalRef.current;
    if (!root) return;

    const controls = Array.from(
      root.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [role="button"][tabindex="0"]',
      ),
    ).filter((element) => {
      if (element.dataset.quotationSkipNav === "true") return false;
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    });

    const index = controls.indexOf(target);
    if (index < 0) return;
    const nextIndex = backwards ? index - 1 : index + 1;
    const next = controls[nextIndex];
    if (!next) return;
    next.focus({ preventScroll: true });
    if (next instanceof HTMLInputElement) next.select();
  }

  function handleFormKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "Enter" ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("[data-quotation-row]")) return;
    if (target.tagName === "BUTTON") return;

    event.preventDefault();
    focusRelativeControl(target, event.shiftKey);
  }

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || showSettings) return;

      if (event.key === "F3") {
        event.preventDefault();
        focusItemEntry();
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        focusBillDetails();
        return;
      }

      if (event.key === "F7") {
        event.preventDefault();
        setShowSettings(true);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!saving) void handleSave();
        return;
      }

      if (event.altKey && event.key === "Enter") {
        event.preventDefault();
        const nextIndex = rows.length;
        setRows((current) => [...current, emptyRow(current.length + 1)]);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            focusQuotationItemCell(nextIndex, "product");
          });
        });
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, rows, saving, showSettings]);

  if (!isOpen) return null;

  const STATUS_OPTIONS = [
    { value: "DRAFT", label: "Draft" },
    { value: "SENT", label: "Sent" },
    { value: "EXPIRED", label: "Expired" },
  ];

  const UNIT_OPTIONS = [
    { value: "NOS", label: "NOS" },
    { value: "KG", label: "KG" },
    { value: "LTR", label: "LTR" },
    { value: "MTR", label: "MTR" },
  ];

  const TAX_OPTIONS = [
    { value: "NT", label: "0%" },
    { value: "P5", label: "5%" },
    { value: "P12", label: "12%" },
    { value: "P18", label: "18%" },
    { value: "P28", label: "28%" },
  ];

  const DISCOUNT_TYPE_OPTIONS = [
    { value: "ABS", label: "₹" },
    { value: "PCT", label: "%" },
  ];

  const panelSizeClass = isMaximized
    ? "h-[calc(100dvh-16px)] w-[calc(100vw-16px)] rounded-[24px]"
    : "h-[88dvh] w-[min(1180px,calc(100vw-32px))] rounded-[24px]";

  const inputCls =
    "h-[38px] w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition selection:bg-slate-900 selection:text-white focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10";

  const tableInputCls =
    "h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm outline-none transition selection:bg-white selection:text-[#1e3a5f] focus:border-[#20b7ff] focus:bg-[#1e3a5f] focus:text-white focus:placeholder:text-white/60 focus:ring-2 focus:ring-[#20b7ff]/35";

  const itemTableMinWidth =
    788 +
    (uiSettings.showStock ? 72 : 0) +
    (uiSettings.showUnit ? 76 : 0) +
    (uiSettings.showTax ? 76 : 0) +
    (uiSettings.showLineDiscount ? 118 : 0);

  return (
    <>
      {/* ── Modal ── */}
      <div
        className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-md sm:p-4"
        onMouseDown={onClose}
      >
        <div
          ref={modalRef}
          className={`flex flex-col overflow-hidden border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.99))] shadow-[0_24px_90px_rgba(2,6,23,0.32)] transition-[width,height,border-radius,box-shadow] duration-200 ${panelSizeClass}`}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDownCapture={handleFormKeyDown}
        >
          {/* Header */}
          <div className="relative shrink-0 overflow-hidden bg-[linear-gradient(135deg,#07101f_0%,#0f1a31_58%,#17213c_100%)] px-3 py-1.5 text-white sm:px-4">
            <div className="pointer-events-none absolute -left-8 top-0 h-24 w-24 rounded-full bg-cyan-400/15 blur-2xl" />
            <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-2xl" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                </div>

                <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                  <span className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white">
                    {isEditing ? "Edit Quotation" : "New Quotation"}
                  </span>
                  {quotationNo && (
                    <span className="hidden rounded-full border border-white/10 bg-white/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-white/70 sm:inline-flex">
                      {quotationNo}
                    </span>
                  )}
                  <div className="hidden items-center gap-1.5 xl:flex">
                    {[
                      "F3 Items",
                      "F4 Details",
                      "F7 Settings",
                      "Ctrl+S Save",
                    ].map((hint) => (
                      <span
                        key={hint}
                        className="rounded-md border border-white/10 bg-white/[0.07] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white/70"
                      >
                        {hint}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="flex h-7 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2 text-[10px] font-semibold text-white transition hover:bg-white/20"
                  title="Inline settings (F7)"
                >
                  <Settings className="h-3 w-3" />
                  <span className="hidden sm:inline">Settings</span>
                  <span className="font-mono text-[9px] text-white/55">F7</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMaximized((value) => !value)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                  title={isMaximized ? "Restore window" : "Maximize window"}
                >
                  {isMaximized ? (
                    <Minimize2 className="h-3 w-3" />
                  ) : (
                    <Maximize2 className="h-3 w-3" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-rose-500/80"
                  title="Close"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Form body */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/80 px-3 py-3 sm:px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Header fields */}
            <section className="rounded-[18px] border border-slate-200 bg-white/85 p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Quotation Details
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    F4 focuses details. Hidden optional fields keep their
                    values.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configure
                  <span className="font-mono text-[9px] text-slate-400">
                    F7
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Quotation No
                  </label>
                  <input
                    data-quotation-focus="details"
                    className={inputCls}
                    value={quotationNo}
                    onChange={(e) => setQuotationNo(e.target.value)}
                    placeholder="Auto"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </label>
                  <input
                    type="date"
                    className={inputCls}
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Customer
                  </label>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <SearchableDropdown
                        value={customerId}
                        onChange={selectCustomer}
                        options={customerOptions}
                        placeholder="Select customer..."
                        autoOpenOnFocus={false}
                        buttonProps={{
                          className:
                            "h-[38px] w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 shadow-sm focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10",
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={onAddCustomer}
                      className="inline-flex h-[38px] w-[42px] shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Add new customer"
                      disabled={!onAddCustomer}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {uiSettings.showStatus ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </label>
                    <Dropdown
                      value={status}
                      onChange={(value) =>
                        setStatus(value as "DRAFT" | "SENT" | "EXPIRED")
                      }
                      options={STATUS_OPTIONS}
                      placeholder="Status"
                      buttonClassName="!h-[38px] !rounded-2xl !border-slate-200 !bg-white !px-3.5 !py-0 !text-sm !shadow-sm focus:!border-cyan-400/60 focus:!ring-4 focus:!ring-cyan-400/10"
                    />
                  </div>
                ) : null}

                {uiSettings.showDepartment ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Department
                    </label>
                    <input
                      className={inputCls}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                ) : null}

                {uiSettings.showHeaderDiscount ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Header Discount (₹)
                    </label>
                    <input
                      type="number"
                      className={inputCls}
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                ) : null}

                {uiSettings.showNotes ? (
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Notes
                    </label>
                    <input
                      className={inputCls}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Validity, terms, remarks…"
                    />
                  </div>
                ) : null}
              </div>
            </section>

            {/* Items table */}
            <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
              <div
                data-quotation-grid-scroll
                className="overflow-x-auto overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <table
                  className="w-full border-collapse text-sm"
                  style={{ minWidth: itemTableMinWidth }}
                >
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-700 bg-[linear-gradient(135deg,#07101f_0%,#0f1a31_58%,#17213c_100%)]">
                      <th className="w-10 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        #
                      </th>
                      <th className="min-w-[260px] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Product
                      </th>
                      {uiSettings.showStock ? (
                        <th className="w-20 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                          Stock
                        </th>
                      ) : null}
                      <th className="w-20 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Qty
                      </th>
                      {uiSettings.showUnit ? (
                        <th className="w-24 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                          Unit
                        </th>
                      ) : null}
                      <th className="w-36 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Rate Type
                      </th>
                      <th className="w-28 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Rate
                      </th>
                      {uiSettings.showTax ? (
                        <th className="w-24 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                          Tax
                        </th>
                      ) : null}
                      {uiSettings.showLineDiscount ? (
                        <th className="w-36 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                          Discount
                        </th>
                      ) : null}
                      <th className="w-28 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Total
                      </th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const selectedProduct = row.productId
                        ? products.find((p) => p.id === row.productId)
                        : null;
                      const availableStock = Number(
                        selectedProduct?.stock || 0,
                      );
                      return (
                        <tr
                          key={idx}
                          className="border-b border-slate-100 hover:bg-slate-50/60"
                        >
                          {/* # */}
                          <td className="px-3 py-1.5 text-center align-middle text-xs text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Product */}
                          <td className="px-2 py-1.5 align-middle">
                            <SearchableDropdown
                              value={row.productId}
                              onChange={(value) => {
                                if (!value) {
                                  setRows((current) =>
                                    current.map((currentRow, currentIndex) =>
                                      currentIndex === idx
                                        ? calcRow({
                                            ...emptyRow(currentRow.lineNo),
                                            quantity: currentRow.quantity || 1,
                                          })
                                        : currentRow,
                                    ),
                                  );
                                  return;
                                }

                                const product = products.find(
                                  (candidate) => candidate.id === value,
                                );
                                if (product) void selectProduct(idx, product);
                              }}
                              onEnter={(direction) =>
                                moveQuotationItemCell(idx, "product", direction)
                              }
                              autoOpenOnFocus
                              options={products.map((product) => ({
                                value: product.id,
                                label: product.name,
                              }))}
                              placeholder="Select product..."
                              className="w-full [&_*]:text-xs"
                              controlClassName="h-8 text-xs px-2 w-full"
                              menuClassName="text-xs min-w-[280px]"
                              optionClassName="!px-3 !py-2 !text-xs"
                              buttonProps={{
                                "data-quotation-row": idx,
                                "data-quotation-field": "product",
                                title:
                                  "F3 focuses products. Arrow keys move, Enter selects.",
                              }}
                            />
                          </td>

                          {/* Stock */}
                          {uiSettings.showStock ? (
                            <td className="px-3 py-1.5 text-right align-middle">
                              {row.productId ? (
                                <span
                                  className={`inline-flex h-6 items-center justify-center rounded-full border px-2 font-mono text-[11px] font-bold ${getStockBadgeClass(
                                    availableStock,
                                  )}`}
                                  title={
                                    row.quantity > availableStock &&
                                    availableStock > 0
                                      ? "Quoted quantity is higher than current stock"
                                      : availableStock <= 0
                                        ? "No current stock"
                                        : "Available stock"
                                  }
                                >
                                  {availableStock}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-300">
                                  —
                                </span>
                              )}
                            </td>
                          ) : null}

                          {/* Qty */}
                          <td className="px-3 py-1.5 align-middle">
                            <input
                              type="number"
                              data-quotation-row={idx}
                              data-quotation-field="qty"
                              className={`${tableInputCls} text-right`}
                              value={row.quantity || ""}
                              onChange={(e) =>
                                updateRow(idx, {
                                  quantity: Number(e.target.value) || 0,
                                })
                              }
                              min={0}
                              step={1}
                              onFocus={(event) => event.currentTarget.select()}
                              onKeyDown={(event) =>
                                handleItemMoveKey(event, idx, "qty")
                              }
                            />
                          </td>

                          {/* Unit */}
                          {uiSettings.showUnit ? (
                            <td className="px-3 py-1.5 align-middle">
                              <CompactDropdown
                                value={row.unit}
                                onChange={(value) =>
                                  updateRow(idx, { unit: value })
                                }
                                onEnter={(direction) =>
                                  moveQuotationItemCell(idx, "unit", direction)
                                }
                                autoOpenOnFocus
                                options={UNIT_OPTIONS}
                                placeholder="Unit"
                                menuPortal
                                menuMinWidth={120}
                                hideMenuScrollbar
                                className="w-full min-w-0 [&_*]:text-xs [&_button]:h-8 [&_button]:px-2"
                                menuClassName="text-xs"
                                buttonProps={{
                                  "data-quotation-row": idx,
                                  "data-quotation-field": "unit",
                                }}
                              />
                            </td>
                          ) : null}

                          {/* Rate type */}
                          <td className="px-3 py-1.5 align-middle">
                            <CompactDropdown
                              value={
                                row.rateSource === "CUSTOM"
                                  ? "__CUSTOM__"
                                  : row.rateTypeId || "__LEGACY__"
                              }
                              onChange={(value) => {
                                if (value === "__CUSTOM__") {
                                  updateRow(idx, {
                                    rateTypeId: null,
                                    rateTypeCode: null,
                                    rateTypeName: "Custom",
                                    rateSource: "CUSTOM",
                                  });
                                  return;
                                }
                                if (value === "__LEGACY__") return;

                                const selected = row.availableRates.find(
                                  (rate) => rate.rateTypeId === value,
                                );
                                if (
                                  !selected?.configured ||
                                  selected.amount == null
                                ) {
                                  return;
                                }

                                updateRow(idx, {
                                  rateTypeId: selected.rateTypeId,
                                  rateTypeCode: selected.code,
                                  rateTypeName: selected.name,
                                  rateSource: "MASTER",
                                  rate: selected.amount,
                                  salePrice: selected.amount,
                                });
                              }}
                              onEnter={(direction) =>
                                moveQuotationItemCell(
                                  idx,
                                  "rateType",
                                  direction,
                                )
                              }
                              autoOpenOnFocus
                              options={[
                                ...(!row.rateTypeId &&
                                row.rateSource !== "CUSTOM"
                                  ? [{ value: "__LEGACY__", label: "Legacy" }]
                                  : []),
                                ...row.availableRates
                                  .filter(
                                    (rate) =>
                                      rate.configured && rate.amount != null,
                                  )
                                  .map((rate) => ({
                                    value: rate.rateTypeId,
                                    label: `${rate.name} - Rs. ${Number(
                                      rate.amount,
                                    ).toFixed(2)}`,
                                  })),
                                { value: "__CUSTOM__", label: "Custom rate" },
                              ]}
                              selectedLabel={
                                row.rateSource === "CUSTOM"
                                  ? "Custom"
                                  : row.rateTypeName ||
                                    (row.rateSource === "LEGACY"
                                      ? "Legacy"
                                      : "")
                              }
                              placeholder="Rate Type"
                              menuPortal
                              menuMinWidth={220}
                              hideMenuScrollbar
                              className="w-full min-w-0 [&_*]:text-xs [&_button]:h-8 [&_button]:px-2"
                              menuClassName="text-xs"
                              buttonProps={{
                                "data-quotation-row": idx,
                                "data-quotation-field": "rateType",
                                title:
                                  "Arrow keys choose Rate Type. Enter selects and moves to Rate.",
                              }}
                            />
                          </td>

                          {/* Rate */}
                          <td className="px-3 py-1.5 align-middle">
                            <input
                              type="number"
                              data-quotation-row={idx}
                              data-quotation-field="rate"
                              className={`${tableInputCls} text-right`}
                              value={row.rate || ""}
                              onChange={(event) =>
                                updateRow(idx, {
                                  rate: Number(event.target.value) || 0,
                                  salePrice: Number(event.target.value) || 0,
                                  rateTypeId: null,
                                  rateTypeCode: null,
                                  rateTypeName: "Custom",
                                  rateSource: "CUSTOM",
                                })
                              }
                              min={0}
                              step={0.01}
                              onFocus={(event) => event.currentTarget.select()}
                              onKeyDown={(event) =>
                                handleItemMoveKey(event, idx, "rate")
                              }
                            />
                          </td>

                          {/* Tax */}
                          {uiSettings.showTax ? (
                            <td className="px-3 py-1.5 align-middle">
                              <CompactDropdown
                                value={row.taxPercent}
                                onChange={(value) =>
                                  updateRow(idx, {
                                    taxPercent: value as TaxPct,
                                  })
                                }
                                onEnter={(direction) =>
                                  moveQuotationItemCell(idx, "tax", direction)
                                }
                                autoOpenOnFocus
                                options={TAX_OPTIONS}
                                placeholder="Tax"
                                menuPortal
                                menuMinWidth={120}
                                hideMenuScrollbar
                                className="w-full min-w-0 [&_*]:text-xs [&_button]:h-8 [&_button]:px-2"
                                menuClassName="text-xs"
                                buttonProps={{
                                  "data-quotation-row": idx,
                                  "data-quotation-field": "tax",
                                }}
                              />
                            </td>
                          ) : null}

                          {/* Discount */}
                          {uiSettings.showLineDiscount ? (
                            <td className="px-3 py-1.5 align-middle">
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  data-quotation-row={idx}
                                  data-quotation-field="discount"
                                  className={`${tableInputCls} text-right`}
                                  value={row.discount || ""}
                                  onChange={(e) =>
                                    updateRow(idx, {
                                      discount: Number(e.target.value) || 0,
                                    })
                                  }
                                  min={0}
                                  step={0.01}
                                  onFocus={(event) =>
                                    event.currentTarget.select()
                                  }
                                  onKeyDown={(event) =>
                                    handleItemMoveKey(event, idx, "discount")
                                  }
                                />
                                <Dropdown
                                  value={row.discountType}
                                  onChange={(value) =>
                                    updateRow(idx, {
                                      discountType: value as DiscountType,
                                    })
                                  }
                                  options={DISCOUNT_TYPE_OPTIONS}
                                  placeholder="Type"
                                  buttonClassName="!h-8 !w-14 !rounded-lg !border-slate-200 !bg-white !px-2 !py-0 !text-xs !shadow-sm focus:!border-cyan-400/60 focus:!ring-2 focus:!ring-cyan-400/10"
                                  menuClassName="rounded-xl"
                                  optionClassName="!px-3 !py-2 !text-xs"
                                />
                              </div>
                            </td>
                          ) : null}

                          {/* Total */}
                          <td className="px-3 py-1.5 text-right align-middle font-semibold tabular-nums text-slate-800">
                            ₹{(row.billedValue || 0).toFixed(2)}
                          </td>

                          {/* Delete */}
                          <td className="px-2 py-1.5 align-middle">
                            <button
                              onClick={() => removeRow(idx)}
                              className="p-1 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-3 py-2">
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-cyan-600 transition hover:bg-cyan-50 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                  <span className="rounded border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 font-mono text-[9px] text-cyan-700">
                    Alt+Enter
                  </span>
                </button>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-slate-200 bg-white/95 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <span>
                  Subtotal:{" "}
                  <strong className="text-slate-800">
                    ₹{subTotal.toFixed(2)}
                  </strong>
                </span>
                {discount > 0 && (
                  <span className="font-medium text-rose-500">
                    − ₹{discount.toFixed(2)}
                  </span>
                )}
                <span className="text-base font-semibold text-slate-900">
                  Total: ₹{grandTotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {errors.length > 0 && (
                  <span className="text-xs text-rose-500">
                    {errors.join(" ")}
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#20b7ff] to-[#6a8fff] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(32,183,255,0.25)] transition hover:opacity-90 disabled:opacity-60 cursor-pointer"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEditing ? "Update" : "Save"} Quotation
                  <span className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/75">
                    Ctrl+S
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <QuotationEntrySettingsModal
        open={showSettings}
        settings={uiSettings}
        onClose={() => setShowSettings(false)}
        onSave={(nextSettings) => {
          setUiSettings(nextSettings);
          saveQuotationUiSettings(nextSettings);
        }}
      />
    </>
  );
}
