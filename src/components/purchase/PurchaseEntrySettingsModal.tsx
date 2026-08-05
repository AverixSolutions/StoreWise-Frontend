"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  Columns3,
  Eye,
  EyeOff,
  FileText,
  LayoutTemplate,
  Printer,
  RefreshCw,
  RotateCcw,
  Settings,
  X,
} from "lucide-react";
import { platform } from "@/platform";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import SettingsOverlay from "@/components/settings/SettingsOverlay";
import ShopSettingsPanel from "@/components/master/ShopSettingsPanel";
import PurchasePrintCustomizationPanel from "@/components/print/PurchasePrintCustomizationPanel";
import {
  getTaskPref,
  setTaskPref,
  type PaperSize,
} from "@/lib/print/printPreferences";
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

type SettingsTab = "bill" | "columns" | "print";

type PrinterInfo = {
  name: string;
  displayName: string;
  isDefault: boolean;
};

type PurchasePrintDraft = {
  printer: string | null;
  preview: boolean;
  paperSize: PaperSize;
};

const billToggles: ToggleDefinition[] = [
  {
    key: "showTransactionType",
    label: "Transaction type",
    description: "Default value remains active when hidden.",
  },
  {
    key: "showPurchaseTime",
    label: "Purchase time",
    description: "Hide time while retaining the stored timestamp.",
  },
  {
    key: "showEntryDate",
    label: "Entry date",
    description: "Retain the entry timestamp without showing it.",
  },
  {
    key: "showDepartment",
    label: "Department",
    description: "Optional purchase department reference.",
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
    description: "Product unit is still saved when hidden.",
  },
  {
    key: "showTax",
    label: "Tax",
    description: "Product tax remains applied when hidden.",
  },
  {
    key: "showLineDiscount",
    label: "Line discount",
    description: "Show per-item discount controls.",
  },
  {
    key: "showSellingRates",
    label: "Selling rates",
    description: "Show profit and named selling-rate inputs.",
  },
  {
    key: "showMrp",
    label: "MRP",
    description: "Show the optional MRP field.",
  },
  {
    key: "showLineType",
    label: "Line type",
    description: "Show valued or free selection.",
  },
  {
    key: "showMfgDate",
    label: "Manufacturing date",
    description: "Show the optional manufacturing date.",
  },
  {
    key: "showExpiryDate",
    label: "Expiry date",
    description: "Show the optional expiry date.",
  },
  {
    key: "showUnitBilled",
    label: "Unit billed",
    description: "Show calculated per-unit billed value.",
  },
];

