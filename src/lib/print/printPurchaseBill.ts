import { platform } from "@/platform";
import { getShopProfile } from "./getShopProfile";
import {
  buildPurchaseInvoiceHtml,
  type PurchasePrintInput,
} from "./buildPurchaseInvoiceHtml";
import { buildPurchaseThermalHtml } from "./buildPurchaseThermalHtml";
import { getTaskPref, type PaperSize } from "./printPreferences";
import { getPurchasePrintCustomization } from "./purchasePrintCustomization";

type ShowToast = (type: "success" | "error" | "info", message: string) => void;

type PurchasePrintOverrides = {
  preview?: boolean;
  silent?: boolean;
  paperSize?: PaperSize;
};

function clean(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function supplierAddress(supplier: Record<string, any> | null): string | null {
  if (!supplier) return null;

  const explicit =
    clean(supplier.address) ||
    clean(supplier.fullAddress) ||
    clean(supplier.billingAddress);

  if (explicit) return explicit;

  const lines = [
    clean(supplier.addressLine1),
    clean(supplier.addressLine2),
    [
      clean(supplier.city),
      clean(supplier.state),
      clean(supplier.pincode || supplier.postalCode),
    ]
      .filter(Boolean)
      .join(" - "),
  ].filter(Boolean);

  return lines.length ? lines.join(", ") : null;
}

async function loadSupplierDetails(
  supplierId: unknown,
): Promise<Record<string, any> | null> {
  const id = clean(supplierId);
  if (!id || !platform.getSupplier) return null;

  try {
    return (await platform.getSupplier(id)) as Record<string, any> | null;
  } catch (error) {
    console.warn("[print] supplier details unavailable", error);
    return null;
  }
}

async function resolveTransactionType(
  licenseId: string,
  purchase: Record<string, any>,
): Promise<string | null> {
  const direct =
    clean(purchase.transactionTypeName) ||
    clean(purchase.transactionType) ||
    clean(purchase.typeName);

  if (direct) return direct;

  const typeId = clean(purchase.typeId);
  if (!typeId || !platform.listTransactionTypes) return null;

  try {
    const result = await platform.listTransactionTypes(licenseId, "purchase");
    const row = (result?.rows || []).find(
      (candidate: any) => String(candidate.id) === typeId,
    );
    return clean(row?.name);
  } catch (error) {
    console.warn("[print] transaction type unavailable", error);
    return null;
  }
}

export async function printPurchaseBill(
  purchaseId: string,
  overrides?: PurchasePrintOverrides,
  showToast?: ShowToast,
) {
  const isDesktop = !!(window as any).electronAPI;
  const pref = getTaskPref("purchase");
  const options = getPurchasePrintCustomization();
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
  const licenseId =
    clean(purchase.licenseId) ||
    clean(localStorage.getItem("licenseId")) ||
    "demo-license";

  const [shop, supplier, transactionType] = await Promise.all([
    getShopProfile(licenseId),
    loadSupplierDetails(purchase.supplierId),
    resolveTransactionType(licenseId, purchase),
  ]);

  const subTotal = items.reduce(
    (sum: number, item: any) => sum + Number(item.billedValue || 0),
    0,
  );
  const discount = Number(purchase.discount || 0);
  const grandTotal = Math.max(0, subTotal - discount);

  const printInput: PurchasePrintInput = {
    shop,
    options,
    bill: {
      entryNo: purchase.slNo,
      billNo: purchase.billNo,
      date: purchase.purchaseDate,
      time: purchase.entryTime,
      supplierName:
        clean(purchase.supplierName) ||
        clean(supplier?.name) ||
        clean(supplier?.supplierName),
      supplierAddress: supplierAddress(supplier),
      supplierPhone:
        clean(supplier?.mobile) ||
        clean(supplier?.phone) ||
        clean(supplier?.contactNumber),
      supplierEmail: clean(supplier?.email),
      supplierGstin:
        clean(supplier?.gstin) ||
        clean(supplier?.gstNo) ||
        clean(supplier?.taxNumber),
      department: purchase.department,
      debitAccount: purchase.debitAccount,
      natureOfEntry: purchase.natureOfEntry,
      purchaseType: purchase.purchaseType,
      transactionType,
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

  const documentTitle =
    String(options.documentTitle || "").trim() || "Purchase Bill";
  const title = `${documentTitle} - ${purchase.billNo ?? purchase.slNo ?? ""}`;

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
    <link rel="icon" href="/favicon.ico" />
    <style id="kynflow-web-preview-style">
      html,
      body {
        background: #ffffff !important;
      }

      body {
        padding-top: 66px !important;
      }

      .kynflow-web-preview {
        position: fixed;
        z-index: 2147483647;
        top: 0;
        left: 0;
        right: 0;
        height: 58px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 0 16px;
        border-bottom: 1px solid rgba(255,255,255,.12);
        background: #0f1e38;
        box-shadow: 0 6px 18px rgba(15,23,42,.18);
        color: #ffffff;
        font-family: Inter, "Segoe UI", Arial, sans-serif;
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

      .kynflow-preview-copy {
        min-width: 0;
      }

      .kynflow-preview-title {
        overflow: hidden;
        color: #ffffff;
        font-size: 14px;
        font-weight: 800;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .kynflow-preview-sub {
        margin-top: 2px;
        color: rgba(255,255,255,.62);
        font-size: 10px;
      }

      .kynflow-preview-actions {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 8px;
      }

      .kynflow-preview-paper {
        margin-right: 4px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 999px;
        padding: 5px 9px;
        background: rgba(255,255,255,.08);
        color: rgba(255,255,255,.86);
        font-size: 10px;
        font-weight: 800;
      }

      .kynflow-preview-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 8px;
        padding: 7px 10px;
        background: rgba(255,255,255,.08);
        color: #ffffff;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
      }

      .kynflow-preview-button:hover {
        background: rgba(255,255,255,.14);
      }

      .kynflow-preview-key {
        display: inline-flex;
        min-height: 18px;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 5px;
        padding: 1px 5px;
        background: rgba(255,255,255,.1);
        color: #ffffff;
        font: 700 8px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
      }

      .kynflow-preview-button.primary {
        border-color: #20b7ff;
        background: #2477ff;
      }

      .kynflow-preview-button.primary:hover {
        background: #1d67dd;
      }

      @media print {
        body {
          padding-top: 0 !important;
        }

        .kynflow-web-preview {
          display: none !important;
        }
      }
    </style>`;

  const controls = `
    <div class="kynflow-web-preview" data-kynflow-preview-toolbar>
      <div class="kynflow-preview-copy">
        <div class="kynflow-preview-title"></div>
        <div class="kynflow-preview-sub">Clean print preview</div>
      </div>
      <div class="kynflow-preview-actions">
        <span class="kynflow-preview-paper"></span>
        <button type="button" class="kynflow-preview-button" data-kynflow-close>
          <span>Close</span>
          <kbd class="kynflow-preview-key">Esc</kbd>
        </button>
        <button type="button" class="kynflow-preview-button primary" data-kynflow-print>
          <span>Print</span>
          <kbd class="kynflow-preview-key">Ctrl+P</kbd>
        </button>
      </div>
    </div>
    <script>
      (function () {
        var title = ${safeTitle};
        var paper = ${safePaper};
        document.title = "KYNFLOW Print Preview";
        var toolbar = document.querySelector("[data-kynflow-preview-toolbar]");
        if (!toolbar) return;

        toolbar.querySelector(".kynflow-preview-title").textContent = title;
        toolbar.querySelector(".kynflow-preview-paper").textContent = paper;

        toolbar
          .querySelector("[data-kynflow-close]")
          .addEventListener("click", function () {
            window.close();
          });

        toolbar
          .querySelector("[data-kynflow-print]")
          .addEventListener("click", function () {
            window.print();
          });

        window.addEventListener(
          "keydown",
          function (event) {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === "p"
            ) {
              event.preventDefault();
              window.print();
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              window.close();
            }
          },
          true,
        );
      })();
    </script>`;

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
