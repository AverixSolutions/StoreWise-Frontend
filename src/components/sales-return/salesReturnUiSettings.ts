import { getTaskPref, type PaperSize } from "@/lib/print/printPreferences";

const LEGACY_STORAGE_KEY = "kynflow_sales_return_ui_settings_v1";
const STORAGE_KEY = "kynflow_sales_return_ui_settings_v2";

export type SalesReturnBillField =
  | "billNo"
  | "returnDate"
  | "entryTime"
  | "department"
  | "debitAccount"
  | "natureOfEntry"
  | "discount";

export type SalesReturnItemColumn =
  | "code"
  | "barcode"
  | "unit"
  | "mrp"
  | "tax"
  | "discount"
  | "rateType"
  | "amount";

export type SalesReturnUiSettings = {
  billDetails: Record<SalesReturnBillField, boolean>;
  itemColumns: Record<SalesReturnItemColumn, boolean>;
};

export const DEFAULT_SALES_RETURN_UI_SETTINGS: SalesReturnUiSettings = {
  billDetails: {
    billNo: true,
    returnDate: true,
    entryTime: true,
    department: true,
    debitAccount: true,
    natureOfEntry: true,
    discount: true,
  },
  itemColumns: {
    code: true,
    barcode: true,
    unit: false,
    mrp: false,
    tax: false,
    discount: true,
    rateType: true,
    amount: true,
  },
};

export function loadSalesReturnUiSettings(): SalesReturnUiSettings {
  if (typeof window === "undefined") return DEFAULT_SALES_RETURN_UI_SETTINGS;
  try {
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    if (currentRaw) {
      const raw = JSON.parse(currentRaw);
      return {
        billDetails: {
          ...DEFAULT_SALES_RETURN_UI_SETTINGS.billDetails,
          ...(raw.billDetails || {}),
        },
        itemColumns: {
          ...DEFAULT_SALES_RETURN_UI_SETTINGS.itemColumns,
          ...(raw.itemColumns || {}),
        },
      };
    }

    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
    const migrated: SalesReturnUiSettings = {
      billDetails: {
        ...DEFAULT_SALES_RETURN_UI_SETTINGS.billDetails,
        ...(legacy.billDetails || {}),
      },
      itemColumns: {
        ...DEFAULT_SALES_RETURN_UI_SETTINGS.itemColumns,
        ...(legacy.itemColumns || {}),
        unit: false,
        tax: false,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return DEFAULT_SALES_RETURN_UI_SETTINGS;
  }
}

export function saveSalesReturnUiSettings(settings: SalesReturnUiSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getSalesReturnPrintSummary(): {
  paperSize: PaperSize;
  preview: boolean;
  printer: string | null;
} {
  return getTaskPref("salesReturn");
}
