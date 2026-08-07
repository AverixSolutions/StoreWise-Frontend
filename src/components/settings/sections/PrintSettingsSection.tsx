// src/app/dashboard/settings/sections/PrintSettingsSection.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  Globe,
  LayoutTemplate,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { platform } from "@/platform";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import SettingsOverlay from "@/components/settings/SettingsOverlay";
import PurchasePrintCustomizationPanel from "@/components/print/PurchasePrintCustomizationPanel";
import PurchaseReturnPrintCustomizationPanel from "@/components/print/PurchaseReturnPrintCustomizationPanel";
import SalesReturnPrintCustomizationPanel from "@/components/print/SalesReturnPrintCustomizationPanel";
import {
  clearAllPrefs,
  getTaskPref,
  setTaskPref,
  type PaperSize,
  type PrintTask,
} from "@/lib/print/printPreferences";

type PrinterInfo = {
  name: string;
  displayName: string;
  isDefault: boolean;
};

type ResolvedPref = {
  printer: string | null;
  preview: boolean;
  paperSize: PaperSize;
};

type TaskDefinition = {
  key: PrintTask;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  customizable?: boolean;
};

const DEFAULT_TASK: TaskDefinition = {
  key: "default",
  label: "Default output",
  description: "Fallback printer, preview mode and paper size.",
  icon: Printer,
  accent: "bg-sky-100 text-sky-600",
};

const DOCUMENT_TASKS: TaskDefinition[] = [
  {
    key: "purchase",
    label: "Purchase Bill",
    description: "Supplier Purchase documents.",
    icon: ShoppingCart,
    accent: "bg-cyan-100 text-cyan-700",
    customizable: true,
  },
  {
    key: "sales",
    label: "Sales Invoice",
    description: "Sales and POS documents.",
    icon: ReceiptText,
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "purchaseReturn",
    label: "Purchase Return",
    description: "Supplier return documents.",
    icon: Undo2,
    accent: "bg-amber-100 text-amber-700",
    customizable: true,
  },
  {
    key: "salesReturn",
    label: "Sales Return",
    description: "Customer return documents.",
    icon: RotateCcw,
    accent: "bg-violet-100 text-violet-700",
    customizable: true,
  },
];

