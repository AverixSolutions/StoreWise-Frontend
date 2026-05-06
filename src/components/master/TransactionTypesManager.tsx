// src/components/master/TransactionTypesManager.tsx
"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  Circle,
  ArrowLeft,
  LayoutDashboard,
  Tag,
} from "lucide-react";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import { SyncManager } from "@/sync/SyncManager"; // ← added import

// ── Types ─────────────────────────────────────────────────────────────────────

type TransactionType = {
  id: string;
  name: string;
  code: string | null;
  category: "sale" | "purchase" | "saleReturn" | "purchaseReturn";
  isDefault: boolean;
  sortOrder: number;
};

type CategoryDef = {
  id: TransactionType["category"];
  label: string;
};

const CATEGORIES: CategoryDef[] = [
  { id: "sale", label: "Sales" },
  { id: "purchase", label: "Purchases" },
  { id: "saleReturn", label: "Sale Returns" },
  { id: "purchaseReturn", label: "Purchase Returns" },
];

// ── Delete Modal ──────────────────────────────────────────────────────────────

function DeleteModal({
  itemName,
  onConfirm,
  onCancel,
  confirming,
}: {
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(3,10,24,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50">
          <Trash2 className="h-5 w-5 text-rose-600" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">
          Delete Transaction Type?
        </h3>
        <p className="mt-1.5 text-sm text-slate-500">
          Are you sure you want to delete{" "}
          <strong className="text-slate-700">&ldquo;{itemName}&rdquo;</strong>?
          Existing transactions using this type will keep the type name as a
          stored string, but the reference will be lost.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer transition"
          >
            {confirming ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────

function ModalField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15";

// ── Editor Modal ──────────────────────────────────────────────────────────────

function TypeEditorModal({
  editing,
  activeTab,
  onClose,
  onSave,
}: {
  editing: TransactionType;
  activeTab: TransactionType["category"];
  onClose: () => void;
  onSave: (data: TransactionType) => Promise<void>;
}) {
  const [form, setForm] = useState<TransactionType>(editing);
  const [saving, setSaving] = useState(false);

  const upd = (patch: Partial<TransactionType>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const catLabel = CATEGORIES.find((c) => c.id === activeTab)?.label ?? "";

  async function handleSave() {
    if (!form.name?.trim()) {
      alert("Name is required");
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-[24px] sm:rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(3,10,24,0.22)] flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative overflow-hidden rounded-t-[24px] bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-5 py-4 text-white shrink-0">
          <div className="pointer-events-none absolute -left-6 top-0 h-16 w-16 rounded-full bg-violet-400/20 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full bg-cyan-500/15 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-400/20">
                <Tag className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  {catLabel}
                </p>
                <h3 className="text-base font-semibold text-white">
                  {editing.id
                    ? `Edit — ${editing.name || editing.code || "Type"}`
                    : "New Transaction Type"}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <ModalField label="Name *">
            <input
              type="text"
              className={inputCls}
              value={form.name}
              onChange={(e) => upd({ name: e.target.value })}
              placeholder="e.g. B2B, Retail, Export"
              autoFocus
            />
          </ModalField>

          <ModalField label="Code (optional)">
            <input
              type="text"
              className={`${inputCls} font-mono`}
              value={form.code ?? ""}
              onChange={(e) => upd({ code: e.target.value || null })}
              placeholder="B2B"
            />
          </ModalField>

          <ModalField label="Sort Order">
            <input
              type="number"
              className={inputCls}
              value={form.sortOrder}
              onChange={(e) => upd({ sortOrder: Number(e.target.value) })}
            />
          </ModalField>

          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
            <input
              type="checkbox"
              id="isDefault"
              checked={form.isDefault}
              onChange={(e) => upd({ isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 accent-violet-600"
            />
            <label
              htmlFor="isDefault"
              className="text-sm font-medium text-slate-700 cursor-pointer select-none"
            >
              Set as default for{" "}
              <span className="font-semibold text-violet-700">{catLabel}</span>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#b026ff] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TransactionTypesManager({
  onBack,
}: {
  onBack?: () => void;
}) {
  const licenseId = getActiveLicenseId()!;
  const [activeTab, setActiveTab] =
    useState<TransactionType["category"]>("sale");
  const [types, setTypes] = useState<TransactionType[]>([]);
  const [editing, setEditing] = useState<TransactionType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionType | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Pull latest transaction types from server into IndexedDB
      await SyncManager.pullNow("transactionType").catch(() => {});
      const res = await platform.listAllTransactionTypes?.(licenseId);
      if (res?.success) {
        const mapped = (res.rows || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          code: r.code ?? null,
          category: r.category,
          isDefault: !!r.isDefault,
          sortOrder: r.sortOrder,
        }));
        setTypes(mapped);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ESC to close modal
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setEditing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const currentTypes = types.filter((t) => t.category === activeTab);

  const handleSave = async (data: TransactionType) => {
    const payload = {
      licenseId,
      name: data.name.trim(),
      code: data.code?.trim() || null,
      category: activeTab,
      isDefault: data.isDefault ?? false,
      sortOrder: data.sortOrder ?? 999,
      ...(data.id ? { id: data.id } : {}),
    };
    const res = await platform.saveTransactionType?.(payload);
    if (res?.success) {
      setEditing(null);
      loadAll();
    } else {
      alert(res?.error || "Failed to save");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    const res = await platform.deleteTransactionType?.(
      deleteTarget.id,
      licenseId,
    );
    setDeleting(false);
    if (res?.success) {
      setDeleteTarget(null);
      loadAll();
    } else {
      alert(res?.error || "Delete failed");
    }
  };

  const handleSetDefault = async (id: string) => {
    const res = await platform.setDefaultTransactionType?.(
      id,
      licenseId,
      activeTab,
    );
    if (res?.success) {
      loadAll();
    } else {
      alert(res?.error || "Failed to set default");
    }
  };

  const TABLE_HEADERS = ["Code", "Name", "Default", "Order", "Actions"];

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          itemName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={deleting}
        />
      )}

      {editing && (
        <TypeEditorModal
          editing={editing}
          activeTab={activeTab}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <div className="space-y-4">
        {/* ── Hero Banner ── */}
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)] md:px-6 md:py-6">
          <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-300">
                <Tag className="h-3 w-3" />
                Transaction Types
              </div>
              <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-white md:text-[30px]">
                Define <span className="kyn-brand-text">Business Types</span>
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                Create B2B, B2C, Retail, Wholesale, etc. for each transaction
                category.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {onBack && (
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Master
                </button>
              )}
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(255,255,255,0.10)] transition hover:bg-slate-50 cursor-pointer"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </button>
            </div>
          </div>
        </section>

        {/* ── Tab Bar ── */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)] p-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
                activeTab === cat.id
                  ? "bg-[#1e3a5f] text-white shadow-[0_2px_8px_rgba(3,10,24,0.18)]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {cat.label}
              {activeTab === cat.id && (
                <span className="inline-flex items-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {currentTypes.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Table Card ── */}
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)] overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {currentTypes.length} type{currentTypes.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() =>
                setEditing({
                  id: "",
                  name: "",
                  code: "",
                  category: activeTab,
                  isDefault: false,
                  sortOrder: 999,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Type</span>
            </button>
          </div>

          {/* ── Desktop Table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#1e3a5f]">
                  {TABLE_HEADERS.map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 first:pl-5 ${
                        h === "Actions" ? "text-right pr-5" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/90">
                {loading ? (
                  <tr>
                    <td
                      colSpan={TABLE_HEADERS.length}
                      className="py-14 text-center"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <span className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                        <p className="text-sm text-slate-400">Loading…</p>
                      </div>
                    </td>
                  </tr>
                ) : currentTypes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={TABLE_HEADERS.length}
                      className="py-14 text-center"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                          <Tag className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">
                          No types yet
                        </p>
                        <p className="text-xs text-slate-400">
                          Click &ldquo;New Type&rdquo; to add your first
                          transaction type.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentTypes.map((t, idx) => (
                    <tr
                      key={t.id}
                      className={`group transition-colors hover:bg-slate-50/80 ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      }`}
                    >
                      {/* Code */}
                      <td className="pl-5 pr-4 py-3">
                        {t.code ? (
                          <span className="inline-flex items-center rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 font-mono tracking-wide">
                            {t.code}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3 text-[13px] font-medium text-slate-800">
                        {t.name}
                      </td>

                      {/* Default */}
                      <td className="px-4 py-3">
                        {t.isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Default
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetDefault(t.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-600 cursor-pointer"
                            title="Set as default"
                          >
                            <Circle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>

                      {/* Order */}
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                          {t.sortOrder}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 pl-4 pr-5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing({ ...t })}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50 cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(t)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="block md:hidden">
            <div className="bg-[#1e3a5f] px-4 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                {currentTypes.length} type
                {currentTypes.length !== 1 ? "s" : ""}
              </p>
            </div>
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                <p className="text-sm text-slate-400">Loading…</p>
              </div>
            ) : currentTypes.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                No types yet. Tap &ldquo;New Type&rdquo; to add one.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {currentTypes.map((t) => (
                  <div
                    key={t.id}
                    className="px-4 py-3.5 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {t.code && (
                            <span className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 font-mono">
                              {t.code}
                            </span>
                          )}
                          <p className="truncate text-[14px] font-semibold text-slate-900">
                            {t.name}
                          </p>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            Order: {t.sortOrder}
                          </span>
                          {t.isDefault ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Default
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetDefault(t.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:border-slate-300 cursor-pointer transition"
                            >
                              <Circle className="h-3 w-3" />
                              Set default
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setEditing({ ...t })}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 transition cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
