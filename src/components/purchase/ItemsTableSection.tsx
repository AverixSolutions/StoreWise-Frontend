// src/components/purchase/ItemsTableSection.tsx
import { Plus, PauseCircle, List, FileText } from "lucide-react";
import { ItemRow, Product } from "./types";
import ItemsTable from "./ItemsTable";

interface ItemsTableSectionProps {
  rows: ItemRow[];
  products: Product[];
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
}

export default function ItemsTableSection({
  rows,
  products,
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
}: ItemsTableSectionProps) {
  const itemCount = rows.filter((r) => r.productId).length;

  return (
    <section className="col-span-1 min-w-0 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-gray-50 to-gray-100/50 z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Item Details</h2>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {itemCount} items
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onShowReports}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium shadow-sm cursor-pointer"
            title="View Reports"
          >
            <FileText className="w-4 h-4" />
            Reports
          </button>
          {showHoldControls && (
            <>
              <button
                onClick={onHold}
                className="px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center gap-2 font-medium shadow-sm cursor-pointer"
                title="Hold (save draft)"
              >
                <PauseCircle className="w-4 h-4" />
                Hold
              </button>

              <button
                onClick={onShowHolds}
                className="px-3 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-colors flex items-center gap-2 font-medium shadow-sm cursor-pointer"
                title="View Holds"
              >
                <List className="w-4 h-4" />
                Holds
              </button>
            </>
          )}

          <button
            onClick={onAddRow}
            className="px-4 py-2 rounded-lg bg-averix-red-dark text-white hover:bg-averix-red-accent transition-colors flex items-center gap-2 font-medium shadow-sm hover:shadow-md z-20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
        </div>
      </div>

      {/* Table Container */}

      <div className="flex-1 overflow-auto relative overflow-y-scroll">
        <ItemsTable
          rows={rows}
          products={products}
          onSelectProduct={onSelectProduct}
          onUpdateRow={onUpdateRow}
          onRemoveRow={onRemoveRow}
          onAddRow={onAddRow}
          onRequestBatchSelect={onRequestBatchSelect}
        />
      </div>

      {/* Footer Summary */}

      <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50 flex-shrink-0 z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>

              <span>
                Total Items:{" "}
                <span className="font-semibold text-gray-900">{itemCount}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-8 text-sm">
            <div className="text-right">
              <div className="text-gray-600">Sub Total</div>

              <div className="font-semibold text-gray-900 text-base">
                ₹ {subTotal.toFixed(2)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-gray-600">Discount</div>

              <div className="font-semibold text-red-600 text-base">
                - ₹ {Number(headerDiscount ?? 0).toFixed(2)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-gray-600">Grand Total</div>

              <div className="font-bold text-green-700 text-xl">
                ₹ {Number(grandTotal).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
