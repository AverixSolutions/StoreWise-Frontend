// src/lib/print/printSaleBill.ts
import { platform } from "@/platform";
import { getShopProfile } from "./getShopProfile";
import { buildThermalReceiptHtml } from "./buildThermalReceiptHtml";
import { buildInvoiceHtml } from "./buildInvoiceHtml";
import { getTaskPref, type PaperSize } from "./printPreferences";
import { getSalesPrintCustomization } from "./salesPrintCustomization";

type ShowToast = (type: "success" | "error" | "info", message: string) => void;

type SalesPrintOverrides = {
  preview?: boolean;
  silent?: boolean;
  paperSize?: PaperSize;
};

function clean(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

async function resolveTransactionType(
  licenseId: string,
  sale: Record<string, any>,
): Promise<string | null> {
  const direct =
    clean(sale.transactionTypeName) ||
    clean(sale.transactionType) ||
    clean(sale.typeName);
  if (direct) return direct;

  const typeId = clean(sale.typeId);
  if (!typeId || !platform.listTransactionTypes) return null;

  try {
    const result = await platform.listTransactionTypes(licenseId, "sale");
    const row = (result?.rows || []).find(
      (candidate: any) => String(candidate.id) === typeId,
    );
    return clean(row?.name);
  } catch (error) {
    console.warn("[print] sales transaction type unavailable", error);
    return null;
  }
}

export async function printSaleBill(
  saleId: string,
  overrides?: SalesPrintOverrides,
  showToast?: ShowToast,
) {
  const isDesktop = !!(window as any).electronAPI;
  const pref = getTaskPref("sales");
  const options = getSalesPrintCustomization();
  const paperSize = overrides?.paperSize ?? pref.paperSize;
  const usePreview = overrides?.silent
    ? false
    : (overrides?.preview ?? pref.preview);
  const isThermal = paperSize === "thermal";

  const response = await platform.getSaleFull?.(saleId);
  if (!response?.success) {
    throw new Error((response as any)?.error || "Failed to load sale");
  }

  const { sale, items } = response as any;
  const licenseId =
    clean(sale.licenseId) ||
    clean(localStorage.getItem("licenseId")) ||
    "demo-license";
  const [shop, transactionType] = await Promise.all([
    getShopProfile(licenseId),
    resolveTransactionType(licenseId, sale),
  ]);

  const subTotal = items.reduce(
    (sum: number, item: any) => sum + Number(item.billedValue || 0),
    0,
  );
  const discount = Number(sale.discount || 0);
  const offerSavings =
    Number(sale.offerSavings || 0) ||
    items.reduce(
      (sum: number, item: any) => sum + Number(item.offerDiscountAmount || 0),
      0,
    );
  const grandTotal = Math.max(0, subTotal - discount);
  const totalQty = items.reduce(
    (sum: number, item: any) => sum + Number(item.quantity || 0),
    0,
  );
  const offerSummary: string[] = Array.from(
    new Set<string>(
      items
        .filter((item: any) => item.offerId || item.offerName)
        .map((item: any) => {
          const label =
            item.offerType === "SPECIAL_PRICE"
              ? "Special Offer"
              : item.offerType === "RATION"
                ? "Ration Offer"
                : item.offerType === "HOURLY_DISCOUNT"
                  ? "Hourly Discount"
                  : "Offer";
          return `${label}: ${item.offerName || item.offerId}`;
        }),
    ),
  );

  const mappedItems = items.map((item: any, index: number) => ({
    lineNo: item.lineNo ?? index + 1,
    name: item.productName || item.name || "",
    barcode: item.barcode,
    batchNo: item.purchaseBatchNo || item.batchNo,
    expiryDate: item.expiryDate,
    qty: Number(item.quantity || 0),
    unit: item.unit,
    rate: Number(item.appliedRate ?? item.rate ?? item.salePrice ?? 0),
    taxPercent: item.taxPercent,
    mrp: item.mrp ?? null,
    salePrice: item.salePrice ?? null,
    offerName: item.offerName ?? null,
    offerType: item.offerType ?? null,
    offerDiscountAmount: Number(item.offerDiscountAmount || 0),
    amount: Number(item.billedValue || 0),
  }));

  const html = isThermal
    ? buildThermalReceiptHtml({
        shop,
        options,
        billNo: sale.billNo || sale.slNo || "",
        entryNo: sale.slNo,
        date: sale.saleDate,
        time: sale.entryTime || sale.saleDate,
        saleType: sale.saleType,
        transactionType,
        department: sale.department,
        debitAccount: sale.debitAccount,
        natureOfEntry: sale.natureOfEntry,
        customerName: sale.customerName || "",
        customerPhone: sale.customerMobile || sale.customerPhone || "",
        customerGstin: sale.customerGstin || "",
        customerAddress: sale.customerAddress || "",
        items: mappedItems.map((item: any) => ({
          ...item,
          total: item.amount,
          offerLabel: item.offerName,
          offerSavings: item.offerDiscountAmount,
        })),
        totalQty,
        subTotal,
        offerSavings,
        offerSummary,
        discount,
        grandTotal,
      })
    : buildInvoiceHtml({
        shop,
        options,
        document: {
          title: options.documentTitle || "Sales Invoice",
          entryNo: sale.slNo,
          billNo: sale.billNo,
          date: sale.saleDate,
          time: sale.entryTime || sale.saleDate,
          saleType: sale.saleType,
          typeLabel: transactionType,
          department: sale.department,
          debitAccount: sale.debitAccount,
          natureOfEntry: sale.natureOfEntry,
        },
        party: {
          label: "Customer",
          name: sale.customerName,
          mobile: sale.customerMobile || sale.customerPhone,
          gstin: sale.customerGstin,
          address: sale.customerAddress || null,
        },
        items: mappedItems,
        subTotal,
        discount,
        offerSavings,
        offerSummary,
        grandTotal,
      });

  const documentTitle =
    String(options.documentTitle || "").trim() || "Sales Invoice";
  const title = `${documentTitle} - ${sale.billNo ?? sale.slNo ?? ""}`;
  const paperLabel = isThermal ? "80mm Thermal" : "A4";

  if (isDesktop) {
    const pageSize = isThermal ? { width: 80000, height: 200000 } : "A4";
    const result = await (window as any).electronAPI.printHtml(html, {
      preview: usePreview,
      pageSize,
      title,
      paperLabel,
      printerName: pref.printer || "",
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

  return webPrint(html, { preview: usePreview, title, paperSize });
}

function webPrint(
  html: string,
  options: { preview: boolean; title: string; paperSize: PaperSize },
) {
  if (!options.preview) return iframePrint(html);

  const width = options.paperSize === "thermal" ? 620 : 1120;
  const win = window.open(
    "",
    "_blank",
    `width=${width},height=860,resizable=yes,scrollbars=yes`,
  );
  if (!win) return iframePrint(html);

  win.document.open();
  win.document.write(
    addWebPreviewShell(html, options.title, options.paperSize),
  );
  win.document.close();
  win.focus();
  return { success: true, preview: true };
}

function addWebPreviewShell(
  html: string,
  title: string,
  paperSize: PaperSize,
): string {
  const safeTitle = JSON.stringify(title);
  const safePaper = JSON.stringify(
    paperSize === "thermal" ? "80mm Thermal" : "A4",
  );
  const styles = `<style id="kynflow-sales-preview-style">
    body{padding-top:62px!important}
    .kynflow-preview{position:fixed;z-index:2147483647;top:0;left:0;right:0;height:56px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 16px;background:#0f1e38;color:#fff;font-family:Inter,"Segoe UI",Arial,sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.18)}
    .kynflow-preview-copy{min-width:0}.kynflow-preview-title{overflow:hidden;font-size:14px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}.kynflow-preview-sub{margin-top:2px;color:rgba(255,255,255,.62);font-size:10px}
    .kynflow-preview-actions{display:flex;align-items:center;gap:8px}.kynflow-preview-paper{border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:5px 9px;background:rgba(255,255,255,.08);font-size:10px;font-weight:800}
    .kynflow-preview button{border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:7px 10px;background:rgba(255,255,255,.08);color:#fff;font-size:11px;font-weight:800;cursor:pointer}.kynflow-preview button.primary{border-color:#20b7ff;background:#2477ff}
    @media print{body{padding-top:0!important}.kynflow-preview{display:none!important}}
  </style>`;
  const controls = `<div class="kynflow-preview"><div class="kynflow-preview-copy"><div class="kynflow-preview-title"></div><div class="kynflow-preview-sub">Clean print preview</div></div><div class="kynflow-preview-actions"><span class="kynflow-preview-paper"></span><button type="button" data-close>Close (Esc)</button><button type="button" class="primary" data-print>Print (Ctrl+P)</button></div></div>
  <script>(function(){var title=${safeTitle};var paper=${safePaper};document.title="KYNFLOW Print Preview";var bar=document.querySelector(".kynflow-preview");if(!bar)return;bar.querySelector(".kynflow-preview-title").textContent=title;bar.querySelector(".kynflow-preview-paper").textContent=paper;bar.querySelector("[data-close]").onclick=function(){window.close()};bar.querySelector("[data-print]").onclick=function(){window.print()};window.addEventListener("keydown",function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="p"){e.preventDefault();window.print()}else if(e.key==="Escape"){e.preventDefault();window.close()}},true)})();</script>`;
  return html
    .replace("</head>", `${styles}</head>`)
    .replace("<body>", `<body>${controls}`);
}

function iframePrint(html: string) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const doc = frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    return { success: false, error: "Print frame unavailable" };
  }

  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 250);
  return { success: true, preview: false };
}
