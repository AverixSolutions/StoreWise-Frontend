// src/components/purchase/ItemsTableSection.tsx
import {
  Plus,
  PackagePlus,
  PauseCircle,
  List,
  FileText,
  Receipt,
  Printer,
  Settings,
  Info,
} from "lucide-react";
import { ItemRow, Product, TransactionMode } from "./types";
import type { RateTypeRecord } from "@/platform/types";
import ItemsTable from "./ItemsTable";
import {
  FULL_PURCHASE_UI_SETTINGS,
  type PurchaseUiSettings,
} from "./purchaseUiSettings";

interface ItemsTableSectionProps {
  rows: ItemRow[];
  products: Product[];
  rateTypes?: RateTypeRecord[];
  onAddProduct?: () => void;
  onSelectProduct: (rowIndex: number, productId: string) => void;
  onUpdateRow: (index: number, patch: Partial<ItemRow>) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  subTotal: number;
  grandTotal: number;
  headerDiscount: number;
  onHold?: () => void;
  onShowHolds?: () => void;
  onPrintBill?: () => void;
  canPrint?: boolean;
  onShowReports: () => void;
  showHoldControls?: boolean;
  onRequestBatchSelect?: (rowIndex: number) => void;
  onBarcodeCommit?: (rowIndex: number) => void;
  printBarcodesSlot?: React.ReactNode;
  offersSlot?: React.ReactNode;
  totalOfferSavings?: number;
  onOpenMobileSheet?: () => void;
  hasMissingFields?: boolean;
  barcodeEnabled?: boolean;
  mode?: TransactionMode;
  uiSettings?: PurchaseUiSettings;
  onOpenSettings?: () => void;
  onOpenDetails?: () => void;
  detailsTitle?: string;
  detailsShortcut?: string;
  onFocusItems?: () => void;
  onFocusBillDetails?: () => void;
  onToggleBillDetails?: () => void;
  onFocusPreviousSection?: () => void;
  returnRateLabel?: string;
}

