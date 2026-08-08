import type { ShopSettingsRecord } from "@/platform/types";
import {
  buildThermalReceiptHtml,
  type ReceiptShop,
} from "./buildThermalReceiptHtml";
import {
  DEFAULT_SALES_PRINT_CUSTOMIZATION,
  type SalesPrintCustomization,
} from "./salesPrintCustomization";
import type { SalesReturnPrintCustomization } from "./salesReturnPrintCustomization";

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clean(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toReceiptShop(
  shop: ShopSettingsRecord | undefined,
  customization: SalesReturnPrintCustomization,
): ReceiptShop {
  const raw = (shop || {}) as any;
  return {
    name: clean(raw.shopName) || clean(raw.name) || "KYNFLOW",
    logoUrl: customization.showLogo
      ? clean(raw.logoDataUrl) || clean(raw.logoUrl)
      : null,
    addressLine1: clean(raw.addressLine1),
    addressLine2: clean(raw.addressLine2),
    city: clean(raw.city),
    state: clean(raw.state),
    pincode: clean(raw.pincode),
    mobile: clean(raw.mobile) || clean(raw.phone),
    email: clean(raw.email),
    gstin: clean(raw.gstin),
    footerNote: clean(customization.footerText) || clean(raw.footerNote),
    authorizedSignatory:
      clean(customization.signatoryLabel) ||
      clean(raw.authorizedSignatory) ||
      "Authorized Signatory",
  };
}

function toSalesOptions(
  customization: SalesReturnPrintCustomization,
): SalesPrintCustomization {
  return {
    ...DEFAULT_SALES_PRINT_CUSTOMIZATION,
    a4Style: customization.a4Template,
    documentTitle: clean(customization.title) || "SALES RETURN",

    showLogo: customization.showLogo,
    showShopName: true,
    showShopAddress: true,
    showShopPhone: true,
    showShopEmail: true,
    showShopGstin: true,

    showCustomerName: customization.showCustomer,
    showCustomerAddress: customization.showCustomer,
    showCustomerPhone: customization.showCustomer,
    showCustomerGstin: customization.showCustomer,

    showEntryNo: true,
    showBillNo: customization.showSourceSale,
    showSaleDate: true,
    showEntryTime: true,
    showSaleType: false,
    showTransactionType: false,
    showDepartment: false,
    showDebitAccount: false,
    showNatureOfEntry: false,

    // Use the same compact detail slot as Sales; relabel BC -> Rate type below.
    showBarcode: customization.showRateType,
    showBatchNo: customization.showBatch,
    showExpiryDate: false,
    showUnit: true,
    showTax: customization.showTax,
    showMrp: false,
    showOffers: false,

    showSubTotal: true,
    showBillDiscount: customization.showDiscount,
    showOfferSavings: false,
    showAmountInWords: customization.showAmountInWords,
    showTerms: true,
    showAuthorizedSignatory: true,
    showKynflowFooter: true,
  };
}

function rateTypeLabel(item: any): string | null {
  return (
    clean(item.rateTypeName) ||
    clean(item.rateTypeCode) ||
    clean(item.rateSource) ||
    null
  );
}

function itemAmount(item: any): number {
  const explicit = item.billedValue ?? item.totalCost ?? item.amount;
  if (explicit != null && Number.isFinite(Number(explicit))) {
    return Number(explicit);
  }
  return Number(item.rate || 0) * Number(item.quantity || 0);
}

function relabelSalesReturnThermalHtml(
  html: string,
  customization: SalesReturnPrintCustomization,
): string {
  const title = (clean(customization.title) || "SALES RETURN").toUpperCase();
  const subtitle = clean(customization.subtitle);
  const titleHtml = `<div class="center title">${esc(title)}</div>`;
  const subtitleHtml = subtitle
    ? `${titleHtml}<div class="center business">${esc(subtitle)}</div>`
    : titleHtml;

  return html
    .replace(titleHtml, subtitleHtml)
    .replaceAll("<span>Bill</span>", "<span>Source Sale</span>")
    .replaceAll("BC:", "Rate type:")
    .replaceAll("GRAND TOTAL", "RETURN TOTAL");
}

export function buildSalesReturnThermalHtml(args: {
  saleReturn: any;
  items: any[];
  shop?: ShopSettingsRecord;
  customization: SalesReturnPrintCustomization;
}) {
  const { saleReturn: sr, items, shop, customization } = args;
  const options = toSalesOptions(customization);
  const sourceSale =
    clean(sr.billNo) ||
    clean(sr.sourceBillNo) ||
    clean(sr.saleBillNo) ||
    clean(sr.saleId);

  const mappedItems = items.map((item, index) => {
    const amount = itemAmount(item);
    return {
      lineNo: item.lineNo ?? index + 1,
      name:
        clean(item.productName) ||
        clean(item.name) ||
        clean(item.productId) ||
        "Item",
      barcode: customization.showRateType ? rateTypeLabel(item) : null,
      batchNo: item.purchaseBatchNo || item.batchNo || null,
      expiryDate: null,
      unit: clean(item.unit),
      taxPercent: item.taxPercent,
      mrp: null,
      qty: Number(item.quantity || 0),
      rate: Number(item.appliedRate ?? item.rate ?? item.salePrice ?? 0),
      total: amount,
      offerLabel: null,
      offerSavings: 0,
    };
  });

  const subTotal = Number(sr.totalAmount || 0);
  const discount = Number(sr.discount || 0);
  const grandTotal = Math.max(0, subTotal - discount);
  const totalQty = mappedItems.reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0,
  );

  const html = buildThermalReceiptHtml({
    shop: toReceiptShop(shop, customization),
    options,
    billNo: sourceSale,
    entryNo: sr.slNo ?? sr.entryNo ?? null,
    date: sr.returnDate || sr.saleDate || sr.entryDate || null,
    time: sr.entryTime || sr.returnDate || sr.saleDate || null,
    customerName: sr.customerName || null,
    customerPhone: sr.customerMobile || sr.customerPhone || null,
    customerGstin: sr.customerGstin || null,
    customerAddress: sr.customerAddress || null,
    items: mappedItems,
    totalQty,
    subTotal,
    offerSavings: 0,
    offerSummary: [],
    discount,
    grandTotal,
    notes: [],
  });

  return relabelSalesReturnThermalHtml(html, customization);
}
