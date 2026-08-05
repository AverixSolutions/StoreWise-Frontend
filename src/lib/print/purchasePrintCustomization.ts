export type PurchaseA4Style = "classic" | "modern";

export type PurchasePrintCustomization = {
  a4Style: PurchaseA4Style;
  documentTitle: string;
  headingColor: string;

  showLogo: boolean;
  showShopName: boolean;
  showShopAddress: boolean;
  showShopPhone: boolean;
  showShopEmail: boolean;
  showShopGstin: boolean;

  showSupplierName: boolean;
  showSupplierAddress: boolean;
  showSupplierPhone: boolean;
  showSupplierEmail: boolean;
  showSupplierGstin: boolean;

  showEntryNo: boolean;
  showBillNo: boolean;
  showPurchaseDate: boolean;
  showEntryTime: boolean;
  showPurchaseType: boolean;
  showTransactionType: boolean;
  showDepartment: boolean;
  showDebitAccount: boolean;
  showNatureOfEntry: boolean;

  showBarcode: boolean;
  showBatchNo: boolean;
  showExpiryDate: boolean;
  showUnit: boolean;
  showTax: boolean;

  showAmountInWords: boolean;
  showTerms: boolean;
  showAuthorizedSignatory: boolean;
  showKynflowFooter: boolean;
};

const STORAGE_KEY = "kynflow_purchase_print_customization";
const CHANGE_EVENT = "kynflow:purchase-print-customization";

export const DEFAULT_PURCHASE_PRINT_CUSTOMIZATION: PurchasePrintCustomization =
  {
    a4Style: "classic",
    documentTitle: "Purchase Bill",
    headingColor: "#1e3a5f",

    showLogo: true,
    showShopName: true,
    showShopAddress: true,
    showShopPhone: true,
    showShopEmail: true,
    showShopGstin: true,

    showSupplierName: true,
    showSupplierAddress: true,
    showSupplierPhone: true,
    showSupplierEmail: true,
    showSupplierGstin: true,

    showEntryNo: true,
    showBillNo: true,
    showPurchaseDate: true,
    showEntryTime: true,
    showPurchaseType: true,
    showTransactionType: true,
    showDepartment: true,
    showDebitAccount: true,
    showNatureOfEntry: true,

    showBarcode: true,
    showBatchNo: true,
    showExpiryDate: true,
    showUnit: true,
    showTax: true,

    showAmountInWords: true,
    showTerms: true,
    showAuthorizedSignatory: true,
    showKynflowFooter: true,
  };

function cleanHex(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text)
    ? text.toLowerCase()
    : DEFAULT_PURCHASE_PRINT_CUSTOMIZATION.headingColor;
}

function normalize(
  value: Partial<PurchasePrintCustomization> | null | undefined,
): PurchasePrintCustomization {
  const source = value && typeof value === "object" ? value : {};

  return {
    ...DEFAULT_PURCHASE_PRINT_CUSTOMIZATION,
    ...source,
    a4Style: source.a4Style === "modern" ? "modern" : "classic",
    documentTitle:
      String(source.documentTitle ?? "").trim() ||
      DEFAULT_PURCHASE_PRINT_CUSTOMIZATION.documentTitle,
    headingColor: cleanHex(source.headingColor),
  };
}

export function getPurchasePrintCustomization(): PurchasePrintCustomization {
  try {
    if (typeof localStorage === "undefined") {
      return { ...DEFAULT_PURCHASE_PRINT_CUSTOMIZATION };
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_PURCHASE_PRINT_CUSTOMIZATION };
  }
}

export function setPurchasePrintCustomization(
  updates: Partial<PurchasePrintCustomization>,
): PurchasePrintCustomization {
  const next = normalize({
    ...getPurchasePrintCustomization(),
    ...updates,
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  } catch {}

  return next;
}

export function resetPurchasePrintCustomization(): PurchasePrintCustomization {
  const next = { ...DEFAULT_PURCHASE_PRINT_CUSTOMIZATION };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  } catch {}

  return next;
}

export function subscribePurchasePrintCustomization(
  listener: (value: PurchasePrintCustomization) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handle = (event: Event) => {
    const detail = (event as CustomEvent<PurchasePrintCustomization>).detail;
    listener(detail ? normalize(detail) : getPurchasePrintCustomization());
  };

  window.addEventListener(CHANGE_EVENT, handle);
  return () => window.removeEventListener(CHANGE_EVENT, handle);
}
