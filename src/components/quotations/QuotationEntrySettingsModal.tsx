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
import QuotationPrintCustomizationPanel from "@/components/print/QuotationPrintCustomizationPanel";
import {
  DEFAULT_QUOTATION_PRINT_SETTINGS,
  loadQuotationPrintSettings,
  saveQuotationPrintSettings,
  type QuotationPrintFormat,
} from "@/lib/print/quotationPrintSettings";
import {
  DEFAULT_QUOTATION_UI_SETTINGS,
  type QuotationUiSettings,
} from "./quotationUiSettings";

type Tab = "bill" | "columns" | "print";

type Props = {
  open: boolean;
  settings: QuotationUiSettings;
  onClose: () => void;
  onSave: (settings: QuotationUiSettings) => void;
  initialTab?: Tab;
};

type ToggleDefinition = {
  key: keyof QuotationUiSettings;
  label: string;
  description: string;
};

type PrinterInfo = {
  name: string;
  displayName: string;
  isDefault: boolean;
};

const billToggles: ToggleDefinition[] = [
  {
    key: "showStatus",
    label: "Status",
    description: "Keep Draft / Sent / Expired available only when needed.",
  },
  {
    key: "showDepartment",
    label: "Department",
    description: "Optional quotation department reference.",
  },
  {
    key: "showHeaderDiscount",
    label: "Quotation discount",
    description: "Show the document-level discount field.",
  },
  {
    key: "showNotes",
    label: "Notes",
    description: "Show validity, terms and quotation remarks.",
  },
];

const columnToggles: ToggleDefinition[] = [
  {
    key: "showStock",
    label: "Stock",
    description: "Show current stock as guidance while quoting.",
  },
  {
    key: "showUnit",
    label: "Unit",
    description: "The saved item unit remains active when hidden.",
  },
  {
    key: "showTax",
    label: "Tax",
    description: "The saved tax remains applied when hidden.",
  },
  {
    key: "showLineDiscount",
    label: "Line discount",
    description: "Show per-item discount controls.",
  },
];

const tabs: Array<{ key: Tab; label: string; icon: typeof FileText }> = [
  { key: "bill", label: "Bill Details", icon: FileText },
  { key: "columns", label: "Item Columns", icon: Columns3 },
  { key: "print", label: "Print", icon: Printer },
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
      className={`flex min-h-[58px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
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

function FormatOption({
  value,
  current,
  title,
  description,
  onChange,
}: {
  value: QuotationPrintFormat;
  current: QuotationPrintFormat;
  title: string;
  description: string;
  onChange: (value: QuotationPrintFormat) => void;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex min-h-[76px] items-center justify-between rounded-xl border p-3 text-left transition ${
        selected
          ? "border-cyan-400 bg-cyan-50 ring-2 ring-cyan-400/15"
          : "border-slate-200 bg-white hover:border-cyan-300"
      }`}
    >
      <span>
        <span className="block text-xs font-semibold text-slate-800">
          {title}
        </span>
        <span className="mt-1 block text-[10px] leading-4 text-slate-500">
          {description}
        </span>
      </span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-cyan-600" /> : null}
    </button>
  );
}

