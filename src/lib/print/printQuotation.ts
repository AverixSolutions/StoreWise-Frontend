// src/lib/print/printQuotation.ts
import { platform } from "@/platform";
import { getShopProfile } from "./getShopProfile";
import { buildInvoiceHtml } from "./buildInvoiceHtml";
import { buildThermalReceiptHtml } from "./buildThermalReceiptHtml";
import { getQuotationPrintCustomization } from "./quotationPrintCustomization";
import {
  loadQuotationPrintSettings,
  type QuotationPrintFormat,
} from "./quotationPrintSettings";

type QuotationPrintOverrides = {
  preview?: boolean;
  format?: QuotationPrintFormat;
  printer?: string | null;
};

function relabelQuotationHtml(html: string): string {
  return html
    .replaceAll("Bill No.", "Quotation No.")
    .replaceAll("<span>Bill</span>", "<span>Quotation</span>")
    .replaceAll("Original customer copy", "Quotation copy");
}

export async function printQuotation(
  quotationId: string,
  overrides?: QuotationPrintOverrides,
) {
  const res = await platform.getQuotationFull?.(quotationId);
  if (!res?.success) {
    throw new Error((res as any)?.error || "Failed to load quotation");
  }

  const { quotation, items } = res as any;
  const shop = await getShopProfile();
  const pref = loadQuotationPrintSettings();
  const format = overrides?.format ?? pref.format;
  const usePreview = overrides?.preview ?? pref.preview;
  const printerName = overrides?.printer ?? pref.printer;
  const isThermal = format === "thermal";

  const options = {
    ...getQuotationPrintCustomization(),
    a4Style: format === "modern" ? ("modern" as const) : ("classic" as const),
    documentTitle: "Quotation",
    showSaleType: false,
    showTransactionType: false,
    showDebitAccount: false,
    showNatureOfEntry: false,
    showOffers: false,
    showOfferSavings: false,
  };

  const mappedItems = items.map((it: any, i: number) => ({
    lineNo: it.lineNo ?? i + 1,
    name: it.productName || it.name || "",
    barcode: it.barcode,
    batchNo: it.batchNo,
    expiryDate: it.expiryDate,
    qty: Number(it.quantity || 0),
    unit: it.unit,
    rate: Number(it.rate ?? it.salePrice ?? 0),
    taxPercent: it.taxPercent,
    mrp: it.mrp ?? null,
    salePrice: it.salePrice ?? null,
    offerName: null,
    offerType: null,
    offerDiscountAmount: 0,
    amount: Number(it.billedValue || 0),
  }));

  const subTotal = mappedItems.reduce(
    (sum: number, item: any) => sum + Number(item.amount || 0),
    0,
  );
  const discount = Number(quotation.discount || 0);
  const grandTotal = Math.max(0, subTotal - discount);
  const totalQty = mappedItems.reduce(
    (sum: number, item: any) => sum + Number(item.qty || 0),
    0,
  );

  const html = relabelQuotationHtml(
    isThermal
      ? buildThermalReceiptHtml({
          shop,
          options,
          billNo: quotation.quotationNo ?? quotation.slNo ?? "",
          entryNo: quotation.slNo ?? quotation.quotationNo ?? null,
          date: quotation.quotationDate,
          time: quotation.entryTime || quotation.quotationDate,
          department: quotation.department,
          customerName: quotation.customerName || "",
          items: mappedItems.map((item: any) => ({
            ...item,
            total: item.amount,
            offerLabel: null,
            offerSavings: 0,
          })),
          totalQty,
          subTotal,
          offerSavings: 0,
          offerSummary: [],
          discount,
          grandTotal,
          notes: quotation.notes ? [String(quotation.notes)] : [],
        })
      : buildInvoiceHtml({
          shop,
          options,
          document: {
            title: "QUOTATION",
            entryNo: quotation.slNo ?? quotation.quotationNo,
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
          items: mappedItems,
          subTotal,
          discount,
          offerSavings: 0,
          offerSummary: [],
          grandTotal,
          notes: quotation.notes ?? undefined,
        }),
  );

  const title = `Quotation - ${quotation.quotationNo ?? quotation.slNo ?? ""}`;
  const paperLabel =
    format === "thermal"
      ? "80mm Thermal"
      : format === "modern"
        ? "Modern A4"
        : "Classic A4";

  const isDesktop = !!(window as any).electronAPI;
  if (isDesktop) {
    return (window as any).electronAPI.printHtml(html, {
      preview: usePreview,
      pageSize: isThermal ? { width: 80000, height: 200000 } : "A4",
      title,
      paperLabel,
      printerName: printerName || "",
    });
  }

  return webPrint(html, {
    preview: usePreview,
    title,
    format,
  });
}

function webPrint(
  html: string,
  options: {
    preview: boolean;
    title: string;
    format: QuotationPrintFormat;
  },
) {
  if (!options.preview) return iframePrint(html);

  const width = options.format === "thermal" ? 620 : 1120;
  const win = window.open(
    "",
    "_blank",
    `width=${width},height=860,resizable=yes,scrollbars=yes`,
  );
  if (!win) return iframePrint(html);

  win.document.open();
  win.document.write(addWebPreviewShell(html, options.title, options.format));
  win.document.close();
  win.focus();
  return { success: true, preview: true };
}

function addWebPreviewShell(
  html: string,
  title: string,
  format: QuotationPrintFormat,
): string {
  const safeTitle = JSON.stringify(title);
  const safePaper = JSON.stringify(
    format === "thermal"
      ? "80mm Thermal"
      : format === "modern"
        ? "Modern A4"
        : "Classic A4",
  );
  const styles = `<style id="kynflow-quotation-preview-style">
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
