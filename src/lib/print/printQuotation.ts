// src/lib/print/printQuotation.ts
import { platform } from "@/platform";
import { getShopProfile } from "./getShopProfile";
import { buildInvoiceHtml } from "./buildInvoiceHtml";

export async function printQuotation(
  quotationId: string,
  overrides?: { preview?: boolean },
) {
  const res = await platform.getQuotationFull?.(quotationId);
  if (!res?.success) throw new Error((res as any)?.error || "Failed to load quotation");

  const { quotation, items } = res as any;
  const shop = await getShopProfile();

  const subTotal = items.reduce(
    (s: number, it: any) => s + Number(it.billedValue || 0),
    0,
  );
  const discount = Number(quotation.discount || 0);
  const grandTotal = Math.max(0, subTotal - discount);

  const html = buildInvoiceHtml({
    shop,
    document: {
      title: "QUOTATION / PROFORMA INVOICE",
      entryNo: quotation.quotationNo ?? quotation.slNo,
      billNo: quotation.quotationNo,
      date: quotation.quotationDate,
      time: quotation.entryTime || quotation.quotationDate,
      department: quotation.department,
      natureOfEntry: quotation.natureOfEntry,
    },
    party: {
      label: "Customer",
      name: quotation.customerName,
    },
    items: items.map((it: any, i: number) => ({
      lineNo: it.lineNo ?? i + 1,
      name: it.productName || it.name || "",
      barcode: it.barcode,
      batchNo: it.batchNo,
      expiryDate: it.expiryDate,
      qty: Number(it.quantity || 0),
      unit: it.unit,
      rate: Number(it.salePrice ?? it.rate ?? 0),
      taxPercent: it.taxPercent,
      mrp: it.mrp ?? null,
      salePrice: it.salePrice ?? null,
      amount: Number(it.billedValue || 0),
    })),
    subTotal,
    discount,
    grandTotal,
    notes: quotation.notes ?? undefined,
  });

  const isDesktop = !!(window as any).electronAPI;

  if (isDesktop) {
    return (window as any).electronAPI.printHtml(html, {
      preview: overrides?.preview ?? true,
      silent: false,
      pageSize: "A4",
      title: `Quotation — ${quotation.quotationNo ?? quotation.slNo ?? ""}`,
    });
  }

  const win = window.open("", "_blank");
  if (!win) throw new Error("Print blocked — allow popups and try again.");
  win.document.write(html);
  win.document.close();
  win.focus();
  return { success: true };
}
