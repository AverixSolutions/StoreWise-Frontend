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
    overrideBatchPrices: false,
  };
}

export function taxPercentToNumber(t: ItemRow["taxPercent"]) {
  if (t === "NT") return 0;
  return Number(String(t).replace("P", "")) || 0;
}

export function calcRow(row: ItemRow): ItemRow {
  if (row.lineType === "FREE") {
    return {
      ...row,
      billedValue: 0,
      totalCost: 0,
      profit: 0,
      unitBilled: 0,
    };
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

  return {
    ...row,
    salePrice: salePrice,
    profit: profit,
    totalCost: totalCost,
    billedValue: billedValue,
    unitBilled,
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
      profitPercent: r.profitPercent || 0,
      salePrice: r.salePrice || null,
      profit: r.profit || null,
      totalCost: r.totalCost || 0,
      billedValue: r.billedValue || 0,
      batchNo: r.batchNo || null,
      mfgDate: r.mfgDate || null,
      expiryDate: r.expiryDate || null,
      isFree: r.lineType === "FREE" ? 1 : 0,
      lineNo: r.lineNo ?? i + 1,
      overrideBatchPrices: r.overrideBatchPrices === true,
    }));
}

export function toLocalDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function toLocalTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromDateTime(date: string, time: string) {
  if (!date) return new Date().toISOString();
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return new Date(`${date}T${t}`).toISOString();
}

export function validatePurchaseBill(header: HeaderForm, items: ItemRow[]) {
  const errs: string[] = [];
  const hasLine = items.some(
    (r) => r.productId && (r.quantity ?? 0) > 0 && (r.rate ?? 0) >= 0
  );
  if (!hasLine) errs.push("Add at least one item with quantity > 0.");

  if (!header.supplier) errs.push("Select a supplier.");

  return errs;
}

export function validateReturnBill(_header: HeaderForm, items: ItemRow[]) {
  const errs: string[] = [];
  const hasLine = items.some(
    (r) => r.productId && (r.quantity ?? 0) > 0 && (r.rate ?? 0) >= 0
  );
  if (!hasLine) errs.push("Add at least one item with quantity > 0.");

  return errs;
}

// Map purchase_items / purchase_return_items to ItemRow[]
export function rowsFromDbItems(dbItems: any[]): ItemRow[] {
  return dbItems.map((it: any, i: number) => ({
    lineNo: it.lineNo ?? i + 1,
    productId: it.productId,
    code: "", // optional
    barcode: it.barcode ?? "",
    name: "", // you show just code/name after onSelectProduct; optional here
    unit: it.unit,
    rate: Number(it.rate) || 0,
    quantity: Number(it.quantity) || 0,
    mrp: it.mrp ?? null,
    taxPercent: it.taxPercent,
    discountType: it.discountType,
    discount: Number(it.discount) || 0,
    profitPercent: it.profit ?? null, // or keep it as separate field if you used profitPercent
    salePrice: it.salePrice ?? null,
    profit: it.profit ?? null,
    totalCost: Number(it.totalCost) || 0,
    billedValue: Number(it.billedValue) || 0,
    batchNo: it.batchNo ?? null,
    mfgDate: it.mfgDate ?? null,
    expiryDate: it.expiryDate ?? null,
    lineType: (it.isFree ? "FREE" : "VALUED") as any,
    unitBilled: it.quantity
      ? Number(it.billedValue || 0) / Number(it.quantity || 1)
      : 0,
  }));
}

// Normalize purchase header from DB to HeaderForm (purchase)
export function headerFromPurchaseDb(
  p: any,
  supplierOpt: Array<{ id: string; name: string }>
): HeaderForm {
  const sup = p.supplierId
    ? supplierOpt.find((s) => s.id === p.supplierId) || {
        id: p.supplierId,
        name: p.supplierName || "",
      }
    : null;
  return {
    billNo: p.billNo || "",
    supplier: sup,
    department: p.department || "",
    debitAccount: p.debitAccount || "",
    natureOfEntry: p.natureOfEntry || "",
    purchaseDate: p.purchaseDate,
    entryTime: p.entryTime || p.purchaseDate,
    discount: Number(p.discount || 0),
    purchaseType: p.purchaseType === "CASH" ? "CASH" : "CREDIT",
  };
}

// For returns, reuse HeaderForm but map date field from returnDate
export function headerFromReturnDb(
  r: any,
  supplierOpt: Array<{ id: string; name: string }>
): HeaderForm {
  const sup = r.supplierId
    ? supplierOpt.find((s) => s.id === r.supplierId) || {
        id: r.supplierId,
        name: r.supplierName || "",
      }
    : null;
  return {
    billNo: r.billNo || "",
    supplier: sup,
    department: r.department || "",
    debitAccount: r.debitAccount || "",
    natureOfEntry: r.natureOfEntry || "",
    purchaseDate: r.returnDate, // reuse purchaseDate field to drive inputs
    entryTime: r.entryTime || r.returnDate,
    discount: Number(r.discount || 0),
    purchaseType: r.purchaseType === "CASH" ? "CASH" : "CREDIT",
  };
}
