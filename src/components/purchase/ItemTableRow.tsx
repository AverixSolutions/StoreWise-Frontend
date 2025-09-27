// src/components/purchase/ItemTableRow.tsx
import { X } from "lucide-react";
import { ItemRow, Product, DiscountType } from "./types";
import { toDateInput, fromDateInput, round2 } from "./utils";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import CompactDropdown from "@/components/ui/CompactDropdown";

// Normalized control classes for consistency
const cellInput =
  "w-full h-8 px-2 text-xs border border-gray-300 rounded " +
  "focus:border-averix-red-dark focus:ring-1 focus:ring-averix-red-dark/20 " +
  "outline-none transition-colors";

// Helper to display empty string until the user types
const asDisplay = (n?: number | null) => (n === 0 || n ? String(n) : "");

// Helper for displaying numbers with 2 decimal places (rounds floating-point errors)
const asDisplay2 = (n?: number | null) =>
  n === 0 || n ? String(round2(n)) : "";

// Parse number or undefined (keeps input visually empty)
const parseNum = (e: React.ChangeEvent<HTMLInputElement>) => {
  const v = e.currentTarget.value;
  if (v === "") return undefined;
  const n = e.currentTarget.valueAsNumber;
  return Number.isFinite(n) ? n : undefined;
};

// Parse number and round it
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
}

export default function ItemTableRow({
  row: r,
  index: idx,
  products,
  onSelectProduct,
  onUpdateRow,
  onRemoveRow,
  canRemove,
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
      {/* Product: sticky just after Sl.NO */}
      <td className="px-2.5 py-2 min-w-[180px] sticky [left:var(--slw)] bg-inherit z-40 border-r border-gray-200">
        <div className="w-full">
          <SearchableDropdown
            value={r.productId}
            onChange={(v) => onSelectProduct(idx, v)}
            options={products.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            placeholder="Select product..."
            className="w-full [&_*]:text-xs"
            controlClassName="h-8 text-xs px-2"
            menuClassName="text-xs"
          />
        </div>
      </td>
      {/* Product Code (center text) */}
      <td className="px-2.5 py-2 min-w-[90px] text-center">
        <div className="w-full items-center">
          <span className="inline-flex items-center text-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-blue-50 text-blue-700 border">
            {r.code || "—"}
          </span>
        </div>
      </td>
      {/* Barcode (slightly taller) */}
      <td className="px-2.5 py-2 min-w-[110px]">
        <div className="w-full">
          <input
            className={cellInput + " h-9"}
            value={r.barcode || ""}
            onChange={(e) => onUpdateRow(idx, { barcode: e.target.value })}
            placeholder="Barcode"
          />
        </div>
      </td>
      {/* Quantity (slightly taller + no default 0 shown) */}
      <td className="px-2.5 py-2 min-w-[70px]">
        <div className="w-full">
          <input
            className={cellInput + " h-9 text-center"}
            type="number"
            value={asDisplay(r.quantity)}
            onChange={(e) => onUpdateRow(idx, { quantity: parseNum(e) })}
            onBlur={(e) => {
              // Optional: if empty on blur, snap to 0 internally
              if (e.currentTarget.value === "")
                onUpdateRow(idx, { quantity: 0 });
            }}
            min={0}
            step={1}
            inputMode="numeric"
            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
            placeholder="0"
          />
        </div>
      </td>
      {/* Unit */}
      <td className="px-2.5 py-2 min-w-[74px]">
        <div className="w-full">
          <CompactDropdown
            value={r.unit || ""}
            onChange={(val) => onUpdateRow(idx, { unit: val as any })}
            options={unitOptions}
            placeholder="Unit"
            className="w-full [&_*]:text-xs [&_button]:h-8 [&_select]:h-8 [&_button]:px-2 [&_select]:px-2"
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
            min="0"
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>
      </td>
      {/* MRP */}
      <td className="px-2.5 py-2 min-w-[84px]">
        <div className="w-full">
          <input
            className={cellInput}
            type="number"
            step="0.01"
            value={asDisplay2(r.mrp)}
            onChange={(e) => onUpdateRow(idx, { mrp: parseRoundedNum(e) ?? 0 })}
            min="0"
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>
      </td>
      {/* Tax */}
      <td className="px-2.5 py-2 min-w-[84px]">
        <div className="w-full">
          <CompactDropdown
            value={r.taxPercent}
            onChange={(val) => onUpdateRow(idx, { taxPercent: val as any })}
            options={taxOptions}
            placeholder="Tax"
            className="w-full [&_*]:text-xs [&_button]:h-8 [&_select]:h-8 [&_button]:px-2 [&_select]:px-2"
          />
        </div>
      </td>
      <td className="px-2.5 py-2 min-w-[130px]">
        <div className="flex items-center gap-2">
          {/* Type toggle */}
          <div className="inline-flex overflow-hidden rounded border border-gray-300">
            <button
              type="button"
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
                onUpdateRow(idx, {
                  discount: parseRoundedNum(e) ?? 0,
                })
              }
              min={0}
              inputMode={r.discountType === "PCT" ? "decimal" : "numeric"}
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              placeholder="0"
            />
          </div>
        </div>
      </td>
      {/* Sale Price + Profit % side-by-side */}
      <td className="px-2.5 py-2 min-w-[200px]">
        <div className="grid grid-cols-[1fr_96px] gap-2 items-center">
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
          />

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-gray-500">P%</span>
            <input
              className={cellInput + " text-right"}
              type="number"
              step="0.01"
              value={asDisplay2(r.profitPercent)}
              onChange={(e) =>
                onUpdateRow(idx, { profitPercent: parseRoundedNum(e) ?? 0 })
              }
              min={0}
              inputMode="decimal"
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              placeholder="0"
            />
          </div>
        </div>
      </td>
      {/* Batch */}
      <td className="px-2.5 py-2 min-w-[90px]">
        <div className="w-full">
          <input
            className={cellInput}
            value={r.batchNo || ""}
            onChange={(e) => onUpdateRow(idx, { batchNo: e.target.value })}
            placeholder="Batch"
          />
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
          />
        </div>
      </td>
      {/* Total (center text) */}
      <td className="px-2.5 py-2 min-w-[90px] sticky [right:var(--actw)] bg-white z-40 border-l border-gray-200 text-center">
        <div className="w-full text-center">
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs font-semibold">
            ₹{round2(r.billedValue || 0).toFixed(2)}
          </span>
        </div>
      </td>
      {/* Action (right: 0) */}
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
