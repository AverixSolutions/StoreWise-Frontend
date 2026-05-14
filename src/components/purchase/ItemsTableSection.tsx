// src/components/purchase/ItemsTableSection.tsx
import {
  Plus,
  PackagePlus,
  PauseCircle,
  List,
  FileText,
  Receipt,
} from "lucide-react";
import { ItemRow, Product } from "./types";
import ItemsTable from "./ItemsTable";

interface ItemsTableSectionProps {
  rows: ItemRow[];
  products: Product[];
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
  onShowReports: () => void;
  showHoldControls?: boolean;
  onRequestBatchSelect?: (rowIndex: number) => void;
  onBarcodeCommit?: (rowIndex: number) => void;
  printBarcodesSlot?: React.ReactNode;
  onOpenMobileSheet?: () => void;
  hasMissingFields?: boolean;
  barcodeEnabled?: boolean;
}

export default function ItemsTableSection({
  rows,
  products,
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
  onShowReports,
  showHoldControls = true,
  onRequestBatchSelect,
  onBarcodeCommit,
  printBarcodesSlot,
  onOpenMobileSheet,
  hasMissingFields = false,
  barcodeEnabled = true,
}: ItemsTableSectionProps) {
  const itemCount = rows.filter((r) => r.productId).length;

  return (
    <section className="col-span-1 min-w-0 bg-white rounded-none shadow-none border-0 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header bar */}
      <div
        className="px-4 py-2.5 flex items-center justify-between flex-shrink-0 z-10 border-b border-white"
        style={{ background: "#1e3a5f" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Change 2 — Mobile "Bill Details" button in header */}
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
        </div>

        {/* Change 1 — Responsive toolbar with wrapped buttons and hidden labels */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {barcodeEnabled && printBarcodesSlot}

          <button
            onClick={onShowReports}
            className="px-2 sm:px-3 py-1.5 rounded-md bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="View Reports"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reports</span>
          </button>

          {showHoldControls && (
            <>
              <button
                onClick={onHold}
                className="px-2 sm:px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-200 hover:bg-amber-500/30 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                title="Hold (save draft)"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hold</span>
              </button>

              <button
                onClick={onShowHolds}
                className="px-2 sm:px-3 py-1.5 rounded-md bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                title="View Holds"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Holds</span>
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
        {/* Horizontal scroll hint — mobile only */}
        <div className="md:hidden text-[10px] text-slate-400 px-3 py-1 bg-slate-50 border-b">
          ← Scroll horizontally for more columns
        </div>
        <ItemsTable
          rows={rows}
          products={products}
          onSelectProduct={onSelectProduct}
          onUpdateRow={onUpdateRow}
          onRemoveRow={onRemoveRow}
          onAddRow={onAddRow}
          onRequestBatchSelect={onRequestBatchSelect}
          onBarcodeCommit={onBarcodeCommit}
          barcodeEnabled={barcodeEnabled}
        />
      </div>

      {/* Change 3 — Compact footer on mobile */}
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
                ₹ {subTotal.toFixed(2)}
              </div>
            </div>

            <div className="hidden sm:block text-right">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">
                Discount
              </div>
              <div className="font-semibold text-rose-500">
                - ₹ {Number(headerDiscount ?? 0).toFixed(2)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wide font-medium">
                Grand Total
              </div>
              <div className="font-bold text-[#1e3a5f] text-base sm:text-lg">
                ₹ {Number(grandTotal).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
