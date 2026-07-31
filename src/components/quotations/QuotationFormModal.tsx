// src/components/quotations/QuotationFormModal.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Search,
  Loader2,
  PackageCheck,
  FileText,
  Maximize2,
  Minimize2,
} from "lucide-react";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import Dropdown from "@/components/ui/Dropdown";
import { platform } from "@/platform";
import type { QuotationItemRow, RateTypeRecord } from "@/platform/types";
import {
  findDefaultRateType,
  orderActiveRateTypes,
  resolveNamedRate,
} from "@/lib/rates/rateResolution";
import { isSyncEnabled } from "@/platform/mode";
import { SyncManager } from "@/sync/SyncManager";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type TaxPct = "NT" | "P5" | "P12" | "P18" | "P28";
type DiscountType = "ABS" | "PCT";

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
  const [productSearch, setProductSearch] = useState<Record<number, string>>(
    {},
  );
  const [openSearchIdx, setOpenSearchIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // ── Dropdown portal state ──────────────────────────────────────────────────
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

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
                          it.rateTypeName ||
                          it.rateTypeCode ||
                          "Saved rate",
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

  // ── Recalculate dropdown position when open index changes ─────────────────
  useEffect(() => {
    if (openSearchIdx === null) {
      setDropdownPos(null);
      return;
    }
    const el = inputRefs.current[openSearchIdx];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 320),
    });
  }, [openSearchIdx]);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      const anyInput = Object.values(inputRefs.current).some(
        (el) => el && el.contains(target),
      );
      const dropdown = document.getElementById("qt-product-dropdown");
      if (!anyInput && !(dropdown && dropdown.contains(target))) {
        setOpenSearchIdx(null);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filteredProducts = useCallback(
    (q: string) => {
      if (!q.trim()) return products.slice(0, 20);
      const lower = q.toLowerCase();
      return products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(lower) ||
            p.code.toLowerCase().includes(lower) ||
            (p.barcode || "").toLowerCase().includes(lower),
        )
        .slice(0, 20);
    },
    [products],
  );

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
    setOpenSearchIdx(null);
    setProductSearch((prev) => ({ ...prev, [rowIdx]: "" }));
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

  function selectCustomer(id: string) {
    setCustomerId(id);
    const cust = customers.find((c) => c.id === id);
    setCustomerName(cust?.name || "");
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
          (rate) =>
            rate.rateTypeId === row.rateTypeId && rate.configured,
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
    "h-[38px] w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10";

  const tableInputCls =
    "h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10";

  const tableDropdownBtnCls =
    "!h-8 !rounded-lg !border-slate-200 !bg-white !px-2 !py-0 !text-xs !shadow-sm focus:!border-cyan-400/60 focus:!ring-2 focus:!ring-cyan-400/10";

  return (
    <>
      {/* ── Modal ── */}
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-md sm:p-4"
        onMouseDown={onClose}
      >
        <div
          className={`flex flex-col overflow-hidden border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.99))] shadow-[0_24px_90px_rgba(2,6,23,0.32)] transition-[width,height,border-radius,box-shadow] duration-200 ${panelSizeClass}`}
          onMouseDown={(e) => e.stopPropagation()}
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
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide">
                    Quotation No
                  </label>
                  <input
                    className={inputCls}
                    value={quotationNo}
                    onChange={(e) => setQuotationNo(e.target.value)}
                    placeholder="Auto"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide">
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
                  <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide">
                    Customer
                  </label>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <SearchableDropdown
                        value={customerId}
                        onChange={selectCustomer}
                        options={customers.map((c) => ({
                          value: c.id,
                          label: c.name,
                        }))}
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
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide">
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
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide">
                    Department
                  </label>
                  <input
                    className={inputCls}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide">
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
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide">
                    Notes
                  </label>
                  <input
                    className={inputCls}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Validity, terms, remarks…"
                  />
                </div>
              </div>
            </section>

            {/* Items table */}
            <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
              <div className="overflow-auto">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-800 bg-[linear-gradient(135deg,#07101f_0%,#0f1a31_58%,#17213c_100%)]">
                      <th className="w-10 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        #
                      </th>
                      <th className="min-w-[280px] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Product
                      </th>
                      <th className="w-20 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Stock
                      </th>
                      <th className="w-20 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Qty
                      </th>
                      <th className="w-24 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Unit
                      </th>
                      <th className="w-28 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Rate
                      </th>
                      <th className="w-24 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Tax
                      </th>
                      <th className="w-36 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Discount
                      </th>
                      <th className="w-28 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        Total
                      </th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const q = productSearch[idx] ?? "";
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
                          <td className="px-3 py-1.5 align-middle">
                            <div className="relative">
                              <input
                                ref={(el) => {
                                  inputRefs.current[idx] = el;
                                }}
                                className={`${tableInputCls} pr-7 text-left`}
                                placeholder="Search product…"
                                value={
                                  openSearchIdx === idx ? q : row.name || ""
                                }
                                onChange={(e) => {
                                  setProductSearch((prev) => ({
                                    ...prev,
                                    [idx]: e.target.value,
                                  }));
                                  setOpenSearchIdx(idx);
                                }}
                                onFocus={() => setOpenSearchIdx(idx)}
                              />
                              <Search className="absolute right-2 top-2 h-3.5 w-3.5 pointer-events-none text-slate-300" />
                            </div>
                          </td>

                          {/* Stock */}
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
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>

                          {/* Qty */}
                          <td className="px-3 py-1.5 align-middle">
                            <input
                              type="number"
                              className={`${tableInputCls} text-right`}
                              value={row.quantity || ""}
                              onChange={(e) =>
                                updateRow(idx, {
                                  quantity: Number(e.target.value) || 0,
                                })
                              }
                              min={0}
                            />
                          </td>

                          {/* Unit */}
                          <td className="px-3 py-1.5 align-middle">
                            <Dropdown
                              value={row.unit}
                              onChange={(value) =>
                                updateRow(idx, { unit: value })
                              }
                              options={UNIT_OPTIONS}
                              placeholder="Unit"
                              buttonClassName={tableDropdownBtnCls}
                              menuClassName="rounded-xl"
                              optionClassName="!px-3 !py-2 !text-xs"
                            />
                          </td>

                          {/* Rate type */}
                          <td className="px-3 py-1.5 align-middle">
                            <div className="space-y-1">
                              <select
                                className={`${tableInputCls} text-left`}
                                value={
                                  row.rateSource === "CUSTOM"
                                    ? "__CUSTOM__"
                                    : row.rateTypeId || ""
                                }
                                onChange={(event) => {
                                  if (event.target.value === "__CUSTOM__") {
                                    updateRow(idx, {
                                      rateTypeId: null,
                                      rateTypeCode: null,
                                      rateTypeName: "Custom",
                                      rateSource: "CUSTOM",
                                    });
                                    return;
                                  }
                                  const selected = row.availableRates.find(
                                    (rate) =>
                                      rate.rateTypeId === event.target.value,
                                  );
                                  if (!selected?.configured || selected.amount == null) {
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
                              >
                                {!row.rateTypeId &&
                                  row.rateSource !== "CUSTOM" && (
                                    <option value="">Legacy</option>
                                  )}
                                {row.availableRates.map((rate) => (
                                  <option
                                    key={rate.rateTypeId}
                                    value={rate.rateTypeId}
                                    disabled={!rate.configured}
                                  >
                                    {rate.name}
                                    {rate.configured
                                      ? ` - ₹${rate.amount}`
                                      : " - Not configured"}
                                  </option>
                                ))}
                                <option value="__CUSTOM__">Custom rate</option>
                              </select>
                              <input
                                type="number"
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
                              />
                            </div>
                          </td>

                          {/* Tax */}
                          <td className="px-3 py-1.5 align-middle">
                            <Dropdown
                              value={row.taxPercent}
                              onChange={(value) =>
                                updateRow(idx, {
                                  taxPercent: value as TaxPct,
                                })
                              }
                              options={TAX_OPTIONS}
                              placeholder="Tax"
                              buttonClassName={tableDropdownBtnCls}
                              menuClassName="rounded-xl"
                              optionClassName="!px-3 !py-2 !text-xs"
                            />
                          </td>

                          {/* Discount */}
                          <td className="px-3 py-1.5 align-middle">
                            <div className="flex gap-1">
                              <input
                                type="number"
                                className={`${tableInputCls} text-right`}
                                value={row.discount || ""}
                                onChange={(e) =>
                                  updateRow(idx, {
                                    discount: Number(e.target.value) || 0,
                                  })
                                }
                                min={0}
                                step={0.01}
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
                  onClick={addRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-cyan-600 hover:bg-cyan-50 rounded-lg transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add Row
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
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#20b7ff] to-[#6a8fff] rounded-lg hover:opacity-90 transition disabled:opacity-60 cursor-pointer shadow-[0_4px_14px_rgba(32,183,255,0.25)]"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEditing ? "Update" : "Save"} Quotation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Product dropdown portal — rendered at document root to escape any overflow/z-index ── */}
      {openSearchIdx !== null &&
        dropdownPos &&
        (() => {
          const filtered = filteredProducts(productSearch[openSearchIdx] ?? "");
          if (!filtered.length) return null;
          return (
            <div
              id="qt-product-dropdown"
              style={{
                position: "fixed",
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                zIndex: 9999,
              }}
              className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
            >
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full cursor-pointer border-b border-slate-50 px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-sky-50"
                  onMouseDown={() => selectProduct(openSearchIdx, p)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {p.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {p.code}
                      </p>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getStockBadgeClass(
                        p.stock,
                      )}`}
                    >
                      <PackageCheck className="h-3 w-3" />
                      Stock {Number(p.stock || 0)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          );
        })()}
    </>
  );
}
