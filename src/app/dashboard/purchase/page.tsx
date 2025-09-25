// src/app/dashboard/purchase/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import SupplierPicker from "@/components/suppliers/SupplierPicker";
import { useRouter } from "next/navigation";

// --- Types ---
interface Product {
  id: string;
  code: string;
  name: string;
  unit: "KG" | "NOS" | "LTR" | "MTR";
  tax: "NT" | "P5" | "P12" | "P18" | "P28";
  costPrice: number;
  salePrice?: number | null;
  barcode?: string | null;
}

type DiscountType = "ABS" | "PCT";

interface ItemRow {
  lineNo: number;
  productId: string;
  code?: string;
  barcode?: string;
  name?: string;
  unit: Product["unit"] | "";
  rate: number;
  quantity: number;
  mrp?: number | null;
  taxPercent: Product["tax"];
  discountType: DiscountType;
  discount: number;
  profitPercent?: number;
  salePrice?: number | null;
  profit?: number | null;
  totalCost?: number | null;
  billedValue?: number | null;
  batchNo?: string;
  mfgDate?: string | null;
  expiryDate?: string | null;
}

interface HeaderForm {
  billNo: string;
  supplier: { id: string; name: string } | null;
  department: string;
  debitAccount: string;
  natureOfEntry: string;
  purchaseDate: string;
  entryTime: string;
  discount: number;
}

