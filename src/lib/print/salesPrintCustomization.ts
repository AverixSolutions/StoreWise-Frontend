export type SalesA4Style = "classic" | "modern";

export type SalesPrintCustomization = {
  a4Style: SalesA4Style;
  documentTitle: string;
  headingColor: string;

  showLogo: boolean;
  showShopName: boolean;
  showShopAddress: boolean;
  showShopPhone: boolean;
  showShopEmail: boolean;
  showShopGstin: boolean;

  showCustomerName: boolean;
  showCustomerAddress: boolean;
  showCustomerPhone: boolean;
  showCustomerGstin: boolean;

  showEntryNo: boolean;
  showBillNo: boolean;
  showSaleDate: boolean;
  showEntryTime: boolean;
  showSaleType: boolean;
  showTransactionType: boolean;
  showDepartment: boolean;
  showDebitAccount: boolean;
  showNatureOfEntry: boolean;

  showBarcode: boolean;
  showBatchNo: boolean;
  showExpiryDate: boolean;
  showUnit: boolean;
  showTax: boolean;
  showMrp: boolean;
  showOffers: boolean;

  showSubTotal: boolean;
  showBillDiscount: boolean;
  showOfferSavings: boolean;
  showAmountInWords: boolean;
  showTerms: boolean;
  showAuthorizedSignatory: boolean;
  showKynflowFooter: boolean;
};

const STORAGE_KEY = "kynflow_sales_print_customization";
const CHANGE_EVENT = "kynflow:sales-print-customization";

export const DEFAULT_SALES_PRINT_CUSTOMIZATION: SalesPrintCustomization = {
  a4Style: "classic",
  documentTitle: "Sales Invoice",
  headingColor: "#1e3a5f",

  showLogo: true,
  showShopName: true,
  showShopAddress: true,
  showShopPhone: true,
  showShopEmail: true,
  showShopGstin: true,

  showCustomerName: true,
  showCustomerAddress: true,
  showCustomerPhone: true,
  showCustomerGstin: true,

  showEntryNo: true,
  showBillNo: true,
  showSaleDate: true,
  showEntryTime: true,
  showSaleType: true,
  showTransactionType: true,
  showDepartment: true,
  showDebitAccount: true,
  showNatureOfEntry: true,

  showBarcode: false,
  showBatchNo: true,
  showExpiryDate: true,
  showUnit: true,
  showTax: true,
  showMrp: false,
  showOffers: true,

  showSubTotal: true,
  showBillDiscount: true,
  showOfferSavings: true,
  showAmountInWords: true,
  showTerms: true,
  showAuthorizedSignatory: true,
  showKynflowFooter: true,
};

function cleanHex(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text)
    ? text.toLowerCase()
    : DEFAULT_SALES_PRINT_CUSTOMIZATION.headingColor;
}

function normalize(
  value: Partial<SalesPrintCustomization> | null | undefined,
): SalesPrintCustomization {
  const source = value && typeof value === "object" ? value : {};

  return {
    ...DEFAULT_SALES_PRINT_CUSTOMIZATION,
    ...source,
    a4Style: source.a4Style === "modern" ? "modern" : "classic",
    documentTitle:
      String(source.documentTitle ?? "").trim() ||
      DEFAULT_SALES_PRINT_CUSTOMIZATION.documentTitle,
    headingColor: cleanHex(source.headingColor),
  };
}

export function getSalesPrintCustomization(): SalesPrintCustomization {
  try {
    if (typeof localStorage === "undefined") {
      return { ...DEFAULT_SALES_PRINT_CUSTOMIZATION };
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SALES_PRINT_CUSTOMIZATION };
  }
}

export function setSalesPrintCustomization(
  updates: Partial<SalesPrintCustomization>,
): SalesPrintCustomization {
  const next = normalize({
    ...getSalesPrintCustomization(),
    ...updates,
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  } catch {}

  return next;
}

export function resetSalesPrintCustomization(): SalesPrintCustomization {
  const next = { ...DEFAULT_SALES_PRINT_CUSTOMIZATION };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  } catch {}

  return next;
}

export function subscribeSalesPrintCustomization(
  listener: (value: SalesPrintCustomization) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handle = (event: Event) => {
    const detail = (event as CustomEvent<SalesPrintCustomization>).detail;
    listener(detail ? normalize(detail) : getSalesPrintCustomization());
  };

  window.addEventListener(CHANGE_EVENT, handle);
  return () => window.removeEventListener(CHANGE_EVENT, handle);
}
