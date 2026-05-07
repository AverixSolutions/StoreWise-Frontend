// src/lib/print/printPreferences.ts
const STORAGE_KEY = "kynflow_print_prefs";

export type PrintTask =
  | "default"
  | "purchase"
  | "sales"
  | "purchaseReturn"
  | "salesReturn";

export type PaperSize = "A4" | "thermal";

export type TaskPref = {
  printer?: string | null;
  preview?: boolean;
  paperSize?: PaperSize;
};

type PrintPrefs = Partial<Record<PrintTask, TaskPref>>;

// Sensible out-of-box defaults per task
const TASK_DEFAULTS: Record<PrintTask, Required<Omit<TaskPref, "printer">>> = {
  default: { preview: true, paperSize: "A4" },
  purchase: { preview: true, paperSize: "A4" },
  purchaseReturn: { preview: true, paperSize: "A4" },
  sales: { preview: true, paperSize: "thermal" },
  salesReturn: { preview: true, paperSize: "thermal" },
};

function load(): PrintPrefs {
  try {
    if (typeof localStorage === "undefined") return {};
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function save(prefs: PrintPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

/**
 * Returns the fully-resolved pref for a task:
 *   task-level overrides → default-task overrides → built-in defaults
 */
export function getTaskPref(task: PrintTask): {
  printer: string | null;
  preview: boolean;
  paperSize: PaperSize;
} {
  const prefs = load();
  const taskRaw = prefs[task] ?? {};
  const defRaw = prefs.default ?? {};
  const builtin = TASK_DEFAULTS[task];

  return {
    printer: taskRaw.printer ?? defRaw.printer ?? null,
    preview: taskRaw.preview ?? builtin.preview,
    paperSize: taskRaw.paperSize ?? builtin.paperSize,
  };
}

/** Merge partial updates into a task's stored prefs. */
export function setTaskPref(task: PrintTask, updates: Partial<TaskPref>) {
  const prefs = load();
  prefs[task] = { ...(prefs[task] ?? {}), ...updates };
  // Clean up nullish printer to keep storage tidy
  if (prefs[task]!.printer == null) delete prefs[task]!.printer;
  save(prefs);
}

/** Read all raw stored prefs (for the settings UI). */
export function getAllPrefs(): PrintPrefs {
  return load();
}

/** Nuke everything. */
export function clearAllPrefs() {
  save({});
}

// ── Legacy shim (keeps existing callers that only needed the printer name) ──

/** @deprecated Use getTaskPref(task).printer instead. */
export function getPrinterForTask(task: PrintTask): string | null {
  return getTaskPref(task).printer;
}

/** @deprecated Use setTaskPref(task, { printer }) instead. */
export function setPrinterForTask(task: PrintTask, printerName: string | null) {
  setTaskPref(task, { printer: printerName ?? null });
}
