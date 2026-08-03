import { platform } from "@/platform";
import { getShopProfile } from "./getShopProfile";
import {
  buildPurchaseInvoiceHtml,
  type PurchasePrintInput,
} from "./buildPurchaseInvoiceHtml";
import { buildPurchaseThermalHtml } from "./buildPurchaseThermalHtml";
import { getTaskPref, type PaperSize } from "./printPreferences";

type ShowToast = (type: "success" | "error" | "info", message: string) => void;

type PurchasePrintOverrides = {
  preview?: boolean;
  silent?: boolean;
  paperSize?: PaperSize;
};

export async function printPurchaseBill(
  purchaseId: string,
  overrides?: PurchasePrintOverrides,
  showToast?: ShowToast,
) {
  const isDesktop = !!(window as any).electronAPI;
  const pref = getTaskPref("purchase");
  const paperSize = overrides?.paperSize ?? pref.paperSize;
  const usePreview = overrides?.silent
    ? false
    : (overrides?.preview ?? pref.preview);
  const isThermal = paperSize === "thermal";

  let response: any;

  if (isDesktop) {
    const api = (window as any).electronAPI;
    if (!api?.getPurchaseFull) {
      throw new Error("Purchase print API not available");
    }
    response = await api.getPurchaseFull(purchaseId);
  } else {
    response = await platform.getPurchaseFull?.(purchaseId);
  }

  if (!response?.success) {
    throw new Error(response?.error || "Failed to load purchase");
  }

  const { purchase, items } = response;
  const shop = await getShopProfile();

  const subTotal = items.reduce(
    (sum: number, item: any) => sum + Number(item.billedValue || 0),
    0,
  );
  const discount = Number(purchase.discount || 0);
  const grandTotal = Math.max(0, subTotal - discount);

  const printInput: PurchasePrintInput = {
    shop,
    bill: {
      entryNo: purchase.slNo,
      billNo: purchase.billNo,
      date: purchase.purchaseDate,
      time: purchase.entryTime,
      supplierName: purchase.supplierName,
      department: purchase.department,
      debitAccount: purchase.debitAccount,
      natureOfEntry: purchase.natureOfEntry,
      purchaseType: purchase.purchaseType,
    },
    items: items.map((item: any, index: number) => ({
      lineNo: item.lineNo ?? index + 1,
      name: item.productName || "",
      barcode: item.barcode,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate,
      qty: Number(item.quantity || 0),
      unit: item.unit,
      rate: Number(item.rate || 0),
      taxPercent: item.taxPercent,
      mrp: item.mrp ?? null,
      salePrice: item.salePrice ?? null,
      amount: Number(item.billedValue || 0),
    })),
    subTotal,
    discount,
    grandTotal,
  };

  const html = isThermal
    ? buildPurchaseThermalHtml(printInput)
    : buildPurchaseInvoiceHtml(printInput);

  const title = `Purchase Bill - ${purchase.billNo ?? purchase.slNo ?? ""}`;

  if (isDesktop) {
    const pageSize = isThermal ? { width: 80000, height: 200000 } : "A4";

    const result = await (window as any).electronAPI.printHtml(html, {
      preview: usePreview,
      pageSize,
      title,
      paperLabel: isThermal ? "80mm Thermal" : "A4",
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

  return webPrint(html, {
    preview: usePreview,
    title,
    paperSize,
  });
}

function webPrint(
  html: string,
  options: {
    preview: boolean;
    title: string;
    paperSize: PaperSize;
  },
) {
  if (!options.preview) {
    return iframePrint(html);
  }

  const width = options.paperSize === "thermal" ? 620 : 1120;
  const win = window.open(
    "",
    "_blank",
    `width=${width},height=860,resizable=yes,scrollbars=yes`,
  );

  if (!win) {
    return iframePrint(html);
  }

  win.document.open();
  win.document.write(
    addWebPreviewShell(
      html,
      options.title,
      options.paperSize === "thermal" ? "80mm Thermal" : "A4",
    ),
  );
  win.document.close();
  win.focus();

  return { success: true, preview: true };
}

function addWebPreviewShell(
  html: string,
  title: string,
  paperLabel: string,
): string {
  const safeTitle = JSON.stringify(title);
  const safePaper = JSON.stringify(paperLabel);

  const styles = `
    <style id="kynflow-web-preview-style">
      body { padding-top: 72px !important; }
      .kynflow-web-preview {
        position: fixed;
        z-index: 2147483647;
        top: 0;
        left: 0;
        right: 0;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 0 20px;
        border-bottom: 1px solid rgba(255,255,255,.12);
        background: linear-gradient(135deg,#091120,#0f1a31 62%,#16213d);
        box-shadow: 0 8px 24px rgba(15,23,42,.22);
        color: #fff;
        font-family: Inter,Segoe UI,Arial,sans-serif;
      }
      .kynflow-web-preview::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: -2px;
        height: 2px;
        background: linear-gradient(90deg,#20b7ff,#2477ff,#b026ff);
      }
      .kynflow-preview-copy { min-width: 0; }
      .kynflow-preview-title {
        overflow: hidden;
        color: #fff;
        font-size: 14px;
        font-weight: 800;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .kynflow-preview-sub {
        margin-top: 2px;
        color: rgba(255,255,255,.56);
        font-size: 10px;
      }
      .kynflow-preview-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }
      .kynflow-preview-paper {
        margin-right: 6px;
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 999px;
        padding: 5px 9px;
        background: rgba(255,255,255,.08);
        color: rgba(255,255,255,.8);
        font-size: 10px;
        font-weight: 800;
      }
      .kynflow-preview-button {
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 8px;
        padding: 8px 12px;
        background: rgba(255,255,255,.08);
        color: #fff;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
      }
      .kynflow-preview-button.primary {
        border-color: #20b7ff;
        background: #2477ff;
      }
      @media print {
        body { padding-top: 0 !important; }
        .kynflow-web-preview { display: none !important; }
      }
    </style>`;

  const controls = `
    <div class="kynflow-web-preview" data-kynflow-preview-toolbar>
      <div class="kynflow-preview-copy">
        <div class="kynflow-preview-title"></div>
        <div class="kynflow-preview-sub">Ctrl+P to print · Esc to close</div>
      </div>
      <div class="kynflow-preview-actions">
        <span class="kynflow-preview-paper"></span>
        <button type="button" class="kynflow-preview-button" data-kynflow-close>Close</button>
        <button type="button" class="kynflow-preview-button primary" data-kynflow-print>Print</button>
      </div>
    </div>
    <script>
      (function () {
        var title = ${safeTitle};
        var paper = ${safePaper};
        var toolbar = document.querySelector("[data-kynflow-preview-toolbar]");
        if (!toolbar) return;
        toolbar.querySelector(".kynflow-preview-title").textContent = title;
        toolbar.querySelector(".kynflow-preview-paper").textContent = paper;
        toolbar.querySelector("[data-kynflow-close]").addEventListener("click", function () {
          window.close();
        });
        toolbar.querySelector("[data-kynflow-print]").addEventListener("click", function () {
          window.print();
        });
        window.addEventListener("keydown", function (event) {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
            event.preventDefault();
            window.print();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            window.close();
          }
        }, true);
        window.addEventListener("afterprint", function () {
          window.close();
        });
      })();
    </script>`;

  return html
    .replace("</head>", `${styles}</head>`)
    .replace("</body>", `${controls}</body>`);
}

function iframePrint(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return { success: false, error: "Cannot create print frame" };
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      iframe.remove();
      return;
    }

    frameWindow.focus();
    frameWindow.print();
    setTimeout(() => iframe.remove(), 1500);
  };

  return { success: true, preview: false };
}
