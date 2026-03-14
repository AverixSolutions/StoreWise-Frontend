// src/lib/barcode/barcodeTemplates.ts
export type BarcodePrintItem = {
  code: string;
  name?: string;
  salePrice?: number | null;
  mrp?: number | null;
  copies?: number;
};

export type BarcodePrintOptions = {
  shopName?: string;
  pageTitle?: string;
  labelWidthMm?: number;
  labelHeightMm?: number;
  columns?: number;
  showShopName?: boolean;
  showName?: boolean;
  showSalePrice?: boolean;
  showMrp?: boolean;
  barcodeHeight?: number;
  fontSizeShop?: number;
  fontSizeName?: number;
  fontSizeMeta?: number;
};

export function expandCopies(items: BarcodePrintItem[]): BarcodePrintItem[] {
  const out: BarcodePrintItem[] = [];

  for (const item of items) {
    const copies = Math.max(1, Number(item.copies || 1));
    for (let i = 0; i < copies; i++) {
      out.push({
        code: String(item.code || "").trim(),
        name: item.name || "",
        salePrice: item.salePrice ?? null,
        mrp: item.mrp ?? null,
        copies: 1,
      });
    }
  }

  return out.filter((x) => x.code);
}
