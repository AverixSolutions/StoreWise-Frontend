// src/lib/barcode/buildLabelRows.ts
import type { LabelPrintRow } from "./labelPrintTypes";

type BatchLike = {
  id: string;
  productId: string;
  barcode?: string | null;
  batchNo?: string | null;
  salePrice?: number | null;
  mrp?: number | null;
  productName?: string | null;
  name?: string | null;
};

export function buildLabelRowsFromBatches(
  items: BatchLike[],
  copies = 1,
): LabelPrintRow[] {
  return items
    .filter((item) => String(item.barcode || "").trim())
    .map((item) => ({
      productId: item.productId,
      batchId: item.id,
      barcode: String(item.barcode || "").trim(),
      itemName: item.productName || item.name || "",
      salePrice: item.salePrice ?? null,
      mrp: item.mrp ?? null,
      batchNo: item.batchNo ?? null,
      copies,
    }));
}
