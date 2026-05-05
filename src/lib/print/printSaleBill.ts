// src/lib/print/printSaleBill.ts
import { platform } from "@/platform";
import { getShopProfile } from "./getShopProfile";
import { buildThermalReceiptHtml } from "./buildThermalReceiptHtml";

export async function printSaleBill(
  saleId: string,
  options?: {
    preview?: boolean;
    silent?: boolean;
  },
) {
  // ── 1. Fetch sale data via platform (works on both web & desktop) ──
  const res = await platform.getSaleFull?.(saleId);
  if (!res?.success) {
    throw new Error(res?.error || "Failed to load sale");
  }

  const { sale, items } = res as any;
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

  // ── 2. Desktop: delegate to Electron's native print ──
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.printHtml) {
    return electronAPI.printHtml(html, {
      preview: options?.preview ?? true,
      silent: options?.silent ?? false,
      pageSize: {
        width: 80000,
        height: 200000,
      },
    });
  }

  // ── 3. Web fallback: open receipt in a new tab and trigger browser print ──
  const win = window.open("", "_blank");
  if (!win) {
    throw new Error(
      "Print blocked: please allow popups for this site and try again.",
    );
  }

  win.document.write(html);
  win.document.close();

  if (options?.preview === false) {
    // silent/auto-print: trigger print dialog immediately
    win.addEventListener("load", () => {
      win.focus();
      win.print();
    });
    // fallback if load already fired before listener attached
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {}
    }, 600);
  } else {
    // preview mode: just show the tab, user prints manually
    win.focus();
  }

  return { success: true };
}
