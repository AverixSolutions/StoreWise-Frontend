// src/components/master/BrandsCategoriesManager.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Tag,
  Layers,
  Edit2,
  Check,
  X,
  Search,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
  LayoutDashboard,
  AlertTriangle,
  ArrowLeft,
  Info,
  FolderOpen,
  Folder,
} from "lucide-react";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import { useRouter } from "next/navigation";
import type { CategoryRecord, BrandRecord } from "@/platform/types";

type Item = { value: string; count: number };

// ── NEW: Category bulk entry type ────────────────────────────────────────────
type CategoryBulkEntry = {
  category: string;
  subcategory?: string;
};

const PAGE_SIZE = 10;

// ── Unsaved-changes guard modal ─────────────────────────────────────────────
function UnsavedModal({
  onLeave,
  onCancel,
}: {
  onLeave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(3,10,24,0.18)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">
          Unsaved changes
        </h3>
        <p className="mt-1.5 text-sm text-slate-500">
          You have an item open for editing. Leave without saving?
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onLeave}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Leave without saving
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Stay &amp; finish editing
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk-import modal (flat list — used for non-brands if needed) ─────────────
function BulkImportModal({
  title,
  existingValues,
  onImport,
  onClose,
}: {
  title: string;
  existingValues: string[];
  onImport: (vals: string[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");

  const preview = text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const newOnes = preview.filter(
    (v) => !existingValues.some((e) => e.toLowerCase() === v.toLowerCase()),
  );
  const dupes = preview.filter((v) =>
    existingValues.some((e) => e.toLowerCase() === v.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(3,10,24,0.18)] flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Bulk import {title.toLowerCase()}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Paste names separated by commas or new lines
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`e.g. Electronics, Clothing, Food\nor one per line`}
            rows={6}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10 resize-none"
          />
          {preview.length > 0 && (
            <div className="space-y-2">
              {newOnes.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    {newOnes.length} will be added
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {newOnes.map((v) => (
                      <span
                        key={v}
                        className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {dupes.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                    {dupes.length} already exist (skipped)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dupes.map((v) => (
                      <span
                        key={v}
                        className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={newOnes.length === 0}
            onClick={() => {
              onImport(newOnes);
              onClose();
            }}
            className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add {newOnes.length > 0 ? `${newOnes.length} ` : ""}
            {title.toLowerCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NEW: Category bulk text parser ───────────────────────────────────────────
function parseCategoryBulkText(text: string): CategoryBulkEntry[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const result: CategoryBulkEntry[] = [];

  for (const line of lines) {
    const parts = line
      .split(">")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) continue;
    if (parts.length > 2) continue;

    const entry: CategoryBulkEntry =
      parts.length === 1
        ? { category: parts[0] }
        : { category: parts[0], subcategory: parts[1] };

    const key = `${entry.category.toLowerCase()}|||${(entry.subcategory ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(entry);
  }

  return result;
}

// ── NEW: Category bulk import modal ─────────────────────────────────────────
function CategoryBulkImportModal({
  onImport,
  onClose,
}: {
  onImport: (entries: CategoryBulkEntry[]) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const preview = parseCategoryBulkText(text);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(3,10,24,0.18)] flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Bulk import categories
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Use one per line. Format: Category or Category &gt; Subcategory
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Electronics\nElectronics > Smartphones\nElectronics > Laptops\nHealth > Dental Care`}
            rows={8}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10 resize-none"
          />

          {preview.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                {preview.length} valid entries
              </p>
              <div className="space-y-1">
                {preview.map((entry, idx) => (
                  <div
                    key={`${entry.category}-${entry.subcategory ?? "root"}-${idx}`}
                    className="text-xs text-emerald-800"
                  >
                    {entry.category}
                    {entry.subcategory ? ` > ${entry.subcategory}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={preview.length === 0 || saving}
            onClick={async () => {
              setSaving(true);
              await onImport(preview);
              setSaving(false);
              onClose();
            }}
            className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Importing..." : `Import ${preview.length || ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Flat item list (used for Brands) ─────────────────────────────────────────
function ItemList({
  title,
  icon: Icon,
  items,
  loading,
  onAdd,
  onRename,
  onDelete,
  accentClass,
  onEditingChange,
  allowCreate = true,
  allowDelete = true,
  allowBulk = true,
}: {
  title: string;
  icon: React.ElementType;
  items: Item[];
  loading: boolean;
  onAdd: (val: string) => void;
  onRename: (old: string, next: string) => Promise<void>;
  onDelete: (val: string) => void;
  accentClass: string;
  onEditingChange: (editing: boolean) => void;
  allowCreate?: boolean;
  allowDelete?: boolean;
  allowBulk?: boolean;
}) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setPage(1), [search]);
  useEffect(() => {
    onEditingChange(editingValue !== null);
  }, [editingValue, onEditingChange]);

  const filtered = items.filter((i) =>
    i.value.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (items.some((i) => i.value.toLowerCase() === trimmed.toLowerCase())) {
      alert(`"${trimmed}" already exists.`);
      return;
    }
    onAdd(trimmed);
    setInput("");
    inputRef.current?.focus();
  }

  function startEdit(val: string) {
    setEditingValue(val);
    setEditInput(val);
  }

  async function commitEdit(old: string) {
    const trimmed = editInput.trim();
    if (!trimmed || trimmed === old) {
      setEditingValue(null);
      return;
    }
    if (
      items.some(
        (i) =>
          i.value.toLowerCase() === trimmed.toLowerCase() && i.value !== old,
      )
    ) {
      alert(`"${trimmed}" already exists.`);
      return;
    }
    setSaving(true);
    await onRename(old, trimmed);
    setSaving(false);
    setEditingValue(null);
  }

  function cancelEdit() {
    setEditingValue(null);
    setEditInput("");
  }

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  return (
    <>
      {showBulk && (
        <BulkImportModal
          title={title}
          existingValues={items.map((i) => i.value)}
          onImport={(vals) => vals.forEach((v) => onAdd(v))}
          onClose={() => setShowBulk(false)}
        />
      )}

      <div className="flex flex-col rounded-[22px] border border-slate-200/80 bg-white/80 overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${accentClass}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
            {items.length}
          </span>
        </div>

        {/* Editing info banner */}
        {editingValue && (
          <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-100 px-5 py-2.5 text-xs text-amber-700">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              Editing <strong>"{editingValue}"</strong> — Enter to save, Esc to
              cancel
            </span>
          </div>
        )}

        <div className="p-5 space-y-4 flex-1">
          {/* Add + bulk row — hidden when allowCreate is false */}
          {allowCreate && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder={`New ${title.toLowerCase().replace(/s$/, "")}…`}
                className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
              />
              <button
                onClick={handleAdd}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add</span>
              </button>
              {allowBulk && (
                <button
                  onClick={() => setShowBulk(true)}
                  title="Bulk import"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Bulk</span>
                </button>
              )}
            </div>
          )}

          {/* Search — only if more than 5 items */}
          {items.length > 5 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}…`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400/60 focus:bg-white focus:ring-4 focus:ring-cyan-400/10"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-11 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {search
                ? `No ${title.toLowerCase()} matching "${search}"`
                : `No ${title.toLowerCase()} yet. Add one above.`}
            </p>
          ) : (
            <ul className="space-y-2">
              {paginated.map((item) => (
                <li
                  key={item.value}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${
                    editingValue === item.value
                      ? "border-cyan-300 bg-cyan-50/50"
                      : "border-slate-100 bg-slate-50/60"
                  }`}
                >
                  {editingValue === item.value ? (
                    <>
                      <input
                        autoFocus
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(item.value);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
                      />
                      <button
                        onClick={() => commitEdit(item.value)}
                        disabled={saving}
                        title="Save (Enter)"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {saving ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={cancelEdit}
                        title="Cancel (Esc)"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">
                        {item.value}
                      </span>
                      {item.count > 0 && (
                        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
                          {item.count} product{item.count !== 1 ? "s" : ""}
                        </span>
                      )}
                      <button
                        onClick={() => startEdit(item.value)}
                        title="Edit"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      {allowDelete &&
                        (item.count > 0 ? (
                          <div
                            title={`Used by ${item.count} product(s) — cannot delete`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                          >
                            <Trash2 className="h-3 w-3" />
                          </div>
                        ) : (
                          <button
                            onClick={() => onDelete(item.value)}
                            title="Delete"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        ))}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {pageNumbers.map((p, idx) =>
                  p === "…" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-1 text-[11px] text-slate-400"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`flex h-7 min-w-[28px] items-center justify-center rounded-lg border px-2 text-[11px] font-semibold transition ${
                        page === p
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Category hierarchy panel ─────────────────────────────────────────────────
function CategoryTreeList({
  rows,
  loading,
  onAddCategory,
  onAddSubcategory,
  onBulkImport,
  onRenameCategory,
  onRenameSubcategory,
  onDeleteCategory,
  onDeleteSubcategory,
  onEditingChange,
  categoryCounts,
  subcategoryCounts,
}: {
  rows: CategoryRecord[];
  loading: boolean;
  onAddCategory: (name: string) => Promise<void>;
  onAddSubcategory: (parentId: string, name: string) => Promise<void>;
  onBulkImport: (entries: CategoryBulkEntry[]) => Promise<void>;
  onRenameCategory: (row: CategoryRecord, nextName: string) => Promise<void>;
  onRenameSubcategory: (row: CategoryRecord, nextName: string) => Promise<void>;
  onDeleteCategory: (row: CategoryRecord) => Promise<void>;
  onDeleteSubcategory: (row: CategoryRecord) => Promise<void>;
  onEditingChange: (editing: boolean) => void;
  categoryCounts: Map<string, number>;
  subcategoryCounts: Map<string, number>;
}) {
  const [catInput, setCatInput] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [subInput, setSubInput] = useState("");
  const [addingSub, setAddingSub] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const catInputRef = useRef<HTMLInputElement>(null);

  const parents = rows.filter((r) => !r.parentId);
  const childrenOf = (parentId: string) =>
    rows.filter((r) => r.parentId === parentId);

  // Notify parent whether any edit is active
  useEffect(() => {
    onEditingChange(editingId !== null || addingSubFor !== null);
  }, [editingId, addingSubFor, onEditingChange]);

  // Filter: show parent if its name matches OR any child name matches
  const filteredParents = parents.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    if (p.name.toLowerCase().includes(q)) return true;
    return childrenOf(p.id).some((c) => c.name.toLowerCase().includes(q));
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddCategory() {
    const trimmed = catInput.trim();
    if (!trimmed) return;
    if (parents.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      alert(`"${trimmed}" already exists.`);
      return;
    }
    await onAddCategory(trimmed);
    setCatInput("");
    catInputRef.current?.focus();
  }

  function startEdit(row: CategoryRecord) {
    setEditingId(row.id);
    setEditInput(row.name);
    // auto-expand parent if editing a subcategory
    if (row.parentId) {
      setExpanded((prev) => new Set([...prev, row.parentId!]));
    }
  }

  async function commitEdit(row: CategoryRecord) {
    const trimmed = editInput.trim();
    if (!trimmed || trimmed === row.name) {
      setEditingId(null);
      return;
    }
    const siblings = row.parentId ? childrenOf(row.parentId) : parents;
    if (
      siblings.some(
        (s) =>
          s.id !== row.id && s.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      alert(`"${trimmed}" already exists.`);
      return;
    }
    setSaving(true);
    if (row.parentId) {
      await onRenameSubcategory(row, trimmed);
    } else {
      await onRenameCategory(row, trimmed);
    }
    setSaving(false);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditInput("");
  }

  function openAddSub(parentId: string) {
    setAddingSubFor(parentId);
    setSubInput("");
    setExpanded((prev) => new Set([...prev, parentId]));
  }

  async function commitAddSub(parentId: string) {
    const trimmed = subInput.trim();
    if (!trimmed) {
      setAddingSubFor(null);
      return;
    }
    const existing = childrenOf(parentId);
    if (existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      alert(`"${trimmed}" already exists in this category.`);
      return;
    }
    setAddingSub(true);
    await onAddSubcategory(parentId, trimmed);
    setAddingSub(false);
    setAddingSubFor(null);
    setSubInput("");
  }

  // Row renderer — shared between parent and child
  function renderRow(
    row: CategoryRecord,
    opts: {
      isChild?: boolean;
      isExpanded?: boolean;
      childCount?: number;
    } = {},
  ) {
    const { isChild = false, isExpanded = false, childCount = 0 } = opts;
    const isEditing = editingId === row.id;

    const parentName = row.parentId
      ? (parents.find((p) => p.id === row.parentId)?.name ?? "")
      : "";

    const usageCount = isChild
      ? (subcategoryCounts.get(`${parentName}|||${row.name}`) ?? 0)
      : (categoryCounts.get(row.name) ?? 0);

    return (
      <div
        key={row.id}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
          isEditing
            ? "border-cyan-300 bg-cyan-50/50"
            : isChild
              ? "border-slate-100 bg-white ml-5"
              : "border-slate-100 bg-slate-50/60"
        }`}
      >
        {/* Expand toggle (parent only) */}
        {!isChild && (
          <button
            onClick={() => toggleExpand(row.id)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRightSmall className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* Folder icon */}
        {!isChild && (
          <span className="shrink-0 text-purple-400">
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5" />
            ) : (
              <Folder className="h-3.5 w-3.5" />
            )}
          </span>
        )}
        {isChild && (
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-purple-300" />
        )}

        {/* Name or edit input */}
        {isEditing ? (
          <input
            autoFocus
            value={editInput}
            onChange={(e) => setEditInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit(row);
              if (e.key === "Escape") cancelEdit();
            }}
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-800">
            {row.name}
          </span>
        )}

        {/* Child count badge (parent only, collapsed) */}
        {!isChild && !isExpanded && childCount > 0 && !isEditing && (
          <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
            {childCount} sub
          </span>
        )}

        {/* Usage count badge */}
        {!isEditing && usageCount > 0 && (
          <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
            {usageCount} product{usageCount !== 1 ? "s" : ""}
          </span>
        )}

        {/* Action buttons */}
        {isEditing ? (
          <>
            <button
              onClick={() => commitEdit(row)}
              disabled={saving}
              title="Save (Enter)"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
            >
              {saving ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={cancelEdit}
              title="Cancel (Esc)"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            {/* Add subcategory (parent only) */}
            {!isChild && (
              <button
                onClick={() => openAddSub(row.id)}
                title="Add subcategory"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-purple-500 transition hover:border-purple-200 hover:bg-purple-50"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => startEdit(row)}
              title="Rename"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            {usageCount > 0 ? (
              <div
                title={`Used by ${usageCount} product(s) — cannot delete`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
              >
                <Trash2 className="h-3 w-3" />
              </div>
            ) : (
              <button
                onClick={() =>
                  isChild ? onDeleteSubcategory(row) : onDeleteCategory(row)
                }
                title="Delete"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {showBulk && (
        <CategoryBulkImportModal
          onImport={onBulkImport}
          onClose={() => setShowBulk(false)}
        />
      )}

      <div className="flex flex-col rounded-[22px] border border-slate-200/80 bg-white/80 overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
            <Layers className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Categories</h3>
          <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
            {parents.length}
          </span>
        </div>

        {/* Editing info banner */}
        {(editingId !== null || addingSubFor !== null) && (
          <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-100 px-5 py-2.5 text-xs text-amber-700">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              {editingId !== null
                ? "Editing — Enter to save, Esc to cancel"
                : "Adding subcategory — Enter to save, Esc to cancel"}
            </span>
          </div>
        )}

        <div className="p-5 space-y-4 flex-1">
          {/* Add category row + Bulk button */}
          <div className="flex gap-2">
            <input
              ref={catInputRef}
              type="text"
              value={catInput}
              onChange={(e) => setCatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              placeholder="New category…"
              className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
            />
            <button
              onClick={handleAddCategory}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
            <button
              onClick={() => setShowBulk(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Bulk</span>
            </button>
          </div>

          {/* Search — only if more than 5 parent categories */}
          {parents.length > 5 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400/60 focus:bg-white focus:ring-4 focus:ring-cyan-400/10"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-11 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : filteredParents.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {search
                ? `No categories matching "${search}"`
                : "No categories yet. Add one above."}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredParents.map((parent) => {
                const children = childrenOf(parent.id);
                const isExpanded = expanded.has(parent.id);

                return (
                  <li key={parent.id} className="space-y-1.5">
                    {/* Parent row */}
                    {renderRow(parent, {
                      isChild: false,
                      isExpanded,
                      childCount: children.length,
                    })}

                    {/* Children + add-sub form (when expanded) */}
                    {isExpanded && (
                      <div className="space-y-1.5 ml-5">
                        {children.map((child) =>
                          renderRow(child, { isChild: true }),
                        )}

                        {/* Add subcategory inline form */}
                        {addingSubFor === parent.id ? (
                          <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/50 px-3 py-2 ml-0">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-purple-300" />
                            <input
                              autoFocus
                              value={subInput}
                              onChange={(e) => setSubInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitAddSub(parent.id);
                                if (e.key === "Escape") {
                                  setAddingSubFor(null);
                                  setSubInput("");
                                }
                              }}
                              placeholder="Subcategory name…"
                              className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
                            />
                            <button
                              onClick={() => commitAddSub(parent.id)}
                              disabled={addingSub}
                              title="Save (Enter)"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {addingSub ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setAddingSubFor(null);
                                setSubInput("");
                              }}
                              title="Cancel (Esc)"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openAddSub(parent.id)}
                            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-purple-300 hover:bg-purple-50/40 hover:text-purple-600 ml-0"
                          >
                            <Plus className="h-3 w-3" />
                            Add subcategory
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BrandsCategoriesManager({
  onBackToMaster,
}: {
  onBackToMaster?: () => void;
}) {
  const router = useRouter();
  const [categoryRecords, setCategoryRecords] = useState<CategoryRecord[]>([]);
  const [brandRecords, setBrandRecords] = useState<BrandRecord[]>([]);
  const [brands, setBrands] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [catEditing, setCatEditing] = useState(false);
  const [brandEditing, setBrandEditing] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "dashboard" | "master" | null
  >(null);
  const [categoryCounts, setCategoryCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [subcategoryCounts, setSubcategoryCounts] = useState<
    Map<string, number>
  >(new Map());

  const licenseId = getActiveLicenseId();
  const isEditing = catEditing || brandEditing;

  function sameText(a?: string | null, b?: string | null) {
    return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
  }

  // ── Load: categories from master table, brands from products ────────────────
  async function load() {
    setLoading(true);
    try {
      const [productsResult, categoriesResult, brandsResult] =
        await Promise.all([
          platform.getProducts(licenseId, { page: 1, pageSize: 5000 }),
          platform.listCategories(licenseId),
          platform.listBrands(licenseId),
        ]);

      const products = productsResult.products;

      const nextCategoryCounts = new Map<string, number>();
      const nextSubcategoryCounts = new Map<string, number>();

      for (const p of products) {
        if (p.category) {
          nextCategoryCounts.set(
            p.category,
            (nextCategoryCounts.get(p.category) ?? 0) + 1,
          );
        }

        if (p.category && (p as any).subcategory) {
          const key = `${p.category}|||${(p as any).subcategory}`;
          nextSubcategoryCounts.set(
            key,
            (nextSubcategoryCounts.get(key) ?? 0) + 1,
          );
        }
      }

      setCategoryCounts(nextCategoryCounts);
      setSubcategoryCounts(nextSubcategoryCounts);

      const brandCountMap = new Map<string, number>();
      for (const p of products) {
        if (!p.brand) continue;

        const existingKey = Array.from(brandCountMap.keys()).find((key) =>
          sameText(key, p.brand),
        );
        const key = existingKey ?? p.brand;

        brandCountMap.set(key, (brandCountMap.get(key) ?? 0) + 1);
      }

      const masterBrands = brandsResult.success ? brandsResult.rows : [];
      setBrandRecords(masterBrands);

      const brandItems: Item[] = masterBrands.map((row) => {
        const countKey = Array.from(brandCountMap.keys()).find((key) =>
          sameText(key, row.name),
        );

        return {
          value: row.name,
          count: countKey ? (brandCountMap.get(countKey) ?? 0) : 0,
        };
      });

      for (const [name, count] of brandCountMap.entries()) {
        const existsInMaster = masterBrands.some((row) =>
          sameText(row.name, name),
        );
        if (!existsInMaster) {
          brandItems.push({ value: name, count });
        }
      }

      setBrands(brandItems.sort((a, b) => a.value.localeCompare(b.value)));

      if (categoriesResult.success) {
        setCategoryRecords(categoriesResult.rows);
      } else {
        setCategoryRecords([]);
      }
    } catch (e) {
      console.error(e);
      setCategoryRecords([]);
      setBrandRecords([]);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [licenseId]);

  // ── Bulk update products when a field is renamed/removed ────────────────────
  async function bulkUpdateField(
    field: "category" | "subcategory" | "brand",
    oldVal: string | null,
    newVal: string | null,
    parentCategory?: string | null,
    nextParentCategory?: string | null,
  ) {
    const result = await platform.getProducts(licenseId, {
      page: 1,
      pageSize: 5000,
    });

    const targets = result.products.filter((p) => {
      if (field === "brand") return p.brand === oldVal;
      if (field === "category") return p.category === oldVal;
      return p.category === parentCategory && (p as any).subcategory === oldVal;
    });

    for (const p of targets) {
      await platform.updateProduct(p.id, {
        licenseId,
        code: p.code,
        codeNumber: p.codeNumber ?? parseInt(p.code, 10),
        name: p.name,
        brand: field === "brand" ? newVal : (p.brand ?? null),
        category:
          field === "category"
            ? newVal
            : field === "subcategory"
              ? (nextParentCategory ?? p.category ?? null)
              : (p.category ?? null),
        subcategory:
          field === "subcategory" ? newVal : ((p as any).subcategory ?? null),
        productName: (p as any).productName ?? null,
        model: (p as any).model ?? null,
        size: (p as any).size ?? null,
        unit: p.unit,
        tax: p.tax,
        hsn: p.hsn ?? null,
        costPrice: p.costPrice,
        salePrice: p.salePrice ?? null,
      });
    }

    await load();
  }

  // ── Real category actions ───────────────────────────────────────────────────
  async function addCategory(name: string) {
    await platform.saveCategory({ licenseId, name, parentId: null });
    await load();
  }

  async function addSubcategory(parentId: string, name: string) {
    await platform.saveCategory({ licenseId, name, parentId });
    await load();
  }

  async function renameCategory(row: CategoryRecord, nextName: string) {
    const oldName = row.name;
    await platform.saveCategory({
      id: row.id,
      licenseId,
      name: nextName,
      parentId: null,
    });
    await bulkUpdateField("category", oldName, nextName);
  }

  async function renameSubcategory(row: CategoryRecord, nextName: string) {
    const parent = categoryRecords.find((r) => r.id === row.parentId);
    if (!parent) return;
    await platform.saveCategory({
      id: row.id,
      licenseId,
      name: nextName,
      parentId: row.parentId,
    });
    await bulkUpdateField(
      "subcategory",
      row.name,
      nextName,
      parent.name,
      parent.name,
    );
  }

  async function deleteCategoryRow(row: CategoryRecord) {
    await platform.deleteCategory(row.id);
    await load();
  }

  // ── NEW: Bulk category + subcategory import ─────────────────────────────────
  async function bulkImportCategories(entries: CategoryBulkEntry[]) {
    const current = await platform.listCategories(licenseId);
    if (!current.success) return;

    const rows = [...current.rows];

    const findParent = (name: string) =>
      rows.find(
        (r) => !r.parentId && r.name.toLowerCase() === name.toLowerCase(),
      );

    const findChild = (parentId: string, name: string) =>
      rows.find(
        (r) =>
          r.parentId === parentId &&
          r.name.toLowerCase() === name.toLowerCase(),
      );

    for (const entry of entries) {
      let parent = findParent(entry.category);

      if (!parent) {
        const created = await platform.saveCategory({
          licenseId,
          name: entry.category,
          parentId: null,
        });

        if (!created.success || !created.id) continue;

        parent = {
          id: created.id,
          licenseId,
          name: entry.category,
          parentId: null,
        };
        rows.push(parent);
      }

      if (entry.subcategory) {
        const existingChild = findChild(parent.id, entry.subcategory);
        if (existingChild) continue;

        const createdChild = await platform.saveCategory({
          licenseId,
          name: entry.subcategory,
          parentId: parent.id,
        });

        if (!createdChild.success || !createdChild.id) continue;

        rows.push({
          id: createdChild.id,
          licenseId,
          name: entry.subcategory,
          parentId: parent.id,
        });
      }
    }

    await load();
  }

  function findBrandRecordByName(name: string) {
    return brandRecords.find((row) => sameText(row.name, name)) ?? null;
  }

  async function addBrand(name: string) {
    const result = await platform.saveBrand({
      licenseId,
      name,
    });

    if (!result.success) {
      alert(result.error || "Failed to add brand");
      return;
    }

    await load();
  }

  async function renameBrand(oldName: string, nextName: string) {
    const existing = findBrandRecordByName(oldName);

    if (existing) {
      const saveResult = await platform.saveBrand({
        id: existing.id,
        licenseId,
        name: nextName,
      });

      if (!saveResult.success) {
        alert(saveResult.error || "Failed to rename brand");
        return;
      }
    } else {
      const createResult = await platform.saveBrand({
        licenseId,
        name: nextName,
      });

      if (!createResult.success) {
        alert(createResult.error || "Failed to rename brand");
        return;
      }
    }

    await bulkUpdateField("brand", oldName, nextName);
  }

  async function deleteBrandByName(name: string) {
    const existing = findBrandRecordByName(name);

    if (!existing) {
      alert("This brand is not in the brand master yet.");
      return;
    }

    const result = await platform.deleteBrand(existing.id);
    if (!result.success) {
      alert(result.error || "Failed to delete brand");
      return;
    }

    await load();
  }

  // ── Navigation guard ────────────────────────────────────────────────────────
  function doNavigate(action: "dashboard" | "master") {
    if (action === "dashboard") {
      router.push("/dashboard");
    } else {
      if (onBackToMaster) {
        onBackToMaster();
      } else {
        router.push("/dashboard/master");
      }
    }
  }

  function tryNavigate(action: "dashboard" | "master") {
    if (isEditing) {
      setPendingAction(action);
    } else {
      doNavigate(action);
    }
  }

  return (
    <div className="space-y-4">
      {/* Unsaved guard modal */}
      {pendingAction && (
        <UnsavedModal
          onLeave={() => {
            const action = pendingAction;
            setPendingAction(null);
            doNavigate(action);
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)] md:px-6 md:py-6">
        <div className="pointer-events-none absolute -left-12 top-0 h-32 w-32 rounded-full bg-purple-400/12 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-fuchsia-500/12 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              KYNFLOW • MASTER DATA
            </div>
            <h1 className="text-[26px] font-semibold tracking-[-0.05em] text-white md:text-[32px]">
              Brands &amp; Categories
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Manage catalog taxonomy. Rename or remove changes propagate to all
              products.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isEditing && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-300 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  Editing active
                </span>
              </div>
            )}

            <button
              onClick={() => tryNavigate("master")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition hover:bg-white/[0.12] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Master
            </button>

            <button
              onClick={() => tryNavigate("dashboard")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(255,255,255,0.12)] transition hover:bg-slate-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* ── Two-column panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Categories — real hierarchy panel */}
        <CategoryTreeList
          rows={categoryRecords}
          loading={loading}
          categoryCounts={categoryCounts}
          subcategoryCounts={subcategoryCounts}
          onAddCategory={addCategory}
          onAddSubcategory={addSubcategory}
          onBulkImport={bulkImportCategories}
          onRenameCategory={renameCategory}
          onRenameSubcategory={renameSubcategory}
          onDeleteCategory={deleteCategoryRow}
          onDeleteSubcategory={deleteCategoryRow}
          onEditingChange={setCatEditing}
        />

        {/* Brands — read-only list (rename only, no create/delete/bulk) */}
        <ItemList
          title="Brands"
          icon={Tag}
          items={brands}
          loading={loading}
          onAdd={addBrand}
          onRename={renameBrand}
          onDelete={deleteBrandByName}
          accentClass="bg-fuchsia-100 text-fuchsia-700"
          onEditingChange={setBrandEditing}
          allowCreate={true}
          allowDelete={true}
          allowBulk={true}
        />
      </div>
    </div>
  );
}
