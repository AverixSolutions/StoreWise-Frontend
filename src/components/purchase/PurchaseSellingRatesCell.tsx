import type { ItemRow } from "./types";
import { focusCell, type ColKey } from "./keyboardGrid";
import { round2 } from "./utils";

type PurchaseSellingRatesCellProps = {
  row: ItemRow;
  rowIndex: number;
  onUpdateRow: (index: number, patch: Partial<ItemRow>) => void;
  onGridKey: (
    event: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    col: ColKey,
  ) => void;
};

const inputClass =
  "purchase-grid-input h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-right text-xs text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15";

function display(value?: number | null) {
  return value === 0 || value ? String(round2(value)) : "";
}

function parseAmount(event: React.ChangeEvent<HTMLInputElement>) {
  if (event.currentTarget.value === "") return null;
  const value = event.currentTarget.valueAsNumber;
  return Number.isFinite(value) ? Math.max(0, round2(value)) : null;
}

function keepHorizontallyVisible(input: HTMLInputElement) {
  const container = input.closest<HTMLElement>("[data-grid-scroll-container]");
  if (!container) return;

  const containerRect = container.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();

  // Keep focused values clear of the sticky Sl.No/Product block on the left
  // and the sticky Total/Action block on the right.
  const leftSafe = containerRect.left + 248;
  const rightSafe = containerRect.right - 162;

  if (inputRect.left < leftSafe) {
    container.scrollLeft += inputRect.left - leftSafe;
  } else if (inputRect.right > rightSafe) {
    container.scrollLeft += inputRect.right - rightSafe;
  }
}

function queueFocus(selector: string) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(selector);
      if (!input) return;

      input.focus({ preventScroll: true });
      input.select();
      keepHorizontallyVisible(input);
    });
  });
}

function focusNamedRate(rowIndex: number, rateIndex: number) {
  queueFocus(`[data-purchase-rate="${rowIndex}:${rateIndex}"]`);
}

function isCommitKey(event: React.KeyboardEvent<HTMLInputElement>) {
  return (
    event.key === "Enter" || event.key === "NumpadEnter" || event.key === "Tab"
  );
}

function blockInvalidNumberKey(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "e" || event.key === "+" || event.key === "-") {
    event.preventDefault();
    return true;
  }
  return false;
}

export default function PurchaseSellingRatesCell({
  row,
  rowIndex,
  onUpdateRow,
  onGridKey,
}: PurchaseSellingRatesCellProps) {
  const rates = row.availableRates ?? [];

  const updateNamedRate = (
    rateTypeId: string,
    amount: number | null,
    isDefault: boolean,
  ) => {
    const nextRates = rates.map((rate) =>
      rate.rateTypeId === rateTypeId
        ? {
            ...rate,
            amount,
            configured: amount != null,
          }
        : rate,
    );

    onUpdateRow(rowIndex, {
      availableRates: nextRates,
      sellingRatesJson: JSON.stringify(
        nextRates.map((rate) => ({
          rateTypeId: rate.rateTypeId,
          code: rate.code,
          name: rate.name,
          amount: rate.amount,
          isDefault: Boolean(rate.isDefault),
        })),
      ),
      ...(isDefault ? { salePrice: amount } : {}),
    });
  };

  return (
    <div className="w-full py-0.5" data-purchase-selling-rates-cell>
      <div className="flex min-w-max items-center gap-1.5 whitespace-nowrap">
        <div className="w-[72px] shrink-0">
          <input
            className={inputClass}
            type="number"
            min={0}
            step={1}
            value={display(row.profitPercent)}
            aria-label="Profit percentage"
            title="Profit percentage"
            onChange={(event) =>
              onUpdateRow(rowIndex, {
                profitPercent: parseAmount(event) ?? 0,
              })
            }
            data-cell={`${rowIndex}:profitPercent`}
            onFocus={(event) => keepHorizontallyVisible(event.currentTarget)}
            onWheel={(event) => event.currentTarget.blur()}
            onKeyDown={(event) => {
              if (blockInvalidNumberKey(event) || !isCommitKey(event)) return;

              event.preventDefault();
              event.stopPropagation();

              if (event.shiftKey) {
                onGridKey(event, rowIndex, "profitPercent");
                return;
              }

              if (rates.length > 0) {
                focusNamedRate(rowIndex, 0);
                return;
              }

              onGridKey(event, rowIndex, "profitPercent");
            }}
          />
        </div>

        {rates.length > 0 ? (
          rates.map((rate, rateIndex) => (
            <div key={rate.rateTypeId} className="w-[82px] shrink-0">
              <input
                className={inputClass}
                type="number"
                min={0}
                step="0.01"
                value={rate.amount ?? ""}
                placeholder="Blank"
                aria-label={`${rate.name} selling rate`}
                title={`${rate.name} (${rate.code})${rate.isDefault ? " - Default" : ""}`}
                data-cell={
                  rateIndex === 0 ? `${rowIndex}:salePrice` : undefined
                }
                data-purchase-rate={`${rowIndex}:${rateIndex}`}
                onFocus={(event) =>
                  keepHorizontallyVisible(event.currentTarget)
                }
                onChange={(event) =>
                  updateNamedRate(
                    rate.rateTypeId,
                    parseAmount(event),
                    Boolean(rate.isDefault),
                  )
                }
                onWheel={(event) => event.currentTarget.blur()}
                onKeyDown={(event) => {
                  if (blockInvalidNumberKey(event) || !isCommitKey(event)) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();

                  if (event.shiftKey) {
                    if (rateIndex > 0) {
                      focusNamedRate(rowIndex, rateIndex - 1);
                    } else {
                      focusCell(rowIndex, "profitPercent");
                    }
                    return;
                  }

                  if (rateIndex < rates.length - 1) {
                    focusNamedRate(rowIndex, rateIndex + 1);
                    return;
                  }

                  onGridKey(event, rowIndex, "salePrice");
                }}
              />
            </div>
          ))
        ) : (
          <div className="w-[82px] shrink-0">
            <input
              className={inputClass}
              type="number"
              min={0}
              step="0.01"
              value={display(row.salePrice)}
              placeholder="Sale"
              aria-label="Selling price"
              title="Selling price"
              data-cell={`${rowIndex}:salePrice`}
              onFocus={(event) => keepHorizontallyVisible(event.currentTarget)}
              onChange={(event) =>
                onUpdateRow(rowIndex, {
                  salePrice: parseAmount(event),
                })
              }
              onWheel={(event) => event.currentTarget.blur()}
              onKeyDown={(event) => {
                if (blockInvalidNumberKey(event) || !isCommitKey(event)) return;

                event.preventDefault();
                event.stopPropagation();
                onGridKey(event, rowIndex, "salePrice");
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
