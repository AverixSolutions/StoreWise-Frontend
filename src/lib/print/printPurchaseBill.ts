// src/lib/print/printPurchaseBill.ts
import { getShopProfile } from "./getShopProfile";
import { buildInvoiceHtml } from "./buildInvoiceHtml";
import { platform } from "@/platform";

export async function printPurchaseBill(
  purchaseId: string,
  options?: {
    preview?: boolean;
    silent?: boolean;
  },
) {
  const isDesktop = !!(window as any).electronAPI;

  // ── Fetch purchase data ───────────────────────────────────────────────────
  let res: any;

  if (isDesktop) {
    const api = (window as any).electronAPI;
    if (!api?.getPurchaseFull)
      throw new Error("Purchase print API not available");
    res = await api.getPurchaseFull(purchaseId);
  } else {
    // Use your existing platform abstraction
    res = await platform.getPurchaseFull?.(purchaseId);
  }

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

  // ── Render / print ────────────────────────────────────────────────────────
  if (isDesktop) {
    return (window as any).electronAPI.printHtml(html, {
      preview: options?.preview ?? true,
      silent: options?.silent ?? false,
      pageSize: "A4",
    });
  }

  // Web: open a print-preview popup
  return webPrint(html, options?.preview ?? true);
}

function webPrint(html: string, preview: boolean) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    // Popup blocked — fallback: inject into hidden iframe
    return iframePrint(html);
  }

  win.document.write(html);
  win.document.close();

  if (!preview) {
    // Small delay so styles/images load before print dialog fires
    win.onload = () => {
      win.focus();
      win.print();
      win.close();
    };
  }

  return { success: true };
}

function iframePrint(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;width:0;height:0;border:none;left:-9999px";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return { success: false, error: "Cannot create print frame" };

  doc.write(html);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };

  return { success: true };
}
