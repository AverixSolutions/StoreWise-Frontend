// src/lib/barcode/printBarcodes.ts
import { buildBarcodePrintHtml } from "./printBarcodeHtml";
import type { BarcodePrintItem, BarcodePrintOptions } from "./barcodeTemplates";

export async function printBarcodes(
  items: BarcodePrintItem[],
  options?: BarcodePrintOptions,
) {
  const html = buildBarcodePrintHtml(items, options);

  if (!(window as any).electronAPI?.printHtml) {
    throw new Error("printHtml API not available");
  }

  return (window as any).electronAPI.printHtml(html, {
    preview: false,
    pageSize: "A4",
  });
}
