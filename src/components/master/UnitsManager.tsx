// src/components/master/UnitsManager.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Check, X, Ruler, Lock } from "lucide-react";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import { useToast } from "@/components/ui/ToastProvider";
import type { UnitRecord } from "@/platform/types";

export default function UnitsManager() {
  const { showToast } = useToast();
  const licenseId = getActiveLicenseId();

  const [units, setUnits] = useState<UnitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await platform.listUnits(licenseId);
      if (res.success) setUnits(res.rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [licenseId]);

  async function handleAdd() {
    const code = codeInput.trim().toUpperCase();
    const label = labelInput.trim();
    if (!code || !label) {
      showToast("error", "Both code and label are required");
      return;
    }
    setSaving(true);
    const res = await platform.saveUnit({ licenseId, code, label });
    setSaving(false);
    if (res.success) {
      setCodeInput("");
      setLabelInput("");
      codeRef.current?.focus();
      showToast("success", `Unit "${code}" added.`);
      load();
    } else {
      showToast("error", res.error || "Failed to add unit");
    }
  }

  function startEdit(unit: UnitRecord) {
    setEditingId(unit.id);
    setEditCode(unit.code);
    setEditLabel(unit.label);
  }

  async function commitEdit(unit: UnitRecord) {
    const code = editCode.trim().toUpperCase();
    const label = editLabel.trim();
    if (!code || !label) {
      showToast("error", "Both code and label are required");
      return;
    }
    setSaving(true);
    const res = await platform.saveUnit({
      id: unit.id,
      licenseId,
      code,
      label,
    });
    setSaving(false);
    if (res.success) {
      setEditingId(null);
      showToast("success", "Unit updated.");
      load();
    } else {
      showToast("error", res.error || "Failed to update unit");
    }
  }

  async function handleDelete(unit: UnitRecord) {
    if (unit.isDefault) return;
    if (!confirm(`Delete unit "${unit.code} — ${unit.label}"?`)) return;
    const res = await platform.deleteUnit(unit.id);
    if (res.success) {
      showToast("success", "Unit deleted.");
      load();
    } else {
      showToast("error", res.error || "Failed to delete unit");
    }
  }

  const defaults = units.filter((u) => u.isDefault);
  const custom = units.filter((u) => !u.isDefault);

  return (
    <div className="space-y-4 pb-10 md:pb-0">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)] md:px-6 md:py-6">
        <div className="pointer-events-none absolute -left-12 top-0 h-32 w-32 rounded-full bg-teal-400/12 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-cyan-500/12 blur-3xl" />
        <div className="relative">
          <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
            KYNFLOW • MASTER DATA
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.05em] text-white md:text-[28px]">
            Units of Measure
          </h1>
          <p className="mt-1.5 text-sm text-slate-300">
            4 built-in units are always available. Add custom ones for your
            business.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Built-in units */}
        <div className="rounded-[22px] border border-slate-200/80 bg-white/80 overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Lock className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              Built-in Units
            </h3>
            <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
              {defaults.length}
            </span>
          </div>
          <div className="p-5 space-y-2">
            {loading
              ? [1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-11 animate-pulse rounded-xl bg-slate-100"
                  />
                ))
              : defaults.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5"
                  >
                    <span className="rounded-lg bg-teal-100 px-2.5 py-1 font-mono text-[11px] font-bold text-teal-800">
                      {unit.code}
                    </span>
                    <span className="flex-1 text-sm font-medium text-slate-700">
                      {unit.label}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      Built-in
                    </span>
                  </div>
                ))}
          </div>
        </div>

        {/* Custom units */}
        <div className="rounded-[22px] border border-slate-200/80 bg-white/80 overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <Ruler className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              Custom Units
            </h3>
            <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
              {custom.length}
            </span>
          </div>

          <div className="p-5 space-y-4">
            {/* Add form */}
            <div className="space-y-2">
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Code
                  </label>
                  <input
                    ref={codeRef}
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAdd();
                      }
                    }}
                    placeholder="e.g. BOX"
                    maxLength={20}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-400/60 focus:ring-4 focus:ring-teal-400/10"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Label
                  </label>
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAdd();
                      }
                    }}
                    placeholder="e.g. Box"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-400/60 focus:ring-4 focus:ring-teal-400/10"
                  />
                </div>
              </div>
              <button
                onClick={handleAdd}
                disabled={saving || !codeInput.trim() || !labelInput.trim()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                Add Custom Unit
              </button>
            </div>

            {/* List */}
            {loading ? (
              [1, 2].map((i) => (
                <div
                  key={i}
                  className="h-11 animate-pulse rounded-xl bg-slate-100"
                />
              ))
            ) : custom.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                No custom units yet. Add one above.
              </p>
            ) : (
              <ul className="space-y-2">
                {custom.map((unit) => (
                  <li
                    key={unit.id}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${editingId === unit.id ? "border-teal-300 bg-teal-50/50" : "border-slate-100 bg-slate-50/60"}`}
                  >
                    {editingId === unit.id ? (
                      <>
                        <input
                          autoFocus
                          value={editCode}
                          onChange={(e) =>
                            setEditCode(e.target.value.toUpperCase())
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(unit);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-sm text-slate-900 outline-none focus:border-teal-400/60"
                          maxLength={20}
                        />
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(unit);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-400/60"
                        />
                        <button
                          onClick={() => commitEdit(unit)}
                          disabled={saving}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="rounded-lg bg-teal-100 px-2.5 py-1 font-mono text-[11px] font-bold text-teal-800">
                          {unit.code}
                        </span>
                        <span className="flex-1 text-sm font-medium text-slate-700">
                          {unit.label}
                        </span>
                        <button
                          onClick={() => startEdit(unit)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(unit)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 hover:border-rose-200 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