export default function ItemsTableSection({
  rows,
  products,
  rateTypes = [],
  onAddProduct,
  onSelectProduct,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  subTotal,
  grandTotal,
  headerDiscount,
  onHold,
  onShowHolds,
  onPrintBill,
  onShowReports,
  canPrint = false,
  showHoldControls = true,
  onRequestBatchSelect,
  onBarcodeCommit,
  printBarcodesSlot,
  offersSlot,
  totalOfferSavings = 0,
  onOpenMobileSheet,
  hasMissingFields = false,
  barcodeEnabled = true,
  mode = "PURCHASE",
  uiSettings = FULL_PURCHASE_UI_SETTINGS,
  onOpenSettings,
  onOpenDetails,
  detailsTitle = "Details",
  detailsShortcut = "F5",
  onFocusItems,
  onFocusBillDetails,
  onToggleBillDetails,
  onFocusPreviousSection,
  returnRateLabel = "Cost Rate",
}: ItemsTableSectionProps) {
  const itemCount = rows.filter((r) => r.productId).length;
  const transactionName =
    mode === "SALE"
      ? "sale"
      : mode === "RETURN"
        ? "return"
        : mode === "QUOTATION"
          ? "quotation"
          : "purchase";
  const settingsName =
    mode === "SALE"
      ? "Sales"
      : mode === "RETURN"
        ? "Purchase Return"
        : mode === "QUOTATION"
          ? "Quotation"
          : "Purchase";

  return (
    <section className="col-span-1 min-w-0 bg-white rounded-none shadow-none border-0 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header bar */}
      <div
        className="px-4 py-2.5 flex items-center justify-between flex-shrink-0 z-10 border-b border-white"
        style={{ background: "#1e3a5f" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Change 2 â€” Mobile "Bill Details" button in header */}
          {onOpenMobileSheet && (
            <button
              onClick={onOpenMobileSheet}
              className="md:hidden mr-1 px-3 py-1.5 rounded-md bg-white/20 border border-white/30 text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              Bill
              {hasMissingFields && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              )}
            </button>
          )}

          <h2 className="text-sm font-semibold text-white">Item Details</h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-white/90 border border-white/20">
            {itemCount} items
          </span>

          <div className="hidden items-center gap-1.5 lg:flex">
            {onFocusItems && (
              <button
                type="button"
                onClick={onFocusItems}
                title="Focus item picker (F3)"
                className="inline-flex items-center gap-1 rounded border border-white/30 bg-white/[0.12] px-1.5 py-0.5 text-[9px] text-white hover:bg-white/15"
              >
                <kbd className="font-mono text-[8px] font-semibold text-white">
                  F3
                </kbd>
                Item
              </button>
            )}
            {onFocusBillDetails && (
              <button
                type="button"
                onClick={onFocusBillDetails}
                title="Focus Bill Details (F4)"
                className="inline-flex items-center gap-1 rounded border border-white/30 bg-white/[0.12] px-1.5 py-0.5 text-[9px] text-white hover:bg-white/15"
              >
                <kbd className="font-mono text-[8px] font-semibold text-white">
                  F4
                </kbd>
                Bill
              </button>
            )}
            {onToggleBillDetails && (
              <button
                type="button"
                onClick={onToggleBillDetails}
                title="Toggle Bill Details (Ctrl+\)"
                className="inline-flex items-center gap-1 rounded border border-white/30 bg-white/[0.12] px-1.5 py-0.5 text-[9px] text-white hover:bg-white/15"
              >
                <kbd className="font-mono text-[8px] font-semibold text-white">
                  Ctrl+\
                </kbd>
                Panel
              </button>
            )}
          </div>
        </div>

        {/* Change 1 â€” Responsive toolbar with wrapped buttons and hidden labels */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {barcodeEnabled && printBarcodesSlot}
          {offersSlot}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-white/20 bg-white/15 px-2 text-white transition hover:bg-white/20"
              title={`${settingsName} Settings (F7)`}
              aria-label={`Open ${settingsName} settings`}
            >
              <Settings className="h-3.5 w-3.5" />
              <kbd className="font-mono text-[8px] font-semibold text-white">
                F7
              </kbd>
            </button>
          )}

          {onOpenDetails && (
            <button
              type="button"
              onClick={onOpenDetails}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-300/15 px-2 text-cyan-50 transition hover:bg-cyan-300/20"
              title={`${detailsTitle} (${detailsShortcut})`}
              aria-label={`Open ${detailsTitle}`}
            >
              <Info className="h-3.5 w-3.5" />
              <kbd className="font-mono text-[8px] font-semibold text-white">
                {detailsShortcut}
              </kbd>
            </button>
          )}

          <button
            onClick={onShowReports}
            className="px-2 sm:px-3 py-1.5 rounded-md bg-white/15 border border-white/20 text-white hover:bg-white/20 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="View Reports (F6)"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reports</span>
            <kbd className="hidden font-mono text-[8px] text-white xl:inline-flex">
              F6
            </kbd>
          </button>

          {onPrintBill && (
            <button
              onClick={onPrintBill}
              disabled={!canPrint}
              title={
                canPrint ? "Print Bill (Ctrl+P)" : "Save bill before printing"
              }
              className={`px-2 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium ${
                canPrint
                  ? "bg-white/15 border border-white/20 text-white hover:bg-white/20 cursor-pointer"
                  : "bg-slate-200 border border-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
              <kbd className="hidden font-mono text-[8px] opacity-60 xl:inline-flex">
                Ctrl+P
              </kbd>
            </button>
          )}

          {showHoldControls && (
            <>
              <button
                onClick={onHold}
                className="px-2 sm:px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-200 hover:bg-amber-500/30 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                title={`Hold current ${transactionName} (F9)`}
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hold</span>
                <kbd className="hidden font-mono text-[8px] text-amber-100/60 xl:inline-flex">
                  F9
                </kbd>
              </button>

              <button
                onClick={onShowHolds}
                className="px-2 sm:px-3 py-1.5 rounded-md bg-white/15 border border-white/20 text-white hover:bg-white/20 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                title="View Holds (F8)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Holds</span>
                <kbd className="hidden font-mono text-[8px] text-white xl:inline-flex">
                  F8
                </kbd>
              </button>
            </>
          )}

          {onAddProduct && (
            <button
              type="button"
              onClick={onAddProduct}
              className="px-2 sm:px-3 py-1.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/30 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Add Product"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Product</span>
            </button>
          )}

          <button
            onClick={onAddRow}
            className="px-2 sm:px-3 py-1.5 rounded-md bg-[#20b7ff] text-white hover:bg-[#0ea5ff] transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Add Row</span>
          </button>
        </div>
      </div>

      {/* Table container */}
      <div className="flex-1 min-h-0 overflow-auto" data-grid-scroll-container>
        {/* Horizontal scroll hint â€” mobile only */}
        <div className="md:hidden text-[10px] text-slate-400 px-3 py-1 bg-slate-50 border-b">
          â† Scroll horizontally for more columns
        </div>
        <ItemsTable
          rows={rows}
          products={products}
          rateTypes={rateTypes}
          onSelectProduct={onSelectProduct}
          onUpdateRow={onUpdateRow}
          onRemoveRow={onRemoveRow}
          onAddRow={onAddRow}
          onRequestBatchSelect={onRequestBatchSelect}
          onBarcodeCommit={onBarcodeCommit}
          barcodeEnabled={barcodeEnabled}
          mode={mode}
          uiSettings={uiSettings}
          onFocusPreviousSection={onFocusPreviousSection}
          returnRateLabel={returnRateLabel}
        />
      </div>

      {/* Change 3 â€” Compact footer on mobile */}
      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex-shrink-0 z-10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-[#20b7ff]" />
            <span>
              Items:{" "}
              <span className="font-semibold text-slate-700">{itemCount}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 text-sm justify-end">
            <div className="hidden sm:block text-right">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">
                Sub Total
              </div>
              <div className="font-semibold text-slate-700">
                â‚¹ {subTotal.toFixed(2)}
              </div>
            </div>

            {totalOfferSavings > 0 && (
              <div className="hidden sm:block text-right">
                <div className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">
                  Offer Savings
                </div>
                <div className="font-semibold text-emerald-600">
                  â‚¹ {Number(totalOfferSavings ?? 0).toFixed(2)}
                </div>
              </div>
            )}

            <div className="hidden sm:block text-right">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">
                Bill Discount
              </div>
              <div className="font-semibold text-rose-500">
                - â‚¹ {Number(headerDiscount ?? 0).toFixed(2)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wide font-medium">
                Grand Total
              </div>
              <div className="font-bold text-[#1e3a5f] text-base sm:text-lg">
                â‚¹ {Number(grandTotal).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
