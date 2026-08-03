"use client";

export type PurchaseUiSettings = {
  showTransactionType: boolean;
  showPurchaseTime: boolean;
  showEntryDate: boolean;
  showDepartment: boolean;
  showDebitAccount: boolean;
  showNatureOfEntry: boolean;
  showHeaderDiscount: boolean;
  showUnit: boolean;
  showTax: boolean;
  showLineDiscount: boolean;
  showSellingRates: boolean;
  showMrp: boolean;
  showLineType: boolean;
  showMfgDate: boolean;
  showExpiryDate: boolean;
  showUnitBilled: boolean;
};

export const DEFAULT_PURCHASE_UI_SETTINGS: PurchaseUiSettings = {
  showTransactionType: true,
  showPurchaseTime: true,
  showEntryDate: true,
  showDepartment: true,
  showDebitAccount: true,
  showNatureOfEntry: true,
  showHeaderDiscount: true,
  showUnit: true,
  showTax: true,
  showLineDiscount: true,
  showSellingRates: true,
  showMrp: true,
  showLineType: true,
  showMfgDate: true,
  showExpiryDate: true,
  showUnitBilled: true,
};

export const FULL_PURCHASE_UI_SETTINGS: PurchaseUiSettings = {
  ...DEFAULT_PURCHASE_UI_SETTINGS,
};

// v2 intentionally resets the former compact-by-default layout once.
// From this version onward every field is visible until the user hides it.
const STORAGE_KEY = "kynflow.purchase.ui.v2";

export function loadPurchaseUiSettings(): PurchaseUiSettings {
  if (typeof window === "undefined") return DEFAULT_PURCHASE_UI_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PURCHASE_UI_SETTINGS;

    return {
      ...DEFAULT_PURCHASE_UI_SETTINGS,
      ...(JSON.parse(raw) as Partial<PurchaseUiSettings>),
    };
  } catch {
    return DEFAULT_PURCHASE_UI_SETTINGS;
  }
}

export function savePurchaseUiSettings(settings: PurchaseUiSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
