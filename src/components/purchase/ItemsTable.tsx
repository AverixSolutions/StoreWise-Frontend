// src/components/purchase/ItemsTable.tsx
import { ItemRow, Product } from "./types";
import ItemTableRow from "./ItemTableRow";

interface ItemsTableProps {
  rows: ItemRow[];
  products: Product[];
  onSelectProduct: (rowIndex: number, productId: string) => void;
  onUpdateRow: (index: number, patch: Partial<ItemRow>) => void;
  onRemoveRow: (index: number) => void;
}

export default function ItemsTable({
  rows,
  products,
  onSelectProduct,
  onUpdateRow,
  onRemoveRow,
}: ItemsTableProps) {
  return (
    <div className="w-full">
      <table
        className="w-full border-collapse min-w-[1200px] text-[13px]"
        style={
          {
            ["--slw" as any]: "52px",
            ["--actw" as any]: "56px",
          } as React.CSSProperties
        }
      >
        <thead className="sticky top-0 bg-gradient-to-r from-averix-red-dark to-averix-red-accent shadow-sm z-50">
          <tr className="divide-x divide-averix-red-light/60">
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide sticky left-0 bg-averix-red-dark z-60 w-[52px] min-w-[52px] pointer-events-none">
              Sl.NO
            </th>

            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide sticky [left:var(--slw)] bg-averix-red-dark z-60 min-w-[180px]">
              Product
            </th>

            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[90px]">
              Code
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[110px]">
              Barcode
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[70px]">
              Qty
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[74px]">
              Unit
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[84px]">
              Rate
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[84px]">
              MRP
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[84px]">
              Tax
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[130px]">
              Discount
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[200px]">
              Sale Price
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[90px]">
              Batch
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[120px]">
              MFG
            </th>
            <th className="px-2.5 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[120px]">
              Expiry
            </th>

            {/* Total (sticky, just before Action) */}
            <th className="px-2.5 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide sticky [right:var(--actw)] bg-averix-red-dark z-60 min-w-[90px]">
              Total
            </th>

            {/* Action (sticky, right: 0) */}
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
              canRemove={rows.length > 1}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
