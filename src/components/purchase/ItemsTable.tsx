// src/components/purchase/ItemsTable.tsx
import { ItemRow, Product, TransactionMode } from "./types";
import type { RateTypeRecord } from "@/platform/types";
import ItemTableRow from "./ItemTableRow";
import { useEffect } from "react";
import {
  focusCell,
  nextCell,
  type ColKey,
  type GridNavigationOptions,
} from "./keyboardGrid";
import {
  FULL_PURCHASE_UI_SETTINGS,
  type PurchaseUiSettings,
} from "./purchaseUiSettings";

interface ItemsTableProps {
  rows: ItemRow[];
  products: Product[];
  rateTypes?: RateTypeRecord[];
  onSelectProduct: (rowIndex: number, productId: string) => void;
  onUpdateRow: (index: number, patch: Partial<ItemRow>) => void;
  onRemoveRow: (index: number) => void;
  onAddRow?: () => void;
  onRequestBatchSelect?: (rowIndex: number) => void;
  onBarcodeCommit?: (rowIndex: number) => void;
  barcodeEnabled?: boolean;
  mode?: TransactionMode;
  uiSettings?: PurchaseUiSettings;
  onFocusPreviousSection?: () => void;
}

export default function ItemsTable({
  rows,
  products,
  rateTypes = [],
  onSelectProduct,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
  onRequestBatchSelect,
  onBarcodeCommit,
  barcodeEnabled = true,
  mode = "PURCHASE",
  uiSettings = FULL_PURCHASE_UI_SETTINGS,
  onFocusPreviousSection,
}: ItemsTableProps) {
  const visibleRateTypes = mode === "PURCHASE" ? rateTypes : [];
  const rateHeaderCount = Math.max(1, visibleRateTypes.length);
  const sellingRatesWidth = Math.max(
    170,
    72 + rateHeaderCount * 82 + rateHeaderCount * 6,
  );

  const hiddenColumns: ColKey[] =
    mode === "PURCHASE"
      ? [
          ...(!uiSettings.showUnit ? (["unit"] as const) : []),
          ...(!uiSettings.showTax ? (["tax"] as const) : []),
          ...(!uiSettings.showLineDiscount ? (["discount"] as const) : []),
          ...(!uiSettings.showSellingRates
            ? (["profitPercent", "salePrice"] as const)
            : []),
          ...(!uiSettings.showMrp ? (["mrp"] as const) : []),
          ...(!uiSettings.showLineType ? (["lineType"] as const) : []),
          ...(!uiSettings.showMfgDate ? (["mfgDate"] as const) : []),
          ...(!uiSettings.showExpiryDate ? (["expiryDate"] as const) : []),
        ]
      : [];

  const gridNavigation: GridNavigationOptions = {
    barcodeEnabled,
    hiddenColumns,
  };

  const REQUIRED: Partial<Record<ColKey, (r: ItemRow) => boolean>> = {
    product: (r) => !!r.productId,
    unit: (r) => !!r.unit,
    quantity: (r) => Number(r.quantity) > 0,
    rate: (r) => Number(r.rate) >= 0,
  };

  function canLeave(col: ColKey, rowIndex: number) {
    const rule = REQUIRED[col];
    return rule ? rule(rows[rowIndex]) : true;
  }

  function handleGridKey(
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    col: ColKey,
  ) {
    if (e.key !== "Enter" && e.key !== "NumpadEnter" && e.key !== "Tab") {
      return;
    }
    e.preventDefault();
    if (!canLeave(col, rowIndex)) return;
    const dir: 1 | -1 = e.shiftKey ? -1 : 1;
    const { rowIndex: nr, col: nc } = nextCell(
      rowIndex,
      col,
      dir,
      gridNavigation,
    );
    if (nr >= rows.length) {
      if (onAddRow && dir === 1) {
        onAddRow();
        setTimeout(() => focusCell(nr, nc), 0);
      }
      return;
    }
    if (nr < 0) {
      if (dir === -1) onFocusPreviousSection?.();
      return;
    }
    focusCell(nr, nc);
  }

  useEffect(() => {
    focusCell(0, "product");
  }, []);

  return (
    <div className="w-full">
      <table
        className="w-full border-collapse text-[13px]"
        style={
          {
            ["--slw" as any]: "52px",
            ["--actw" as any]: "56px",
          } as React.CSSProperties
        }
      >
        <thead className="sticky top-0 z-50" style={{ background: "#1e3a5f" }}>
          <tr className="divide-x divide-white/10">
            <th
              className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] sticky left-0 z-[60] w-[52px] min-w-[52px] pointer-events-none"
              style={{ background: "#1e3a5f" }}
            >
              Sl.NO
            </th>
            <th
              className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] sticky z-[60] min-w-[180px]"
              style={{ background: "#1e3a5f", left: "var(--slw)" }}
            >
              Product
            </th>
            {barcodeEnabled && (
              <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[110px]">
                Barcode
              </th>
            )}
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[70px]">
              Qty
            </th>
            <th
              className={`px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[74px]${mode === "PURCHASE" && !uiSettings.showUnit ? " hidden" : ""}`}
            >
              Unit
            </th>
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[84px]">
              Rate
            </th>
            <th
              className={`px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[84px]${mode === "PURCHASE" && !uiSettings.showTax ? " hidden" : ""}`}
            >
              Tax
            </th>
            <th
              className={`px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[130px]${mode === "PURCHASE" && !uiSettings.showLineDiscount ? " hidden" : ""}`}
            >
              Discount
            </th>

            <th
              className={`px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em]${mode === "PURCHASE" ? "" : " min-w-[640px]"}${mode === "PURCHASE" && !uiSettings.showSellingRates ? " hidden" : ""}`}
              style={
                mode === "PURCHASE"
                  ? { minWidth: sellingRatesWidth }
                  : undefined
              }
            >
              {mode === "SALE" || mode === "QUOTATION" ? (
                "Rate Type"
              ) : mode === "PURCHASE" ? (
                <div className="flex min-w-max items-center gap-1.5 whitespace-nowrap normal-case tracking-normal">
                  <span className="w-[72px] shrink-0 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-white/75">
                    Profit %
                  </span>
                  {visibleRateTypes.length > 0 ? (
                    visibleRateTypes.map((rateType) => (
                      <span
                        key={rateType.id}
                        className="flex w-[82px] shrink-0 items-center justify-center gap-1 text-[9px] font-semibold text-white/85"
                        title={`${rateType.name} (${rateType.code})${rateType.isDefault ? " - Default" : ""}`}
                      >
                        <span className="truncate">{rateType.name}</span>
                        {rateType.isDefault ? (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300"
                            aria-label="Default rate"
                          />
                        ) : null}
                      </span>
                    ))
                  ) : (
                    <span className="w-[82px] shrink-0 text-center text-[9px] font-semibold text-white/85">
                      Sale
                    </span>
                  )}
                </div>
              ) : (
                "Selling Rates"
              )}
            </th>
            <th
              className={`px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[84px]${mode === "PURCHASE" && !uiSettings.showMrp ? " hidden" : ""}`}
            >
              MRP
            </th>

            {/* Hidden on mobile/tablet — show from lg breakpoint */}
            <th
              className={`px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[80px] hidden lg:table-cell${mode === "PURCHASE" && !uiSettings.showLineType ? " hidden" : ""}`}
            >
              Type
            </th>
            {/* Hidden on mobile — show from md breakpoint */}
            <th
              className={`px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[120px] hidden md:table-cell${mode === "PURCHASE" && !uiSettings.showMfgDate ? " hidden" : ""}`}
            >
              MFG
            </th>
            <th
              className={`px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[120px] hidden md:table-cell${mode === "PURCHASE" && !uiSettings.showExpiryDate ? " hidden" : ""}`}
            >
              Expiry
            </th>
            <th
              className={`px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[110px] hidden lg:table-cell${mode === "PURCHASE" && !uiSettings.showUnitBilled ? " hidden" : ""}`}
            >
              Unit Billed
            </th>

            <th
              className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] sticky z-[60] min-w-[90px]"
              style={{ background: "#1e3a5f", right: "var(--actw)" }}
            >
              Total
            </th>
            <th
              className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] sticky right-0 z-[60] w-[56px] min-w-[56px] pointer-events-none"
              style={{ background: "#1e3a5f" }}
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((r, idx) => (
            <ItemTableRow
              key={r.lineNo}
              row={r}
              index={idx}
              products={products}
              onSelectProduct={onSelectProduct}
              onUpdateRow={onUpdateRow}
              onRemoveRow={onRemoveRow}
              onGridKey={handleGridKey}
              canRemove={rows.length > 1}
              rowsLength={rows.length}
              onAddRow={onAddRow}
              onRequestBatchSelect={onRequestBatchSelect}
              onBarcodeCommit={onBarcodeCommit}
              barcodeEnabled={barcodeEnabled}
              mode={mode}
              uiSettings={uiSettings}
              gridNavigation={gridNavigation}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
