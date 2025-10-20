// src/components/sales/utils.ts
import { HeaderForm, ItemRow } from "./type";

export const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export function createEmptyRow(lineNo: number): ItemRow {
  return {
    lineNo,
    productId: "",
    code: "",
    name: "",
    barcode: "",
    unit: "NOS",
    quantity: 0,
    rate: 0,
    mrp: 0,
    taxPercent: "NT",
    discountType: "ABS",
    discount: 0,
    salePrice: 0,
    profitPercent: 0,
    batchNo: "",
    mfgDate: null,
    expiryDate: null,
    lineType: "VALUED",
    billedValue: 0,
    profit: 0,
    totalCost: 0,
    unitBilled: 0,
  };
}

export const taxPercentToNumber = (t: ItemRow["taxPercent"]) =>
  t === "NT" ? 0 : Number(String(t).replace("P", "")) || 0;

export function calcRow(row: ItemRow): ItemRow {
  if (row.lineType === "FREE") {
    return { ...row, billedValue: 0, totalCost: 0, profit: 0, unitBilled: 0 };
  }
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
  const unitBilled = qty > 0 ? round2(billedValue / qty) : 0;

  return { ...row, salePrice, profit, totalCost, billedValue, unitBilled };
}

export function mapItems(rows: ItemRow[]) {
  return rows
    .filter((r) => r.productId)
    .map((r, i) => ({
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
      salePrice: r.salePrice || null,
      profit: r.profit || null,
      totalCost: r.totalCost || 0,
      billedValue: r.billedValue || 0,
      batchNo: r.batchNo || null,
      mfgDate: r.mfgDate || null,
      expiryDate: r.expiryDate || null,
      isFree: r.lineType === "FREE" ? 1 : 0,
      lineNo: r.lineNo ?? i + 1,
    }));
}

export function validateSaleBill(header: HeaderForm, items: ItemRow[]) {
  const errs: string[] = [];
  const hasLine = items.some(
    (r) => r.productId && (r.quantity ?? 0) > 0 && (r.rate ?? 0) >= 0
  );
  if (!hasLine) errs.push("Add at least one item with quantity > 0.");
  if (header.saleType === "CREDIT" && !header.customer)
    errs.push("Select a customer for CREDIT sales.");
  return errs;
}

export const toLocalDate = (iso?: string) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : "";
export const toLocalTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromDateTime = (date: string, time: string) =>
  new Date(
    `${date || new Date().toISOString().slice(0, 10)}T${time || "00:00"}`
  ).toISOString();
