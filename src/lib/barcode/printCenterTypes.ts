// src/lib/barcode/printCenterTypes.ts
import type { LabelPrintEngine } from "@/lib/barcode/labelPrintTypes";

export type PrintCenterMode = "DEFAULT" | "LABEL";

export type PrintCenterItemRow = {
  productId: string;
  batchId?: string;
  itemName: string;
  barcode: string;
  batchNo?: string | null;
  salePrice?: number | null;
  mrp?: number | null;
  copies: number;
};

export type DefaultPrintSettings = {
  shopName: string;
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  showShopName: boolean;
  showName: boolean;
  showSalePrice: boolean;
  showMrp: boolean;
  barcodeHeight: number;
  fontSizeShop: number;
  fontSizeName: number;
  fontSizeMeta: number;
};

export type LabelModeSettings = {
  engine: LabelPrintEngine;
  printerId?: string;
  templateId?: string;
  copiesOverride?: string;
};
