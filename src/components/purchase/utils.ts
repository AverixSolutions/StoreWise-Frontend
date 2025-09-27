// src/components/purchase/utils.ts
import { HeaderForm, ItemRow } from "./types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toLocalInput(iso: string) {
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

export function fromLocalInput(s: string) {
  try {
    return new Date(s).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function toDateInput(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return "";
  }
}

export function fromDateInput(s?: string) {
  if (!s) return null;
  try {
    return new Date(s).toISOString();
  } catch {
    return null;
  }
}

export function createEmptyRow(lineNo: number): ItemRow {
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

export function taxPercentToNumber(t: ItemRow["taxPercent"]) {
  if (t === "NT") return 0;
  return Number(String(t).replace("P", "")) || 0;
}

export function calcRow(row: ItemRow): ItemRow {
  const qty = Math.max(0, Number(row.quantity) || 0);
  const rate = Math.max(0, Number(row.rate) || 0);
  const taxPct = taxPercentToNumber(row.taxPercent);
  const taxAmount = round2(rate * qty * (taxPct / 100));
  const preTax = round2(rate * qty);
  const totalCost = round2(preTax + taxAmount);

  const basePerUnit = round2(rate + taxAmount / Math.max(1, qty));

  let salePrice =
    row.profitPercent && row.profitPercent > 0
      ? round2(basePerUnit * (1 + row.profitPercent / 100))
      : round2(row.salePrice ?? 0);

  const profit = round2(salePrice ? salePrice - basePerUnit : 0);

  const discountValue =
    row.discountType === "PCT"
      ? round2(totalCost * (Math.max(0, Math.min(100, row.discount)) / 100))
      : Math.max(0, Number(row.discount) || 0);

  const billedValue = round2(Math.max(0, totalCost - discountValue));

  return {
    ...row,
    salePrice: salePrice,
    profit: profit,
    totalCost: totalCost,
    billedValue: billedValue,
  };
}

export function validateBill(
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

export function mapItems(rows: ItemRow[]) {
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
      taxAmount: round2((r.totalCost || 0) - r.rate * r.quantity),
      discount:
        r.discountType === "PCT"
          ? round2(
              (r.totalCost || 0) *
                (Math.max(0, Math.min(100, r.discount)) / 100)
            )
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
