// src/lib/barcode/labelPrintTypes.ts
export type LabelPrintEngine = "BARTENDER" | "ZPL" | "HTML";

export type LabelPrintRow = {
  productId: string;
  batchId?: string;
  barcode: string;
  itemName?: string;
  salePrice?: number | null;
  mrp?: number | null;
  batchNo?: string | null;
  copies?: number;
};

export type LabelPrintRequest = {
  licenseId: string;
  printerId?: string;
  templateId?: string;
  engine?: LabelPrintEngine;
  rows: LabelPrintRow[];
};
