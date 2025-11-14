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
] as const;

export type ColKey = (typeof COLS)[number];

export function focusCell(rowIndex: number, col: ColKey) {
  if (typeof document === "undefined") return;

  const selector = `[data-cell="${rowIndex}:${col}"]`;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;

  // Focus + select for inputs
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    try {
      el.select();
    } catch {}
  }

  const container = el.closest<HTMLElement>("[data-grid-scroll-container]");
  if (!container) {
    // Fallback – scroll window if no container wrapper
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }

  // ---------- VERTICAL SAFE BAND (gentle nudge only) ----------
  const paddingY = 32; // vertical padding from top/bottom of container
  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();

  let deltaY = 0;
  const upperSafe = cRect.top + paddingY;
  const lowerSafe = cRect.bottom - paddingY;

  if (eRect.top < upperSafe) {
    // too high
    deltaY = eRect.top - upperSafe;
  } else if (eRect.bottom > lowerSafe) {
    // too low
    deltaY = eRect.bottom - lowerSafe;
  }

  if (deltaY !== 0) {
    container.scrollTop += deltaY;
  }

  // ---------- HORIZONTAL SNAP ZONES (left block / right block) ----------
  const colIndex = COLS.indexOf(col);
  const pivotIndex = COLS.indexOf("mfgDate"); // from here we show the "right side" fully

  if (colIndex === -1) return;

  if (pivotIndex === -1) {
    // Fallback: no pivot defined, just ensure cell is roughly in view horizontally
    const paddingX = 48;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;
    const leftSafe = viewLeft + paddingX;
    const rightSafe = viewRight - paddingX;

    // Approximate element's position within container using rects
    const elLeftRelative = eRect.left - cRect.left + viewLeft;
    const elRightRelative = eRect.right - cRect.left + viewLeft;

    if (elLeftRelative < leftSafe) {
      container.scrollLeft -= leftSafe - elLeftRelative;
    } else if (elRightRelative > rightSafe) {
      container.scrollLeft += elRightRelative - rightSafe;
    }
    return;
  }

  // LEFT ZONE: before MFG → snap fully to start
  if (colIndex < pivotIndex) {
    container.scrollLeft = 0;
    return;
  }

  // RIGHT ZONE: from MFG onwards → snap fully to end
  const maxScrollLeft = container.scrollWidth - container.clientWidth;
  container.scrollLeft = maxScrollLeft > 0 ? maxScrollLeft : 0;
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
