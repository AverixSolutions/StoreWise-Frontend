export type QuotationUiSettings = {
  showStatus: boolean;
  showDepartment: boolean;
  showHeaderDiscount: boolean;
  showNotes: boolean;
  showStock: boolean;
  showUnit: boolean;
  showTax: boolean;
  showLineDiscount: boolean;
};

export const DEFAULT_QUOTATION_UI_SETTINGS: QuotationUiSettings = {
  showStatus: true,
  showDepartment: true,
  showHeaderDiscount: true,
  showNotes: true,
  showStock: true,
  showUnit: true,
  showTax: true,
  showLineDiscount: true,
};

const STORAGE_KEY = "kynflow.quotation.ui.v1";

export function loadQuotationUiSettings(): QuotationUiSettings {
  if (typeof window === "undefined") return DEFAULT_QUOTATION_UI_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_QUOTATION_UI_SETTINGS;
    return {
      ...DEFAULT_QUOTATION_UI_SETTINGS,
      ...(JSON.parse(raw) as Partial<QuotationUiSettings>),
    };
  } catch {
    return DEFAULT_QUOTATION_UI_SETTINGS;
  }
}

export function saveQuotationUiSettings(settings: QuotationUiSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
