// src/components/purchase/ItemTableRow.tsx
import { X } from "lucide-react";
import {
  ItemRow,
  Product,
  ReturnSellingRateColumn,
  TransactionMode,
} from "./types";
import { toDateInput, fromDateInput, round2 } from "./utils";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import CompactDropdown from "@/components/ui/CompactDropdown";
import {
  focusCell,
  nextCell,
  type GridNavigationOptions,
} from "./keyboardGrid";
import type { RateTypeRecord } from "@/platform/types";
import {
  FULL_PURCHASE_UI_SETTINGS,
  type PurchaseUiSettings,
} from "./purchaseUiSettings";

const cellInput =
  "w-full h-8 px-2 text-xs border border-gray-300 rounded " +
  "purchase-grid-input bg-white text-slate-800 placeholder:text-slate-400 selection:bg-[#1e3a5f] selection:text-white " +
  "focus:border-[#20b7ff] focus:ring-1 focus:ring-[#20b7ff]/20 " +
  "outline-none transition-colors";

const asDisplay = (n?: number | null) => (n === 0 || n ? String(n) : "");
const asDisplay2 = (n?: number | null) =>
  n === 0 || n ? String(round2(n)) : "";

const parseNum = (e: React.ChangeEvent<HTMLInputElement>) => {
  const v = e.currentTarget.value;
  if (v === "") return undefined;
  const n = e.currentTarget.valueAsNumber;
  return Number.isFinite(n) ? n : undefined;
};

const asDisplayInt = (n?: number | null) =>
  n === 0 || n ? String(Math.round(n)) : "";

const parseIntNum = (e: React.ChangeEvent<HTMLInputElement>) => {
  const v = e.currentTarget.value;
  if (v === "") return undefined;
  const n = e.currentTarget.valueAsNumber;
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : undefined;
};

const parseRoundedNum = (e: React.ChangeEvent<HTMLInputElement>) => {
  const v = e.currentTarget.value;
  if (v === "") return undefined;
  const n = e.currentTarget.valueAsNumber;
  return Number.isFinite(n) ? round2(n) : undefined;
};

interface ItemTableRowProps {
  row: ItemRow;
  index: number;
  products: Product[];
  onSelectProduct: (rowIndex: number, productId: string) => void;
  onUpdateRow: (index: number, patch: Partial<ItemRow>) => void;
  onRemoveRow: (index: number) => void;
  canRemove: boolean;
  onGridKey: (
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    col: any,
  ) => void;
  rowsLength: number;
  onAddRow?: () => void;
  onRequestBatchSelect?: (rowIndex: number) => void;
  onBarcodeCommit?: (rowIndex: number) => void;
  barcodeEnabled?: boolean;
  mode?: TransactionMode;
  uiSettings?: PurchaseUiSettings;
  gridNavigation?: GridNavigationOptions;
  returnSellingRateColumns?: ReturnSellingRateColumn[];
  purchaseRateTypes?: RateTypeRecord[];
}

