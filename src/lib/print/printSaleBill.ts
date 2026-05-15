// src/lib/print/printSaleBill.ts
import { platform } from "@/platform";
import { getShopProfile } from "./getShopProfile";
import { buildThermalReceiptHtml } from "./buildThermalReceiptHtml";
import { buildInvoiceHtml } from "./buildInvoiceHtml";
import { getTaskPref } from "./printPreferences";

type ShowToast = (type: "success" | "error" | "info", message: string) => void;

export async function printSaleBill(
  saleId: string,
  overrides?: { preview?: boolean; silent?: boolean },
  showToast?: ShowToast,
) {
  const isDesktop = !!(window as any).electronAPI;

  // ── 1. Read user prefs ────────────────────────────────────────────────────
  const pref = getTaskPref("sales");
  const usePreview = overrides?.preview ?? pref.preview;
  const isThermal = pref.paperSize === "thermal";

  // ── 2. Fetch sale data ────────────────────────────────────────────────────
  const res = await platform.getSaleFull?.(saleId);
  if (!res?.success)
    throw new Error((res as any)?.error || "Failed to load sale");

  const { sale, items } = res as any;
  const shop = await getShopProfile();

  const subTotal = items.reduce(
    (s: number, it: any) => s + Number(it.billedValue || 0),
    0,
  );
  const discount = Number(sale.discount || 0);
  const offerSavings =
    Number(sale.offerSavings || 0) ||
    items.reduce(
      (s: number, it: any) => s + Number(it.offerDiscountAmount || 0),
      0,
    );
  const grandTotal = Math.max(0, subTotal - discount);
  const totalQty = items.reduce(
    (s: number, it: any) => s + Number(it.quantity || 0),
    0,
  );
  const offerSummary: string[] = Array.from(
    new Set<string>(
      items
        .filter((it: any) => it.offerId || it.offerName)
        .map((it: any) => {
          const label =
            it.offerType === "SPECIAL_PRICE"
              ? "Special Offer"
              : it.offerType === "RATION"
                ? "Ration Offer"
                : it.offerType === "HOURLY_DISCOUNT"
                  ? "Hourly Discount"
                  : "Offer";
          return `${label}: ${it.offerName || it.offerId}`;
        }),
    ),
  );

  // ── 3. Build HTML — thermal receipt OR full A4 invoice ────────────────────
  const html = isThermal
    ? buildThermalReceiptHtml({
        shop,
        billNo: sale.billNo || sale.slNo || "",
        date: sale.saleDate,
        time: sale.entryTime || sale.saleDate,
        customerPhone: sale.customerMobile || sale.customerPhone || "",
        items: items.map((it: any, i: number) => ({
          lineNo: it.lineNo ?? i + 1,
          name: it.productName || it.name || "",
          qty: Number(it.quantity || 0),
          rate: Number(it.appliedRate ?? it.rate ?? it.salePrice ?? 0),
          total: Number(it.billedValue || 0),
          offerLabel: it.offerName || null,
          offerSavings: Number(it.offerDiscountAmount || 0),
        })),
        totalQty,
        subTotal,
        offerSavings,
        offerSummary,
        discount,
        grandTotal,
        notes: [
          "HAVE A NICE DAY",
          "EXCHANGE WITHIN 7 DAYS ONLY",
          "NO COLOUR GUARANTEE FOR COTTON GARMENTS",
          "BILL AND PRODUCT PRICE TAG REQUIRED FOR EXCHANGE",
          "NO REFUND",
        ],
      })
    : buildInvoiceHtml({
        shop,
        document: {
          title: "Sales Bill",
          entryNo: sale.slNo,
          billNo: sale.billNo,
          date: sale.saleDate,
          time: sale.entryTime || sale.saleDate,
        },
        party: {
          label: "Customer",
          name: sale.customerName,
          mobile: sale.customerMobile || sale.customerPhone,
          gstin: sale.customerGstin,
          address: sale.customerAddress || null,
        },
        items: items.map((it: any, i: number) => ({
          lineNo: it.lineNo ?? i + 1,
          name: it.productName || it.name || "",
          barcode: it.barcode,
          batchNo: it.batchNo,
          expiryDate: it.expiryDate,
          qty: Number(it.quantity || 0),
          unit: it.unit,
          rate: Number(it.appliedRate ?? it.rate ?? it.salePrice ?? 0),
          taxPercent: it.taxPercent,
          mrp: it.mrp ?? null,
          salePrice: it.salePrice ?? null,
          offerName: it.offerName ?? null,
          offerType: it.offerType ?? null,
          offerDiscountAmount: Number(it.offerDiscountAmount || 0),
          amount: Number(it.billedValue || 0),
        })),
        subTotal,
        discount,
        offerSavings,
        offerSummary,
        grandTotal,
      });

  // ── 4. Print ──────────────────────────────────────────────────────────────
  if (isDesktop) {
    const pageSize = isThermal ? { width: 80000, height: 200000 } : "A4";

    const result = await (window as any).electronAPI.printHtml(html, {
      preview: usePreview,
      silent: !usePreview,
      pageSize,
      title: `Sale Bill — ${sale.billNo ?? sale.slNo ?? ""}`,
      ...(pref.printer ? { printerName: pref.printer } : {}),
    });

    if (!usePreview) {
      if (result?.success) {
        showToast?.("success", "Sale bill printed successfully");
      } else {
        showToast?.(
          "error",
          `Print failed: ${result?.error || "Unknown error"}`,
        );
      }
    }

    return result;
  }

  // Web fallback
  const win = window.open("", "_blank");
  if (!win) throw new Error("Print blocked — allow popups and try again.");

  win.document.write(html);
  win.document.close();

  if (!usePreview) {
    win.addEventListener("load", () => {
      win.focus();
      win.print();
    });
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {}
    }, 600);
  } else {
    win.focus();
  }
  return { success: true };
}
