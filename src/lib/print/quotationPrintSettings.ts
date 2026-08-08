export type QuotationPrintFormat = "classic" | "modern" | "thermal";

export type QuotationPrintSettings = {
  format: QuotationPrintFormat;
  preview: boolean;
  printer: string | null;
};

export const DEFAULT_QUOTATION_PRINT_SETTINGS: QuotationPrintSettings = {
  format: "classic",
  preview: true,
  printer: null,
};

const STORAGE_KEY = "kynflow.quotation.print.v1";

export function loadQuotationPrintSettings(): QuotationPrintSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_QUOTATION_PRINT_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_QUOTATION_PRINT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<QuotationPrintSettings>;
    return {
      format:
        parsed.format === "modern" || parsed.format === "thermal"
          ? parsed.format
          : "classic",
      preview: parsed.preview ?? true,
      printer:
        typeof parsed.printer === "string" && parsed.printer.trim()
          ? parsed.printer
          : null,
    };
  } catch {
    return { ...DEFAULT_QUOTATION_PRINT_SETTINGS };
  }
}

export function saveQuotationPrintSettings(settings: QuotationPrintSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
