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
import { platform } from "@/platform";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import SalesReturnPrintCustomizationPanel from "@/components/print/SalesReturnPrintCustomizationPanel";
import { getTaskPref, setTaskPref } from "@/lib/print/printPreferences";
import {
  DEFAULT_SALES_RETURN_UI_SETTINGS,
  type SalesReturnUiSettings,
} from "./salesReturnUiSettings";

type Tab = "bill" | "columns" | "print";
type PrinterInfo = { name: string; displayName: string; isDefault: boolean };

type ToggleDefinition =
  | {
      group: "billDetails";
      key: keyof SalesReturnUiSettings["billDetails"];
      label: string;
      description: string;
    }
  | {
      group: "itemColumns";
      key: keyof SalesReturnUiSettings["itemColumns"];
      label: string;
      description: string;
    };

const billToggles: Extract<ToggleDefinition, { group: "billDetails" }>[] = [
  {
    group: "billDetails",
    key: "returnDate",
    label: "Return date",
    description: "Keep the saved return date while hiding its control.",
  },
  {
    group: "billDetails",
    key: "entryTime",
    label: "Entry time",
    description: "Keep the stored timestamp without showing its time control.",
  },
  {
    group: "billDetails",
    key: "department",
    label: "Department",
    description: "Optional Sales Return department reference.",
  },
  {
    group: "billDetails",
    key: "debitAccount",
    label: "Debit account",
    description: "Optional debit-account reference.",
  },
  {
    group: "billDetails",
    key: "natureOfEntry",
    label: "Nature of entry",
    description: "Optional Sales Return description.",
  },
  {
    group: "billDetails",
    key: "discount",
    label: "Return discount",
    description: "Show the return-level discount input.",
  },
];

