const STORAGE_KEY = "kynflow_sales_return_print_template_v1";

export type SalesReturnA4Template = "classic" | "modern";

export type SalesReturnPrintCustomization = {
  a4Template: SalesReturnA4Template;
  title: string;
  subtitle: string;
  showLogo: boolean;
  showCustomer: boolean;
  showSourceSale: boolean;
  showBatch: boolean;
  showRateType: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showAmountInWords: boolean;
  footerText: string;
  signatoryLabel: string;
};

export const DEFAULT_SALES_RETURN_PRINT_CUSTOMIZATION: SalesReturnPrintCustomization =
  {
    a4Template: "classic",
    title: "SALES RETURN",
    subtitle: "Customer Return / Credit Note",
    showLogo: true,
    showCustomer: true,
    showSourceSale: true,
    showBatch: true,
    showRateType: true,
    showTax: true,
    showDiscount: true,
    showAmountInWords: true,
    footerText: "Thank you for your business.",
    signatoryLabel: "Authorized Signatory",
  };

export function loadSalesReturnPrintCustomization(): SalesReturnPrintCustomization {
  if (typeof window === "undefined")
    return DEFAULT_SALES_RETURN_PRINT_CUSTOMIZATION;
  try {
    return {
      ...DEFAULT_SALES_RETURN_PRINT_CUSTOMIZATION,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
    };
  } catch {
    return DEFAULT_SALES_RETURN_PRINT_CUSTOMIZATION;
  }
}

export function saveSalesReturnPrintCustomization(
  value: SalesReturnPrintCustomization,
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function resetSalesReturnPrintCustomization() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