export default function ItemTableRow({
  row: r,
  index: idx,
  products,
  onSelectProduct,
  onUpdateRow,
  onRemoveRow,
  canRemove,
  onGridKey,
  rowsLength,
  onAddRow,
  onRequestBatchSelect,
  onBarcodeCommit,
  barcodeEnabled = true,
  mode = "PURCHASE",
  uiSettings = FULL_PURCHASE_UI_SETTINGS,
  gridNavigation = { barcodeEnabled },
  returnSellingRateColumns = [],
  purchaseRateTypes = [],
}: ItemTableRowProps) {
  const taxOptions = [
    { value: "NT", label: "No Tax" },
    { value: "P5", label: "5%" },
    { value: "P12", label: "12%" },
    { value: "P18", label: "18%" },
    { value: "P28", label: "28%" },
  ];

  const unitOptions = [
    { value: "", label: "Select" },
    { value: "NOS", label: "NOS" },
    { value: "KG", label: "KG" },
    { value: "LTR", label: "LTR" },
    { value: "MTR", label: "MTR" },
  ];

  const lineTypeOptions = [
    { value: "VALUED", label: "Valued" },
    { value: "FREE", label: "Free" },
  ];
  const hasOffer = Boolean(r.offerId);
  const rowBg = hasOffer
    ? "bg-cyan-50/70"
    : idx % 2 === 0
      ? "bg-white"
      : "bg-slate-50";
  const stickyRowBg = `${rowBg} group-hover:bg-slate-200 group-focus-within:bg-[#1e3a5f]`;
  const sourcePurchaseLinked =
    mode === "RETURN" && Boolean(r.sourcePurchaseItemId);
  const sourceSaleLinked = mode === "RETURN" && Boolean(r.sourceSaleItemId);
  const sourceLinked = sourcePurchaseLinked;
  const productLocked = sourcePurchaseLinked || sourceSaleLinked;
  const returnQuantityLimit = sourcePurchaseLinked
    ? Math.min(
        Number(r.remainingReturnableQuantity || 0),
        Number(r.sourceAvailableStock || 0),
      )
    : sourceSaleLinked
      ? Number(r.remainingReturnableQuantity || 0)
      : undefined;

  const purchaseRates = purchaseRateTypes.map((rateType) => {
    const savedRate = (r.availableRates || []).find(
      (rate) => rate.rateTypeId === rateType.id,
    );
    return {
      rateTypeId: rateType.id,
      code: rateType.code,
      name: rateType.name,
      amount: savedRate?.amount ?? null,
      configured: savedRate?.amount != null,
      isDefault: Boolean(rateType.isDefault),
    };
  });

  const updatePurchaseNamedRate = (
    rateTypeId: string,
    amount: number | null,
    isDefault: boolean,
  ) => {
    const nextRates = purchaseRates.map((rate) =>
      rate.rateTypeId === rateTypeId
        ? {
            ...rate,
            amount,
            configured: amount != null,
          }
        : rate,
    );

    onUpdateRow(idx, {
      availableRates: nextRates,
      sellingRatesJson: JSON.stringify(
        nextRates.map((rate) => ({
          rateTypeId: rate.rateTypeId,
          code: rate.code,
          name: rate.name,
          amount: rate.amount,
          isDefault: Boolean(rate.isDefault),
        })),
      ),
      ...(isDefault ? { salePrice: amount } : {}),
    });
  };

  const focusPurchaseRate = (rateIndex: number) => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLInputElement>(
        `[data-purchase-rate="${idx}:${rateIndex}"]`,
      );
      target?.focus();
      target?.select();
    });
  };

  const updateReturnNamedRate = (
    column: ReturnSellingRateColumn,
    amount: number | null,
  ) => {
    if (column.legacy) {
      onUpdateRow(idx, { salePrice: amount });
      return;
    }

    const nextRates = [...(r.availableRates || [])];
    const foundIndex = nextRates.findIndex((rate) => {
      if (column.rateTypeId && rate.rateTypeId === column.rateTypeId) {
        return true;
      }
      if (
        column.code &&
        rate.code &&
        rate.code.toUpperCase() === column.code.toUpperCase()
      ) {
        return true;
      }
      return rate.name === column.name;
    });

    const nextRate = {
      rateTypeId:
        column.rateTypeId ||
        nextRates[foundIndex]?.rateTypeId ||
        column.code ||
        column.name,
      code: column.code || nextRates[foundIndex]?.code || column.name,
      name: column.name,
      amount,
      configured: amount != null,
      isDefault: Boolean(column.isDefault),
    };

    if (foundIndex >= 0) {
      nextRates[foundIndex] = {
        ...nextRates[foundIndex],
        ...nextRate,
      };
    } else {
      nextRates.push(nextRate);
    }

    onUpdateRow(idx, {
      availableRates: nextRates,
      sellingRatesJson: JSON.stringify(
        nextRates.map((rate) => ({
          rateTypeId: rate.rateTypeId,
          code: rate.code,
          name: rate.name,
          amount: rate.amount,
          isDefault: Boolean(rate.isDefault),
        })),
      ),
      ...(column.isDefault ? { salePrice: amount } : {}),
    });
  };

  const focusReturnRate = (rateIndex: number) => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLInputElement>(
        `[data-return-rate="${idx}:${rateIndex}"]`,
      );
      target?.focus();
      target?.select();
    });
  };

  const goFrom = (col: import("./keyboardGrid").ColKey, dir: 1 | -1 = 1) => {
    const { rowIndex: nr, col: nc } = nextCell(idx, col, dir, gridNavigation);
    if (nr >= rowsLength && dir === 1 && onAddRow) {
      onAddRow();
      setTimeout(() => focusCell(nr, nc), 0);
      return;
    }
    if (nr < 0) return;
    setTimeout(() => focusCell(nr, nc), 0);
  };

  return (
    <tr
      className={`group border-b border-slate-200 text-slate-900 transition-colors duration-150 hover:bg-slate-200 focus-within:bg-[#1e3a5f] focus-within:text-white divide-x divide-slate-500 ${rowBg}`}
      onKeyDownCapture={(e) => {
        const lowerKey = e.key.toLowerCase();
        const isMoveKey =
          e.key === "Enter" ||
          (e as any).key === "NumpadEnter" ||
          e.key === "Tab";

        if (
          mode === "RETURN" &&
          isMoveKey &&
          e.shiftKey &&
          uiSettings.showSellingRates &&
          returnSellingRateColumns.length > 0
        ) {
          const activeCell = (e.target as HTMLElement).closest<HTMLElement>(
            "[data-cell]",
          );
          const token = activeCell?.dataset.cell || "";
          const activeCol = token.split(":")[1] || "";
          const firstPostRateCol = uiSettings.showTax
            ? "tax"
            : uiSettings.showLineDiscount
              ? "discount"
              : uiSettings.showMrp
                ? "mrp"
                : uiSettings.showLineType
                  ? "lineType"
                  : uiSettings.showMfgDate
                    ? "mfgDate"
                    : uiSettings.showExpiryDate
                      ? "expiryDate"
                      : uiSettings.showUnitBilled
                        ? "unitBilled"
                        : "";

          if (activeCol && activeCol === firstPostRateCol) {
            e.preventDefault();
            e.stopPropagation();
            focusReturnRate(returnSellingRateColumns.length - 1);
            return;
          }
        }

        const batchShortcut =
          e.key === "F2" ||
          (mode !== "RETURN" && (e.ctrlKey || e.metaKey) && lowerKey === "b");
        if (batchShortcut && r.productId) {
          e.preventDefault();
          e.stopPropagation();
          onRequestBatchSelect?.(idx);
        }
      }}
    >
      {/* Sl.NO */}
      <td
        className={`px-2.5 py-2 sticky left-0 ${stickyRowBg} z-40 w-[52px] min-w-[52px] border-r border-slate-300 transition-colors`}
      >
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center justify-center w-7 h-5 rounded bg-gray-100 text-gray-800 text-xs font-mono font-medium">
            {r.lineNo}
          </span>
        </div>
      </td>

      {/* Product */}
      <td
        className={`px-2.5 py-2 min-w-[300px] sticky [left:var(--slw)] ${stickyRowBg} z-40 border-r border-slate-300 transition-colors`}
      >
        <div className="w-full">
          <SearchableDropdown
            value={r.productId}
            onChange={(v) => onSelectProduct(idx, v)}
            onEnter={(dir) => goFrom("product", dir)}
            autoOpenOnFocus
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Select product..."
            className="w-full [&_*]:text-xs"
            controlClassName="h-8 text-xs px-2 w-full"
            menuClassName="text-xs min-w-[280px]"
            buttonProps={{
              disabled: productLocked,
              "data-cell": `${idx}:product`,
              onKeyDown: (e) => onGridKey(e as any, idx, "product"),
            }}
          />
          {hasOffer && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-cyan-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                {r.offerMessage || r.offerName || "Offer Applied"}
              </span>
              {Number(r.offerDiscountAmount || 0) > 0 && (
                <span className="text-[10px] font-semibold text-emerald-600">
                  Saved ₹{round2(r.offerDiscountAmount || 0).toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      </td>

      {barcodeEnabled && (
        <td className="px-2.5 py-2 min-w-[170px]">
          <div className="flex items-center gap-2">
            <input
              className={cellInput + " h-9 flex-1"}
              value={r.barcode || ""}
              onChange={(e) =>
                onUpdateRow(idx, { barcode: e.target.value.trim() })
              }
              placeholder="Barcode (optional)"
              data-cell={`${idx}:barcode`}
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.currentTarget.select()}
              onBlur={() => {
                if (onBarcodeCommit) onBarcodeCommit(idx);
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === "F2" ||
                    (mode !== "RETURN" &&
                      e.ctrlKey &&
                      e.key.toLowerCase() === "b")) &&
                  r.productId
                ) {
                  e.preventDefault();
                  if (onRequestBatchSelect) onRequestBatchSelect(idx);
                  return;
                }
                if (e.key === "Enter" || (e as any).key === "NumpadEnter") {
                  e.preventDefault();
                  if (onBarcodeCommit) onBarcodeCommit(idx);
                  onGridKey(e as any, idx, "barcode");
                  return;
                }
                onGridKey(e, idx, "barcode");
              }}
            />
            <label className="flex items-center gap-1 text-[11px] whitespace-nowrap text-gray-600">
              <input
                type="checkbox"
                checked={r.printBarcode !== false}
                onChange={(e) =>
                  onUpdateRow(idx, { printBarcode: e.target.checked })
                }
              />
              Print
            </label>
          </div>
        </td>
      )}

      {/* Quantity */}
      <td className="min-w-[88px] px-2.5 py-2">
        <input
          className={cellInput + " h-9 text-center"}
          type="number"
          value={asDisplay(r.quantity)}
          onChange={(e) => onUpdateRow(idx, { quantity: parseNum(e) })}
          onBlur={(e) => {
            if (e.currentTarget.value === "") onUpdateRow(idx, { quantity: 0 });
          }}
          min={0}
          max={returnQuantityLimit}
          step={1}
          inputMode="numeric"
          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
          placeholder="0"
          data-cell={`${idx}:quantity`}
          aria-label={
            returnQuantityLimit != null
              ? `Return quantity. Maximum ${returnQuantityLimit}`
              : "Return quantity"
          }
          title={
            returnQuantityLimit != null
              ? `Maximum returnable: ${returnQuantityLimit}`
              : undefined
          }
          onKeyDown={(e) => onGridKey(e, idx, "quantity")}
        />
      </td>

      {uiSettings.showUnit ? (
        <>
          {/* Unit */}
          <td className="px-2.5 py-2 min-w-[74px]">
            <CompactDropdown
              value={r.unit || ""}
              onChange={(val) => onUpdateRow(idx, { unit: val as any })}
              onEnter={(dir) => goFrom("unit", dir)}
              autoOpenOnFocus
              options={unitOptions}
              placeholder="Unit"
              className="w-full [&_*]:text-xs [&_button]:h-8 [&_select]:h-8 [&_button]:px-2 [&_select]:px-2"
              buttonProps={{
                "data-cell": `${idx}:unit`,
                onKeyDown: (e: any) => onGridKey(e, idx, "unit"),
              }}
            />
          </td>
        </>
      ) : null}

      {/* Sales rate type — placed immediately before Rate */}
      {mode === "SALE" || mode === "QUOTATION" ? (
        <td className="min-w-[132px] max-w-[148px] px-2 py-2">
          {mode === "SALE" || mode === "QUOTATION" ? (
            <CompactDropdown
              value={
                r.rateSource === "CUSTOM" ? "__CUSTOM__" : r.rateTypeId || ""
              }
              onChange={(value) => {
                if (value === "__CUSTOM__") {
                  onUpdateRow(idx, {
                    rateTypeId: null,
                    rateTypeCode: null,
                    rateTypeName: "Custom",
                    rateSource: "CUSTOM",
                    originalRate: r.rate,
                    originalSalePrice: r.rate,
                    appliedRate: null,
                    offerId: null,
                    offerName: null,
                    offerType: null,
                    offerDiscountAmount: 0,
                    offerMessage: null,
                    offerMeta: null,
                  });
                  return;
                }

                const selected = r.availableRates?.find(
                  (rate) => rate.rateTypeId === value,
                );
                if (!selected?.configured || selected.amount == null) return;

                onUpdateRow(idx, {
                  rateTypeId: selected.rateTypeId,
                  rateTypeCode: selected.code,
                  rateTypeName: selected.name,
                  rateSource: "MASTER",
                  rate: selected.amount,
                  salePrice: selected.amount,
                  originalRate: selected.amount,
                  originalSalePrice: selected.amount,
                  appliedRate: null,
                  offerId: null,
                  offerName: null,
                  offerType: null,
                  offerDiscountAmount: 0,
                  offerMessage: null,
                  offerMeta: null,
                });
              }}
              onEnter={(dir) => goFrom("salePrice", dir)}
              autoOpenOnFocus
              options={[
                ...(!r.rateTypeId && r.rateSource !== "CUSTOM"
                  ? [{ value: "", label: "Legacy" }]
                  : []),
                ...(r.availableRates || []).map((rate) => ({
                  value: rate.rateTypeId,
                  label: rate.configured
                    ? `${rate.name} - Rs. ${rate.amount}`
                    : `${rate.name} - Not configured`,
                })),
                { value: "__CUSTOM__", label: "Custom rate" },
              ]}
              placeholder="Select rate"
              selectedLabel={
                r.rateSource === "CUSTOM"
                  ? "Custom"
                  : r.rateTypeName ||
                    (r.rateSource === "LEGACY" ? "Legacy" : "")
              }
              menuPortal
              menuMinWidth={220}
              hideMenuScrollbar
              menuClassName="text-xs"
              className="w-full min-w-0 [&_*]:text-xs [&_button]:h-8 [&_button]:px-2"
              buttonProps={{
                "data-cell": `${idx}:salePrice`,
                onKeyDown: (e: any) => onGridKey(e, idx, "salePrice"),
                title:
                  "Enter to open/select rate, Shift+Enter to move back, F2 to choose batch",
              }}
            />
          ) : null}
        </td>
      ) : null}

      {/* Cost rate for Purchase Return; editable transaction rate elsewhere */}
      <td className="min-w-[92px] px-2.5 py-2">
        <input
          className={`${cellInput} ${
            sourceLinked
              ? "cursor-default border-slate-200 bg-slate-100 font-semibold text-slate-700"
              : ""
          }`}
          type="number"
          step="0.01"
          value={asDisplay2(r.rate)}
          onChange={(e) => {
            if (sourceLinked) return;
            onUpdateRow(idx, { rate: parseRoundedNum(e) ?? 0 });
          }}
          readOnly={sourceLinked}
          min={0}
          inputMode="decimal"
          placeholder="0.00"
          data-cell={`${idx}:rate`}
          title={
            sourceLinked
              ? "Original cost rate saved on the selected Purchase bill"
              : undefined
          }
          onKeyDown={(e) => {
            const isEnter =
              e.key === "Enter" ||
              (e as any).key === "NumpadEnter" ||
              e.key === "Tab";

            if (sourceLinked) {
              if (
                e.key === "ArrowUp" ||
                e.key === "ArrowDown" ||
                e.key === "e" ||
                e.key === "+" ||
                e.key === "-"
              ) {
                e.preventDefault();
                return;
              }
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              onUpdateRow(idx, {
                rate: round2(Number(e.currentTarget.value || 0) + 1),
              });
              return;
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onUpdateRow(idx, {
                rate: Math.max(
                  0,
                  round2(Number(e.currentTarget.value || 0) - 1),
                ),
              });
              return;
            } else if (e.key === "e" || e.key === "+" || e.key === "-") {
              e.preventDefault();
              return;
            }

            if (isEnter && mode === "RETURN") {
              e.preventDefault();
              if (
                !e.shiftKey &&
                uiSettings.showSellingRates &&
                returnSellingRateColumns.length > 0
              ) {
                focusReturnRate(0);
                return;
              }
              onGridKey(e as any, idx, "rate");
              return;
            }

            if (isEnter) {
              onGridKey(e as any, idx, "rate");
            }
          }}
        />
      </td>

      {mode === "RETURN" && uiSettings.showSellingRates
        ? returnSellingRateColumns.map((column, returnRateIndex) => {
            const savedRate = column.legacy
              ? (r.availableRates || []).length === 0 && r.salePrice != null
                ? {
                    amount: Number(r.salePrice),
                    configured: true,
                    isDefault: true,
                  }
                : null
              : (r.availableRates || []).find((rate) => {
                  if (
                    column.rateTypeId &&
                    rate.rateTypeId === column.rateTypeId
                  ) {
                    return true;
                  }
                  if (
                    column.code &&
                    rate.code &&
                    rate.code.toUpperCase() === column.code.toUpperCase()
                  ) {
                    return true;
                  }
                  return rate.name === column.name;
                }) || null;
            const amount =
              savedRate?.configured && savedRate.amount != null
                ? Number(savedRate.amount)
                : null;

            return (
              <td
                key={column.key}
                className="min-w-[96px] px-2.5 py-2 text-center"
                title={`${column.name}${column.isDefault ? " - Default" : ""}. Editable on this Purchase Return only.`}
              >
                <input
                  className={`${cellInput} h-9 min-w-[78px] text-center font-semibold`}
                  type="number"
                  step="0.01"
                  min={0}
                  value={amount == null ? "" : round2(amount)}
                  placeholder="—"
                  inputMode="decimal"
                  data-return-rate={`${idx}:${returnRateIndex}`}
                  onFocus={(event) => event.currentTarget.select()}
                  onClick={(event) => event.currentTarget.select()}
                  onChange={(event) => {
                    const raw = event.currentTarget.value;
                    updateReturnNamedRate(
                      column,
                      raw === "" ? null : round2(Number(raw)),
                    );
                  }}
                  onKeyDown={(event) => {
                    const isEnter =
                      event.key === "Enter" ||
                      (event as any).key === "NumpadEnter" ||
                      event.key === "Tab";
                    if (!isEnter) {
                      if (
                        event.key === "e" ||
                        event.key === "+" ||
                        event.key === "-"
                      ) {
                        event.preventDefault();
                      }
                      return;
                    }

                    event.preventDefault();
                    const direction: 1 | -1 = event.shiftKey ? -1 : 1;
                    const nextIndex = returnRateIndex + direction;

                    if (
                      nextIndex >= 0 &&
                      nextIndex < returnSellingRateColumns.length
                    ) {
                      focusReturnRate(nextIndex);
                      return;
                    }

                    if (direction === -1) {
                      window.setTimeout(() => focusCell(idx, "rate"), 0);
                      return;
                    }

                    onGridKey(event as any, idx, "rate");
                  }}
                />
              </td>
            );
          })
        : null}

      {uiSettings.showTax ? (
        <>
          {/* Tax */}
          <td className="px-2.5 py-2 min-w-[84px]">
            <CompactDropdown
              value={r.taxPercent}
              onChange={(val) => onUpdateRow(idx, { taxPercent: val as any })}
              onEnter={(dir) => goFrom("tax", dir)}
              autoOpenOnFocus
              options={taxOptions}
              placeholder="Tax"
              className="w-full [&_*]:text-xs [&_button]:h-8 [&_select]:h-8 [&_button]:px-2 [&_select]:px-2"
              buttonProps={{
                "data-cell": `${idx}:tax`,
                onKeyDown: (e: any) => onGridKey(e, idx, "tax"),
              }}
            />
          </td>
        </>
      ) : null}

      {uiSettings.showLineDiscount ? (
        <>
          {/* Discount */}
          <td className="px-2.5 py-2 min-w-[130px]">
            <div className="flex items-center gap-2">
              <div className="inline-flex overflow-hidden rounded border border-gray-300">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => onUpdateRow(idx, { discountType: "ABS" })}
                  className={
                    "px-2 h-8 text-xs transition-colors " +
                    (r.discountType === "ABS"
                      ? "bg-[#1e3a5f] text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50")
                  }
                  title="Amount"
                >
                  ₹
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => onUpdateRow(idx, { discountType: "PCT" })}
                  className={
                    "px-2 h-8 text-xs border-l border-gray-300 transition-colors " +
                    (r.discountType === "PCT"
                      ? "bg-[#1e3a5f] text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50")
                  }
                  title="Percent"
                >
                  %
                </button>
              </div>

              <div className="relative flex-1 min-w-[80px]">
                {r.discountType === "ABS" ? (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-500">
                    ₹
                  </span>
                ) : (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-500">
                    %
                  </span>
                )}
                <input
                  className={
                    cellInput +
                    " h-8 " +
                    (r.discountType === "ABS"
                      ? "pl-5 text-right pr-2"
                      : "pr-5 text-right pl-2")
                  }
                  type="number"
                  step={r.discountType === "PCT" ? "0.01" : "1"}
                  value={asDisplay2(r.discount)}
                  onChange={(e) =>
                    onUpdateRow(idx, { discount: parseRoundedNum(e) ?? 0 })
                  }
                  min={0}
                  inputMode={r.discountType === "PCT" ? "decimal" : "numeric"}
                  onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  placeholder="0"
                  data-cell={`${idx}:discount`}
                  onKeyDown={(e) => {
                    const lower = e.key.toLowerCase();
                    if (e.altKey && (lower === "d" || lower === "t")) {
                      e.preventDefault();
                      onUpdateRow(idx, {
                        discountType: r.discountType === "ABS" ? "PCT" : "ABS",
                      });
                      return;
                    }
                    if (e.altKey && lower === "p") {
                      e.preventDefault();
                      onUpdateRow(idx, { discountType: "PCT" });
                      return;
                    }
                    if (e.key === "%") {
                      e.preventDefault();
                      onUpdateRow(idx, { discountType: "PCT" });
                      return;
                    }
                    if (e.altKey && lower === "a") {
                      e.preventDefault();
                      onUpdateRow(idx, { discountType: "ABS" });
                      return;
                    }
                    if (e.key === "₹" || e.key === "$") {
                      e.preventDefault();
                      onUpdateRow(idx, { discountType: "ABS" });
                      return;
                    }
                    if (e.key === "e" || e.key === "+" || e.key === "-") {
                      e.preventDefault();
                      return;
                    }
                    if (e.key === "Enter" || (e as any).key === "NumpadEnter") {
                      onGridKey(e as any, idx, "discount");
                      return;
                    }
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      const cur = Number(
                        (e.currentTarget as HTMLInputElement).value || 0,
                      );
                      const step = r.discountType === "ABS" ? 1 : 0.01;
                      onUpdateRow(idx, {
                        discount:
                          e.key === "ArrowUp"
                            ? round2(cur + step)
                            : Math.max(0, round2(cur - step)),
                      });
                    }
                  }}
                />
              </div>
            </div>
          </td>
        </>
      ) : null}

      {/* Purchase selling rates use one visible column per active Rate Type */}
      {mode === "PURCHASE" && uiSettings.showSellingRates ? (
        <>
          <td className="min-w-[88px] px-2.5 py-2">
            <input
              className={cellInput + " text-center"}
              type="number"
              min={0}
              step={1}
              value={asDisplay(r.profitPercent)}
              aria-label="Profit percentage"
              title="Profit percentage"
              data-cell={`${idx}:profitPercent`}
              onChange={(event) =>
                onUpdateRow(idx, {
                  profitPercent: parseNum(event) ?? 0,
                })
              }
              onWheel={(event) => event.currentTarget.blur()}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (
                  event.key === "e" ||
                  event.key === "+" ||
                  event.key === "-"
                ) {
                  event.preventDefault();
                  return;
                }
                if (
                  event.key !== "Enter" &&
                  event.key !== "NumpadEnter" &&
                  event.key !== "Tab"
                ) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();

                if (event.shiftKey) {
                  onGridKey(event, idx, "profitPercent");
                  return;
                }
                if (purchaseRates.length > 0) {
                  focusPurchaseRate(0);
                  return;
                }
                onGridKey(event, idx, "profitPercent");
              }}
            />
          </td>

          {purchaseRates.length > 0 ? (
            purchaseRates.map((rate, rateIndex) => (
              <td key={rate.rateTypeId} className="min-w-[96px] px-2.5 py-2">
                <input
                  className={cellInput + " text-center"}
                  type="number"
                  min={0}
                  step="0.01"
                  value={rate.amount ?? ""}
                  placeholder="Blank"
                  aria-label={`${rate.name} selling rate`}
                  title={`${rate.name} (${rate.code})${rate.isDefault ? " - Default" : ""}`}
                  data-cell={rateIndex === 0 ? `${idx}:salePrice` : undefined}
                  data-purchase-rate={`${idx}:${rateIndex}`}
                  onChange={(event) =>
                    updatePurchaseNamedRate(
                      rate.rateTypeId,
                      parseRoundedNum(event) ?? null,
                      Boolean(rate.isDefault),
                    )
                  }
                  onWheel={(event) => event.currentTarget.blur()}
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(event) => {
                    if (
                      event.key === "e" ||
                      event.key === "+" ||
                      event.key === "-"
                    ) {
                      event.preventDefault();
                      return;
                    }
                    if (
                      event.key !== "Enter" &&
                      event.key !== "NumpadEnter" &&
                      event.key !== "Tab"
                    ) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();

                    if (event.shiftKey) {
                      if (rateIndex > 0) {
                        focusPurchaseRate(rateIndex - 1);
                      } else {
                        focusCell(idx, "profitPercent");
                      }
                      return;
                    }

                    if (rateIndex + 1 < purchaseRates.length) {
                      focusPurchaseRate(rateIndex + 1);
                      return;
                    }

                    onGridKey(event, idx, "salePrice");
                  }}
                />
              </td>
            ))
          ) : (
            <td className="min-w-[96px] px-2.5 py-2">
              <input
                className={cellInput + " text-center"}
                type="number"
                min={0}
                step="0.01"
                value={asDisplay2(r.salePrice)}
                placeholder="0.00"
                aria-label="Sale price"
                title="Legacy sale price"
                data-cell={`${idx}:salePrice`}
                onChange={(event) =>
                  onUpdateRow(idx, {
                    salePrice: parseRoundedNum(event) ?? 0,
                  })
                }
                onWheel={(event) => event.currentTarget.blur()}
                onFocus={(event) => event.currentTarget.select()}
                onKeyDown={(event) => {
                  if (
                    event.key === "e" ||
                    event.key === "+" ||
                    event.key === "-"
                  ) {
                    event.preventDefault();
                    return;
                  }
                  if (
                    event.key === "Enter" ||
                    event.key === "NumpadEnter" ||
                    event.key === "Tab"
                  ) {
                    onGridKey(event, idx, "salePrice");
                  }
                }}
              />
            </td>
          )}
        </>
      ) : null}

      {uiSettings.showMrp ? (
        <>
          {/* MRP */}
          <td className="px-2.5 py-2 min-w-[84px]">
            <input
              className={cellInput}
              type="number"
              step={1}
              value={asDisplayInt(r.mrp)}
              onChange={(e) => onUpdateRow(idx, { mrp: parseIntNum(e) ?? 0 })}
              min={0}
              inputMode="numeric"
              pattern="\d*"
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              onKeyDown={(e) => {
                if (e.key === "e" || e.key === "+" || e.key === "-") {
                  e.preventDefault();
                }
                if (e.key === "Enter" || (e as any).key === "NumpadEnter") {
                  onGridKey(e as any, idx, "mrp");
                }
              }}
              placeholder="0"
              data-cell={`${idx}:mrp`}
            />
          </td>
        </>
      ) : null}

      {uiSettings.showLineType ? (
        <>
          {/* Line Type */}
          <td className="px-2.5 py-2 min-w-[80px] hidden lg:table-cell text-center">
            <CompactDropdown
              value={r.lineType || "VALUED"}
              onChange={(val) =>
                onUpdateRow(idx, { lineType: (val as any) || "VALUED" })
              }
              onEnter={(dir) => goFrom("lineType", dir)}
              autoOpenOnFocus
              options={lineTypeOptions}
              placeholder="Type"
              className="w-full [&_*]:text-xs [&_button]:h-8 [&_select]:h-8 [&_button]:px-2 [&_select]:px-2"
              buttonProps={{
                "data-cell": `${idx}:lineType`,
                onKeyDown: (e: any) => onGridKey(e, idx, "lineType"),
              }}
            />
          </td>
        </>
      ) : null}

      {uiSettings.showMfgDate ? (
        <>
          {/* MFG Date */}
          <td className="px-2.5 py-2 min-w-[120px] hidden md:table-cell">
            <input
              type="date"
              className={cellInput}
              value={toDateInput(r.mfgDate)}
              onChange={(e) =>
                onUpdateRow(idx, { mfgDate: fromDateInput(e.target.value) })
              }
              data-cell={`${idx}:mfgDate`}
              onKeyDown={(e) => onGridKey(e, idx, "mfgDate")}
            />
          </td>
        </>
      ) : null}

      {uiSettings.showExpiryDate ? (
        <>
          {/* Expiry Date */}
          <td className="px-2.5 py-2 min-w-[120px] hidden md:table-cell">
            <input
              type="date"
              className={cellInput}
              value={toDateInput(r.expiryDate)}
              onChange={(e) =>
                onUpdateRow(idx, { expiryDate: fromDateInput(e.target.value) })
              }
              data-cell={`${idx}:expiryDate`}
              onKeyDown={(e) => onGridKey(e, idx, "expiryDate")}
            />
          </td>
        </>
      ) : null}

      {uiSettings.showUnitBilled ? (
        <>
          {/* Unit Billed */}
          <td className="px-2.5 py-2 min-w-[110px] hidden lg:table-cell text-center">
            <span className="inline-flex items-center px-2 py-1 rounded-md bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/70 text-xs font-semibold">
              ₹{round2(r.unitBilled || 0).toFixed(2)}
            </span>
          </td>
        </>
      ) : null}

      {/* Total */}
      <td
        className={`px-2.5 py-2 min-w-[90px] sticky [right:var(--actw)] ${stickyRowBg} z-40 border-l border-slate-300 text-center transition-colors`}
      >
        <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 text-xs font-semibold">
          ₹{round2(r.billedValue || 0).toFixed(2)}
        </span>
      </td>

      {/* Action */}
      <td
        className={`px-2.5 py-2 sticky right-0 ${stickyRowBg} z-40 w-[56px] min-w-[56px] border-l border-slate-300 transition-colors`}
      >
        <div className="flex justify-center">
          <button
            onClick={() => onRemoveRow(idx)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Remove Item"
            disabled={!canRemove}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
