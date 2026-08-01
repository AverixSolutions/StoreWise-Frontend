"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Settings2, X } from "lucide-react";
import {
  DEFAULT_PURCHASE_UI_SETTINGS,
  type PurchaseUiSettings,
} from "./purchaseUiSettings";

type PurchaseEntrySettingsModalProps = {
  open: boolean;
  settings: PurchaseUiSettings;
  onClose: () => void;
  onSave: (settings: PurchaseUiSettings) => void;
};

type ToggleDefinition = {
  key: keyof PurchaseUiSettings;
  label: string;
  description: string;
};

const billToggles: ToggleDefinition[] = [
  {
    key: "showTransactionType",
    label: "Transaction type",
    description: "The default purchase type is still applied when hidden.",
  },
  {
    key: "showPurchaseTime",
    label: "Purchase time",
    description: "Keep only the purchase date visible.",
  },
  {
    key: "showEntryDate",
    label: "Entry date",
    description: "The current entry timestamp is retained when hidden.",
  },
  {
    key: "showDepartment",
    label: "Department",
    description: "Optional department reference.",
  },
  {
    key: "showDebitAccount",
    label: "Debit account",
    description: "Optional debit-account reference.",
  },
  {
    key: "showNatureOfEntry",
    label: "Nature of entry",
    description: "Optional purchase description.",
  },
  {
    key: "showHeaderDiscount",
    label: "Bill discount",
    description: "Show the bill-level discount input.",
  },
];

const gridToggles: ToggleDefinition[] = [
  {
    key: "showUnit",
    label: "Unit",
    description: "The product unit remains saved when hidden.",
  },
  {
    key: "showTax",
    label: "Tax",
    description: "The product tax remains applied when hidden.",
  },
  {
    key: "showLineDiscount",
    label: "Line discount",
    description: "Hide the per-item discount controls.",
  },
  {
    key: "showSellingRates",
    label: "Selling rates",
    description: "Show profit and all named selling-rate lines.",
  },
  {
    key: "showMrp",
    label: "MRP",
    description: "Show the optional MRP field.",
  },
  {
    key: "showLineType",
    label: "Line type",
    description: "Show valued/free selection.",
  },
  {
    key: "showMfgDate",
    label: "Manufacturing date",
    description: "Show the optional batch manufacturing date.",
  },
  {
    key: "showExpiryDate",
    label: "Expiry date",
    description: "Show the optional batch expiry date.",
  },
  {
    key: "showUnitBilled",
    label: "Unit billed",
    description: "Show the calculated per-unit billed value.",
  },
];

function ToggleRow({
  definition,
  checked,
  onChange,
}: {
  definition: ToggleDefinition;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-cyan-200 hover:bg-cyan-50/30">
      <span>
        <span className="block text-sm font-semibold text-slate-700">
          {definition.label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
          {definition.description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-400"
      />
    </label>
  );
}

export default function PurchaseEntrySettingsModal({
  open,
  settings,
  onClose,
  onSave,
}: PurchaseEntrySettingsModalProps) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, open]);

  if (!open) return null;

  const renderGroup = (title: string, rows: ToggleDefinition[]) => (
    <section>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((definition) => (
          <ToggleRow
            key={definition.key}
            definition={definition}
            checked={draft[definition.key]}
            onChange={(checked) =>
              setDraft((current) => ({
                ...current,
                [definition.key]: checked,
              }))
            }
          />
        ))}
      </div>
    </section>
  );

  return (
    <div
      className="fixed inset-0 z-[980] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-entry-settings-title"
        className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-slate-200 bg-slate-50 shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:max-w-3xl sm:rounded-[24px]"
      >
        <div className="flex items-center justify-between bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Purchase Entry
            </p>
            <h3
              id="purchase-entry-settings-title"
              className="mt-0.5 flex items-center gap-2 text-base font-semibold"
            >
              <Settings2 className="h-4 w-4" />
              Inline Settings
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close purchase settings"
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-4 sm:p-5">
          <p className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs leading-5 text-cyan-800">
            These options only change what is visible. Hidden product defaults
            and saved purchase values remain active.
          </p>
          {renderGroup("Bill details", billToggles)}
          {renderGroup("Item grid", gridToggles)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_PURCHASE_UI_SETTINGS)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Compact defaults
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
