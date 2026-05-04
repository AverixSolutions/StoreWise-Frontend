// src/components/tax/TaxSettings.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Plus,
  Percent,
  Edit2,
  Trash2,
  ArrowLeft,
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";

// ── Types ─────────────────────────────────────────────────────────────────────

type TaxComponent = {
  component: "CGST" | "SGST" | "IGST" | "CESS";
  rate: number;
};
type TaxDefaults = {
  salesAccountId?: string | null;
  purchaseAccountId?: string | null;
  salesReturnAccountId?: string | null;
  purchaseReturnAccountId?: string | null;
  outputCgstAccountId?: string | null;
  outputSgstAccountId?: string | null;
  outputIgstAccountId?: string | null;
  inputCgstAccountId?: string | null;
  inputSgstAccountId?: string | null;
  inputIgstAccountId?: string | null;
  cessAccountId?: string | null;
  singleTaxAccountId?: string | null;
};
type TaxCategory = {
  id?: string;
  code: string;
  name: string;
  rate: number;
  isInterstate: boolean;
  cessRate?: number | null;
  calcMethod?: string;
  components: TaxComponent[];
  defaults?: TaxDefaults | null;
};
type AccountOption = {
  id: string;
  name: string;
  taxType?: "INPUT" | "OUTPUT" | null;
  gstComponent?: "CGST" | "SGST" | "IGST" | "CESS" | null;
  rate?: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isStdIntra(c: TaxCategory) {
  if (c.isInterstate) return false;
  const comps = c.components || [];
  if (comps.length !== 2) return false;
  const names = comps
    .map((x) => x.component)
    .sort()
    .join(",");
  const sum = comps.reduce((a, b) => a + Number(b.rate || 0), 0);
  return names === "CGST,SGST" && Number(c.rate || 0) === Number(sum);
}

function isStdInter(c: TaxCategory) {
  if (!c.isInterstate) return false;
  const comps = c.components || [];
  if (comps.length !== 1) return false;
  return (
    comps[0].component === "IGST" &&
    Number(c.rate || 0) === Number(comps[0].rate || 0)
  );
}

function isNoTax(c?: TaxCategory | null) {
  if (!c) return false;
  return Number(c.rate || 0) === 0 && (c.components || []).length === 0;
}

const renderSplit = (c: TaxCategory) => {
  if (isNoTax(c)) return "No tax";
  const comps = c.components || [];
  if (comps.length)
    return comps.map((x) => `${x.component} ${Number(x.rate)}%`).join(" + ");
  return c.isInterstate ? `IGST ${Number(c.rate)}%` : `GST ${Number(c.rate)}%`;
};

function first<T>(arr: T[]) {
  return arr.length ? arr[0] : undefined;
}

const EPS = 1e-6;
const sameRate = (a?: number | null, b?: number | null) =>
  a == null || b == null ? true : Math.abs(Number(a) - Number(b)) < EPS;

function optsFor(
  all: AccountOption[],
  {
    taxType,
    component,
    rate,
  }: {
    taxType: "INPUT" | "OUTPUT";
    component: "CGST" | "SGST" | "IGST" | "CESS";
    rate?: number;
  },
) {
  return all.filter(
    (o) =>
      o.taxType === taxType &&
      o.gstComponent === component &&
      sameRate(o.rate ?? null, rate ?? null),
  );
}

const equalDefaults = (a?: TaxDefaults | null, b?: TaxDefaults | null) => {
  const keys: (keyof TaxDefaults)[] = [
    "salesAccountId",
    "purchaseAccountId",
    "salesReturnAccountId",
    "purchaseReturnAccountId",
    "outputCgstAccountId",
    "outputSgstAccountId",
    "outputIgstAccountId",
    "inputCgstAccountId",
    "inputSgstAccountId",
    "inputIgstAccountId",
    "cessAccountId",
    "singleTaxAccountId",
  ];
  return keys.every((k) => (a?.[k] ?? null) === (b?.[k] ?? null));
};

// ── Sub-components ────────────────────────────────────────────────────────────

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
          Delete Tax Category?
        </h3>
        <p className="mt-1.5 text-sm text-slate-500">
          Are you sure you want to delete{" "}
          <strong className="text-slate-700">&ldquo;{itemName}&rdquo;</strong>?
          This action cannot be undone.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
          >
            {confirming ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field + input helpers ─────────────────────────────────────────────────────

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
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/15";

function SectionCard({
  icon: Icon,
  title,
  iconColor = "text-cyan-300",
  children,
}: {
  icon: React.ElementType;
  title: string;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)] overflow-hidden">
      <div className="flex items-center gap-3 bg-[#1e3a5f] px-5 py-3">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
          {title}
        </span>
      </div>
      <div className="bg-slate-50/60 p-5">{children}</div>
    </div>
  );
}

