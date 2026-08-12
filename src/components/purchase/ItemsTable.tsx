// src/components/purchase/ItemsTable.tsx
import {
  ItemRow,
  Product,
  ReturnSellingRateColumn,
  TransactionMode,
} from "./types";
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

function buildReturnSellingRateColumns(
  rows: ItemRow[],
): ReturnSellingRateColumn[] {
  const columns: ReturnSellingRateColumn[] = [];
  const seen = new Set<string>();
  let needsLegacyColumn = false;

  rows.forEach((row) => {
    const savedRates = row.availableRates || [];

    if (savedRates.length === 0) {
      if (row.salePrice != null) needsLegacyColumn = true;
      return;
    }

    savedRates.forEach((rate) => {
      const key =
        String(rate.rateTypeId || "").trim() ||
        String(rate.code || "")
          .trim()
          .toUpperCase() ||
        String(rate.name || "")
          .trim()
          .toUpperCase();

      if (!key || seen.has(key)) return;
      seen.add(key);
      columns.push({
        key,
        rateTypeId: rate.rateTypeId || null,
        code: rate.code || null,
        name: rate.name || rate.code || "Saved rate",
        isDefault: Boolean(rate.isDefault),
      });
    });
  });

  if (needsLegacyColumn) {
    columns.push({
      key: "__LEGACY_DEFAULT__",
      name: "Legacy Default",
      isDefault: true,
      legacy: true,
    });
  }

  return columns;
}

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
  returnRateLabel?: string;
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
  returnRateLabel = "Cost Rate",
}: ItemsTableProps) {
  const visibleRateTypes = mode === "PURCHASE" ? rateTypes : [];
  const returnSellingRateColumns =
    mode === "RETURN" && uiSettings.showSellingRates
      ? buildReturnSellingRateColumns(rows)
      : [];

  const hiddenColumns: ColKey[] = [
    ...(!uiSettings.showUnit ? (["unit"] as const) : []),
    ...(!uiSettings.showTax ? (["tax"] as const) : []),
    ...(!uiSettings.showLineDiscount ? (["discount"] as const) : []),
    ...(mode === "RETURN"
      ? (["profitPercent", "salePrice"] as const)
      : mode !== "PURCHASE"
        ? (["profitPercent"] as const)
        : []),
    ...(mode === "PURCHASE" && !uiSettings.showSellingRates
      ? (["profitPercent", "salePrice"] as const)
      : []),
    ...(!uiSettings.showMrp ? (["mrp"] as const) : []),
    ...(!uiSettings.showLineType ? (["lineType"] as const) : []),
    ...(mode !== "PURCHASE" ? (["batchNo"] as const) : []),
    ...(!uiSettings.showMfgDate ? (["mfgDate"] as const) : []),
    ...(!uiSettings.showExpiryDate ? (["expiryDate"] as const) : []),
  ];

  const salesColumnOrder: readonly ColKey[] = [
    "product",
    "barcode",
    "quantity",
    "unit",
    "salePrice",
    "rate",
    "tax",
    "discount",
    "mrp",
    "lineType",
    "mfgDate",
    "expiryDate",
  ];

  const gridNavigation: GridNavigationOptions = {
    barcodeEnabled,
    hiddenColumns,
    columnOrder:
      mode === "SALE" || mode === "QUOTATION" ? salesColumnOrder : undefined,
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
    const lowerKey = e.key.toLowerCase();
    if (
      (e.key === "F2" ||
        (mode !== "RETURN" && (e.ctrlKey || e.metaKey) && lowerKey === "b")) &&
      rows[rowIndex]?.productId
    ) {
      e.preventDefault();
      onRequestBatchSelect?.(rowIndex);
      return;
    }

    if (e.key !== "Enter" && e.key !== "NumpadEnter" && e.key !== "Tab") {
      return;
    }
    e.preventDefault();
    const dir: 1 | -1 = e.shiftKey ? -1 : 1;
    if (dir === 1 && !canLeave(col, rowIndex)) return;
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
    setTimeout(() => focusCell(nr, nc), 0);
  }

  useEffect(() => {
    focusCell(0, "product");
  }, []);

  return (
    <div className="w-full">
      <table
        className="purchase-items-table w-full border-collapse text-[13px]"
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
                <span className="inline-flex items-center gap-1.5">
                  Barcode
                  <kbd className="font-mono text-[8px] normal-case tracking-normal text-white/60">
                    F2
                  </kbd>
                </span>
              </th>
            )}
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[70px]">
              Qty
            </th>
            {uiSettings.showUnit ? (
              <th className="min-w-[74px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Unit
              </th>
            ) : null}
            {mode === "SALE" || mode === "QUOTATION" ? (
              <th className="min-w-[132px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Rate Type
              </th>
            ) : null}
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[92px]">
              {mode === "RETURN" ? returnRateLabel : "Rate"}
            </th>
            {mode === "RETURN" && uiSettings.showSellingRates
              ? returnSellingRateColumns.map((column) => (
                  <th
                    key={column.key}
                    className="min-w-[96px] px-2.5 py-2 text-center text-[10px] font-semibold text-white/80"
                    title={
                      column.legacy
                        ? "Single default selling rate saved on a legacy Purchase"
                        : `${column.name}${column.code ? ` (${column.code})` : ""}${column.isDefault ? " - Default" : ""}`
                    }
                  >
                    <span className="inline-flex max-w-[112px] items-center justify-center gap-1">
                      <span className="truncate">{column.name}</span>
                      {column.isDefault ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300"
                          aria-label="Default selling rate"
                        />
                      ) : null}
                    </span>
                  </th>
                ))
              : null}
            {uiSettings.showTax ? (
              <th className="min-w-[84px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Tax
              </th>
            ) : null}
            {uiSettings.showLineDiscount ? (
              <th className="min-w-[130px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Discount
              </th>
            ) : null}

            {mode === "PURCHASE" && uiSettings.showSellingRates ? (
              <>
                <th className="min-w-[88px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  Profit %
                </th>
                {visibleRateTypes.length > 0 ? (
                  visibleRateTypes.map((rateType) => (
                    <th
                      key={rateType.id}
                      className="min-w-[96px] px-2.5 py-2 text-center text-[10px] font-semibold text-white/80"
                      title={`${rateType.name} (${rateType.code})${rateType.isDefault ? " - Default" : ""}`}
                    >
                      <span className="inline-flex max-w-[112px] items-center justify-center gap-1">
                        <span className="truncate">{rateType.name}</span>
                        {rateType.isDefault ? (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300"
                            aria-label="Default selling rate"
                          />
                        ) : null}
                      </span>
                    </th>
                  ))
                ) : (
                  <th className="min-w-[96px] px-2.5 py-2 text-center text-[10px] font-semibold text-white/80">
                    Sale
                  </th>
                )}
              </>
            ) : null}
            {uiSettings.showMrp ? (
              <th className="min-w-[84px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                MRP
              </th>
            ) : null}

            {/* Hidden on mobile/tablet — show from lg breakpoint */}
            {uiSettings.showLineType ? (
              <th className="hidden min-w-[80px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 lg:table-cell">
                Type
              </th>
            ) : null}
            {mode === "PURCHASE" ? (
              <th className="min-w-[118px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Mfr Batch
              </th>
            ) : null}
            {/* Hidden on mobile — show from md breakpoint */}
            {uiSettings.showMfgDate ? (
              <th className="hidden min-w-[120px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 md:table-cell">
                MFG
              </th>
            ) : null}
            {uiSettings.showExpiryDate ? (
              <th className="hidden min-w-[120px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 md:table-cell">
                Expiry
              </th>
            ) : null}
            {uiSettings.showUnitBilled ? (
              <th className="hidden min-w-[110px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 lg:table-cell">
                Unit Billed
              </th>
            ) : null}

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
              returnSellingRateColumns={returnSellingRateColumns}
              purchaseRateTypes={visibleRateTypes}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
