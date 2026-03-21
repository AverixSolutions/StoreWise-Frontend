// src/lib/print/printSaleBill.ts
import { getShopProfile } from "./getShopProfile";
import { buildThermalReceiptHtml } from "./buildThermalReceiptHtml";

export async function printSaleBill(
  saleId: string,
  options?: {
    preview?: boolean;
    silent?: boolean;
  },
) {
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

  const totalQty = items.reduce(
    (sum: number, it: any) => sum + Number(it.quantity || 0),
    0,
  );

  const html = buildThermalReceiptHtml({
    shop,
    billNo: sale.billNo || sale.slNo || "",
    date: sale.saleDate,
    time: sale.entryTime || sale.saleDate,
    customerPhone: sale.customerMobile || sale.customerPhone || "",
    items: items.map((it: any, index: number) => ({
      lineNo: it.lineNo ?? index + 1,
      name: it.productName || it.name || "",
      qty: Number(it.quantity || 0),
      rate: Number(it.salePrice ?? it.rate ?? 0),
      total: Number(it.billedValue || 0),
    })),
    totalQty,
    subTotal,
    discount,
    grandTotal,
    notes: [
      "HAVE A NICE DAY",
      "EXCHANGE WITHIN 7 DAYS ONLY",
      "NO COLOUR GUARANTEE FOR COTTON GARMENTS",
      "BILL AND PRODUCT PRICE TAG REQUIRED FOR EXCHANGE",
      "NO REFUND",
    ],
  });

  return api.printHtml(html, {
    preview: options?.preview ?? true,
    silent: options?.silent ?? false,
    pageSize: {
      width: 80000,
      height: 200000,
    },
  });
}