const tabs: Array<{
  key: SettingsTab;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    key: "bill",
    label: "Bill Details",
    description: "Header fields",
    icon: FileText,
  },
  {
    key: "columns",
    label: "Item Columns",
    description: "Grid visibility",
    icon: Columns3,
  },
  {
    key: "print",
    label: "Print",
    description: "Paper and preview",
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
      className={`flex min-h-[58px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
        checked
          ? "border-slate-300 bg-white shadow-sm"
          : "border-slate-200 bg-slate-100/70"
      } hover:border-cyan-300`}
      aria-pressed={checked}
    >
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-slate-800">
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

function PaperOption({
  value,
  current,
  title,
  description,
  onChange,
}: {
  value: PaperSize;
  current: PaperSize;
  title: string;
  description: string;
  onChange: (value: PaperSize) => void;
}) {
  const active = current === value;

  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex flex-1 items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-cyan-400 bg-cyan-50 ring-1 ring-cyan-200"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span>
        <span className="block text-sm font-semibold text-slate-800">
          {title}
        </span>
        <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
          {description}
        </span>
      </span>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          active
            ? "border-cyan-500 bg-cyan-500 text-white"
            : "border-slate-300 text-transparent"
        }`}
      >
        <Check className="h-3 w-3" />
      </span>
    </button>
  );
}

export default function PurchaseEntrySettingsModal({
  open,
  settings,
  onClose,
  onSave,
}: PurchaseEntrySettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("bill");
  const [draft, setDraft] = useState(settings);
  const [printDraft, setPrintDraft] = useState<PurchasePrintDraft>(() =>
    getTaskPref("purchase"),
  );
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [showBusinessProfile, setShowBusinessProfile] = useState(false);
  const [showPurchaseTemplate, setShowPurchaseTemplate] = useState(false);

  const isDesktop =
    typeof window !== "undefined" && !!(window as any).electronAPI;

  useEffect(() => {
    if (!open) return;

    setDraft(settings);
    setPrintDraft(getTaskPref("purchase"));
    setActiveTab("bill");
    setShowBusinessProfile(false);
    setShowPurchaseTemplate(false);
  }, [open, settings]);

  useEffect(() => {
    if (!open || !isDesktop) return;

    let cancelled = false;
    setLoadingPrinters(true);

    const loadPrinters = async () => {
      try {
        const rows = await platform.getPrinters?.();
        if (!cancelled) setPrinters(rows || []);
      } finally {
        if (!cancelled) setLoadingPrinters(false);
      }
    };

    void loadPrinters();

    return () => {
      cancelled = true;
    };
  }, [isDesktop, open]);

  if (!open) return null;

  function setUiValue(key: keyof PurchaseUiSettings, checked: boolean) {
    setDraft((current) => ({
      ...current,
      [key]: checked,
    }));
  }

  function resetActiveTab() {
    if (activeTab === "print") {
      setPrintDraft({
        printer: null,
        preview: true,
        paperSize: "A4",
      });
      return;
    }

    const rows = activeTab === "bill" ? billToggles : gridToggles;
    setDraft((current) => {
      const next = { ...current };
      rows.forEach(({ key }) => {
        next[key] = DEFAULT_PURCHASE_UI_SETTINGS[key];
      });
      return next;
    });
  }

  function applySettings() {
    setTaskPref("purchase", {
      printer: printDraft.printer,
      preview: printDraft.preview,
      paperSize: printDraft.paperSize,
    });
    onSave(draft);
  }

  const visibleRows = activeTab === "bill" ? billToggles : gridToggles;

  return (
    <>
      <div className="fixed inset-0 z-[980] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-entry-settings-title"
          className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[22px] border border-slate-200 bg-slate-50 shadow-[0_28px_80px_rgba(15,23,42,0.34)] sm:max-w-2xl sm:rounded-[22px]"
        >
          <div className="bg-[linear-gradient(135deg,#091120_0%,#0f1a31_62%,#16213d_100%)] text-white">
            <div className="flex items-center justify-between px-4 py-3.5 sm:px-5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Purchase Entry
                </p>
                <h3
                  id="purchase-entry-settings-title"
                  className="mt-0.5 flex items-center gap-2 text-base font-semibold"
                >
                  <Settings className="h-4 w-4 text-cyan-300" />
                  Inline Settings
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close purchase settings"
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
                    className={`relative flex items-center justify-center gap-1.5 rounded-t-lg px-1.5 py-1.5 text-left transition ${
                      active
                        ? "bg-slate-50 text-slate-900"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-semibold leading-4">
                        {tab.label}
                      </span>
                      <span
                        className={`hidden truncate text-[8px] leading-3 sm:block ${
                          active ? "text-slate-500" : "text-white/35"
                        }`}
                      >
                        {tab.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {activeTab !== "print" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {visibleRows.map((definition) => (
                  <ToggleRow
                    key={definition.key}
                    definition={definition}
                    checked={draft[definition.key]}
                    onChange={(checked) => setUiValue(definition.key, checked)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2">
                    <h4 className="text-xs font-semibold text-slate-800">
                      Bill format
                    </h4>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      The selected format controls both preview and final print.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <PaperOption
                      value="A4"
                      current={printDraft.paperSize}
                      title="A4 Invoice"
                      description="Professional full-page purchase bill."
                      onChange={(paperSize) =>
                        setPrintDraft((current) => ({
                          ...current,
                          paperSize,
                        }))
                      }
                    />
                    <PaperOption
                      value="thermal"
                      current={printDraft.paperSize}
                      title="80mm Thermal"
                      description="Compact counter receipt format."
                      onChange={(paperSize) =>
                        setPrintDraft((current) => ({
                          ...current,
                          paperSize,
                        }))
                      }
                    />
                  </div>
                </section>

                <section className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPrintDraft((current) => ({
                        ...current,
                        preview: !current.preview,
                      }))
                    }
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {printDraft.preview ? (
                        <Eye className="h-4 w-4 shrink-0 text-cyan-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">
                          Print preview
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                          {printDraft.preview
                            ? "Show one clean preview before printing."
                            : "Print directly with no preview window."}
                        </span>
                      </span>
                    </span>

                    <span
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                        printDraft.preview ? "bg-cyan-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          printDraft.preview
                            ? "translate-x-[18px]"
                            : "translate-x-[3px]"
                        }`}
                      />
                    </span>
                  </button>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-800">
                      Printer
                    </label>

                    {!isDesktop ? (
                      <p className="text-[10px] leading-4 text-slate-500">
                        Browser mode uses the browser print destination.
                      </p>
                    ) : loadingPrinters ? (
                      <div className="flex items-center gap-2 py-2 text-[10px] text-slate-500">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Detecting printers…
                      </div>
                    ) : (
                      <SearchableDropdown
                        value={printDraft.printer ?? ""}
                        onChange={(value) =>
                          setPrintDraft((current) => ({
                            ...current,
                            printer: value || null,
                          }))
                        }
                        options={[
                          {
                            value: "",
                            label: "System default printer",
                          },
                          ...printers.map((printer) => ({
                            value: printer.name,
                            label: `${printer.displayName}${
                              printer.isDefault ? " (default)" : ""
                            }`,
                          })),
                        ]}
                        placeholder="System default printer"
                        autoOpenOnFocus
                        className="w-full"
                        controlClassName="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 transition hover:border-slate-300 focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                        menuClassName="z-[1100] max-h-56 text-xs"
                        buttonProps={{
                          "aria-label": "Printer",
                        }}
                      />
                    )}
                  </div>
                </section>

                <section className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setShowBusinessProfile(true)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-800">
                          Business Profile
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                          Logo, business name, address, GSTIN and footer.
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-cyan-700">
                      Edit
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPurchaseTemplate(true)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                        <LayoutTemplate className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-800">
                          Purchase Bill Template
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                          Style and choose which printed details are visible.
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-cyan-700">
                      Customize
                    </span>
                  </button>
                </section>

                <div className="rounded-xl border border-slate-300 bg-slate-900 px-3 py-2 text-[10px] leading-4 text-slate-100">
                  <strong>Preview on:</strong> Ctrl+P prints and Escape closes.
                  The preview closes automatically after a successful print.
                  <br />
                  <strong>Preview off:</strong> the selected A4 or thermal bill
                  prints directly without opening KYNFLOW preview.
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
            <button
              type="button"
              onClick={resetActiveTab}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset this tab
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applySettings}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Apply Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      <SettingsOverlay
        open={showBusinessProfile}
        title="Business Profile"
        description="Shared logo and shop details used by every document"
        icon={Building2}
        onClose={() => setShowBusinessProfile(false)}
        width="xl"
      >
        <ShopSettingsPanel embedded />
      </SettingsOverlay>

      <SettingsOverlay
        open={showPurchaseTemplate}
        title="Purchase Bill Template"
        description="Customize A4 and 80mm Purchase output"
        icon={LayoutTemplate}
        onClose={() => setShowPurchaseTemplate(false)}
        width="xl"
      >
        <PurchasePrintCustomizationPanel />
      </SettingsOverlay>
    </>
  );
}
