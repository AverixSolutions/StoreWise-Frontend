"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Edit3, Plus, Power, Star, Trash2, X } from "lucide-react";
import { platform } from "@/platform";
import type { RateTypeRecord } from "@/platform/types";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import { useToast } from "@/components/ui/ToastProvider";

type Draft = {
  id?: string;
  code: string;
  name: string;
  sortOrder: string;
};

const emptyDraft: Draft = { code: "", name: "", sortOrder: "0" };

export default function RateMaster({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<RateTypeRecord[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (result.success) setRows(result.rows);
    else setError(result.error || "Unable to load selling rates.");
    setLoading(false);
  }, [licenseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!draft || !licenseId) return;
    const code = draft.code.trim().toUpperCase();
    const name = draft.name.trim();
    if (!code || !name) {
      setError("Code and name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await platform.saveRateType({
      id: draft.id,
      licenseId,
      code,
      name,
      sortOrder: Number(draft.sortOrder || 0),
      isActive: true,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error || "Unable to save rate.");
      return;
    }
    setDraft(null);
    showToast("success", draft.id ? "Selling rate updated." : "Selling rate created.");
    await load();
  }

  async function mutate(
    message: string,
    action: () => Promise<{ success: boolean; error?: string }>,
  ) {
    setError(null);
    const result = await action();
    if (!result.success) {
      setError(result.error || "The rate could not be changed.");
      return;
    }
    showToast("success", message);
    await load();
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                Back
              </button>
            )}
            <h2 className="text-lg font-semibold text-slate-900">Selling Rate Master</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Named selling prices shared by every product. One active rate is always the default.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(emptyDraft)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" /> New rate
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {draft && (
        <form
          className="mt-4 grid gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/40 p-3 sm:grid-cols-[1fr_1.4fr_100px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="text-[11px] font-medium text-slate-600">
            Code
            <input
              autoFocus
              value={draft.code}
              onChange={(event) =>
                setDraft({ ...draft, code: event.target.value.toUpperCase() })
              }
              maxLength={30}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs uppercase outline-none focus:border-cyan-400"
              placeholder="WHOLESALE"
            />
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Name
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-cyan-400"
              placeholder="Wholesale"
            />
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Order
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-cyan-400"
            />
          </label>
          <div className="flex items-end gap-1.5">
            <button
              disabled={saving}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              aria-label="Cancel"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        {loading ? (
          <div className="p-6 text-center text-xs text-slate-500">Loading selling rates…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">No rates configured.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <div key={row.id} className="grid items-center gap-3 px-3 py-2.5 sm:grid-cols-[1fr_150px_80px_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-slate-800">{row.name}</span>
                    {row.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                        <Star className="h-2.5 w-2.5" /> Default
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {row.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <code className="text-xs font-semibold text-slate-500">{row.code}</code>
                <span className="text-xs text-slate-500">Order {row.sortOrder}</span>
                <div className="flex justify-end gap-1">
                  {!row.isDefault && row.isActive && (
                    <button
                      type="button"
                      title="Set as default"
                      onClick={() =>
                        void mutate("Default selling rate changed.", () =>
                          platform.setDefaultRateType(licenseId, row.id),
                        )
                      }
                      className="rounded-lg p-2 text-amber-500 hover:bg-amber-50"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title={row.isActive ? "Deactivate" : "Activate"}
                    onClick={() => {
                      if (
                        row.isActive &&
                        !confirm(`Deactivate ${row.name}? Existing transactions will keep their saved rate name and value.`)
                      ) return;
                      void mutate(
                        row.isActive ? "Rate deactivated." : "Rate activated.",
                        () => platform.toggleRateType(licenseId, row.id, !row.isActive),
                      );
                    }}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Edit"
                    onClick={() =>
                      setDraft({
                        id: row.id,
                        code: row.code,
                        name: row.name,
                        sortOrder: String(row.sortOrder),
                      })
                    }
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  {!row.isDefault && (
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => {
                        if (!confirm(`Delete ${row.name}? It will be soft-deleted; historical transactions remain readable.`)) return;
                        void mutate("Rate deleted.", () =>
                          platform.deleteRateType(licenseId, row.id),
                        );
                      }}
                      className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
