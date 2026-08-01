// src/components/purchase/keyboardGrid.ts
export const COLS = [
  "product",
  "barcode",
  "quantity",
  "unit",
  "rate",
  "tax",
  "discount",
  "profitPercent",
  "salePrice",
  "mrp",
  "lineType",
  "mfgDate",
  "expiryDate",
] as const;

export type ColKey = (typeof COLS)[number];

export type GridNavigationOptions = {
  barcodeEnabled?: boolean;
  hiddenColumns?: readonly ColKey[];
};

function activeCols(
  options: boolean | GridNavigationOptions = true,
): readonly ColKey[] {
  const barcodeEnabled =
    typeof options === "boolean" ? options : options.barcodeEnabled !== false;
  const hiddenColumns =
    typeof options === "boolean" ? [] : (options.hiddenColumns ?? []);

  return COLS.filter(
    (col) =>
      (barcodeEnabled || col !== "barcode") && !hiddenColumns.includes(col),
  );
}

export function focusCell(rowIndex: number, col: ColKey) {
  if (typeof document === "undefined") return;

  const selector = `[data-cell="${rowIndex}:${col}"]`;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;

  // Browser-native focus scrolling caused the Purchase row to jump under the
  // sticky header and open product picker. Keep focus stationary first, then
  // make only the minimum controlled adjustment.
  el.focus({ preventScroll: true });
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    try {
      el.select();
    } catch {}
  }

  const container = el.closest<HTMLElement>("[data-grid-scroll-container]");
  if (!container) {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = el.getBoundingClientRect();
  const header = container.querySelector<HTMLElement>("thead");
  const headerHeight = header?.getBoundingClientRect().height ?? 36;

  // Keep the active row below the sticky table header. Vertical scrolling only
  // happens when the control is genuinely outside this safe band.
  const upperSafe = containerRect.top + headerHeight + 10;
  const lowerSafe = containerRect.bottom - 32;

  if (elementRect.top < upperSafe) {
    container.scrollTop += elementRect.top - upperSafe;
  } else if (elementRect.bottom > lowerSafe) {
    container.scrollTop += elementRect.bottom - lowerSafe;
  }

  const colIndex = COLS.indexOf(col);
  const pivotIndex = COLS.indexOf("profitPercent");
  if (colIndex === -1) return;

  // Preserve the old stable left-side behavior for product/cost fields.
  if (pivotIndex !== -1 && colIndex < pivotIndex) {
    container.scrollLeft = 0;
    return;
  }

  // For Profit, named Selling Rates and fields after them, reveal only the
  // focused control. Do not jump to the table's maximum horizontal position.
  const refreshedContainerRect = container.getBoundingClientRect();
  const refreshedElementRect = el.getBoundingClientRect();
  const leftSafe = refreshedContainerRect.left + 248;
  const rightSafe = refreshedContainerRect.right - 162;

  if (refreshedElementRect.left < leftSafe) {
    container.scrollLeft += refreshedElementRect.left - leftSafe;
  } else if (refreshedElementRect.right > rightSafe) {
    container.scrollLeft += refreshedElementRect.right - rightSafe;
  }
}

export function nextCell(
  rowIndex: number,
  col: ColKey,
  dir: 1 | -1,
  options: boolean | GridNavigationOptions = true,
) {
  const cols = activeCols(options);
  const i = cols.indexOf(col);
  if (i < 0) return { rowIndex, col };

  let ni = i + dir;
  let nr = rowIndex;

  if (ni >= cols.length) {
    ni = 0;
    nr = rowIndex + 1;
  } else if (ni < 0) {
    ni = cols.length - 1;
    nr = rowIndex - 1;
  }

  return { rowIndex: nr, col: cols[ni] as ColKey };
}
