// src/lib/print/printSaleBill.ts
import { getShopProfile } from "./getShopProfile";
import { buildInvoiceHtml } from "./buildInvoiceHtml";

export async function printSaleBill(saleId: string) {
  const api = (window as any).electronAPI;
  if (!api?.getSaleFull || !api?.printHtml) {
    throw new Error("Sale print API not available");
  }

  const res = await api.getSaleFull(saleId);
  if (!res?.success) {
    throw new Error(res?.error || "Failed to load sale");
  }

  const { sale, items } = res;
  const shop = await getShopProfile();

  const subTotal = items.reduce(
    (sum: number, it: any) => sum + Number(it.billedValue || 0),
    0,
  );
  const discount = Number(sale.discount || 0);
  const grandTotal = Math.max(0, subTotal - discount);

  const html = buildInvoiceHtml({
    shop,
    document: {
      title: "Sale Bill",
      entryNo: sale.slNo,
      billNo: sale.billNo,
      date: sale.saleDate,
      time: sale.entryTime,
      department: sale.department,
      debitAccount: sale.debitAccount,
      natureOfEntry: sale.natureOfEntry,
      typeLabel: sale.saleType,
    },
    party: {
      label: "Customer",
      name: sale.customerName,
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
    preview: false,
    pageSize: "A4",
  });
}
