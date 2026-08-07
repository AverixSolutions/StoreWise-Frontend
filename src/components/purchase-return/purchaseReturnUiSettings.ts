"use client";

import type { PurchaseUiSettings } from "@/components/purchase/purchaseUiSettings";

export type PurchaseReturnUiSettings = PurchaseUiSettings;

export const DEFAULT_PURCHASE_RETURN_UI_SETTINGS: PurchaseReturnUiSettings = {
  showTransactionType: true,
  showPurchaseTime: false,
  showEntryDate: false,
  showDepartment: false,
  showDebitAccount: false,
  showNatureOfEntry: false,
  showHeaderDiscount: true,
  showUnit: true,
  showTax: false,
  showLineDiscount: true,
  showSellingRates: true,
  showMrp: false,
  showLineType: false,
  showMfgDate: false,
  showExpiryDate: false,
  showUnitBilled: true,
};

const STORAGE_KEY = "kynflow.purchaseReturn.ui.v2";

export function loadPurchaseReturnUiSettings(): PurchaseReturnUiSettings {
  if (typeof window === "undefined") {
    return DEFAULT_PURCHASE_RETURN_UI_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PURCHASE_RETURN_UI_SETTINGS;

    return {
      ...DEFAULT_PURCHASE_RETURN_UI_SETTINGS,
      ...(JSON.parse(raw) as Partial<PurchaseReturnUiSettings>),
    };
  } catch {
    return DEFAULT_PURCHASE_RETURN_UI_SETTINGS;
  }
}

export function savePurchaseReturnUiSettings(
  settings: PurchaseReturnUiSettings,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
