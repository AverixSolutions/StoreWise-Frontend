// src/components/quotations/QuotationFormModal.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash2, Search, Loader2 } from "lucide-react";
import { platform } from "@/platform";
import type { QuotationRow, QuotationItemRow } from "@/platform/types";
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
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  licenseId: string;
  editId?: string | null;
  onSaved: () => void;
  customers: Array<{ id: string; name: string }>;
}

export default function QuotationFormModal({
  isOpen,
  onClose,
  licenseId,
  editId,
  onSaved,
  customers,
}: Props) {
  const isEditing = !!editId;

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
  const grandTotal = useMemo(
    () => Math.max(0, subTotal - (discount || 0)),
    [subTotal, discount],
  );

  useEffect(() => {
    if (!isOpen) return;
    platform
      .getFilteredProducts?.(licenseId, {}, { page: 1, pageSize: 500 })
      .then((r) => setProducts((r?.products || []) as Product[]));
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
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 288),
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

  function selectProduct(rowIdx: number, prod: Product) {
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
              rate: Number(prod.salePrice || prod.mrp || 0),
              mrp: Number(prod.mrp || 0),
              salePrice: Number(prod.salePrice || 0),
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

  const TAX_OPTIONS: TaxPct[] = ["NT", "P5", "P12", "P18", "P28"];

  const inputCls =
    "h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 w-full transition";

  return (
    <>
      {/* ── Full-screen modal ── */}
      <div className="fixed inset-0 z-[60] flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#0f1e38_60%,#16213d_100%)] text-white shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight">
              {isEditing ? "Edit Quotation" : "New Quotation"}
            </h2>
            {quotationNo && (
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-xs font-medium text-white/90 border border-white/10">
                {quotationNo}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto">
          {/* Header fields */}
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
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
                <select
                  className={inputCls}
                  value={customerId}
                  onChange={(e) => selectCustomer(e.target.value)}
                >
                  <option value="">— None —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide">
                  Status
                </label>
                <select
                  className={inputCls}
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "DRAFT" | "SENT" | "EXPIRED")
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="EXPIRED">Expired</option>
                </select>
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
          </div>

          {/* Items table — overflow-visible so dropdown isn't clipped */}
          <div className="px-2 py-2 overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100">
                  <th className="px-2 py-2 text-left w-8 font-semibold">#</th>
                  <th className="px-2 py-2 text-left font-semibold">Product</th>
                  <th className="px-2 py-2 text-right w-16 font-semibold">
                    Qty
                  </th>
                  <th className="px-2 py-2 text-left w-20 font-semibold">
                    Unit
                  </th>
                  <th className="px-2 py-2 text-right w-24 font-semibold">
                    Rate
                  </th>
                  <th className="px-2 py-2 text-left w-16 font-semibold">
                    Tax%
                  </th>
                  <th className="px-2 py-2 text-right w-28 font-semibold">
                    Discount
                  </th>
                  <th className="px-2 py-2 text-right w-24 font-semibold">
                    Total
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              {/* No overflow-hidden here — dropdown needs to escape */}
              <tbody>
                {rows.map((row, idx) => {
                  const q = productSearch[idx] ?? "";
                  const filtered = filteredProducts(q);
                  return (
                    <tr
                      key={idx}
                      className="border-b border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-2 py-1.5 text-slate-400 text-xs text-center">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-1.5">
                        {/* Input — no relative wrapper, position tracked via ref + portal */}
                        <div className="relative">
                          <input
                            ref={(el) => {
                              inputRefs.current[idx] = el;
                            }}
                            className="w-full h-8 px-2 pr-7 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
                            placeholder="Search product…"
                            value={openSearchIdx === idx ? q : row.name || ""}
                            onChange={(e) => {
                              setProductSearch((prev) => ({
                                ...prev,
                                [idx]: e.target.value,
                              }));
                              setOpenSearchIdx(idx);
                            }}
                            onFocus={() => setOpenSearchIdx(idx)}
                          />
                          <Search className="absolute right-2 top-2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          className="w-full h-8 px-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition text-right"
                          value={row.quantity || ""}
                          onChange={(e) =>
                            updateRow(idx, {
                              quantity: Number(e.target.value) || 0,
                            })
                          }
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className="h-8 px-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-sky-400 w-full transition"
                          value={row.unit}
                          onChange={(e) =>
                            updateRow(idx, { unit: e.target.value })
                          }
                        >
                          {["NOS", "KG", "LTR", "MTR"].map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          className="w-full h-8 px-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition text-right"
                          value={row.rate || ""}
                          onChange={(e) =>
                            updateRow(idx, {
                              rate: Number(e.target.value) || 0,
                            })
                          }
                          min={0}
                          step={0.01}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className="h-8 px-1 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-sky-400 w-full transition"
                          value={row.taxPercent}
                          onChange={(e) =>
                            updateRow(idx, {
                              taxPercent: e.target.value as TaxPct,
                            })
                          }
                        >
                          {TAX_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t === "NT" ? "0%" : `${t.replace("P", "")}%`}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <input
                            type="number"
                            className="w-full h-8 px-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition text-right"
                            value={row.discount || ""}
                            onChange={(e) =>
                              updateRow(idx, {
                                discount: Number(e.target.value) || 0,
                              })
                            }
                            min={0}
                            step={0.01}
                          />
                          <select
                            className="h-8 px-1 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-sky-400 transition"
                            value={row.discountType}
                            onChange={(e) =>
                              updateRow(idx, {
                                discountType: e.target.value as DiscountType,
                              })
                            }
                          >
                            <option value="ABS">₹</option>
                            <option value="PCT">%</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-800 tabular-nums">
                        ₹{(row.billedValue || 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => removeRow(idx)}
                          className="p-1 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <button
              onClick={addRow}
              className="mt-2 ml-2 flex items-center gap-1.5 px-3 py-1.5 text-sm text-sky-500 hover:bg-sky-50 rounded-lg transition cursor-pointer font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>
              Subtotal:{" "}
              <strong className="text-slate-800">₹{subTotal.toFixed(2)}</strong>
            </span>
            {discount > 0 && (
              <span className="text-rose-500 font-medium">
                − ₹{discount.toFixed(2)}
              </span>
            )}
            <span className="font-semibold text-slate-900 text-base">
              Total: ₹{grandTotal.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {errors.length > 0 && (
              <span className="text-xs text-rose-500">{errors.join(" ")}</span>
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
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? "Update" : "Save"} Quotation
            </button>
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
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-sky-50 flex items-center justify-between cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                  onMouseDown={() => selectProduct(openSearchIdx, p)}
                >
                  <span className="font-medium text-slate-800 truncate">
                    {p.name}
                  </span>
                  <span className="text-xs text-slate-400 ml-2 shrink-0 font-mono">
                    {p.code}
                  </span>
                </button>
              ))}
            </div>
          );
        })()}
    </>
  );
}
