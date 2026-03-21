// src/lib/barcode/printLabels.ts
import type { LabelPrintRequest } from "./labelPrintTypes";
import { printBarcodesHtmlSheet } from "./printBarcodes";

export async function printLabels(request: LabelPrintRequest) {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI) throw new Error("electronAPI not available");

  const engine = request.engine || "HTML";

  if (engine === "HTML") {
    const htmlItems = request.rows.map((row) => ({
      code: row.barcode,
      barcode: row.barcode,
      productName: row.itemName || "",
      price:
        row.salePrice !== null && row.salePrice !== undefined
          ? `₹${row.salePrice}`
          : row.mrp !== null && row.mrp !== undefined
            ? `₹${row.mrp}`
            : "",
      copies: row.copies || 1,
      batchNo: row.batchNo || "",
    }));

    return printBarcodesHtmlSheet(htmlItems);
  }

  const res = await electronAPI.printLabelsNative(request);
  if (!res?.success) {
    throw new Error(res?.error || "Label print failed");
  }

  return res;
}
