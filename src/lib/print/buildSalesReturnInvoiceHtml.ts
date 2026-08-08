import type { ShopSettingsRecord } from "@/platform/types";
import { buildInvoiceHtml, type ShopProfile } from "./buildInvoiceHtml";
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

function toShopProfile(
  shop: ShopSettingsRecord | undefined,
  customization: SalesReturnPrintCustomization,
): ShopProfile {
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

    // Use the standard Sales item-detail slot for the return rate type.
    // The rendered "Barcode" label is changed to "Rate Type" below.
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

function relabelSalesReturnHtml(
  html: string,
  customization: SalesReturnPrintCustomization,
): string {
  const subtitle = clean(customization.subtitle) || "Customer return document";

  return html
    .replaceAll("Bill No.", "Source Sale")
    .replaceAll("Barcode:", "Rate Type:")
    .replaceAll("Grand Total", "Return Total")
    .replaceAll("Amount in words", "Return amount in words")
    .replaceAll("Document details", "Return details")
    .replace("<p>Original customer copy</p>", `<p>${esc(subtitle)}</p>`);
}

export function buildSalesReturnInvoiceHtml(args: {
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

  const mappedItems = items.map((item, index) => ({
    lineNo: item.lineNo ?? index + 1,
    name:
      clean(item.productName) ||
      clean(item.name) ||
      clean(item.productId) ||
      "Item",
    barcode: customization.showRateType ? rateTypeLabel(item) : null,
    batchNo: item.purchaseBatchNo || item.batchNo || null,
    expiryDate: null,
    qty: Number(item.quantity || 0),
    unit: clean(item.unit),
    rate: Number(item.appliedRate ?? item.rate ?? item.salePrice ?? 0),
    taxPercent: item.taxPercent,
    mrp: null,
    salePrice: item.salePrice ?? null,
    offerName: null,
    offerType: null,
    offerDiscountAmount: 0,
    amount: itemAmount(item),
  }));

  const subTotal = Number(sr.totalAmount || 0);
  const discount = Number(sr.discount || 0);
  const grandTotal = Math.max(0, subTotal - discount);

  const html = buildInvoiceHtml({
    shop: toShopProfile(shop, customization),
    options,
    document: {
      title: options.documentTitle,
      entryNo: sr.slNo ?? sr.entryNo ?? null,
      billNo: sourceSale,
      date: sr.returnDate || sr.saleDate || sr.entryDate || null,
      time: sr.entryTime || sr.returnDate || sr.saleDate || null,
    },
    party: {
      label: "Customer",
      name: sr.customerName || null,
      mobile: sr.customerMobile || sr.customerPhone || null,
      gstin: sr.customerGstin || null,
      address: sr.customerAddress || null,
    },
    items: mappedItems,
    subTotal,
    discount,
    offerSavings: 0,
    offerSummary: [],
    grandTotal,
  });

  return relabelSalesReturnHtml(html, customization);
}
