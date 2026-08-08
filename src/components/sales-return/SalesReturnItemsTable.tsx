"use client";

import { useRef } from "react";
import {
  FileText,
  Info,
  Plus,
  Printer,
  Receipt,
  Settings,
  X,
} from "lucide-react";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import CompactDropdown from "@/components/ui/CompactDropdown";
import type { SalesReturnItemRow } from "./types";
import type { SalesReturnUiSettings } from "./salesReturnUiSettings";
import {
  focusSalesReturnCell,
  nextSalesReturnCell,
  type SalesReturnColKey,
} from "./keyboardGrid";

const input =
  "purchase-grid-input h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs text-slate-800 outline-none transition-colors " +
  "selection:bg-[#1e3a5f] selection:text-white focus:border-[#20b7ff] focus:ring-1 focus:ring-[#20b7ff]/20";
const unitOptions = ["NOS", "KG", "LTR", "MTR"].map((value) => ({
  value,
  label: value,
}));
const taxOptions = ["NT", "P5", "P12", "P18", "P28"].map((value) => ({
  value,
  label: value,
}));

export default function SalesReturnItemsTable({
  sourceLinked,
  rows,
  products,
  settings,
  barcodeEnabled,
  onSelectProduct,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onRequestBatchSelect,
  onOpenMobileSheet,
  hasMissingFields = false,
  onOpenSettings,
  onOpenDetails,
  onShowReports,
  onPrintBill,
  canPrint = false,
  onFocusBillDetails,
  onToggleBillDetails,
  onFocusItems,
  onFocusPreviousSection,
}: {
  sourceLinked: boolean;
  rows: SalesReturnItemRow[];
  products: any[];
  settings: SalesReturnUiSettings;
  barcodeEnabled: boolean;
  onSelectProduct: (rowIndex: number, productId: string) => void;
  onUpdateRow: (rowIndex: number, patch: Partial<SalesReturnItemRow>) => void;
  onAddRow: () => void;
  onRemoveRow: (rowIndex: number) => void;
  onRequestBatchSelect: (rowIndex: number, productId?: string) => void;
  onOpenMobileSheet?: () => void;
  hasMissingFields?: boolean;
  onOpenSettings?: () => void;
  onOpenDetails?: () => void;
  onShowReports: () => void;
  onPrintBill?: () => void;
  canPrint?: boolean;
  onFocusBillDetails?: () => void;
  onToggleBillDetails?: () => void;
  onFocusItems?: () => void;
  onFocusPreviousSection?: () => void;
}) {
  const columns = settings.itemColumns;
  const itemCount = rows.filter((row) => row.productId).length;
  const productSelectionPending = useRef<Set<number>>(new Set());
  const activeColumns = [
    ...(!sourceLinked ? (["product"] as SalesReturnColKey[]) : []),
    ...(barcodeEnabled ? (["barcode"] as SalesReturnColKey[]) : []),
    "quantity",
    ...(columns.unit ? (["unit"] as SalesReturnColKey[]) : []),
    "rateType",
    "rate",
    ...(columns.tax ? (["tax"] as SalesReturnColKey[]) : []),
    ...(columns.discount ? (["discount"] as SalesReturnColKey[]) : []),
    ...(columns.mrp ? (["mrp"] as SalesReturnColKey[]) : []),
  ] as SalesReturnColKey[];

  function moveFrom(rowIndex: number, col: SalesReturnColKey, dir: 1 | -1 = 1) {
    if (activeColumns.length === 0) return;

    let target = nextSalesReturnCell(rowIndex, col, dir, activeColumns);
    const maxAttempts = Math.max(4, (rows.length + 1) * activeColumns.length);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (target.rowIndex < 0) {
        onFocusPreviousSection?.();
        return;
      }

      if (target.rowIndex >= rows.length) {
        if (dir === 1 && !sourceLinked) {
          const newRowIndex = rows.length;
          onAddRow();
          window.setTimeout(
            () => focusSalesReturnCell(newRowIndex, activeColumns[0]),
            0,
          );
        }
        return;
      }

      if (focusSalesReturnCell(target.rowIndex, target.col)) return;
      target = nextSalesReturnCell(
        target.rowIndex,
        target.col,
        dir,
        activeColumns,
      );
    }
  }

  function handleMoveKey(
    event: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    col: SalesReturnColKey,
  ) {
    const isMove =
      event.key === "Enter" ||
      event.key === "NumpadEnter" ||
      event.key === "Tab";
    if (!isMove) return false;

    event.preventDefault();
    event.stopPropagation();
    moveFrom(rowIndex, col, event.shiftKey ? -1 : 1);
    return true;
  }

  return (
    <section className="col-span-1 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-0 bg-white shadow-none">
      <div
        className="z-10 flex shrink-0 items-center justify-between border-b border-white px-4 py-2.5"
        style={{ background: "#1e3a5f" }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {onOpenMobileSheet ? (
            <button
              type="button"
              onClick={onOpenMobileSheet}
              className="mr-1 flex items-center gap-1 rounded-md border border-white/30 bg-white/20 px-3 py-1.5 text-xs font-medium text-white md:hidden"
            >
              <Receipt className="h-3.5 w-3.5" />
              Bill
              {hasMissingFields ? (
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              ) : null}
            </button>
          ) : null}

          <h2 className="text-sm font-semibold text-white">Item Details</h2>
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/90">
            {itemCount} items
          </span>

          <div className="hidden items-center gap-1.5 lg:flex">
            {onFocusItems ? (
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
            ) : null}
            {onFocusBillDetails ? (
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
            ) : null}
            {onToggleBillDetails ? (
              <button
                type="button"
                onClick={onToggleBillDetails}
                title="Toggle Bill Details (Ctrl+\\)"
                className="inline-flex items-center gap-1 rounded border border-white/30 bg-white/[0.12] px-1.5 py-0.5 text-[9px] text-white hover:bg-white/15"
              >
                <kbd className="font-mono text-[8px] font-semibold text-white">
                  Ctrl+\
                </kbd>
                Panel
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-white/20 bg-white/15 px-2 text-white transition hover:bg-white/20"
              title="Sales Return Settings (F7)"
            >
              <Settings className="h-3.5 w-3.5" />
              <kbd className="font-mono text-[8px] font-semibold text-white">
                F7
              </kbd>
            </button>
          ) : null}

          {onOpenDetails ? (
            <button
              type="button"
              onClick={onOpenDetails}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-300/15 px-2 text-cyan-50 transition hover:bg-cyan-300/20"
              title="Source Sale Details (F5)"
              aria-label="Open Source Sale Details"
            >
              <Info className="h-3.5 w-3.5" />
              <kbd className="font-mono text-[8px] font-semibold text-white">
                F5
              </kbd>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onShowReports}
            className="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/15 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20 sm:px-3"
            title="View Reports (F6)"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reports</span>
            <kbd className="hidden font-mono text-[8px] text-white xl:inline-flex">
              F6
            </kbd>
          </button>

          {onPrintBill ? (
            <button
              type="button"
              onClick={onPrintBill}
              disabled={!canPrint}
              title={
                canPrint
                  ? "Print Return (Ctrl+P)"
                  : "Save return before printing"
              }
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                canPrint
                  ? "cursor-pointer border border-white/20 bg-white/15 text-white hover:bg-white/20"
                  : "cursor-not-allowed border border-slate-200 bg-slate-200 text-slate-500"
              }`}
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print</span>
              <kbd className="hidden font-mono text-[8px] opacity-60 xl:inline-flex">
                Ctrl+P
              </kbd>
            </button>
          ) : null}

          {!sourceLinked ? (
            <button
              type="button"
              onClick={onAddRow}
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[#20b7ff] px-2 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0ea5ff] sm:px-3"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add Row</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto" data-grid-scroll-container>
        <div className="border-b bg-slate-50 px-3 py-1 text-[10px] text-slate-400 md:hidden">
          Scroll horizontally for more columns
        </div>
        <table
          className="w-full min-w-[1080px] border-collapse text-[13px]"
          style={
            {
              "--slw": "52px",
              "--actw": "56px",
            } as React.CSSProperties
          }
        >
          <thead
            className="sticky top-0 z-50"
            style={{ background: "#1e3a5f" }}
          >
            <tr className="divide-x divide-white/10">
              <th className="sticky left-0 z-[60] w-[52px] min-w-[52px] border-r border-white/15 bg-[#1e3a5f] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Sl.NO
              </th>
              <th className="sticky [left:var(--slw)] z-[60] min-w-[280px] border-r border-white/15 bg-[#1e3a5f] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Product
              </th>
              {barcodeEnabled ? (
                <th className="min-w-[170px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  Barcode
                </th>
              ) : null}
              <th className="min-w-[88px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Qty
              </th>
              {columns.unit ? (
                <th className="min-w-[74px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  Unit
                </th>
              ) : null}
              <th className="min-w-[132px] max-w-[148px] px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Rate Type
              </th>
              <th className="min-w-[92px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Return Rate
              </th>
              {columns.tax ? (
                <th className="min-w-[84px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  Tax
                </th>
              ) : null}
              {columns.discount ? (
                <th className="min-w-[132px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  Discount
                </th>
              ) : null}
              {columns.mrp ? (
                <th className="min-w-[84px] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  MRP
                </th>
              ) : null}
              <th className="sticky [right:var(--actw)] z-[60] min-w-[104px] border-l border-white/15 bg-[#1e3a5f] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Amount
              </th>
              <th className="sticky right-0 z-[60] w-[56px] min-w-[56px] border-l border-white/15 bg-[#1e3a5f] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const over =
                sourceLinked &&
                Number(row.quantity || 0) >
                  Number(row.remainingReturnableQuantity || 0);
              const noRemaining =
                sourceLinked &&
                Number(row.remainingReturnableQuantity || 0) <= 0;
              const rowBg = over ? "bg-rose-50" : "bg-white";
              const stickyRowBg = over
                ? "bg-rose-50 group-hover:bg-rose-100 group-focus-within:bg-[#1e3a5f]"
                : "bg-white group-hover:bg-slate-200 group-focus-within:bg-[#1e3a5f]";

              return (
                <tr
                  key={`${row.sourceSaleItemId || "manual"}-${index}`}
                  className={`group border-b border-slate-200 text-slate-900 transition-colors duration-150 hover:bg-slate-200 focus-within:bg-[#1e3a5f] focus-within:text-white divide-x divide-slate-300 ${rowBg}`}
                  onKeyDownCapture={(event) => {
                    if (event.key === "F2" && row.productId) {
                      event.preventDefault();
                      event.stopPropagation();
                      onRequestBatchSelect(index, row.productId);
                    }
                  }}
                >
                  <td
                    className={`sticky left-0 z-40 w-[52px] min-w-[52px] border-r border-slate-300 px-2.5 py-2 text-center transition-colors ${stickyRowBg}`}
                  >
                    <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-gray-100 font-mono text-xs font-medium text-gray-800">
                      {index + 1}
                    </span>
                  </td>

                  <td
                    className={`sticky [left:var(--slw)] z-40 min-w-[300px] border-r border-slate-300 px-2.5 py-2 transition-colors ${stickyRowBg}`}
                  >
                    <SearchableDropdown
                      value={row.productId || ""}
                      onChange={(value) => {
                        productSelectionPending.current.add(index);
                        window.setTimeout(
                          () => productSelectionPending.current.delete(index),
                          100,
                        );
                        onSelectProduct(index, value);
                      }}
                      onEnter={(direction) => {
                        if (
                          direction === 1 &&
                          productSelectionPending.current.delete(index)
                        ) {
                          return;
                        }
                        productSelectionPending.current.delete(index);
                        moveFrom(index, "product", direction);
                      }}
                      options={products.map((product) => ({
                        value: product.id,
                        label: product.name,
                      }))}
                      placeholder="Select product..."
                      autoOpenOnFocus
                      controlClassName="h-8 w-full px-2 text-xs"
                      inputClassName="h-8 text-xs"
                      optionClassName="text-xs"
                      menuClassName="z-[1100] min-w-[280px] text-xs"
                      buttonProps={{
                        disabled: sourceLinked,
                        "data-cell": `${index}:product`,
                        title: sourceLinked
                          ? "Product is locked to the selected Sale bill"
                          : "Enter to select product; F2 opens batch selection",
                      }}
                    />
                  </td>

                  {barcodeEnabled ? (
                    <td className="min-w-[170px] px-2.5 py-2">
                      <input
                        value={row.barcode || ""}
                        onChange={(event) =>
                          onUpdateRow(index, {
                            barcode: event.target.value.trim(),
                          })
                        }
                        placeholder="Barcode (optional)"
                        data-cell={`${index}:barcode`}
                        onFocus={(event) => event.currentTarget.select()}
                        onClick={(event) => event.currentTarget.select()}
                        onKeyDown={(event) => {
                          if (event.key === "F2") {
                            event.preventDefault();
                            event.stopPropagation();
                            onRequestBatchSelect(index, row.productId);
                            return;
                          }
                          handleMoveKey(event, index, "barcode");
                        }}
                        className={`${input} h-9`}
                      />
                    </td>
                  ) : null}

                  <td className="min-w-[88px] px-2.5 py-2">
                    <input
                      type="number"
                      min="0"
                      max={
                        sourceLinked
                          ? Number(row.remainingReturnableQuantity || 0)
                          : undefined
                      }
                      step="1"
                      disabled={noRemaining}
                      value={row.quantity ?? 0}
                      onChange={(event) =>
                        onUpdateRow(index, {
                          quantity: Number(event.target.value) || 0,
                        })
                      }
                      data-cell={`${index}:quantity`}
                      onFocus={(event) => event.currentTarget.select()}
                      onClick={(event) => event.currentTarget.select()}
                      onKeyDown={(event) => {
                        if (event.key === "F2") {
                          event.preventDefault();
                          event.stopPropagation();
                          onRequestBatchSelect(index, row.productId);
                          return;
                        }
                        handleMoveKey(event, index, "quantity");
                      }}
                      className={`${input} text-right ${
                        over
                          ? "border-rose-400 bg-rose-50 focus:border-rose-500 focus:ring-rose-100"
                          : ""
                      }`}
                    />
                    {sourceLinked ? (
                      <div
                        className={`mt-1 text-right text-[9px] ${
                          over ? "font-bold text-rose-600" : "text-slate-500"
                        }`}
                      >
                        Remaining {Number(row.remainingReturnableQuantity || 0)}
                      </div>
                    ) : null}
                  </td>

                  {columns.unit ? (
                    <td className="min-w-[74px] px-2.5 py-2">
                      <CompactDropdown
                        value={row.unit || ""}
                        onChange={(value) =>
                          onUpdateRow(index, { unit: value as any })
                        }
                        onEnter={(direction) =>
                          moveFrom(index, "unit", direction)
                        }
                        autoOpenOnFocus
                        options={
                          unitOptions.some(
                            (option) => option.value === row.unit,
                          )
                            ? unitOptions
                            : [
                                {
                                  value: String(row.unit || ""),
                                  label: String(row.unit || ""),
                                },
                                ...unitOptions,
                              ]
                        }
                        placeholder="Unit"
                        className="w-full [&_*]:text-xs [&_button]:h-8 [&_button]:px-2"
                        buttonProps={{
                          "data-cell": `${index}:unit`,
                          title:
                            "Enter to open/select, Shift+Enter to move backward",
                        }}
                      />
                    </td>
                  ) : null}

                  <td className="min-w-[132px] max-w-[148px] px-2 py-2">
                    <CompactDropdown
                      value={
                        row.rateSource === "CUSTOM"
                          ? "__CUSTOM__"
                          : row.rateTypeId || ""
                      }
                      onChange={(value) => {
                        if (value === "__CUSTOM__") {
                          onUpdateRow(index, {
                            rateTypeId: null,
                            rateTypeCode: null,
                            rateTypeName: "Custom",
                            rateSource: "CUSTOM",
                          });
                          return;
                        }

                        const selected = (row.availableRates || []).find(
                          (rate) => rate.rateTypeId === value,
                        );
                        if (!selected?.configured || selected.amount == null)
                          return;

                        onUpdateRow(index, {
                          rateTypeId: selected.rateTypeId,
                          rateTypeCode: selected.code,
                          rateTypeName: selected.name,
                          rateSource: "MASTER",
                          rate: Number(selected.amount),
                          salePrice: Number(selected.amount),
                        });
                      }}
                      onEnter={(direction) =>
                        moveFrom(index, "rateType", direction)
                      }
                      autoOpenOnFocus
                      options={[
                        ...(!row.rateTypeId && row.rateSource !== "CUSTOM"
                          ? [{ value: "", label: "Legacy" }]
                          : []),
                        ...(row.availableRates || []).map((rate) => ({
                          value: rate.rateTypeId,
                          label: rate.configured
                            ? `${rate.name} - Rs. ${rate.amount}`
                            : `${rate.name} - Not configured`,
                        })),
                        { value: "__CUSTOM__", label: "Custom rate" },
                      ]}
                      placeholder="Select rate"
                      selectedLabel={
                        row.rateSource === "CUSTOM"
                          ? "Custom"
                          : row.rateTypeName ||
                            (row.rateSource === "LEGACY" ? "Legacy" : "")
                      }
                      menuPortal
                      menuMinWidth={220}
                      hideMenuScrollbar
                      menuClassName="text-xs"
                      className="w-full min-w-0 [&_*]:text-xs [&_button]:h-8 [&_button]:px-2"
                      buttonProps={{
                        "data-cell": `${index}:rateType`,
                        title:
                          "Enter to open/select rate, Shift+Enter to move back, F2 to choose batch",
                      }}
                    />
                  </td>

                  <td className="min-w-[92px] px-2.5 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.rate ?? 0}
                      onChange={(event) =>
                        onUpdateRow(index, {
                          rate: Number(event.target.value) || 0,
                        })
                      }
                      data-cell={`${index}:rate`}
                      onFocus={(event) => event.currentTarget.select()}
                      onClick={(event) => event.currentTarget.select()}
                      onKeyDown={(event) => handleMoveKey(event, index, "rate")}
                      className={`${input} text-right font-semibold`}
                    />
                    {sourceLinked &&
                    row.sourceRate != null &&
                    Number(row.rate) !== Number(row.sourceRate) ? (
                      <div className="mt-1 text-right text-[9px] text-amber-600">
                        Original Rs. {Number(row.sourceRate).toFixed(2)}
                      </div>
                    ) : null}
                  </td>

                  {columns.tax ? (
                    <td className="px-2.5 py-2">
                      <CompactDropdown
                        value={String(row.taxPercent || "NT")}
                        onChange={(value) =>
                          onUpdateRow(index, { taxPercent: value as any })
                        }
                        onEnter={(direction) =>
                          moveFrom(index, "tax", direction)
                        }
                        autoOpenOnFocus
                        options={taxOptions}
                        placeholder="Tax"
                        className="w-full [&_*]:text-xs [&_button]:h-8 [&_button]:px-2"
                        buttonProps={{
                          "data-cell": `${index}:tax`,
                          title:
                            "Enter to open/select, Shift+Enter to move backward",
                        }}
                      />
                    </td>
                  ) : null}

                  {columns.discount ? (
                    <td className="px-2.5 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateRow(index, {
                              discountType:
                                row.discountType === "PCT" ? "ABS" : "PCT",
                            })
                          }
                          tabIndex={-1}
                          className="h-8 w-12 rounded border border-slate-300 bg-slate-50 text-[10px] font-bold text-slate-600"
                        >
                          {row.discountType || "ABS"}
                        </button>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.discount ?? 0}
                          onChange={(event) =>
                            onUpdateRow(index, {
                              discount: Number(event.target.value) || 0,
                            })
                          }
                          data-cell={`${index}:discount`}
                          onFocus={(event) => event.currentTarget.select()}
                          onClick={(event) => event.currentTarget.select()}
                          onKeyDown={(event) =>
                            handleMoveKey(event, index, "discount")
                          }
                          className={input}
                        />
                      </div>
                    </td>
                  ) : null}

                  {columns.mrp ? (
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.mrp ?? 0}
                        onChange={(event) =>
                          onUpdateRow(index, {
                            mrp: Number(event.target.value) || 0,
                          })
                        }
                        data-cell={`${index}:mrp`}
                        onFocus={(event) => event.currentTarget.select()}
                        onClick={(event) => event.currentTarget.select()}
                        onKeyDown={(event) =>
                          handleMoveKey(event, index, "mrp")
                        }
                        className={`${input} text-right`}
                      />
                    </td>
                  ) : null}

                  <td
                    className={`sticky [right:var(--actw)] z-40 min-w-[104px] border-l border-slate-300 px-2.5 py-2 text-center transition-colors ${stickyRowBg}`}
                  >
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
                      Rs. {Number(row.billedValue || 0).toFixed(2)}
                    </span>
                  </td>

                  <td
                    className={`sticky right-0 z-40 w-[56px] min-w-[56px] border-l border-slate-300 px-2.5 py-2 transition-colors ${stickyRowBg}`}
                  >
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => onRemoveRow(index)}
                        disabled={sourceLinked || rows.length <= 1}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-500 transition-all duration-200 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove return row ${index + 1}`}
                        title="Remove Item"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="z-10 flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full bg-[#20b7ff]" />
          <span>
            Items:{" "}
            <span className="font-semibold text-slate-700">{itemCount}</span>
          </span>
        </div>
        {sourceLinked ? (
          <span className="hidden text-[10px] text-slate-400 sm:inline">
            Product is locked to the source Sale. F2 selects batch; Qty, Rate
            Type and Return Rate remain editable.
          </span>
        ) : null}
      </div>
    </section>
  );
}