function toLocalInput(iso: string) {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}
function fromLocalInput(s: string) {
  try {
    return new Date(s).toISOString();
  } catch {
    return new Date().toISOString();
  }
}
function toDateInput(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return "";
  }
}
function fromDateInput(s?: string) {
  if (!s) return null;
  try {
    return new Date(s).toISOString();
  } catch {
    return null;
  }
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
  const [header, setHeader] = useState<HeaderForm>({
    billNo: "",
    supplier: null,
    department: "",
    debitAccount: "",
    natureOfEntry: "",
    purchaseDate: new Date().toISOString(),
    entryTime: new Date().toISOString(),
    discount: 0,
  });

  const [rows, setRows] = useState<ItemRow[]>([createEmptyRow(1)]);

  useEffect(() => {
    (async () => {
      const res = await (window as any).electronAPI.getProducts(licenseId, {
        page: 1,
        pageSize: 200,
      });
      setProducts(res.products);
    })();
  }, [licenseId]);

  function createEmptyRow(lineNo: number): ItemRow {
    return {
      lineNo,
      productId: "",
      unit: "",
      rate: 0,
      quantity: 1,
      mrp: null,
      taxPercent: "NT",
      discountType: "ABS",
      discount: 0,
      profitPercent: 0,
      salePrice: 0,
      profit: 0,
      totalCost: 0,
      billedValue: 0,
      barcode: "",
      batchNo: "",
      mfgDate: null,
      expiryDate: null,
    };
  }

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
      }))
    ),
  ]);

  function taxPercentToNumber(t: ItemRow["taxPercent"]) {
    if (t === "NT") return 0;
    return Number(String(t).replace("P", "")) || 0;
  }

  function calcRow(row: ItemRow): ItemRow {
    const qty = Math.max(0, Number(row.quantity) || 0);
    const rate = Math.max(0, Number(row.rate) || 0);
    const taxPct = taxPercentToNumber(row.taxPercent);
    const taxAmount = rate * qty * (taxPct / 100);
    const preTax = rate * qty;
    const totalCost = preTax + taxAmount;

    const basePerUnit = rate + taxAmount / Math.max(1, qty);

    let salePrice =
      row.profitPercent && row.profitPercent > 0
        ? basePerUnit * (1 + row.profitPercent / 100)
        : row.salePrice ?? 0;

    const profit = salePrice ? salePrice - basePerUnit : 0;

    const discountValue =
      row.discountType === "PCT"
        ? totalCost * (Math.max(0, Math.min(100, row.discount)) / 100)
        : Math.max(0, Number(row.discount) || 0);

    const billedValue = Math.max(0, totalCost - discountValue);

    return {
      ...row,
      salePrice: Number(salePrice || 0),
      profit: Number(profit || 0),
      totalCost: Number(totalCost || 0),
      billedValue: Number(billedValue || 0),
    };
  }

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

  function round2(n: number) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function validateBill(
    header: HeaderForm,
    itemsMapped: ReturnType<typeof mapItems>
  ) {
    const errors: string[] = [];
    if (!header.supplier) errors.push("Select a supplier.");
    if (!itemsMapped.length) errors.push("Add at least one item.");

    itemsMapped.forEach((it, i) => {
      const line = i + 1;
      if (!it.productId) errors.push(`Line ${line}: select a product.`);
      if (!it.unit) errors.push(`Line ${line}: unit is required.`);
      if (Number(it.quantity) <= 0)
        errors.push(`Line ${line}: quantity must be > 0.`);
      if (Number(it.rate) < 0)
        errors.push(`Line ${line}: rate cannot be negative.`);
    });

    return errors;
  }

  function mapItems(rows: ItemRow[]) {
    return rows
      .filter((r) => r.productId)
      .map((r) => ({
        productId: r.productId,
        barcode: r.barcode || r.code,
        quantity: r.quantity,
        unit: r.unit,
        rate: r.rate,
        mrp: r.mrp || null,
        taxPercent: r.taxPercent,
        taxAmount: (r.totalCost || 0) - r.rate * r.quantity,
        discount:
          r.discountType === "PCT"
            ? (r.totalCost || 0) *
              (Math.max(0, Math.min(100, r.discount)) / 100)
            : r.discount,
        discountType: r.discountType,
        profitPercent: r.profitPercent || 0,
        salePrice: r.salePrice || null,
        profit: r.profit || null,
        totalCost: r.totalCost || 0,
        billedValue: r.billedValue || 0,
        batchNo: r.batchNo || null,
        mfgDate: r.mfgDate || null,
        expiryDate: r.expiryDate || null,
        lineNo: r.lineNo,
      }));
  }

  const handleSave = async () => {
    const items = mapItems(rows);
    const errs = validateBill(header, items);
    if (errs.length) {
      alert("Please fix the following:\n\n• " + errs.join("\n• "));
      return false;
    }

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
    };

    const res = await (window as any).electronAPI.createPurchase(
      purchase,
      items
    );

    if (res?.success) {
      alert(`✅ Saved! SlNo: ${res.slNo}, Total: ${res.totalAmount}`);

      if (priceUpdateSettings.updatePricesAfterSave) {
        const priceUpdates = rows
          .filter(
            (r) =>
              r.productId &&
              (priceUpdateSettings.updateCostFromPurchase || // we may want to push cost anyway
                (typeof r.salePrice === "number" && r.salePrice > 0) || // user typed a sale price
                (r.profitPercent ?? 0) > 0) // or we auto-compute from profit%
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
              salePrice: sale > 0 ? sale : undefined, // only push when meaningful
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

  const [isDirty, setIsDirty] = useState(false);

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
    });
    setRows([createEmptyRow(1)]);
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

    const save = window.confirm(
      "You have unsaved changes.\n\nOK = Save & Exit\nCancel = Choose without saving"
    );
    if (save) {
      const ok = await handleSave();
      if (ok) router.push(path);
    } else {
      const exit = window.confirm("Exit without saving?");
      if (exit) {
        resetAll();
        router.push(path);
      }
    }
  }

  // UI
  return (
    <div className="h-[calc(100vh-72px)] flex flex-col">
      {/* Local sticky nav */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => tryNavigate("/dashboard")}
            className="text-sm text-gray-700 hover:underline"
          >
            ← Back to Dashboard
          </button>
          <button
            onClick={() => tryNavigate("/dashboard/purchase-return")}
            className="text-sm text-gray-700 hover:underline"
          >
            Go to Purchase Return →
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="grid h-full grid-cols-12 gap-4">
          {/* Left: Bill */}
          <section className="col-span-4 bg-white rounded-2xl shadow p-4 space-y-4 overflow-y-auto">
            <h2 className="text-lg font-semibold">Purchase Bill</h2>

            <div className="grid grid-cols-2 gap-3">
              <LabeledInput
                label="Bill No"
                value={header.billNo}
                onChange={(v: string) =>
                  setHeader((s) => ({ ...s, billNo: v }))
                }
              />
              <div>
                <label className="text-sm text-gray-600">Supplier</label>
                <SupplierPicker
                  value={header.supplier}
                  onChange={(v) => setHeader((s) => ({ ...s, supplier: v }))}
                />
              </div>

              <LabeledInput
                label="Department"
                value={header.department}
                onChange={(v: string) =>
                  setHeader((s) => ({ ...s, department: v }))
                }
              />
              <LabeledInput
                label="Debit A/c"
                value={header.debitAccount}
                onChange={(v: string) =>
                  setHeader((s) => ({ ...s, debitAccount: v }))
                }
              />

              <LabeledInput
                label="Nature of Entry"
                value={header.natureOfEntry}
                onChange={(v: string) =>
                  setHeader((s) => ({ ...s, natureOfEntry: v }))
                }
              />
              <LabeledInput
                label="Header Discount (₹)"
                type="number"
                value={String(header.discount)}
                onChange={(v: string) =>
                  setHeader((s) => ({ ...s, discount: Number(v) || 0 }))
                }
              />

              <LabeledInput
                label="Purchase Date"
                type="datetime-local"
                value={toLocalInput(header.purchaseDate)}
                onChange={(v: string) =>
                  setHeader((s) => ({ ...s, purchaseDate: fromLocalInput(v) }))
                }
              />
              <LabeledInput
                label="Entry Time"
                type="datetime-local"
                value={toLocalInput(header.entryTime)}
                onChange={(v: string) =>
                  setHeader((s) => ({ ...s, entryTime: fromLocalInput(v) }))
                }
              />
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-sm text-gray-700 space-y-1">
              <div className="flex justify-between">
                <span>Sub Total</span>
                <span>₹ {subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Header Discount</span>
                <span>- ₹ {(header.discount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-averix-red-dark">
                <span>Grand Total</span>
                <span>₹ {grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                className="bg-averix-red-vivid text-white px-5 py-2 rounded-lg shadow hover:bg-averix-red-dark"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="bg-white border px-5 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </section>

          {/* Right: Items */}
          <section className="col-span-8 bg-white rounded-2xl shadow p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Items</h2>
              <button
                onClick={addRow}
                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
              >
                + Add Row
              </button>
            </div>

            {/* Scroll both ways for many columns */}
            <div className="h-[calc(100%-44px)] overflow-x-auto overflow-y-auto">
              <table className="w-full text-sm min-w-[1200px]">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="text-left">
                    <Th>#</Th>
                    <Th>Product</Th>
                    <Th>Code</Th>
                    <Th>Barcode</Th>
                    <Th>Qty</Th>
                    <Th>Unit</Th>
                    <Th>Rate</Th>
                    <Th>MRP</Th>
                    <Th>Tax</Th>
                    <Th>Disc</Th>
                    <Th>Sale Price</Th>
                    <Th>Batch</Th>
                    <Th>MFG</Th>
                    <Th>EXP</Th>
                    <Th>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.lineNo} className="border-b">
                      <Td className="whitespace-nowrap">{r.lineNo}</Td>
                      <Td className="min-w-[16rem]">
                        <select
                          className="border rounded px-2 py-1 w-64"
                          value={r.productId}
                          onChange={(e) =>
                            handleSelectProduct(idx, e.target.value)
                          }
                        >
                          <option value="">Select...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} - {p.name}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td className="whitespace-nowrap">{r.code || ""}</Td>
                      <Td className="min-w-[10rem]">
                        <input
                          className="border rounded px-2 py-1 w-40"
                          value={r.barcode || ""}
                          onChange={(e) =>
                            updateRow(idx, { barcode: e.target.value })
                          }
                        />
                      </Td>
                      <Td>
                        <NumInput
                          value={r.quantity}
                          onChange={(v) => updateRow(idx, { quantity: v })}
                          width="w-20"
                        />
                      </Td>
                      <Td>
                        <select
                          className="border rounded px-2 py-1"
                          value={r.unit || ""}
                          onChange={(e) =>
                            updateRow(idx, { unit: e.target.value as any })
                          }
                        >
                          {(["NOS", "KG", "LTR", "MTR"] as const).map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        <NumInput
                          value={r.rate}
                          onChange={(v) => updateRow(idx, { rate: v })}
                          width="w-24"
                        />
                      </Td>
                      <Td>
                        <NumInput
                          value={r.mrp || 0}
                          onChange={(v) => updateRow(idx, { mrp: v })}
                          width="w-24"
                        />
                      </Td>
                      <Td>
                        <select
                          className="border rounded px-2 py-1"
                          value={r.taxPercent}
                          onChange={(e) =>
                            updateRow(idx, {
                              taxPercent: e.target.value as any,
                            })
                          }
                        >
                          {(["NT", "P5", "P12", "P18", "P28"] as const).map(
                            (t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            )
                          )}
                        </select>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <select
                            className="border rounded px-1 py-1"
                            value={r.discountType}
                            onChange={(e) =>
                              updateRow(idx, {
                                discountType: e.target.value as DiscountType,
                              })
                            }
                          >
                            <option value="ABS">₹</option>
                            <option value="PCT">%</option>
                          </select>
                          <NumInput
                            value={r.discount}
                            onChange={(v) => updateRow(idx, { discount: v })}
                            width="w-20"
                          />
                        </div>
                      </Td>
                      <Td>
                        <NumInput
                          value={r.salePrice || 0}
                          onChange={(v) => updateRow(idx, { salePrice: v })}
                          width="w-24"
                        />
                        <div className="text-[11px] text-gray-500">
                          (+Profit{" "}
                          <input
                            className="border rounded px-1 w-12 ml-1"
                            type="number"
                            value={r.profitPercent || 0}
                            onChange={(e) =>
                              updateRow(idx, {
                                profitPercent: Number(e.target.value),
                              })
                            }
                          />
                          %)
                        </div>
                      </Td>
                      <Td>
                        <input
                          className="border rounded px-2 py-1 w-24"
                          value={r.batchNo || ""}
                          onChange={(e) =>
                            updateRow(idx, { batchNo: e.target.value })
                          }
                        />
                      </Td>
                      <Td>
                        <input
                          type="date"
                          className="border rounded px-2 py-1"
                          value={toDateInput(r.mfgDate)}
                          onChange={(e) =>
                            updateRow(idx, {
                              mfgDate: fromDateInput(e.target.value),
                            })
                          }
                        />
                      </Td>
                      <Td>
                        <input
                          type="date"
                          className="border rounded px-2 py-1"
                          value={toDateInput(r.expiryDate)}
                          onChange={(e) =>
                            updateRow(idx, {
                              expiryDate: fromDateInput(e.target.value),
                            })
                          }
                        />
                      </Td>
                      <Td className="font-semibold whitespace-nowrap">
                        ₹ {(r.billedValue || 0).toFixed(2)}
                      </Td>
                      <Td>
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => removeRow(idx)}
                        >
                          Remove
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// --- Small UI helpers ---
function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-2 py-2 text-xs font-semibold text-gray-600 ${className}`}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-2 py-2 align-top ${className}`}>{children}</td>;
}
function NumInput({
  value,
  onChange,
  width = "w-24",
}: {
  value: number;
  onChange: (v: number) => void;
  width?: string;
}) {
  return (
    <input
      className={`border rounded px-2 py-1 ${width}`}
      type="number"
      value={Number(value) || 0}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <input
        className="border p-2 rounded w-full"
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
