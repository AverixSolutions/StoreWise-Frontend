import { getTaskPref, type PaperSize } from "@/lib/print/printPreferences";

const STORAGE_KEY = "kynflow_sales_return_ui_settings_v1";

export type SalesReturnBillField =
  | "billNo"
  | "returnDate"
  | "entryTime"
  | "department"
  | "debitAccount"
  | "natureOfEntry"
  | "discount";

export type SalesReturnItemColumn =
  "code" | "barcode" | "mrp" | "tax" | "discount" | "rateType" | "amount";

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
    mrp: false,
    tax: true,
    discount: true,
    rateType: true,
    amount: true,
  },
};

export function loadSalesReturnUiSettings(): SalesReturnUiSettings {
  if (typeof window === "undefined") return DEFAULT_SALES_RETURN_UI_SETTINGS;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
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
