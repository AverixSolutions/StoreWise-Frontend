// src/app/dashboard/settings/sections/PrintSettingsSection.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Printer,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Globe,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { platform } from "@/platform";
import {
  getTaskPref,
  setTaskPref,
  clearAllPrefs,
  type PrintTask,
  type PaperSize,
} from "@/lib/print/printPreferences";

// ── Types ─────────────────────────────────────────────────────────────────────

type PrinterInfo = { name: string; displayName: string; isDefault: boolean };

type ResolvedPref = {
  printer: string | null;
  preview: boolean;
  paperSize: PaperSize;
};
type AllResolved = Partial<Record<PrintTask, ResolvedPref>>;

// ── Task definitions ──────────────────────────────────────────────────────────

const PRINT_TASKS: { key: PrintTask; label: string; sub: string }[] = [
  {
    key: "default",
    label: "Default",
    sub: "Fallback when no task-specific printer is set",
  },
  { key: "purchase", label: "Purchase Bills", sub: "Invoice on purchase save" },
  { key: "sales", label: "Sales / POS", sub: "Receipt on sale completion" },
  {
    key: "purchaseReturn",
    label: "Purchase Returns",
    sub: "Invoice on purchase return",
  },
  {
    key: "salesReturn",
    label: "Sales Returns",
    sub: "Invoice on sales return",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadAll(): AllResolved {
  const out: AllResolved = {};
  for (const { key } of PRINT_TASKS) out[key] = getTaskPref(key);
  return out;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        value ? "bg-sky-500" : "bg-slate-200"
      }`}
      aria-checked={value}
      role="switch"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function PaperPills({
  value,
  onChange,
}: {
  value: PaperSize;
  onChange: (v: PaperSize) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {(["A4", "thermal"] as PaperSize[]).map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-all duration-150 ${
            value === size
              ? "bg-white text-sky-600 shadow-sm border border-slate-200"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {size === "A4" ? "A4" : "80mm"}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PrintSettingsSection({
  onBack,
}: {
  onBack: () => void;
}) {
  const isDesktop =
    typeof window !== "undefined" && !!(window as any).electronAPI;

  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [prefs, setPrefs] = useState<AllResolved>(loadAll);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const loadPrinters = useCallback(async () => {
    setLoading(true);
    try {
      const list = await platform.getPrinters?.();
      setPrinters(list || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isDesktop) loadPrinters();
  }, [isDesktop, loadPrinters]);

  // Generic updater — any field of any task
  function handleChange<K extends keyof ResolvedPref>(
    task: PrintTask,
    field: K,
    value: ResolvedPref[K],
  ) {
    setTaskPref(task, { [field]: value });
    setPrefs(loadAll());
    setSaved(`${task}.${field}`);
    setTimeout(() => setSaved(null), 1600);
  }

  function handleClear() {
    clearAllPrefs();
    setPrefs(loadAll());
  }

  const taskPref = (task: PrintTask): ResolvedPref =>
    prefs[task] ?? { printer: null, preview: true, paperSize: "A4" };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header card ── */}
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#0f1e38_60%,#16213d_100%)] px-5 py-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Settings
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Print Settings
              </h1>
              <p className="text-sm text-slate-400">
                Printer, preview mode and paper size — per document type
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
        {!isDesktop ? (
          /* Web-only notice */
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Globe className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">
                Printer detection isn't available in the browser.
              </p>
              <p className="max-w-xs text-xs text-slate-400">
                Your browser will show its own print dialog. Paper size and
                preview preferences below still apply.
              </p>
            </div>

            {/* Still show preview + paper size controls in web mode */}
            <WebModePrefs
              tasks={PRINT_TASKS}
              taskPref={taskPref}
              saved={saved}
              onChange={handleChange}
              onClear={handleClear}
            />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Detecting printers…
          </div>
        ) : (
          <DesktopPrefs
            tasks={PRINT_TASKS}
            printers={printers}
            taskPref={taskPref}
            saved={saved}
            onChange={handleChange}
            onClear={handleClear}
            onRetry={loadPrinters}
          />
        )}
      </div>
    </div>
  );
}

// ── Desktop full prefs ────────────────────────────────────────────────────────

function DesktopPrefs({
  tasks,
  printers,
  taskPref,
  saved,
  onChange,
  onClear,
  onRetry,
}: {
  tasks: typeof PRINT_TASKS;
  printers: PrinterInfo[];
  taskPref: (t: PrintTask) => ResolvedPref;
  saved: string | null;
  onChange: <K extends keyof ResolvedPref>(
    t: PrintTask,
    f: K,
    v: ResolvedPref[K],
  ) => void;
  onClear: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Per-task print configuration
        </p>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition"
        >
          Reset all
        </button>
      </div>

      {printers.length === 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-amber-700 flex-1">
            No printers detected. Make sure a printer is installed.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* Column headers */}
      <div className="mb-1 hidden sm:grid sm:grid-cols-[1fr_220px_auto_auto] sm:gap-3 sm:px-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Task
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Printer
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Preview
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Paper
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {tasks.map(({ key, label, sub }) => {
          const pref = taskPref(key);
          return (
            <div
              key={key}
              className="flex flex-col gap-3 py-4 sm:grid sm:grid-cols-[1fr_220px_auto_auto] sm:items-center sm:gap-3"
            >
              {/* Label */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  {(saved === `${key}.printer` ||
                    saved === `${key}.preview` ||
                    saved === `${key}.paperSize`) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Saved
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </div>

              {/* Printer */}
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400 sm:hidden">
                  Printer
                </label>
                <select
                  value={pref.printer ?? ""}
                  onChange={(e) =>
                    onChange(key, "printer", e.target.value || null)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition"
                  disabled={printers.length === 0}
                >
                  <option value="">
                    {key === "default" ? "OS default" : "← Use default"}
                  </option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName}
                      {p.isDefault ? " ✓" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview toggle */}
              <div className="flex items-center gap-2 sm:flex-col sm:items-center sm:gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 sm:hidden">
                  Preview
                </label>
                <div className="flex items-center gap-1.5">
                  {pref.preview ? (
                    <Eye className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  )}
                  <Toggle
                    value={pref.preview}
                    onChange={(v) => onChange(key, "preview", v)}
                  />
                </div>
                <span className="text-[10px] text-slate-400">
                  {pref.preview ? "On" : "Off"}
                </span>
              </div>

              {/* Paper size */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 sm:hidden">
                  Paper
                </label>
                <PaperPills
                  value={pref.paperSize}
                  onChange={(v) => onChange(key, "paperSize", v)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        ✓ marks the system default printer. <strong>Preview off</strong> sends
        directly to the printer — no dialog. Paper size applies to the print
        job; layout is optimised per document type.
      </p>
    </div>
  );
}

// ── Web-mode: no printer selector, still show preview + paper ────────────────

function WebModePrefs({
  tasks,
  taskPref,
  saved,
  onChange,
  onClear,
}: {
  tasks: typeof PRINT_TASKS;
  taskPref: (t: PrintTask) => ResolvedPref;
  saved: string | null;
  onChange: <K extends keyof ResolvedPref>(
    t: PrintTask,
    f: K,
    v: ResolvedPref[K],
  ) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Preview &amp; paper size
        </p>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition"
        >
          Reset all
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {tasks.map(({ key, label, sub }) => {
          const pref = taskPref(key);
          return (
            <div
              key={key}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  {(saved === `${key}.preview` ||
                    saved === `${key}.paperSize`) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Saved
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  {pref.preview ? (
                    <Eye className="h-3.5 w-3.5 text-sky-400" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-slate-300" />
                  )}
                  <Toggle
                    value={pref.preview}
                    onChange={(v) => onChange(key, "preview", v)}
                  />
                  <span className="text-xs text-slate-400">
                    {pref.preview ? "Preview on" : "Silent"}
                  </span>
                </div>
                <PaperPills
                  value={pref.paperSize}
                  onChange={(v) => onChange(key, "paperSize", v)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
