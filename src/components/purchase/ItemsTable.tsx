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
  onRequestBatchSelect?: (rowIndex: number) => void;
  onBarcodeCommit?: (rowIndex: number) => void;
}

export default function ItemsTable({
  rows,
  products,
  onSelectProduct,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
  onRequestBatchSelect,
  onBarcodeCommit,
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
    col: ColKey,
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
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[110px]">
              Barcode
            </th>
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[70px]">
              Qty
            </th>
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[74px]">
              Unit
            </th>
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[84px]">
              Rate
            </th>
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[84px]">
              Tax
            </th>
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[130px]">
              Discount
            </th>

            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[200px]">
              Sale Price
            </th>
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[84px]">
              MRP
            </th>

            {/* Hidden on mobile/tablet — show from lg breakpoint */}
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[80px] hidden lg:table-cell">
              Type
            </th>
            {/* Hidden on mobile — show from md breakpoint */}
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[120px] hidden md:table-cell">
              MFG
            </th>
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[120px] hidden md:table-cell">
              Expiry
            </th>
            <th className="px-2.5 py-2 text-center text-[10px] font-semibold text-white/80 uppercase tracking-[0.14em] min-w-[110px] hidden lg:table-cell">
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
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
