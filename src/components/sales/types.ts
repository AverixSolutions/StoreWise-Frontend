// src/components/sales/types.ts
export type DiscountType = "ABS" | "PCT";
export type SaleType = "CASH" | "CREDIT";
export type LineType = "VALUED" | "FREE";

export interface Customer {
  id: string;
  name: string;
}

export interface BatchInfo {
  id: string;
  barcode?: string | null;
  batchNo?: string | null;
  purchaseBatchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  costPrice?: number | null;
  stock?: number | null;
}

export interface ItemRow {
  lineNo: number;
  productId: string;
  code?: string;
  barcode?: string;
  name?: string;
  unit: "KG" | "NOS" | "LTR" | "MTR" | "";
  rate: number;
  quantity: number;
  mrp?: number | null;
  taxPercent: "NT" | "P5" | "P12" | "P18" | "P28";
  discountType: DiscountType;
  discount: number;
  profitPercent?: number;
  salePrice?: number | null;
  profit?: number | null;
  totalCost?: number | null;
  billedValue?: number | null;
  batchId?: string | null;
  batchNo?: string | null;
  purchaseBatchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineType?: LineType;
  unitBilled?: number;
}

export interface HeaderForm {
  billNo: string;
  customer: Customer | null;
  department: string;
  debitAccount: string;
  natureOfEntry: string;
  saleDate: string;
  entryTime: string;
  discount: number;
  saleType: SaleType;
}
