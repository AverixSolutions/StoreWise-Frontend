"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Check,
  ClipboardPaste,
  Edit3,
  LoaderCircle,
  MoreVertical,
  Plus,
  Power,
  Rows3,
  Star,
  Trash2,
  X,
} from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import {
  RATE_CODE_PATTERN,
  codeAfterNameChange,
  nextRateSortOrder,
  normalizeCaseInsensitive,
  parseRatePaste,
  validateBulkRateRows,
  type BulkRateDraft,
  type BulkRateField,
} from "@/lib/rates/rateMaster";
import { platform } from "@/platform";
import type { RateTypeRecord } from "@/platform/types";

type RateDraft = {
  id?: string;
  name: string;
  code: string;
  sortOrder: string;
  isActive: boolean;
  isDefault: boolean;
  codeManuallyEdited: boolean;
};

type BulkUiRow = BulkRateDraft & {
  key: string;
  codeManuallyEdited: boolean;
};

type ConfirmAction = {
  title: string;
  message: string;
  confirmText: string;
  successMessage: string;
  action: () => Promise<{ success: boolean; error?: string }>;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 disabled:bg-slate-100 disabled:text-slate-400";

function singleRateErrors(draft: RateDraft, existing: RateTypeRecord[]) {
  const errors: Partial<Record<"name" | "code" | "sortOrder" | "isActive", string>> = {};
  const name = draft.name.trim();
  const code = draft.code.trim().toUpperCase();
  const sortOrder = Number(draft.sortOrder);
  const otherRows = existing.filter((row) => row.id !== draft.id);
  if (!name) errors.name = "Rate name is required.";
  else if (
    otherRows.some(
      (row) => normalizeCaseInsensitive(row.name) === normalizeCaseInsensitive(name),
    )
  ) {
    errors.name = "A rate with this name already exists.";
  }
  if (!code) errors.code = "Rate code is required.";
  else if (!RATE_CODE_PATTERN.test(code)) {
    errors.code = "Use 1-30 uppercase letters, numbers, hyphens or underscores.";
  } else if (
    otherRows.some(
      (row) => normalizeCaseInsensitive(row.code) === normalizeCaseInsensitive(code),
    )
  ) {
    errors.code = "A rate with this code already exists.";
  }
  if (
    !draft.sortOrder.trim() ||
    !Number.isFinite(sortOrder) ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0
  ) {
    errors.sortOrder = "Order must be a non-negative whole number.";
  }
  if (draft.isDefault && !draft.isActive) {
    errors.isActive = "The default rate must be active.";
  }
  return errors;
}

function RateEditorModal({
  draft,
  existing,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: RateDraft;
  existing: RateTypeRecord[];
  saving: boolean;
  onChange: (draft: RateDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const errors = singleRateErrors(draft, existing);
  const valid = Object.keys(errors).length === 0;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  return (
    <div
      className="fixed inset-0 z-[980] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-editor-title"
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:max-w-lg sm:rounded-[24px]"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !saving) onSave();
        }}
      >
        <div className="flex items-center justify-between bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Selling Rate Master
            </p>
            <h3 id="rate-editor-title" className="mt-0.5 text-base font-semibold">
              {draft.id ? "Edit Selling Rate" : "Add Selling Rate"}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close rate editor"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Rate Name
            </span>
            <input
              autoFocus
              value={draft.name}
              onChange={(event) => {
                const name = event.target.value;
                onChange({
                  ...draft,
                  name,
                  code: codeAfterNameChange(
                    name,
                    draft.code,
                    draft.codeManuallyEdited,
                  ),
                });
              }}
              aria-invalid={Boolean(errors.name)}
              className={inputClass}
              placeholder="e.g. Wholesale Price"
            />
            {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name}</p>}
          </label>

          <label>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Rate Code
            </span>
            <input
              value={draft.code}
              onChange={(event) =>
                onChange({
                  ...draft,
                  code: event.target.value.toUpperCase(),
                  codeManuallyEdited: true,
                })
              }
              maxLength={30}
              aria-invalid={Boolean(errors.code)}
              className={`${inputClass} font-mono uppercase`}
              placeholder="WHOLESALE_PRICE"
            />
            {errors.code && <p className="mt-1 text-xs text-rose-600">{errors.code}</p>}
          </label>

          <label>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Sort Order
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={draft.sortOrder}
              onChange={(event) => onChange({ ...draft, sortOrder: event.target.value })}
              aria-invalid={Boolean(errors.sortOrder)}
              className={inputClass}
            />
            {errors.sortOrder && (
              <p className="mt-1 text-xs text-rose-600">{errors.sortOrder}</p>
            )}
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={draft.isActive}
              disabled={draft.isDefault}
              onChange={(event) => onChange({ ...draft, isActive: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-400"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-700">Active</span>
              <span className="block text-xs text-slate-500">Available for new transactions.</span>
              {errors.isActive && (
                <span className="mt-1 block text-xs text-rose-600">{errors.isActive}</span>
              )}
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={draft.isDefault}
              disabled={Boolean(draft.id && draft.isDefault)}
              onChange={(event) =>
                onChange({
                  ...draft,
                  isDefault: event.target.checked,
                  isActive: event.target.checked ? true : draft.isActive,
                })
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-400"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-700">Make Default</span>
              <span className="block text-xs text-slate-500">
                {draft.id && draft.isDefault
                  ? "This is the current default."
                  : "Switch the active selling-rate default."}
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {draft.id ? "Save Changes" : "Add Rate"}
          </button>
        </div>
      </form>
    </div>
  );
}

function makeBulkRow(sortOrder: string | number): BulkUiRow {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "",
    code: "",
    sortOrder: String(sortOrder),
    isActive: true,
    isDefault: false,
    codeManuallyEdited: false,
  };
}

function PasteRateDialog({
  firstSortOrder,
  onClose,
  onAdd,
}: {
  firstSortOrder: number;
  onClose: () => void;
  onAdd: (rows: BulkUiRow[]) => void;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseRatePaste(text, firstSortOrder), [firstSortOrder, text]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-rate-title"
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 id="paste-rate-title" className="text-base font-semibold text-slate-900">
              Paste Selling Rates
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              One name per line, or name,code,sortOrder.
            </p>
          </div>
          <button type="button" aria-label="Close paste dialog" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <textarea
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={7}
            className={`${inputClass} resize-y font-mono text-xs leading-5`}
            placeholder={"Wholesale\nDealer\nOnline,ONLINE,40"}
          />
          {parsed.errors.length > 0 && (
            <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {parsed.errors.map((error) => (
                <p key={`${error.line}-${error.message}`}>Line {error.line}: {error.message}</p>
              ))}
            </div>
          )}
          {parsed.rows.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Preview · {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}
              </div>
              <div className="max-h-44 divide-y divide-slate-100 overflow-y-auto">
                {parsed.rows.map((row) => (
                  <div key={row.line} className="grid grid-cols-[32px_1fr_1fr_60px] gap-2 px-3 py-2 text-xs text-slate-600">
                    <span className="text-slate-400">{row.line}</span>
                    <span className="truncate font-medium text-slate-700">{row.name || "—"}</span>
                    <code className="truncate">{row.code || "—"}</code>
                    <span className="text-right">{row.sortOrder || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={parsed.rows.length === 0 || parsed.errors.length > 0}
            onClick={() =>
              onAdd(
                parsed.rows.map((row) => ({
                  ...row,
                  key: `${row.line}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                })),
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ClipboardPaste className="h-4 w-4" /> Add to Grid
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkRateModal({
  existing,
  licenseId,
  onClose,
  onCreated,
}: {
  existing: RateTypeRecord[];
  licenseId: string;
  onClose: () => void;
  onCreated: (count: number) => Promise<void>;
}) {
  const [rows, setRows] = useState<BulkUiRow[]>(() => [makeBulkRow(nextRateSortOrder(existing))]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const validation = useMemo(() => validateBulkRateRows(rows, existing), [existing, rows]);
  const saveCount = validation.rows.length;
  const valid = validation.errors.length === 0 && saveCount > 0;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !pasteOpen) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, pasteOpen, saving]);

  const errorFor = (row: number, field: BulkRateField) =>
    [...new Set(
      validation.errors
        .filter((error) => error.row === row && error.field === field)
        .map((error) => error.message),
    )].join(" ");

  const replaceRow = (index: number, next: BulkUiRow) =>
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? next : row)));

  const nextOrder = nextRateSortOrder([...existing, ...rows]);

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setServerError(null);
    const result = await platform.createRateTypesBulk({
      licenseId,
      rows: validation.rows,
    });
    setSaving(false);
    if (!result.success) {
      setServerError(result.error || "Unable to create selling rates.");
      return;
    }
    await onCreated(result.rows.length);
  }

  return (
    <div className="fixed inset-0 z-[980] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-rate-title"
        className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:max-w-5xl sm:rounded-[24px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">Selling Rate Master</p>
            <h3 id="bulk-rate-title" className="mt-0.5 text-base font-semibold">Bulk Add Selling Rates</h3>
          </div>
          <button type="button" aria-label="Close bulk add" disabled={saving} onClick={onClose} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => setRows((current) => [...current, makeBulkRow(nextOrder)])}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add Row
          </button>
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ClipboardPaste className="h-3.5 w-3.5" /> Paste List
          </button>
          <span className="ml-auto text-xs text-slate-500">Select at most one default; a default is always active.</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
          {serverError && (
            <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {serverError}
            </div>
          )}
          <div className="min-w-[820px] overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[48px_minmax(170px,1.2fr)_minmax(160px,1fr)_100px_80px_80px_48px] gap-2 bg-[#1e3a5f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">
              <span>Row</span><span>Name</span><span>Code</span><span>Order</span><span>Active</span><span>Default</span><span />
            </div>
            <div className="divide-y divide-slate-100">
              {rows.map((row, index) => {
                const nameError = errorFor(index, "name");
                const codeError = errorFor(index, "code");
                const orderError = errorFor(index, "sortOrder");
                const activeError = errorFor(index, "isActive");
                const defaultError = errorFor(index, "isDefault");
                return (
                  <div key={row.key} className="grid grid-cols-[48px_minmax(170px,1.2fr)_minmax(160px,1fr)_100px_80px_80px_48px] items-start gap-2 px-3 py-2.5">
                    <span className="pt-2 text-xs font-semibold text-slate-400">{index + 1}</span>
                    <div>
                      <input
                        autoFocus={index === 0}
                        value={row.name}
                        onChange={(event) => {
                          const name = event.target.value;
                          replaceRow(index, {
                            ...row,
                            name,
                            code: codeAfterNameChange(name, row.code, row.codeManuallyEdited),
                          });
                        }}
                        aria-invalid={Boolean(nameError)}
                        className={`${inputClass} px-2.5 py-1.5 text-xs`}
                        placeholder="Wholesale"
                      />
                      {nameError && <p className="mt-1 text-[10px] leading-4 text-rose-600">{nameError}</p>}
                    </div>
                    <div>
                      <input
                        value={row.code}
                        onChange={(event) => replaceRow(index, { ...row, code: event.target.value.toUpperCase(), codeManuallyEdited: true })}
                        maxLength={30}
                        aria-invalid={Boolean(codeError)}
                        className={`${inputClass} px-2.5 py-1.5 font-mono text-xs uppercase`}
                        placeholder="WHOLESALE"
                      />
                      {codeError && <p className="mt-1 text-[10px] leading-4 text-rose-600">{codeError}</p>}
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.sortOrder}
                        onChange={(event) => replaceRow(index, { ...row, sortOrder: event.target.value })}
                        aria-invalid={Boolean(orderError)}
                        className={`${inputClass} px-2.5 py-1.5 text-xs`}
                      />
                      {orderError && <p className="mt-1 text-[10px] leading-4 text-rose-600">{orderError}</p>}
                    </div>
                    <div className="pt-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Row ${index + 1} active`}
                        checked={row.isActive}
                        disabled={row.isDefault}
                        onChange={(event) => replaceRow(index, { ...row, isActive: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-400"
                      />
                      {activeError && <p className="mt-1 text-[10px] leading-4 text-rose-600">{activeError}</p>}
                    </div>
                    <div className="pt-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Row ${index + 1} default`}
                        checked={row.isDefault}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setRows((current) => current.map((item, rowIndex) => ({
                            ...item,
                            isDefault: rowIndex === index ? checked : false,
                            isActive: rowIndex === index && checked ? true : item.isActive,
                          })));
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-400"
                      />
                      {defaultError && <p className="mt-1 text-[10px] leading-4 text-rose-600">{defaultError}</p>}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => setRows((current) => current.length === 1 ? [makeBulkRow("")] : current.filter((item) => item.key !== row.key))}
                      className="mt-0.5 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3.5 sm:px-5">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Cancel</button>
          <button
            type="button"
            data-testid="save-bulk-rates"
            disabled={!valid || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Rows3 className="h-4 w-4" />}
            Save {saveCount} Rate{saveCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      {pasteOpen && (
        <PasteRateDialog
          firstSortOrder={nextOrder}
          onClose={() => setPasteOpen(false)}
          onAdd={(pastedRows) => {
            setRows((current) => {
              const untouched = current.length === 1 && !current[0].name.trim() && !current[0].code.trim();
              return untouched ? pastedRows : [...current, ...pastedRows];
            });
            setPasteOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default function RateMaster({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<RateTypeRecord[]>([]);
  const [draft, setDraft] = useState<RateDraft | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmAction | null>(null);
  const { showToast } = useToast();
  const licenseId = getActiveLicenseId();

  const load = useCallback(async () => {
    if (!licenseId) {
      setError("No active license found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await platform.listRateTypes(licenseId, true);
    if (result.success) {
      setRows(
        [...result.rows].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
      );
    } else {
      setError(result.error || "Unable to load selling rates.");
    }
    setLoading(false);
  }, [licenseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const closeMenu = (event: KeyboardEvent | MouseEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      setMenuId(null);
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, []);

  function openAdd() {
    setDraft({
      name: "",
      code: "",
      sortOrder: String(nextRateSortOrder(rows)),
      isActive: true,
      isDefault: false,
      codeManuallyEdited: false,
    });
  }

  function openEdit(row: RateTypeRecord) {
    setMenuId(null);
    setDraft({
      id: row.id,
      name: row.name,
      code: row.code,
      sortOrder: String(row.sortOrder),
      isActive: row.isActive,
      isDefault: row.isDefault,
      codeManuallyEdited: true,
    });
  }

  async function saveDraft() {
    if (!draft || !licenseId || Object.keys(singleRateErrors(draft, rows)).length > 0) return;
    setSaving(true);
    const result = await platform.saveRateType({
      id: draft.id,
      licenseId,
      name: draft.name.trim(),
      code: draft.code.trim().toUpperCase(),
      sortOrder: Number(draft.sortOrder),
      isActive: draft.isActive,
      isDefault: draft.isDefault,
    });
    setSaving(false);
    if (!result.success) {
      showToast("error", result.error || "Unable to save selling rate.");
      return;
    }
    const wasEditing = Boolean(draft.id);
    setDraft(null);
    showToast("success", wasEditing ? "Selling rate updated." : "Selling rate created.");
    await load();
  }

  async function mutate(action: ConfirmAction) {
    setError(null);
    const result = await action.action();
    if (!result.success) {
      const message = result.error || "The selling rate could not be changed.";
      setError(message);
      showToast("error", message);
      return;
    }
    showToast("success", action.successMessage);
    await load();
  }

  function requestAction(action: ConfirmAction) {
    setMenuId(null);
    setConfirmation(action);
  }

  return (
    <>
      <section className="rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {onBack && (
                <button type="button" onClick={onBack} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                  Back
                </button>
              )}
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Selling Rate Master</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">Manage named selling prices shared across products. One active rate remains the default.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              disabled={!licenseId || loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-40"
            >
              <Rows3 className="h-3.5 w-3.5" /> Bulk Add
            </button>
            <button
              type="button"
              onClick={openAdd}
              disabled={!licenseId || loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Add Rate
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 sm:mx-5">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-2 p-5" aria-label="Loading selling rates">
              {[1, 2, 3].map((value) => <div key={value} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Rows3 className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-600">No selling rates configured</p>
              <p className="mt-1 text-xs text-slate-400">Add a rate to get started.</p>
            </div>
          ) : (
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-[#1e3a5f] text-left">
                  {[
                    ["Name", "w-[30%]"],
                    ["Code", "w-[24%]"],
                    ["Default", "w-[12%]"],
                    ["Status", "w-[12%]"],
                    ["Order", "w-[10%]"],
                    ["Actions", "w-[12%] text-right"],
                  ].map(([label, width]) => (
                    <th key={label} className={`${width} px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr key={row.id} className="text-sm transition hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{row.name}</td>
                    <td className="px-4 py-2.5"><code className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{row.code}</code></td>
                    <td className="px-4 py-2.5">
                      {row.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700"><Star className="h-2.5 w-2.5 fill-current" /> Default</span>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${row.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>{row.isActive ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500">{row.sortOrder}</td>
                    <td className="relative px-4 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`Actions for ${row.name}`}
                        aria-expanded={menuId === row.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuId((current) => current === row.id ? null : row.id);
                        }}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuId === row.id && (
                        <div
                          role="menu"
                          onClick={(event) => event.stopPropagation()}
                          className={`absolute right-4 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-[0_14px_34px_rgba(15,23,42,0.18)] ${index >= rows.length - 2 ? "bottom-10" : "top-10"}`}
                        >
                          <button type="button" role="menuitem" onClick={() => openEdit(row)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5" /> Edit</button>
                          {!row.isDefault && row.isActive && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => requestAction({
                                title: "Change default selling rate?",
                                message: `${row.name} will become the default rate used by compatibility pricing. Historical transactions will not change.`,
                                confirmText: "Set as Default",
                                successMessage: "Default selling rate changed.",
                                action: () => platform.setDefaultRateType(licenseId!, row.id),
                              })}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            ><Star className="h-3.5 w-3.5" /> Set as Default</button>
                          )}
                          {row.isActive ? (
                            <button
                              type="button"
                              role="menuitem"
                              disabled={row.isDefault}
                              title={row.isDefault ? "Set another default before deactivating this rate" : undefined}
                              onClick={() => requestAction({
                                title: "Deactivate selling rate?",
                                message: `${row.name} will no longer be available for new transactions. Saved transaction rate names and values remain unchanged.`,
                                confirmText: "Deactivate",
                                successMessage: "Selling rate deactivated.",
                                action: () => platform.toggleRateType(licenseId!, row.id, false),
                              })}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
                            ><Power className="h-3.5 w-3.5" /> Deactivate</button>
                          ) : (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuId(null);
                                void mutate({
                                  title: "",
                                  message: "",
                                  confirmText: "",
                                  successMessage: "Selling rate activated.",
                                  action: () => platform.toggleRateType(licenseId!, row.id, true),
                                });
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            ><Power className="h-3.5 w-3.5" /> Activate</button>
                          )}
                          {!row.isDefault && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => requestAction({
                                title: "Delete selling rate?",
                                message: `${row.name} will be soft-deleted. Historical transactions remain readable.`,
                                confirmText: "Delete Rate",
                                successMessage: "Selling rate deleted.",
                                action: () => platform.deleteRateType(licenseId!, row.id),
                              })}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                            ><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {draft && (
        <RateEditorModal
          draft={draft}
          existing={rows}
          saving={saving}
          onChange={setDraft}
          onClose={() => {
            if (!saving) setDraft(null);
          }}
          onSave={() => void saveDraft()}
        />
      )}

      {bulkOpen && licenseId && (
        <BulkRateModal
          existing={rows}
          licenseId={licenseId}
          onClose={() => setBulkOpen(false)}
          onCreated={async (count) => {
            setBulkOpen(false);
            showToast("success", `${count} selling rate${count === 1 ? "" : "s"} created.`);
            await load();
          }}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(confirmation)}
        title={confirmation?.title}
        message={confirmation?.message}
        confirmText={confirmation?.confirmText}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          const action = confirmation;
          setConfirmation(null);
          void mutate(action);
        }}
      />
    </>
  );
}