const columnToggles: Extract<ToggleDefinition, { group: "itemColumns" }>[] = [
  {
    group: "itemColumns",
    key: "tax",
    label: "Tax",
    description: "The row tax remains applied when hidden.",
  },
  {
    group: "itemColumns",
    key: "discount",
    label: "Line discount",
    description: "Show per-item return discount controls.",
  },
  {
    group: "itemColumns",
    key: "mrp",
    label: "MRP",
    description: "Show the selected batch MRP snapshot.",
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

export default function SalesReturnEntrySettingsModal({
  isOpen,
  value,
  onApply,
  onClose,
}: {
  isOpen: boolean;
  value: SalesReturnUiSettings;
  onApply: (value: SalesReturnUiSettings) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("bill");
  const [draft, setDraft] = useState(value);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [printPref, setPrintPrefState] = useState(() =>
    getTaskPref("salesReturn"),
  );

  useEffect(() => {
    if (!isOpen) return;
    setDraft(value);
    setPrintPrefState(getTaskPref("salesReturn"));

    let cancelled = false;
    platform
      .getPrinters?.()
      .then((rows) => {
        if (!cancelled) setPrinters((rows || []) as PrinterInfo[]);
      })
      .catch(() => {
        if (!cancelled) setPrinters([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const definitions = activeTab === "bill" ? billToggles : columnToggles;

  function setPref(patch: Partial<typeof printPref>) {
    const next = { ...printPref, ...patch };
    setPrintPrefState(next);
    setTaskPref("salesReturn", patch);
  }

  function resetActiveTab() {
    if (activeTab === "print") {
      const next = {
        printer: null,
        preview: true,
        paperSize: "thermal" as const,
      };
      setPrintPrefState(next);
      setTaskPref("salesReturn", next);
      return;
    }

    setDraft((current) => {
      const next = {
        ...current,
        billDetails: { ...current.billDetails },
        itemColumns: { ...current.itemColumns },
      };
      definitions.forEach((definition) => {
        if (definition.group === "billDetails") {
          next.billDetails[
            definition.key as keyof SalesReturnUiSettings["billDetails"]
          ] =
            DEFAULT_SALES_RETURN_UI_SETTINGS.billDetails[
              definition.key as keyof SalesReturnUiSettings["billDetails"]
            ];
        } else {
          next.itemColumns[
            definition.key as keyof SalesReturnUiSettings["itemColumns"]
          ] =
            DEFAULT_SALES_RETURN_UI_SETTINGS.itemColumns[
              definition.key as keyof SalesReturnUiSettings["itemColumns"]
            ];
        }
      });
      return next;
    });
  }

  function toggle(definition: ToggleDefinition, checked: boolean) {
    setDraft((current) => {
      if (definition.group === "billDetails") {
        const key =
          definition.key as keyof SalesReturnUiSettings["billDetails"];
        return {
          ...current,
          billDetails: { ...current.billDetails, [key]: checked },
        };
      }

      const key = definition.key as keyof SalesReturnUiSettings["itemColumns"];
      return {
        ...current,
        itemColumns: { ...current.itemColumns, [key]: checked },
      };
    });
  }

  function isChecked(definition: ToggleDefinition) {
    if (definition.group === "billDetails") {
      return Boolean(
        draft.billDetails[
          definition.key as keyof SalesReturnUiSettings["billDetails"]
        ],
      );
    }
    return Boolean(
      draft.itemColumns[
        definition.key as keyof SalesReturnUiSettings["itemColumns"]
      ],
    );
  }

  function applySettings() {
    onApply(draft);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[1700] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-return-settings-title"
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[22px] border border-slate-200 bg-slate-50 shadow-[0_28px_80px_rgba(15,23,42,0.34)] sm:max-w-2xl sm:rounded-[22px]"
      >
        <div className="bg-[linear-gradient(135deg,#091120_0%,#0f1a31_62%,#16213d_100%)] text-white">
          <div className="flex items-center justify-between px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Sales Return
              </p>
              <h3
                id="sales-return-settings-title"
                className="mt-0.5 flex items-center gap-2 text-base font-semibold"
              >
                <Settings className="h-4 w-4 text-cyan-300" />
                Inline Settings
              </h3>
              <p className="mt-1 text-[10px] text-white/55">
                Grid visibility and Sales Return print output.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Sales Return settings"
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
              Return Type, Customer and optional Sale Bill stay in Bill Details.
              The item grid follows Sales: Product, Qty, Unit, Rate Type, Return
              Rate, Amount and Action stay visible. F2 opens batch selection
              without adding a separate Batch column.
            </p>
          </div>

          {activeTab === "print" ? (
            <div className="space-y-3">
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <h4 className="text-xs font-semibold text-slate-800">
                  Print destination
                </h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                      Printer
                    </label>
                    <SearchableDropdown
                      value={printPref.printer || ""}
                      onChange={(printer) =>
                        setPref({ printer: printer || null })
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
                      controlClassName="h-9 text-xs"
                      menuClassName="z-[1900] max-h-56 text-xs"
                      buttonProps={{ "aria-label": "Sales Return printer" }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                      Paper
                    </label>
                    <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                      {(["A4", "thermal"] as const).map((paperSize) => (
                        <button
                          key={paperSize}
                          type="button"
                          onClick={() => setPref({ paperSize })}
                          className={`h-7 rounded-md text-[10px] font-semibold transition ${
                            printPref.paperSize === paperSize
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {paperSize === "thermal" ? "80mm" : "A4"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                      Preview
                    </label>
                    <button
                      type="button"
                      onClick={() => setPref({ preview: !printPref.preview })}
                      className={`flex h-9 w-full items-center justify-between rounded-lg border px-2.5 text-[10px] font-semibold transition ${
                        printPref.preview
                          ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      <span>
                        {printPref.preview ? "Preview on" : "Direct print"}
                      </span>
                      <span
                        className={`relative inline-flex h-4 w-8 items-center rounded-full ${
                          printPref.preview ? "bg-cyan-500" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
                            printPref.preview
                              ? "translate-x-[17px]"
                              : "translate-x-[3px]"
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <SalesReturnPrintCustomizationPanel compact />
              </section>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {definitions.map((definition) => (
                <ToggleRow
                  key={`${definition.group}:${String(definition.key)}`}
                  definition={definition}
                  checked={isChecked(definition)}
                  onChange={(checked) => toggle(definition, checked)}
                />
              ))}
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
  );
}
