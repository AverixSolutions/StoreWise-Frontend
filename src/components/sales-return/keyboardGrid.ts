export const SALES_RETURN_COLS = [
  "product",
  "barcode",
  "quantity",
  "unit",
  "rateType",
  "rate",
  "tax",
  "discount",
  "mrp",
] as const;

export type SalesReturnColKey = (typeof SALES_RETURN_COLS)[number];

export function focusSalesReturnCell(
  rowIndex: number,
  col: SalesReturnColKey,
): boolean {
  if (typeof document === "undefined") return false;

  const el = document.querySelector<HTMLElement>(
    `[data-cell="${rowIndex}:${col}"]`,
  );
  if (
    !el ||
    el.hasAttribute("disabled") ||
    el.getAttribute("aria-disabled") === "true" ||
    el.getClientRects().length === 0
  ) {
    return false;
  }

  el.focus({ preventScroll: true });
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    try {
      el.select();
    } catch {}
  }

  const container = el.closest<HTMLElement>("[data-grid-scroll-container]");
  if (!container) {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = el.getBoundingClientRect();
  const header = container.querySelector<HTMLElement>("thead");
  const headerHeight = header?.getBoundingClientRect().height ?? 36;
  const upperSafe = containerRect.top + headerHeight + 10;
  const lowerSafe = containerRect.bottom - 32;

  if (elementRect.top < upperSafe) {
    container.scrollTop += elementRect.top - upperSafe;
  } else if (elementRect.bottom > lowerSafe) {
    container.scrollTop += elementRect.bottom - lowerSafe;
  }

  const refreshedContainerRect = container.getBoundingClientRect();
  const refreshedElementRect = el.getBoundingClientRect();
  const leftSafe = refreshedContainerRect.left + 250;
  const rightSafe = refreshedContainerRect.right - 120;

  if (refreshedElementRect.left < leftSafe) {
    container.scrollLeft += refreshedElementRect.left - leftSafe;
  } else if (refreshedElementRect.right > rightSafe) {
    container.scrollLeft += refreshedElementRect.right - rightSafe;
  }

  return true;
}

export function nextSalesReturnCell(
  rowIndex: number,
  col: SalesReturnColKey,
  dir: 1 | -1,
  columnOrder: readonly SalesReturnColKey[],
) {
  const index = columnOrder.indexOf(col);
  if (index < 0) return { rowIndex, col };

  let nextIndex = index + dir;
  let nextRow = rowIndex;

  if (nextIndex >= columnOrder.length) {
    nextIndex = 0;
    nextRow = rowIndex + 1;
  } else if (nextIndex < 0) {
    nextIndex = columnOrder.length - 1;
    nextRow = rowIndex - 1;
  }

  return {
    rowIndex: nextRow,
    col: columnOrder[nextIndex] as SalesReturnColKey,
  };
}
