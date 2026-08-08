import {
  DEFAULT_SALES_PRINT_CUSTOMIZATION,
  type SalesPrintCustomization,
} from "./salesPrintCustomization";

export type QuotationPrintCustomization = SalesPrintCustomization;

export const DEFAULT_QUOTATION_PRINT_CUSTOMIZATION: QuotationPrintCustomization =
  {
    ...DEFAULT_SALES_PRINT_CUSTOMIZATION,
    a4Style: "classic",
    documentTitle: "Quotation",
    showSaleType: false,
    showTransactionType: false,
    showDebitAccount: false,
    showNatureOfEntry: false,
    showOffers: false,
    showOfferSavings: false,
    showMrp: true,
  };

const STORAGE_KEY = "kynflow.quotation.print.customization.v1";
const EVENT_NAME = "kynflow:quotation-print-customization";

function normalize(
  value?: Partial<QuotationPrintCustomization> | null,
): QuotationPrintCustomization {
  return {
    ...DEFAULT_QUOTATION_PRINT_CUSTOMIZATION,
    ...(value || {}),
    documentTitle: "Quotation",
    showSaleType: false,
    showTransactionType: false,
    showDebitAccount: false,
    showNatureOfEntry: false,
    showOffers: false,
    showOfferSavings: false,
  };
}

export function getQuotationPrintCustomization(): QuotationPrintCustomization {
  if (typeof window === "undefined") {
    return { ...DEFAULT_QUOTATION_PRINT_CUSTOMIZATION };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_QUOTATION_PRINT_CUSTOMIZATION };
    return normalize(
      JSON.parse(raw) as Partial<QuotationPrintCustomization> | null,
    );
  } catch {
    return { ...DEFAULT_QUOTATION_PRINT_CUSTOMIZATION };
  }
}

export function setQuotationPrintCustomization(
  patch: Partial<QuotationPrintCustomization>,
): QuotationPrintCustomization {
  const next = normalize({
    ...getQuotationPrintCustomization(),
    ...patch,
  });

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent<QuotationPrintCustomization>(EVENT_NAME, {
        detail: next,
      }),
    );
  }

  return next;
}

export function resetQuotationPrintCustomization(): QuotationPrintCustomization {
  const next = { ...DEFAULT_QUOTATION_PRINT_CUSTOMIZATION };

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent<QuotationPrintCustomization>(EVENT_NAME, {
        detail: next,
      }),
    );
  }

  return next;
}

export function subscribeQuotationPrintCustomization(
  listener: (next: QuotationPrintCustomization) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const onChange = (event: Event) => {
    const detail = (
      event as CustomEvent<QuotationPrintCustomization | undefined>
    ).detail;
    listener(detail ? normalize(detail) : getQuotationPrintCustomization());
  };

  window.addEventListener(EVENT_NAME, onChange);
  return () => window.removeEventListener(EVENT_NAME, onChange);
}