// ── Tax Editor Modal ──────────────────────────────────────────────────────────

function TaxEditorModal({
  editing,
  setEditing,
  acctOpts,
  onSave,
}: {
  editing: TaxCategory;
  setEditing: React.Dispatch<React.SetStateAction<TaxCategory | null>>;
  acctOpts: AccountOption[];
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const intra = isStdIntra(editing);
  const inter = isStdInter(editing);
  const noTax = isNoTax(editing);
  const halfRate = intra ? Number((editing.rate || 0) / 2) : null;
  const igstRate = inter ? Number(editing.rate || 0) : null;

  const accountOptions = acctOpts.map((a) => ({ value: a.id, label: a.name }));
  const makeFilteredOpts = (
    taxType: "INPUT" | "OUTPUT",
    component: "CGST" | "SGST" | "IGST" | "CESS",
    rate?: number,
  ) =>
    optsFor(acctOpts, { taxType, component, rate }).map((o) => ({
      value: o.id,
      label: o.name,
    }));

  const upd = (patch: Partial<TaxCategory>) =>
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
  const updDefaults = (patch: Partial<TaxDefaults>) =>
    setEditing((prev) =>
      prev
        ? { ...prev, defaults: { ...(prev.defaults || {}), ...patch } }
        : prev,
    );

  async function handleSave() {
    setSaving(true);
    await onSave();
    setSaving(false);
  }

  const taxLedgerGroups = [
    {
      label: "Sales (Input Tax)",
      color: "emerald",
      bg: "bg-emerald-50/60",
      border: "border-emerald-200",
      labelCls: "text-emerald-700",
      keys: {
        cgst: "inputCgstAccountId",
        sgst: "inputSgstAccountId",
        igst: "inputIgstAccountId",
      },
      taxType: "INPUT" as const,
    },
    {
      label: "Purchase (Output Tax)",
      color: "cyan",
      bg: "bg-cyan-50/60",
      border: "border-cyan-200",
      labelCls: "text-cyan-700",
      keys: {
        cgst: "outputCgstAccountId",
        sgst: "outputSgstAccountId",
        igst: "outputIgstAccountId",
      },
      taxType: "OUTPUT" as const,
    },
  ] as const;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={() => setEditing(null)}
    >
      <div
        className="w-full sm:max-w-2xl rounded-t-[24px] sm:rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(3,10,24,0.22)] flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative overflow-hidden rounded-t-[24px] bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-5 py-4 text-white shrink-0">
          <div className="pointer-events-none absolute -left-6 top-0 h-16 w-16 rounded-full bg-rose-400/20 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full bg-cyan-500/15 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/20">
                <Percent className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Tax Category
                </p>
                <h3 className="text-base font-semibold text-white">
                  {editing.id
                    ? `Edit — ${editing.name || editing.code}`
                    : "New Tax Category"}
                </h3>
              </div>
            </div>
            <button
              onClick={() => setEditing(null)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <ModalField label="Code">
              <input
                className={inputCls}
                placeholder="e.g. P5"
                value={editing.code}
                onChange={(e) => upd({ code: e.target.value })}
              />
            </ModalField>
            <ModalField label="Name" className="col-span-2 sm:col-span-1">
              <input
                className={inputCls}
                placeholder="e.g. 5% Taxable"
                value={editing.name}
                onChange={(e) => upd({ name: e.target.value })}
              />
            </ModalField>
            <ModalField label="Total Rate %">
              <input
                type="number"
                step="0.01"
                className={inputCls}
                placeholder="5"
                value={editing.rate}
                onChange={(e) => {
                  const rate = Number(e.target.value || 0);
                  if (intra) {
                    upd({
                      rate,
                      components: [
                        { component: "CGST", rate: rate / 2 },
                        { component: "SGST", rate: rate / 2 },
                      ],
                    });
                  } else if (inter) {
                    upd({ rate, components: [{ component: "IGST", rate }] });
                  } else {
                    upd({ rate });
                  }
                }}
              />
            </ModalField>
          </div>

          {/* Transaction Type toggle */}
          <ModalField label="Transaction Type">
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 w-fit">
              <button
                onClick={() =>
                  upd({
                    isInterstate: false,
                    components:
                      editing.rate > 0
                        ? [
                            { component: "CGST", rate: editing.rate / 2 },
                            { component: "SGST", rate: editing.rate / 2 },
                          ]
                        : [],
                  })
                }
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
                  !editing.isInterstate
                    ? "bg-white shadow-[0_2px_8px_rgba(15,23,42,0.10)] text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Intrastate (CGST + SGST)
              </button>
              <button
                onClick={() =>
                  upd({
                    isInterstate: true,
                    components:
                      editing.rate > 0
                        ? [{ component: "IGST", rate: editing.rate }]
                        : [],
                  })
                }
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
                  editing.isInterstate
                    ? "bg-white shadow-[0_2px_8px_rgba(15,23,42,0.10)] text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Interstate (IGST)
              </button>
            </div>
          </ModalField>

          {/* Component rates */}
          {!noTax && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Tax Component Breakdown
              </p>
              {intra && (
                <div className="grid grid-cols-2 gap-4">
                  {(["CGST", "SGST"] as const).map((comp) => (
                    <ModalField key={comp} label={`${comp} Rate %`}>
                      <input
                        type="number"
                        step="0.01"
                        className={inputCls}
                        value={
                          editing.components?.find((x) => x.component === comp)
                            ?.rate ?? editing.rate / 2
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value || 0);
                          const other = Number(editing.rate || 0) - val;
                          upd({
                            isInterstate: false,
                            components:
                              comp === "CGST"
                                ? [
                                    { component: "CGST", rate: val },
                                    { component: "SGST", rate: other },
                                  ]
                                : [
                                    { component: "CGST", rate: other },
                                    { component: "SGST", rate: val },
                                  ],
                          });
                        }}
                      />
                    </ModalField>
                  ))}
                  <div className="col-span-2 flex items-center gap-2 rounded-xl border border-cyan-200/60 bg-cyan-50/60 px-3.5 py-2.5 text-xs font-medium text-cyan-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Locked to CGST + SGST — components must sum to total rate.
                  </div>
                </div>
              )}
              {inter && (
                <div className="space-y-3">
                  <ModalField label="IGST Rate %">
                    <input
                      type="number"
                      step="0.01"
                      className={inputCls}
                      value={editing.components?.[0]?.rate ?? editing.rate}
                      onChange={(e) => {
                        const ig = Number(e.target.value || 0);
                        upd({
                          isInterstate: true,
                          components: [{ component: "IGST", rate: ig }],
                          rate: ig,
                        });
                      }}
                    />
                  </ModalField>
                  <div className="flex items-center gap-2 rounded-xl border border-cyan-200/60 bg-cyan-50/60 px-3.5 py-2.5 text-xs font-medium text-cyan-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Locked to IGST for interstate transactions.
                  </div>
                </div>
              )}
              {!intra && !inter && (
                <p className="text-sm text-slate-400">
                  Custom component layout — set rates above manually.
                </p>
              )}
            </div>
          )}

          {noTax && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No tax applied for this slab — only base accounts are needed.
            </div>
          )}

          {/* Base Accounts */}
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Account Defaults
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  { label: "Sales Account", key: "salesAccountId" },
                  { label: "Purchase Account", key: "purchaseAccountId" },
                  {
                    label: "Sales Return Account",
                    key: "salesReturnAccountId",
                  },
                  {
                    label: "Purchase Return Account",
                    key: "purchaseReturnAccountId",
                  },
                ] as { label: string; key: keyof TaxDefaults }[]
              ).map(({ label, key }) => (
                <ModalField key={key} label={label}>
                  <SearchableDropdown
                    value={(editing.defaults?.[key] as string) ?? ""}
                    onChange={(v) => updDefaults({ [key]: v || null })}
                    options={accountOptions}
                    placeholder="Select account…"
                  />
                </ModalField>
              ))}
            </div>
          </div>

          {/* Tax Ledgers */}
          {!noTax && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {taxLedgerGroups.map((grp) => (
                <div
                  key={grp.label}
                  className={`rounded-xl border ${grp.border} ${grp.bg} p-4 space-y-3`}
                >
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${grp.labelCls}`}
                  >
                    {grp.label}
                  </p>
                  {!editing.isInterstate ? (
                    <>
                      <ModalField
                        label={`CGST${halfRate != null ? ` (${halfRate}%)` : ""}`}
                      >
                        <SearchableDropdown
                          value={
                            (editing.defaults?.[grp.keys.cgst] as string) ?? ""
                          }
                          onChange={(v) =>
                            updDefaults({ [grp.keys.cgst]: v || null })
                          }
                          options={makeFilteredOpts(
                            grp.taxType,
                            "CGST",
                            halfRate ?? undefined,
                          )}
                          placeholder="Select ledger…"
                        />
                      </ModalField>
                      <ModalField
                        label={`SGST${halfRate != null ? ` (${halfRate}%)` : ""}`}
                      >
                        <SearchableDropdown
                          value={
                            (editing.defaults?.[grp.keys.sgst] as string) ?? ""
                          }
                          onChange={(v) =>
                            updDefaults({ [grp.keys.sgst]: v || null })
                          }
                          options={makeFilteredOpts(
                            grp.taxType,
                            "SGST",
                            halfRate ?? undefined,
                          )}
                          placeholder="Select ledger…"
                        />
                      </ModalField>
                    </>
                  ) : (
                    <ModalField
                      label={`IGST${igstRate != null ? ` (${igstRate}%)` : ""}`}
                    >
                      <SearchableDropdown
                        value={
                          (editing.defaults?.[grp.keys.igst] as string) ?? ""
                        }
                        onChange={(v) =>
                          updDefaults({ [grp.keys.igst]: v || null })
                        }
                        options={makeFilteredOpts(
                          grp.taxType,
                          "IGST",
                          igstRate ?? undefined,
                        )}
                        placeholder="Select ledger…"
                      />
                    </ModalField>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 py-4 flex gap-3 justify-end">
          <button
            onClick={() => setEditing(null)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(32,183,255,0.22)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
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

export default function TaxSettings({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const licenseId = getActiveLicenseId() ?? "demo-license";

  const [rows, setRows] = useState<TaxCategory[]>([]);
  const [editing, setEditing] = useState<TaxCategory | null>(null);
  const [acctOpts, setAcctOpts] = useState<AccountOption[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<TaxCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAccounts = async () => {
    const res = await platform.listDefaultableAccounts(licenseId);
    if (res?.success) {
      setAcctOpts(
        res.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          taxType: r.taxType ?? null,
          gstComponent: r.gstComponent ?? null,
          rate: r.rate ?? null,
        })),
      );
    }
  };

  const load = async () => {
    const res = await platform.listTaxCategories(licenseId);
    if (res?.success)
      setRows(
        res.rows.map((r: any) => ({
          ...r,
          isInterstate: Boolean(r.isInterstate),
        })),
      );
  };

  useEffect(() => {
    load();
    loadAccounts();
  }, []);

  // ESC to close modal
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setEditing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  // Auto-fill defaults when editing opens
  useEffect(() => {
    if (!editing || !acctOpts.length) return;
    setEditing((prev) => {
      if (!prev) return prev;
      const d = prev.defaults || {};
      const hasAny =
        d.salesAccountId ||
        d.purchaseAccountId ||
        d.inputCgstAccountId ||
        d.inputSgstAccountId ||
        d.inputIgstAccountId ||
        d.outputCgstAccountId ||
        d.outputSgstAccountId ||
        d.outputIgstAccountId;
      if (hasAny) return prev;

      const intra = isStdIntra(prev);
      const inter = isStdInter(prev);
      const half = intra ? Number(prev.rate || 0) / 2 : null;
      const ig = inter ? Number(prev.rate || 0) : null;

      const pick = (
        taxType: "INPUT" | "OUTPUT",
        comp: "CGST" | "SGST" | "IGST",
        rate?: number | null,
      ) =>
        first(
          optsFor(acctOpts, {
            taxType,
            component: comp,
            rate: rate ?? undefined,
          }),
        )?.id || null;

      let nextDefaults: TaxDefaults = { ...d };
      if (intra) {
        nextDefaults.inputCgstAccountId = pick("INPUT", "CGST", half);
        nextDefaults.inputSgstAccountId = pick("INPUT", "SGST", half);
        nextDefaults.outputCgstAccountId = pick("OUTPUT", "CGST", half);
        nextDefaults.outputSgstAccountId = pick("OUTPUT", "SGST", half);
      } else if (inter) {
        nextDefaults.inputIgstAccountId = pick("INPUT", "IGST", ig);
        nextDefaults.outputIgstAccountId = pick("OUTPUT", "IGST", ig);
      }
      nextDefaults.salesReturnAccountId ??= nextDefaults.salesAccountId ?? null;
      nextDefaults.purchaseReturnAccountId ??=
        nextDefaults.purchaseAccountId ?? null;

      if (equalDefaults(d, nextDefaults)) return prev;
      return { ...prev, defaults: nextDefaults };
    });
  }, [
    acctOpts,
    editing?.id,
    editing?.rate,
    editing?.isInterstate,
    editing?.components?.map((c) => `${c.component}:${c.rate}`).join("|"),
  ]);

  const onSeed = async () => {
    const ok = await platform.seedIndiaGST(licenseId);
    if (ok?.success) {
      await loadAccounts();
      await load();
      alert("Seeded India GST basics.");
    } else {
      alert(ok?.error || "Failed to seed");
    }
  };

  const onSave = async () => {
    if (!editing) return;
    const res = await platform.saveTaxCategory({ ...editing, licenseId });
    if (res?.success) {
      setEditing(null);
      load();
    }
  };

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    await platform.deleteTaxCategory(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  const TABLE_HEADERS = ["Code", "Name", "Rate %", "Type", "Split", "Actions"];

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
        <TaxEditorModal
          editing={editing}
          setEditing={setEditing as any}
          acctOpts={acctOpts}
          onSave={onSave}
        />
      )}

      <div className="space-y-4">
        {/* ── Hero Banner ── */}
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)] md:px-6 md:py-6">
          <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-rose-400/10 blur-3xl" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-300">
                <Percent className="h-3 w-3" />
                Tax Configuration
              </div>
              <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-white md:text-[30px]">
                Tax <span className="kyn-brand-text">Settings</span>
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                GST slabs, component splits &amp; account posting heads.
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
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(255,255,255,0.10)] transition hover:bg-slate-50 cursor-pointer"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </button>
            </div>
          </div>
        </section>

        {/* ── Table Card ── */}
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)] overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {rows.length} slab{rows.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onSeed}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <span className="hidden sm:inline">Seed India GST</span>
                <span className="sm:hidden">Seed</span>
              </button>
              <button
                onClick={() =>
                  setEditing({
                    code: "P5",
                    name: "5% Taxable",
                    rate: 5,
                    isInterstate: false,
                    components: [
                      { component: "CGST", rate: 2.5 },
                      { component: "SGST", rate: 2.5 },
                    ],
                    defaults: {},
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Tax</span>
              </button>
            </div>
          </div>

          {/* Desktop Table */}
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
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={TABLE_HEADERS.length}
                      className="py-14 text-center"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                          <Percent className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">
                          No tax slabs yet
                        </p>
                        <p className="text-xs text-slate-400">
                          Create your first tax category or seed India GST
                          defaults.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr
                      key={r.id}
                      className={`group transition-colors hover:bg-slate-50/80 ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      }`}
                    >
                      <td className="pl-5 pr-4 py-3">
                        <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 font-mono tracking-wide">
                          {r.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium text-slate-800">
                        {r.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-slate-900">
                          {r.rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                            r.isInterstate
                              ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {r.isInterstate ? "Interstate" : "Intrastate"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] font-medium text-slate-600">
                        {renderSplit(r)}
                      </td>
                      <td className="py-3 pl-4 pr-5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              setEditing(
                                structuredClone
                                  ? structuredClone(r)
                                  : JSON.parse(JSON.stringify(r)),
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50 cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(r)}
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

          {/* Mobile cards */}
          <div className="block md:hidden">
            <div className="bg-[#1e3a5f] px-4 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                {rows.length} tax slabs
              </p>
            </div>
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                No tax slabs yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 font-mono">
                            {r.code}
                          </span>
                          <p className="truncate text-[14px] font-semibold text-slate-900">
                            {r.name}
                          </p>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {r.rate}%
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                              r.isInterstate
                                ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {r.isInterstate ? "Interstate" : "Intrastate"}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {renderSplit(r)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            setEditing(
                              structuredClone
                                ? structuredClone(r)
                                : JSON.parse(JSON.stringify(r)),
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-cyan-600"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500"
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