function PaperPills({
  value,
  onChange,
}: {
  value: PaperSize;
  onChange: (value: PaperSize) => void;
}) {
  return (
    <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1">
      {(["A4", "thermal"] as PaperSize[]).map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
            value === size
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {size === "A4" ? "A4" : "80mm"}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        value ? "bg-cyan-500" : "bg-slate-300"
      }`}
      aria-checked={value}
      role="switch"
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function OutputCard({
  definition,
  pref,
  printerLabel,
  onConfigure,
  onCustomize,
}: {
  definition: TaskDefinition;
  pref: ResolvedPref;
  printerLabel: string;
  onConfigure: () => void;
  onCustomize?: () => void;
}) {
  const Icon = definition.icon;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${definition.accent}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          {pref.paperSize === "thermal" ? "80mm" : "A4"}
        </span>
      </div>

      <div className="mt-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {definition.label}
        </h3>
        <p className="mt-1 text-[10px] leading-4 text-slate-500">
          {definition.description}
        </p>
      </div>

      <dl className="mt-3 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Printer
          </dt>
          <dd className="max-w-[65%] truncate text-right text-[10px] font-semibold text-slate-700">
            {printerLabel}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Mode
          </dt>
          <dd className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700">
            {pref.preview ? (
              <Eye className="h-3 w-3 text-cyan-600" />
            ) : (
              <EyeOff className="h-3 w-3 text-slate-400" />
            )}
            {pref.preview ? "Preview" : "Direct print"}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <button
          type="button"
          onClick={onConfigure}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-slate-800"
        >
          Configure
          <ArrowRight className="h-3 w-3" />
        </button>
        {onCustomize && (
          <button
            type="button"
            onClick={onCustomize}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-[10px] font-semibold text-cyan-700 transition hover:bg-cyan-100"
          >
            <LayoutTemplate className="h-3 w-3" />
            Customize bill
          </button>
        )}
      </div>
    </article>
  );
}

export default function PrintSettingsSection({
  onBack,
}: {
  onBack: () => void;
}) {
  const isDesktop =
    typeof window !== "undefined" && !!(window as any).electronAPI;

  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [activeTask, setActiveTask] = useState<PrintTask | null>(null);
  const [showPurchaseTemplate, setShowPurchaseTemplate] = useState(false);
  const [showPurchaseReturnTemplate, setShowPurchaseReturnTemplate] =
    useState(false);
  const [showSalesReturnTemplate, setShowSalesReturnTemplate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saved, setSaved] = useState(false);

  const loadPrinters = useCallback(async () => {
    if (!isDesktop) return;
    setLoadingPrinters(true);
    try {
      const rows = await platform.getPrinters?.();
      setPrinters(rows || []);
    } finally {
      setLoadingPrinters(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    void loadPrinters();
  }, [loadPrinters]);

  const activeDefinition = useMemo(
    () =>
      activeTask === "default"
        ? DEFAULT_TASK
        : (DOCUMENT_TASKS.find((task) => task.key === activeTask) ?? null),
    [activeTask],
  );

  function taskPref(task: PrintTask): ResolvedPref {
    void refreshKey;
    return getTaskPref(task);
  }

  function printerName(pref: ResolvedPref, task: PrintTask): string {
    if (!isDesktop) return "Browser destination";
    if (!pref.printer) {
      return task === "default" ? "System default" : "Default output";
    }

    return (
      printers.find((printer) => printer.name === pref.printer)?.displayName ||
      pref.printer
    );
  }

  function updateTask<K extends keyof ResolvedPref>(
    task: PrintTask,
    key: K,
    value: ResolvedPref[K],
  ) {
    setTaskPref(task, { [key]: value });
    setRefreshKey((current) => current + 1);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  function resetTask(task: PrintTask) {
    setTaskPref(task, {
      printer: null,
      preview: true,
      paperSize: "A4",
    });
    setRefreshKey((current) => current + 1);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  function resetEverything() {
    clearAllPrefs();
    setRefreshKey((current) => current + 1);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  const activePref = activeTask ? taskPref(activeTask) : null;

  return (
    <>
      <div className="flex flex-col gap-4">
        <section className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#0f1e38_60%,#16213d_100%)] px-5 py-5 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/20 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Settings
              </button>

              <button
                type="button"
                onClick={resetEverything}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/80 transition hover:bg-white/20 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                Reset print settings
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  Print & Documents
                </h1>
                <p className="text-sm text-slate-400">
                  Configure one output at a time instead of one long settings
                  page.
                </p>
              </div>
            </div>
          </div>
        </section>

        {saved && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Print preference saved.
          </div>
        )}

        {!isDesktop && (
          <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <Globe className="h-4 w-4 shrink-0 text-sky-600" />
            <p className="text-xs text-sky-700">
              Browser mode uses the browser print destination. Preview and paper
              preferences still apply.
            </p>
          </div>
        )}

        <section>
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Default output
            </h2>
            <p className="text-[10px] text-slate-500">
              Used whenever a document has no dedicated printer.
            </p>
          </div>
          <div className="max-w-xl">
            <OutputCard
              definition={DEFAULT_TASK}
              pref={taskPref("default")}
              printerLabel={printerName(taskPref("default"), "default")}
              onConfigure={() => setActiveTask("default")}
            />
          </div>
        </section>

        <section className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Document outputs
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Open only the document you need. Future templates can be added
                without lengthening this page.
              </p>
            </div>
            {loadingPrinters && (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Detecting printers
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {DOCUMENT_TASKS.map((definition) => {
              const pref = taskPref(definition.key);
              return (
                <OutputCard
                  key={definition.key}
                  definition={definition}
                  pref={pref}
                  printerLabel={printerName(pref, definition.key)}
                  onConfigure={() => setActiveTask(definition.key)}
                  onCustomize={
                    definition.key === "purchase"
                      ? () => setShowPurchaseTemplate(true)
                      : definition.key === "purchaseReturn"
                        ? () => setShowPurchaseReturnTemplate(true)
                        : definition.key === "salesReturn"
                          ? () => setShowSalesReturnTemplate(true)
                          : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      </div>

      <SettingsOverlay
        open={Boolean(activeTask && activeDefinition && activePref)}
        title={activeDefinition?.label || "Print output"}
        description="Printer, preview mode and paper size"
        icon={activeDefinition?.icon || Printer}
        onClose={() => setActiveTask(null)}
        width="lg"
      >
        {activeTask && activeDefinition && activePref && (
          <div className="space-y-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {activeDefinition.label}
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {activeDefinition.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resetTask(activeTask)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Printer
                  </label>
                  {!isDesktop ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                      Browser print destination
                    </div>
                  ) : loadingPrinters ? (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Detecting printers...
                    </div>
                  ) : (
                    <SearchableDropdown
                      value={activePref.printer ?? ""}
                      onChange={(value) =>
                        updateTask(activeTask, "printer", value || null)
                      }
                      options={[
                        {
                          value: "",
                          label:
                            activeTask === "default"
                              ? "System default printer"
                              : "Use Default output",
                        },
                        ...printers.map((printer) => ({
                          value: printer.name,
                          label: `${printer.displayName}${
                            printer.isDefault ? " (system default)" : ""
                          }`,
                        })),
                      ]}
                      placeholder={
                        activeTask === "default"
                          ? "System default printer"
                          : "Use Default output"
                      }
                      autoOpenOnFocus
                      className="w-full"
                      controlClassName="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 transition hover:border-slate-300 focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      menuClassName="z-[1900] max-h-64 text-xs"
                      buttonProps={{
                        "aria-label": `${activeDefinition.label} printer`,
                      }}
                    />
                  )}
                </div>

                <div className="flex min-h-[76px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <span className="flex items-center gap-2.5">
                    {activePref.preview ? (
                      <Eye className="h-4 w-4 text-cyan-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    )}
                    <span>
                      <span className="block text-xs font-semibold text-slate-800">
                        Print preview
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {activePref.preview
                          ? "Preview before printing."
                          : "Print directly."}
                      </span>
                    </span>
                  </span>
                  <Toggle
                    value={activePref.preview}
                    onChange={(value) =>
                      updateTask(activeTask, "preview", value)
                    }
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <label className="mb-2 block text-xs font-semibold text-slate-800">
                    Paper format
                  </label>
                  <PaperPills
                    value={activePref.paperSize}
                    onChange={(value) =>
                      updateTask(activeTask, "paperSize", value)
                    }
                  />
                </div>
              </div>
            </section>

            {activeTask === "purchase" && (
              <button
                type="button"
                onClick={() => {
                  setActiveTask(null);
                  setShowPurchaseTemplate(true);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-left transition hover:bg-cyan-100"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white">
                    <LayoutTemplate className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-cyan-900">
                      Customize Purchase Bill
                    </span>
                    <span className="mt-0.5 block text-[10px] text-cyan-700">
                      Style, logo visibility, document fields and footer.
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-cyan-700" />
              </button>
            )}

            {activeTask === "purchaseReturn" && (
              <button
                type="button"
                onClick={() => {
                  setActiveTask(null);
                  setShowPurchaseReturnTemplate(true);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left transition hover:bg-amber-100"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white">
                    <LayoutTemplate className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-amber-900">
                      Customize Purchase Return
                    </span>
                    <span className="mt-0.5 block text-[10px] text-amber-700">
                      Classic/Modern A4, logo, fields and footer.
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-amber-700" />
              </button>
            )}

            {activeTask === "salesReturn" && (
              <button
                type="button"
                onClick={() => {
                  setActiveTask(null);
                  setShowSalesReturnTemplate(true);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left transition hover:bg-violet-100"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
                    <LayoutTemplate className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-violet-900">
                      Customize Sales Return
                    </span>
                    <span className="mt-0.5 block text-[10px] text-violet-700">
                      Classic/Modern A4, 80mm, fields and footer.
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-violet-700" />
              </button>
            )}
          </div>
        )}
      </SettingsOverlay>

      <SettingsOverlay
        open={showPurchaseTemplate}
        title="Purchase Bill Template"
        description="A4 and 80mm layout customization"
        icon={LayoutTemplate}
        onClose={() => setShowPurchaseTemplate(false)}
        width="xl"
      >
        <PurchasePrintCustomizationPanel />
      </SettingsOverlay>

      <SettingsOverlay
        open={showPurchaseReturnTemplate}
        title="Purchase Return Template"
        description="A4 and 80mm Purchase Return layout customization"
        icon={LayoutTemplate}
        onClose={() => setShowPurchaseReturnTemplate(false)}
        width="xl"
      >
        <PurchaseReturnPrintCustomizationPanel />
      </SettingsOverlay>

      <SettingsOverlay
        open={showSalesReturnTemplate}
        title="Sales Return Template"
        description="Classic, Modern and 80mm Sales Return customization"
        icon={LayoutTemplate}
        onClose={() => setShowSalesReturnTemplate(false)}
        width="xl"
      >
        <SalesReturnPrintCustomizationPanel />
      </SettingsOverlay>
    </>
  );
}
