// src/lib/print/printPurchaseBill.ts
import { getShopProfile } from "./getShopProfile";
import { buildInvoiceHtml } from "./buildInvoiceHtml";

export async function printPurchaseBill(
  purchaseId: string,
  options?: {
    preview?: boolean;
    silent?: boolean;
  },
) {
  const api = (window as any).electronAPI;

  if (!api?.getPurchaseFull || !api?.printHtml) {
    throw new Error("Purchase print API not available");
  }

  const res = await api.getPurchaseFull(purchaseId);
  if (!res?.success) {
    throw new Error(res?.error || "Failed to load purchase");
  }

  const { purchase, items } = res;
  const shop = await getShopProfile();

  const subTotal = items.reduce(
    (sum: number, it: any) => sum + Number(it.billedValue || 0),
    0,
  );
  const discount = Number(purchase.discount || 0);
  const grandTotal = Math.max(0, subTotal - discount);

  const html = buildInvoiceHtml({
    shop,
    document: {
      title: "Purchase Bill",
      entryNo: purchase.slNo,
      billNo: purchase.billNo,
      date: purchase.purchaseDate,
      time: purchase.entryTime,
      department: purchase.department,
      debitAccount: purchase.debitAccount,
      natureOfEntry: purchase.natureOfEntry,
      typeLabel: purchase.purchaseType,
    },
    party: {
      label: "Supplier",
      name: purchase.supplierName,
    },
    items: items.map((it: any, index: number) => ({
      lineNo: it.lineNo ?? index + 1,
      name: it.productName || "",
      barcode: it.barcode,
      batchNo: it.batchNo,
      expiryDate: it.expiryDate,
      qty: Number(it.quantity || 0),
      unit: it.unit,
      rate: Number(it.rate || 0),
      taxPercent: it.taxPercent,
      mrp: it.mrp ?? null,
      salePrice: it.salePrice ?? null,
      amount: Number(it.billedValue || 0),
    })),
    subTotal,
    discount,
    grandTotal,
  });

  return api.printHtml(html, {
    preview: options?.preview ?? true,
    silent: options?.silent ?? false,
    pageSize: "A4",
  });
}
