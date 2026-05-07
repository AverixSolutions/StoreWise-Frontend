// src/lib/print/printPurchaseBill.ts
import { getShopProfile } from "./getShopProfile";
import { buildInvoiceHtml } from "./buildInvoiceHtml";
import { platform } from "@/platform";
import { getTaskPref } from "./printPreferences";

type ShowToast = (type: "success" | "error" | "info", message: string) => void;

export async function printPurchaseBill(
  purchaseId: string,
  overrides?: { preview?: boolean; silent?: boolean },
  showToast?: ShowToast,
) {
  const isDesktop = !!(window as any).electronAPI;
  const pref = getTaskPref("purchase");
  const usePreview = overrides?.preview ?? pref.preview;

  let res: any;
  if (isDesktop) {
    const api = (window as any).electronAPI;
    if (!api?.getPurchaseFull)
      throw new Error("Purchase print API not available");
    res = await api.getPurchaseFull(purchaseId);
  } else {
    res = await platform.getPurchaseFull?.(purchaseId);
  }
  if (!res?.success) throw new Error(res?.error || "Failed to load purchase");

  const { purchase, items } = res;
  const shop = await getShopProfile();
  const subTotal = items.reduce(
    (s: number, it: any) => s + Number(it.billedValue || 0),
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
    party: { label: "Supplier", name: purchase.supplierName },
    items: items.map((it: any, i: number) => ({
      lineNo: it.lineNo ?? i + 1,
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

  if (isDesktop) {
    const pageSize =
      pref.paperSize === "thermal" ? { width: 80000, height: 200000 } : "A4";

    const result = await (window as any).electronAPI.printHtml(html, {
      preview: usePreview,
      pageSize,
      title: `Purchase Bill — ${purchase.billNo ?? purchase.slNo ?? ""}`,
      printerName: pref.printer || "",
    });

    if (!usePreview) {
      if (result?.success) {
        showToast?.("success", "Purchase bill printed successfully");
      } else {
        showToast?.(
          "error",
          `Print failed: ${result?.error || "Unknown error"}`,
        );
      }
    }

    return result;
  }

  return webPrint(html, usePreview);
}

function webPrint(html: string, preview: boolean) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return iframePrint(html);
  win.document.write(html);
  win.document.close();
  if (!preview) {
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
