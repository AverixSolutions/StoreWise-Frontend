// src/components/purchase/ItemTableRow.tsx
import { X } from "lucide-react";
import { ItemRow, Product } from "./types";
import { toDateInput, fromDateInput, round2 } from "./utils";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import CompactDropdown from "@/components/ui/CompactDropdown";
import { focusCell, nextCell } from "./keyboardGrid";

const cellInput =
  "w-full h-8 px-2 text-xs border border-gray-300 rounded " +
  "focus:border-averix-red-dark focus:ring-1 focus:ring-averix-red-dark/20 " +
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

  const goFrom = (col: import("./keyboardGrid").ColKey, dir: 1 | -1 = 1) => {
    const { rowIndex: nr, col: nc } = nextCell(idx, col, dir);

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
      className={`transition-all duration-200 hover:bg-blue-50/30 border-b border-gray-100 divide-x divide-gray-100 ${
        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
      }`}
    >
      {/* Sl.NO (left: 0) */}
      <td className="px-2.5 py-2 sticky left-0 bg-inherit z-40 w-[52px] min-w-[52px] border-r border-gray-200">
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center justify-center w-7 h-5 rounded bg-gray-100 text-gray-800 text-xs font-mono font-medium">
            {r.lineNo}
          </span>
        </div>
      </td>

      {/* Product: sticky Sl.NO */}
      <td className="px-2.5 py-2 min-w-[180px] sticky [left:var(--slw)] bg-inherit z-40 border-r border-gray-200">
        <div className="w-full">
          <SearchableDropdown
            value={r.productId}
            onChange={(v) => {
              onSelectProduct(idx, v);
            }}
            onEnter={(dir) => goFrom("product", dir)}
            autoOpenOnFocus
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Select product..."
            className="w-full [&_*]:text-xs"
            controlClassName="h-8 text-xs px-2"
            menuClassName="text-xs"
            buttonProps={{
              "data-cell": `${idx}:product`,
              onKeyDown: (e) => onGridKey(e as any, idx, "product"),
            }}
          />
        </div>
      </td>

      {/* Barcode  */}
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
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onClick={(e) => {
              e.currentTarget.select();
            }}
            onBlur={() => {
              if (onBarcodeCommit) onBarcodeCommit(idx);
            }}
            onKeyDown={(e) => {
              if (
                (e.key === "F2" ||
                  (e.ctrlKey && e.key.toLowerCase() === "b")) &&
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

      {/* Quantity */}
      <td className="px-2.5 py-2 min-w-[70px]">
        <div className="w-full">
          <input
            className={cellInput + " h-9 text-center"}
            type="number"
            value={asDisplay(r.quantity)}
            onChange={(e) => onUpdateRow(idx, { quantity: parseNum(e) })}
            onBlur={(e) => {
              if (e.currentTarget.value === "")
                onUpdateRow(idx, { quantity: 0 });
            }}
            min={0}
            step={1}
            inputMode="numeric"
            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
            placeholder="0"
            data-cell={`${idx}:quantity`}
            onKeyDown={(e) => onGridKey(e, idx, "quantity")}
          />
        </div>
      </td>

      {/* Unit */}
      <td className="px-2.5 py-2 min-w-[74px]">
        <div className="w-full">
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
        </div>
      </td>

      {/* Rate */}
      <td className="px-2.5 py-2 min-w-[84px]">
        <div className="w-full">
          <input
            className={cellInput}
            type="number"
            step="0.01"
            value={asDisplay2(r.rate)}
            onChange={(e) =>
              onUpdateRow(idx, { rate: parseRoundedNum(e) ?? 0 })
            }
            min={0}
            inputMode="decimal"
            placeholder="0.00"
            data-cell={`${idx}:rate`}
            onKeyDown={(e) => {
              const el = e.currentTarget;
              if (e.key === "ArrowUp") {
                e.preventDefault();
                const cur = Number(el.value || 0);
                onUpdateRow(idx, { rate: round2(cur + 1) });
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const cur = Number(el.value || 0);
                onUpdateRow(idx, { rate: Math.max(0, round2(cur - 1)) });
              } else if (e.key === "e" || e.key === "+" || e.key === "-") {
                e.preventDefault();
              } else if (
                e.key === "Enter" ||
                (e as any).key === "NumpadEnter"
              ) {
                onGridKey(e as any, idx, "rate");
              }
            }}
          />
        </div>
      </td>

      {/* Tax */}
      <td className="px-2.5 py-2 min-w-[84px]">
        <div className="w-full">
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
        </div>
      </td>

      {/* Discount */}
      <td className="px-2.5 py-2 min-w-[130px]">
        <div className="flex items-center gap-2">
          {/* Type toggle (avoid focus trap) */}
          <div className="inline-flex overflow-hidden rounded border border-gray-300">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onUpdateRow(idx, { discountType: "ABS" })}
              className={
                "px-2 h-8 text-xs " +
                (r.discountType === "ABS"
                  ? "bg-averix-red-dark text-white"
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
                "px-2 h-8 text-xs border-l border-gray-300 " +
                (r.discountType === "PCT"
                  ? "bg-averix-red-dark text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50")
              }
              title="Percent"
            >
              %
            </button>
          </div>

          {/* Value input */}
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
                // --- Keyboard shortcuts for type ---
                const lower = e.key.toLowerCase();

                // Alt+D / Alt+T toggles type
                if (e.altKey && (lower === "d" || lower === "t")) {
                  e.preventDefault();
                  const next = r.discountType === "ABS" ? "PCT" : "ABS";
                  onUpdateRow(idx, { discountType: next });
                  return;
                }
                // Alt+P or '%' -> Percent
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
                // Alt+A or '₹' or '$' -> Amount
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
                  const next =
                    e.key === "ArrowUp"
                      ? round2(cur + step)
                      : Math.max(0, round2(cur - step));
                  onUpdateRow(idx, { discount: next });
                }
              }}
            />
          </div>
        </div>
      </td>

      {/* MFG Date */}
      <td className="px-2.5 py-2 min-w-[120px]">
        <div className="w-full">
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
        </div>
      </td>

      {/* Expiry Date */}
      <td className="px-2.5 py-2 min-w-[120px]">
        <div className="w-full">
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
        </div>
      </td>

      {/* Sale Price + Profit % */}
      <td className="px-2.5 py-2 min-w-[200px]">
        <div className="grid grid-cols-[1fr_96px] gap-2 items-center">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-gray-500">P%</span>
            <input
              className={cellInput + " text-right"}
              type="number"
              step={1}
              value={asDisplay2(r.profitPercent)}
              onChange={(e) =>
                onUpdateRow(idx, { profitPercent: parseRoundedNum(e) ?? 0 })
              }
              min={0}
              inputMode="numeric"
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              placeholder="0"
              onKeyDown={(e) => {
                const el = e.currentTarget;
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  const cur = Number(el.value || 0);
                  onUpdateRow(idx, { profitPercent: round2(cur + 1) });
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  const cur = Number(el.value || 0);
                  onUpdateRow(idx, {
                    profitPercent: Math.max(0, round2(cur - 1)),
                  });
                } else if (e.key === "e" || e.key === "+" || e.key === "-") {
                  e.preventDefault();
                } else if (
                  e.key === "Enter" ||
                  (e as any).key === "NumpadEnter"
                ) {
                  onGridKey(e as any, idx, "profitPercent");
                }
              }}
              data-cell={`${idx}:profitPercent`}
            />
          </div>
          <input
            className={cellInput + " text-right"}
            type="number"
            step="0.01"
            value={asDisplay2(r.salePrice)}
            onChange={(e) =>
              onUpdateRow(idx, { salePrice: parseRoundedNum(e) ?? 0 })
            }
            min={0}
            inputMode="decimal"
            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
            placeholder="Sale"
            data-cell={`${idx}:salePrice`}
            onKeyDown={(e) => {
              const el = e.currentTarget;
              if (e.key === "ArrowUp") {
                e.preventDefault();
                const cur = Number(el.value || 0);
                onUpdateRow(idx, { salePrice: round2(cur + 1) });
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const cur = Number(el.value || 0);
                onUpdateRow(idx, { salePrice: Math.max(0, round2(cur - 1)) });
              } else if (e.key === "e" || e.key === "+" || e.key === "-") {
                e.preventDefault();
              } else if (
                e.key === "Enter" ||
                (e as any).key === "NumpadEnter"
              ) {
                onGridKey(e as any, idx, "salePrice");
              }
            }}
          />
        </div>
      </td>

      {/* MRP */}
      <td className="px-2.5 py-2 min-w-[84px]">
        <div className="w-full">
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
        </div>
      </td>

      {/* Line Type */}
      <td className="px-2.5 py-2 min-w-[80px] text-center">
        <div className="w-full">
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
        </div>
      </td>

      {/* Unit Value  */}
      <td className="px-2.5 py-2 min-w-[110px] text-center">
        <div className="w-full text-center">
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
            ₹{round2(r.unitBilled || 0).toFixed(2)}
          </span>
        </div>
      </td>

      {/* Total */}
      <td className="px-2.5 py-2 min-w-[90px] sticky [right:var(--actw)] bg-white z-40 border-l border-gray-200 text-center">
        <div className="w-full text-center">
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs font-semibold">
            ₹{round2(r.billedValue || 0).toFixed(2)}
          </span>
        </div>
      </td>

      {/* Action */}
      <td className="px-2.5 py-2 sticky right-0 bg-white z-40 w-[56px] min-w-[56px] border-l border-gray-200">
        <div className="flex justify-center">
          <button
            onClick={() => onRemoveRow(idx)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
