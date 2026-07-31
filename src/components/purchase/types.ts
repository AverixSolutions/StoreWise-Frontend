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
export type TransactionMode = "PURCHASE" | "SALE" | "QUOTATION" | "RETURN";

export type AvailableNamedRate = {
  rateTypeId: string;
  code: string;
  name: string;
  amount: number | null;
  configured: boolean;
  isDefault?: boolean;
};

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

  batchId?: string | null;
  batchNo?: string | null;
  purchaseBatchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;

  lineType?: LineType;
  unitBilled?: number;

  originalRate?: number | null;
  originalSalePrice?: number | null;
  appliedRate?: number | null;
  offerId?: string | null;
  offerName?: string | null;
  offerType?: string | null;
  offerDiscountAmount?: number;
  offerMessage?: string | null;
  offerMeta?: string | null;

  overrideBatchPrices?: boolean;
  forceNewBatch?: boolean;
  printBarcode?: boolean;

  appliedQuantity?: number;
  overReturnQuantity?: number;
  overReturnReason?: string | null;
  rateTypeId?: string | null;
  rateTypeCode?: string | null;
  rateTypeName?: string | null;
  rateSource?: "MASTER" | "CUSTOM" | "LEGACY";
  availableRates?: AvailableNamedRate[];
  sellingRatesJson?: string | null;
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
  typeId?: string | null;
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
