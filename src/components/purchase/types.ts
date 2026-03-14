// src/components/purchase/types.ts
export interface Product {
  id: string;
  code: string;
  name: string;
  unit: "KG" | "NOS" | "LTR" | "MTR";
  tax: "NT" | "P5" | "P12" | "P18" | "P28";
  costPrice: number;
  salePrice?: number | null;
  mrp?: number | null;
  barcode?: string | null;
}

export type DiscountType = "ABS" | "PCT";

export type PurchaseType = "CASH" | "CREDIT";

export type LineType = "VALUED" | "FREE";

export interface ItemRow {
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
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineType?: LineType;
  unitBilled?: number;
  overrideBatchPrices?: boolean;
  forceNewBatch?: boolean;
  printBarcode?: boolean;
}

export interface HeaderForm {
  billNo: string;
  supplier: { id: string; name: string } | null;
  department: string;
  debitAccount: string;
  natureOfEntry: string;
  purchaseDate: string;
  entryTime: string;
  discount: number;
  purchaseType: PurchaseType;
}

export interface BatchInfo {
  id: string;
  barcode?: string | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  costPrice?: number | null;
  stock?: number | null;
}