export default function QuotationEntrySettingsModal({
  open,
  settings,
  onClose,
  onSave,
  initialTab = "bill",
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [draft, setDraft] = useState(settings);
  const [printDraft, setPrintDraft] = useState(loadQuotationPrintSettings());
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [showBusinessProfile, setShowBusinessProfile] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  const isDesktop =
    typeof window !== "undefined" && Boolean((window as any).electronAPI);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setDraft(settings);
    setPrintDraft(loadQuotationPrintSettings());
  }, [initialTab, open, settings]);

  useEffect(() => {
    if (!open || !isDesktop) return;
    let cancelled = false;

    const loadPrinters = async () => {
      setLoadingPrinters(true);
      try {
        const rows = await platform.getPrinters?.();
        if (!cancelled) setPrinters((rows || []) as PrinterInfo[]);
      } finally {
        if (!cancelled) setLoadingPrinters(false);
      }
    };

    void loadPrinters();
    return () => {
      cancelled = true;
    };
  }, [isDesktop, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || showBusinessProfile || showTemplate) {
        return;
      }
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, open, showBusinessProfile, showTemplate]);

  if (!open) return null;

  const visibleToggles = activeTab === "bill" ? billToggles : columnToggles;

  function resetActiveTab() {
    if (activeTab === "print") {
      setPrintDraft({ ...DEFAULT_QUOTATION_PRINT_SETTINGS });
      return;
    }

    const definitions = activeTab === "bill" ? billToggles : columnToggles;
    setDraft((current) => {
      const next = { ...current };
      definitions.forEach(({ key }) => {
        next[key] = DEFAULT_QUOTATION_UI_SETTINGS[key];
      });
      return next;
    });
  }

  function applySettings() {
    saveQuotationPrintSettings(printDraft);
    onSave(draft);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-[980] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quotation-entry-settings-title"
          className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[22px] border border-slate-200 bg-slate-50 shadow-[0_28px_80px_rgba(15,23,42,0.34)] sm:max-w-2xl sm:rounded-[22px]"
        >
          <div className="bg-[linear-gradient(135deg,#091120_0%,#0f1a31_62%,#16213d_100%)] text-white">
            <div className="flex items-center justify-between px-4 py-3.5 sm:px-5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Quotation
                </p>
                <h3
                  id="quotation-entry-settings-title"
                  className="mt-0.5 flex items-center gap-2 text-base font-semibold"
                >
                  <Settings className="h-4 w-4 text-cyan-300" />
                  Inline Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close quotation settings"
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
                    className={`flex items-center justify-center gap-1.5 rounded-t-lg px-2 py-2 text-[10px] font-semibold transition ${
                      active
                        ? "bg-slate-50 text-slate-900"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {activeTab !== "print" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {visibleToggles.map((definition) => (
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
            ) : (
              <div className="space-y-3">
                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <h4 className="text-xs font-semibold text-slate-800">
                    Quotation format
                  </h4>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Choose the exact saved format used by preview and printing.
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <FormatOption
                      value="classic"
                      current={printDraft.format}
                      title="Classic A4"
                      description="Traditional full-page quotation."
                      onChange={(format) =>
                        setPrintDraft((current) => ({ ...current, format }))
                      }
                    />
                    <FormatOption
                      value="modern"
                      current={printDraft.format}
                      title="Modern A4"
                      description="Modern full-page quotation."
                      onChange={(format) =>
                        setPrintDraft((current) => ({ ...current, format }))
                      }
                    />
                    <FormatOption
                      value="thermal"
                      current={printDraft.format}
                      title="80mm Thermal"
                      description="Compact quotation receipt."
                      onChange={(format) =>
                        setPrintDraft((current) => ({ ...current, format }))
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
                    <span className="flex items-center gap-2.5">
                      {printDraft.preview ? (
                        <Eye className="h-4 w-4 text-cyan-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-slate-400" />
                      )}
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">
                          Print preview
                        </span>
                        <span className="mt-0.5 block text-[10px] text-slate-500">
                          {printDraft.preview
                            ? "Show one clean preview before printing."
                            : "Print directly without a preview window."}
                        </span>
                      </span>
                    </span>
                    <span
                      className={`relative inline-flex h-5 w-9 items-center rounded-full ${
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
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-800">
                        Printer
                      </label>
                      {loadingPrinters ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />
                      ) : null}
                    </div>
                    {isDesktop ? (
                      <SearchableDropdown
                        value={printDraft.printer || ""}
                        onChange={(value) =>
                          setPrintDraft((current) => ({
                            ...current,
                            printer: value || null,
                          }))
                        }
                        options={[
                          { value: "", label: "System default printer" },
                          ...printers.map((printer) => ({
                            value: printer.name,
                            label: `${printer.displayName || printer.name}${
                              printer.isDefault ? " (Default)" : ""
                            }`,
                          })),
                        ]}
                        placeholder="System default printer"
                        autoOpenOnFocus
                        className="w-full"
                        controlClassName="h-9 text-xs"
                        menuClassName="z-[1100] max-h-56 text-xs"
                        buttonProps={{ "aria-label": "Printer" }}
                      />
                    ) : (
                      <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-500">
                        System default printer
                      </div>
                    )}
                  </div>
                </section>

                <section className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplate(true)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                        <LayoutTemplate className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-800">
                          Quotation Template
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                          See the real Classic, Modern and 80mm layouts.
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-cyan-700">
                      Preview
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBusinessProfile(true)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
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
                          Shared logo, identity, address and GSTIN.
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-emerald-700">
                      Edit
                    </span>
                  </button>
                </section>

                <div className="rounded-xl border border-slate-300 bg-slate-900 px-3 py-2 text-[10px] leading-4 text-slate-100">
                  <strong>Classic / Modern:</strong> prints on A4.
                  <br />
                  <strong>80mm Thermal:</strong> uses the printer-safe compact
                  receipt path.
                  <br />
                  <strong>Preview on:</strong> Ctrl+P prints and Escape closes
                  the preview.
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
            <button
              type="button"
              onClick={resetActiveTab}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset tab
            </button>
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

      <SettingsOverlay
        open={showTemplate}
        title="Quotation Template"
        description="Exact Classic A4, Modern A4 and 80mm renderer preview"
        icon={LayoutTemplate}
        onClose={() => setShowTemplate(false)}
        width="xl"
      >
        <QuotationPrintCustomizationPanel
          format={printDraft.format}
          onFormatChange={(format) =>
            setPrintDraft((current) => ({ ...current, format }))
          }
        />
      </SettingsOverlay>

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
    </>
  );
}
