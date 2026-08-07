"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Columns3,
  FileText,
  Printer,
  RotateCcw,
  Settings,
  X,
} from "lucide-react";
import {
  DEFAULT_PURCHASE_RETURN_UI_SETTINGS,
  type PurchaseReturnUiSettings,
} from "./purchaseReturnUiSettings";
import PurchaseReturnPrintSettingsPanel from "./PurchaseReturnPrintSettingsPanel";

type Props = {
  open: boolean;
  settings: PurchaseReturnUiSettings;
  onClose: () => void;
  onSave: (settings: PurchaseReturnUiSettings) => void;
};

type Tab = "bill" | "columns" | "print";

type ToggleDefinition = {
  key: keyof PurchaseReturnUiSettings;
  label: string;
  description: string;
};

const billToggles: ToggleDefinition[] = [
  {
    key: "showTransactionType",
    label: "Transaction type",
    description: "The selected return type stays active when hidden.",
  },
  {
    key: "showPurchaseTime",
    label: "Return time",
    description: "Keep the stored timestamp without showing the time control.",
  },
  {
    key: "showEntryDate",
    label: "Entry date",
    description: "Keep the entry timestamp while hiding its field.",
  },
  {
    key: "showDepartment",
    label: "Department",
    description: "Optional Purchase Return department reference.",
  },
  {
    key: "showDebitAccount",
    label: "Debit account",
    description: "Optional debit-account reference.",
  },
  {
    key: "showNatureOfEntry",
    label: "Nature of entry",
    description: "Optional Purchase Return description.",
  },
  {
    key: "showHeaderDiscount",
    label: "Return discount",
    description: "Show the return-level discount input.",
  },
];

const columnToggles: ToggleDefinition[] = [
  {
    key: "showUnit",
    label: "Unit",
    description: "The saved product unit remains in the return payload.",
  },
  {
    key: "showTax",
    label: "Tax",
    description: "The saved row tax remains applied when hidden.",
  },
  {
    key: "showLineDiscount",
    label: "Line discount",
    description: "Show per-item return discount controls.",
  },
  {
    key: "showSellingRates",
    label: "Saved selling rates",
    description:
      "Show the Retail, Wholesale, Dealer and other rates saved on the source Purchase.",
  },
  {
    key: "showMrp",
    label: "MRP",
    description: "Show the selected batch MRP snapshot.",
  },
  {
    key: "showLineType",
    label: "Line type",
    description: "Show valued or free selection.",
  },
  {
    key: "showMfgDate",
    label: "Manufacturing date",
    description: "Show batch manufacturing information.",
  },
  {
    key: "showExpiryDate",
    label: "Expiry date",
    description: "Show batch expiry information.",
  },
  {
    key: "showUnitBilled",
    label: "Unit billed",
    description: "Show the calculated per-unit billed value.",
  },
];

const tabs: Array<{
  key: Tab;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    key: "bill",
    label: "Bill Details",
    description: "Return header fields",
    icon: FileText,
  },
  {
    key: "columns",
    label: "Item Columns",
    description: "Return grid visibility",
    icon: Columns3,
  },
  {
    key: "print",
    label: "Print",
    description: "A4 / 80mm and template",
    icon: Printer,
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
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
        checked
          ? "border-slate-300 bg-white shadow-sm"
          : "border-slate-200 bg-slate-100/70"
      } hover:border-cyan-300`}
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-800">
          {definition.label}
        </span>
        <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
          {definition.description}
        </span>
      </span>

      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          checked ? "bg-cyan-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </button>
  );
}

export default function PurchaseReturnEntrySettingsModal({
  open,
  settings,
  onClose,
  onSave,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("bill");
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, open]);

  if (!open) return null;

  const definitions = activeTab === "bill" ? billToggles : columnToggles;

  function resetActiveTab() {
    if (activeTab === "print") return;
    setDraft((current) => {
      const next = { ...current };
      definitions.forEach(({ key }) => {
        next[key] = DEFAULT_PURCHASE_RETURN_UI_SETTINGS[key];
      });
      return next;
    });
  }

  function applySettings() {
    onSave(draft);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-return-settings-title"
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[22px] border border-slate-200 bg-slate-50 shadow-[0_28px_80px_rgba(15,23,42,0.34)] sm:max-w-2xl sm:rounded-[22px]"
      >
        <div className="bg-[linear-gradient(135deg,#091120_0%,#0f1a31_62%,#16213d_100%)] text-white">
          <div className="flex items-center justify-between px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Purchase Return
              </p>
              <h3
                id="purchase-return-settings-title"
                className="mt-0.5 flex items-center gap-2 text-base font-semibold"
              >
                <Settings className="h-4 w-4 text-cyan-300" />
                Inline Settings
              </h3>
              <p className="mt-1 text-[10px] text-white/55">
                Grid visibility and Purchase Return print output.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Purchase Return settings"
              className="rounded-lg p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 border-t border-white/10 bg-black/10 px-2 pt-1.5 sm:px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex min-w-0 items-center justify-center gap-1.5 rounded-t-lg px-2 py-2 text-[10px] font-semibold transition ${
                    active
                      ? "bg-slate-50 text-slate-900"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="mb-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
            <p className="text-[10px] leading-4 text-cyan-800">
              Purchase Return stock, batch, ledger, tax and saved-rate behavior
              is not changed by these visibility preferences.
            </p>
          </div>

          {activeTab === "print" ? (
            <PurchaseReturnPrintSettingsPanel />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {definitions.map((definition) => (
                <ToggleRow
                  key={definition.key}
                  definition={definition}
                  checked={Boolean(draft[definition.key])}
                  onChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      [definition.key]: checked,
                    }))
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
          {activeTab === "print" ? (
            <span className="text-[10px] text-slate-500">
              Print changes save immediately.
            </span>
          ) : (
            <button
              type="button"
              onClick={resetActiveTab}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset tab
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applySettings}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 text-xs font-semibold text-white transition hover:bg-[#16304f]"
            >
              <Check className="h-3.5 w-3.5" />
              Apply & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
