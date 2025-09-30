// src/components/purchase/ItemsTable.tsx
import { ItemRow, Product } from "./types";
import ItemTableRow from "./ItemTableRow";
import { useEffect } from "react";
import { focusCell, nextCell, ColKey } from "./keyboardGrid";

interface ItemsTableProps {
  rows: ItemRow[];
  products: Product[];
  onSelectProduct: (rowIndex: number, productId: string) => void;
  onUpdateRow: (index: number, patch: Partial<ItemRow>) => void;
  onRemoveRow: (index: number) => void;
  onAddRow?: () => void;
}

export default function ItemsTable({
  rows,
  products,
  onSelectProduct,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
}: ItemsTableProps) {
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
    col: ColKey
  ) {
    if (e.key !== "Enter" && (e as any).key !== "NumpadEnter") return;
    e.preventDefault();

    if (!canLeave(col, rowIndex)) return;

    const dir: 1 | -1 = e.shiftKey ? -1 : 1;
    const { rowIndex: nr, col: nc } = nextCell(rowIndex, col, dir);

    if (nr >= rows.length) {
      if (onAddRow && dir === 1) {
        onAddRow();
        setTimeout(() => focusCell(nr, nc), 0);
      }
      return;
    }

    if (nr < 0) return;

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
        <thead className="sticky top-0 bg-gradient-to-r from-averix-red-dark to-averix-red-accent shadow-sm z-50">
          <tr className="divide-x divide-averix-red-light/60">
            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide sticky left-0 bg-averix-red-dark z-60 w-[52px] min-w-[52px] pointer-events-none">
              Sl.NO
            </th>

            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide sticky [left:var(--slw)] bg-averix-red-dark z-60 min-w-[180px]">
              Product
            </th>

            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[110px]">
              Barcode
            </th>
            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[70px]">
              Qty
            </th>
            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[74px]">
              Unit
            </th>
            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[84px]">
              Rate
            </th>

            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[84px]">
              Tax
            </th>
            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[130px]">
              Discount
            </th>

            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[120px]">
              MFG
            </th>
            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[120px]">
              Expiry
            </th>
            <th className="px-2.5 py-2  text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[200px]">
              Sale Price
            </th>

            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[84px]">
              MRP
            </th>

            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[80px]">
              Type
            </th>

            {/* Per Unit (billed) */}
            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[110px]">
              Unit Billed
            </th>

            {/* Total */}
            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide sticky [right:var(--actw)] bg-averix-red-dark z-60 min-w-[90px]">
              Total
            </th>

            {/* Action  */}
            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide sticky right-0 bg-averix-red-dark z-60 w-[56px] min-w-[56px] pointer-events-none">
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
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
