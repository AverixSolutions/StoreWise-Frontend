// src/components/purchase/keyboardGrid.ts
export const COLS = [
  "product",
  "barcode",
  "quantity",
  "unit",
  "rate",
  "tax",
  "discount",
  "mfgDate",
  "expiryDate",
  "profitPercent",
  "salePrice",
  "mrp",
  "lineType",
];

export type ColKey = (typeof COLS)[number];

export function focusCell(rowIndex: number, col: ColKey) {
  const el = document.querySelector<HTMLElement>(
    `[data-cell="${rowIndex}:${col}"]`
  );
  el?.focus();
}

export function nextCell(rowIndex: number, col: ColKey, dir: 1 | -1) {
  const i = COLS.indexOf(col);
  if (i < 0) return { rowIndex, col };

  let ni = i + dir;
  let nr = rowIndex;

  if (ni >= COLS.length) {
    ni = 0;
    nr = rowIndex + 1;
  } else if (ni < 0) {
    ni = COLS.length - 1;
    nr = rowIndex - 1;
  }

  return { rowIndex: nr, col: COLS[ni] as ColKey };
}
