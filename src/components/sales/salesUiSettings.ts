"use client";

export type SalesUiSettings = {
  allowCashSaleWithoutCustomer: boolean;
  showTransactionType: boolean;
  showSaleTime: boolean;
  showEntryDate: boolean;
  showDepartment: boolean;
  showDebitAccount: boolean;
  showNatureOfEntry: boolean;
  showHeaderDiscount: boolean;
  showUnit: boolean;
  showTax: boolean;
  showLineDiscount: boolean;
  showMrp: boolean;
  showLineType: boolean;
  showMfgDate: boolean;
  showExpiryDate: boolean;
  showUnitBilled: boolean;
  showBarcodeInput: boolean;
};

export const DEFAULT_SALES_UI_SETTINGS: SalesUiSettings = {
  allowCashSaleWithoutCustomer: false,
  showTransactionType: true,
  showSaleTime: true,
  showEntryDate: true,
  showDepartment: true,
  showDebitAccount: true,
  showNatureOfEntry: true,
  showHeaderDiscount: true,
  showUnit: false,
  showTax: false,
  showLineDiscount: true,
  showMrp: true,
  showLineType: true,
  showMfgDate: false,
  showExpiryDate: false,
  showUnitBilled: true,
  showBarcodeInput: true,
};

// V2 intentionally starts Sales with optional Unit, Tax, MFG and Expiry hidden.
// Users can enable any of them from Sales Settings.
const STORAGE_KEY = "kynflow.sales.ui.v2";

export function loadSalesUiSettings(): SalesUiSettings {
  if (typeof window === "undefined") return DEFAULT_SALES_UI_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SALES_UI_SETTINGS;
    return {
      ...DEFAULT_SALES_UI_SETTINGS,
      ...(JSON.parse(raw) as Partial<SalesUiSettings>),
    };
  } catch {
    return DEFAULT_SALES_UI_SETTINGS;
  }
}

export function saveSalesUiSettings(settings: SalesUiSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
