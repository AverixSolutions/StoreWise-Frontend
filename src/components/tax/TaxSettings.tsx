// src/components/tax/TaxSettings.tsx
"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import SearchableDropdown from "@/components/ui/SearchableDropdown";

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

const renderSplit = (c: TaxCategory) => {
  if (isNoTax(c)) return "No tax";
  const comps = c.components || [];
  if (comps.length) {
    return comps.map((x) => `${x.component} ${Number(x.rate)}%`).join(" + ");
  }

  return c.isInterstate ? `IGST ${Number(c.rate)}%` : `GST ${Number(c.rate)}%`;
};

function isNoTax(c?: TaxCategory | null) {
  if (!c) return false;
  const total = Number(c.rate || 0);
  const comps = c.components || [];
  return total === 0 && comps.length === 0;
}

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
  }
) {
  return all.filter(
    (o) =>
      o.taxType === taxType &&
      o.gstComponent === component &&
      sameRate(o.rate ?? null, rate ?? null)
  );
}

export default function TaxSettings() {
  const licenseId =
    typeof window !== "undefined"
      ? localStorage.getItem("licenseId") || "demo-license"
      : "demo-license";

  const [rows, setRows] = useState<TaxCategory[]>([]);
  const [editing, setEditing] = useState<TaxCategory | null>(null);
  const [acctOpts, setAcctOpts] = useState<AccountOption[]>([]);

  const loadAccounts = async () => {
    const res = await (window as any).electronAPI.listDefaultableAccounts(
      licenseId
    );
    if (res?.success) {
      setAcctOpts(
        res.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          taxType: r.taxType ?? null,
          gstComponent: r.gstComponent ?? null,
          rate: r.rate ?? null,
        }))
      );
    }
  };

  const load = async () => {
    const res = await (window as any).electronAPI.listTaxCategories(licenseId);
    if (res?.success) setRows(res.rows);
  };

  useEffect(() => {
    load();
    loadAccounts();
  }, []);

  // Close on ESC
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setEditing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

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

  useEffect(() => {
    if (!editing || !acctOpts.length) return;

    setEditing((prev) => {
      if (!prev) return prev;

      const d = prev.defaults || {};

      const copyBaseToReturnsIfBlank = (dx: TaxDefaults): TaxDefaults => ({
        ...dx,
        salesReturnAccountId:
          dx.salesReturnAccountId ?? dx.salesAccountId ?? null,
        purchaseReturnAccountId:
          dx.purchaseReturnAccountId ?? dx.purchaseAccountId ?? null,
      });

      const hasAny =
        d.salesAccountId ||
        d.purchaseAccountId ||
        d.salesReturnAccountId ||
        d.purchaseReturnAccountId ||
        d.inputCgstAccountId ||
        d.inputSgstAccountId ||
        d.inputIgstAccountId ||
        d.outputCgstAccountId ||
        d.outputSgstAccountId ||
        d.outputIgstAccountId;

      const intra = isStdIntra(prev);
      const inter = isStdInter(prev);
      const half = intra ? Number(prev.rate || 0) / 2 : null;
      const ig = inter ? Number(prev.rate || 0) : null;

      const pick = (
        taxType: "INPUT" | "OUTPUT",
        comp: "CGST" | "SGST" | "IGST",
        rate?: number | null
      ) =>
        first(
          optsFor(acctOpts, {
            taxType,
            component: comp,
            rate: rate ?? undefined,
          })
        )?.id || null;

      let nextDefaults: TaxDefaults = {
        salesAccountId: d.salesAccountId ?? null,
        purchaseAccountId: d.purchaseAccountId ?? null,
        salesReturnAccountId: d.salesReturnAccountId ?? null,
        purchaseReturnAccountId: d.purchaseReturnAccountId ?? null,
      };

      if (!hasAny) {
        if (intra) {
          nextDefaults.inputCgstAccountId = pick("INPUT", "CGST", half);
          nextDefaults.inputSgstAccountId = pick("INPUT", "SGST", half);
          nextDefaults.outputCgstAccountId = pick("OUTPUT", "CGST", half);
          nextDefaults.outputSgstAccountId = pick("OUTPUT", "SGST", half);
        } else if (inter) {
          nextDefaults.inputIgstAccountId = pick("INPUT", "IGST", ig);
          nextDefaults.outputIgstAccountId = pick("OUTPUT", "IGST", ig);
        }
      }

      nextDefaults = copyBaseToReturnsIfBlank(nextDefaults);

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
    const ok = await (window as any).electronAPI.seedIndiaGST(licenseId);
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
    const payload = { ...editing, licenseId };
    const res = await (window as any).electronAPI.saveTaxCategory(payload);
    if (res?.success) {
      setEditing(null);
      load();
    }
  };

  const halfRate = isStdIntra(editing || ({} as any))
    ? Number((editing!.rate || 0) / 2)
    : null;
  const igstRate = isStdInter(editing || ({} as any))
    ? Number(editing!.rate || 0)
    : null;

  const accountOptions = acctOpts.map((a) => ({ value: a.id, label: a.name }));
  const makeFilteredOpts = (
    taxType: "INPUT" | "OUTPUT",
    component: "CGST" | "SGST" | "IGST" | "CESS",
    rate?: number
  ) =>
    optsFor(acctOpts, { taxType, component, rate }).map((o) => ({
      value: o.id,
      label: o.name,
    }));

  // Helper to show account names in table
  const idToName = new Map(acctOpts.map((a) => [a.id, a.name]));
  const showName = (id?: string | null) => (id ? idToName.get(id) || id : "—");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Settings</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage GST tax slabs and account mappings
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onSeed}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
                title="Pre-build India GST slabs + ledgers"
              >
                Seed India GST
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
                className="px-4 py-2 bg-averix-red-dark text-white rounded-lg hover:bg-averix-red-darker transition-all font-medium shadow-sm"
              >
                + New Tax
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Rate %
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Split
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {r.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {r.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-semibold">
                      {r.rate}%
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          r.isInterstate
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {r.isInterstate ? "Interstate" : "Intrastate"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {renderSplit(r)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() =>
                            setEditing(
                              structuredClone
                                ? structuredClone(r)
                                : JSON.parse(JSON.stringify(r))
                            )
                          }
                          className="px-3 py-1.5 text-sm border-2 border-averix-red-light text-averix-red-dark rounded-lg hover:bg-averix-red-light hover:text-white transition-all font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm("Delete this tax category?")) {
                              await (
                                window as any
                              ).electronAPI.deleteTaxCategory(r.id);
                              load();
                            }
                          }}
                          className="px-3 py-1.5 text-sm border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <svg
                          className="w-12 h-12 text-gray-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <p className="font-medium">No tax slabs yet</p>
                        <p className="text-sm">
                          Create your first tax category to get started
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Editor */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            key={editing.id || "new"}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-averix-red-dark to-averix-red-light text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editing.id ? "Edit Tax Category" : "New Tax Category"}
                </h2>
                <p className="text-sm text-white/80 mt-1">
                  Configure tax rates and account mappings
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code
                  </label>
                  <input
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:border-averix-red-light focus:ring-2 focus:ring-averix-red-light/20 outline-none transition-all"
                    placeholder="e.g., P5"
                    value={editing.code}
                    onChange={(e) =>
                      setEditing({ ...editing, code: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:border-averix-red-light focus:ring-2 focus:ring-averix-red-light/20 outline-none transition-all"
                    placeholder="e.g., 5% Taxable"
                    value={editing.name}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Rate %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:border-averix-red-light focus:ring-2 focus:ring-averix-red-light/20 outline-none transition-all"
                    placeholder="5"
                    value={editing.rate}
                    onChange={(e) => {
                      const rate = Number(e.target.value || 0);
                      if (isStdIntra(editing)) {
                        setEditing({
                          ...editing,
                          rate,
                          components: [
                            { component: "CGST", rate: rate / 2 },
                            { component: "SGST", rate: rate / 2 },
                          ],
                        });
                      } else if (isStdInter(editing)) {
                        setEditing({
                          ...editing,
                          rate,
                          components: [{ component: "IGST", rate }],
                        });
                      } else {
                        setEditing({ ...editing, rate });
                      }
                    }}
                  />
                </div>
              </div>

              {/* Components */}
              {!isNoTax(editing) && (
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    Tax Components
                  </h3>
                  {isStdIntra(editing) && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          CGST Rate %
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-averix-red-light outline-none"
                          value={
                            editing.components?.find(
                              (x) => x.component === "CGST"
                            )?.rate ?? editing.rate / 2
                          }
                          onChange={(e) => {
                            const cg = Number(e.target.value || 0);
                            const sg = Number(editing.rate || 0) - cg;
                            setEditing({
                              ...editing,
                              isInterstate: false,
                              components: [
                                { component: "CGST", rate: cg },
                                { component: "SGST", rate: sg },
                              ],
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          SGST Rate %
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-averix-red-light outline-none"
                          value={
                            editing.components?.find(
                              (x) => x.component === "SGST"
                            )?.rate ?? editing.rate / 2
                          }
                          onChange={(e) => {
                            const sg = Number(e.target.value || 0);
                            const cg = Number(editing.rate || 0) - sg;
                            setEditing({
                              ...editing,
                              isInterstate: false,
                              components: [
                                { component: "CGST", rate: cg },
                                { component: "SGST", rate: sg },
                              ],
                            });
                          }}
                        />
                      </div>
                      <p className="col-span-2 text-xs text-gray-500 bg-blue-50 rounded p-2 border border-blue-200">
                        ✓ Locked to CGST+SGST pattern. Components must sum to
                        total rate.
                      </p>
                    </div>
                  )}
                  {isStdInter(editing) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">
                        IGST Rate %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-averix-red-light outline-none"
                        value={editing.components?.[0]?.rate ?? editing.rate}
                        onChange={(e) => {
                          const ig = Number(e.target.value || 0);
                          setEditing({
                            ...editing,
                            isInterstate: true,
                            components: [{ component: "IGST", rate: ig }],
                            rate: ig,
                          });
                        }}
                      />
                      <p className="text-xs text-gray-500 mt-2 bg-blue-50 rounded p-2 border border-blue-200">
                        ✓ Locked to IGST for interstate transactions.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Defaults */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Account Defaults{" "}
                    {isNoTax(editing) && (
                      <span className="text-gray-500 font-normal">
                        (No tax applied)
                      </span>
                    )}
                  </h3>
                </div>

                {/* Base Accounts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Sales Account
                    </label>
                    <SearchableDropdown
                      value={editing.defaults?.salesAccountId ?? ""}
                      onChange={(v) =>
                        setEditing({
                          ...editing,
                          defaults: {
                            ...(editing.defaults || {}),
                            salesAccountId: v || null,
                          },
                        })
                      }
                      options={accountOptions}
                      placeholder="Select account..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Purchase Account
                    </label>
                    <SearchableDropdown
                      value={editing.defaults?.purchaseAccountId ?? ""}
                      onChange={(v) =>
                        setEditing({
                          ...editing,
                          defaults: {
                            ...(editing.defaults || {}),
                            purchaseAccountId: v || null,
                          },
                        })
                      }
                      options={accountOptions}
                      placeholder="Select account..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Sales Return Account
                    </label>
                    <SearchableDropdown
                      value={editing.defaults?.salesReturnAccountId ?? ""}
                      onChange={(v) =>
                        setEditing({
                          ...editing,
                          defaults: {
                            ...(editing.defaults || {}),
                            salesReturnAccountId: v || null,
                          },
                        })
                      }
                      options={accountOptions}
                      placeholder="Select account..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Purchase Return Account
                    </label>
                    <SearchableDropdown
                      value={editing.defaults?.purchaseReturnAccountId ?? ""}
                      onChange={(v) =>
                        setEditing({
                          ...editing,
                          defaults: {
                            ...(editing.defaults || {}),
                            purchaseReturnAccountId: v || null,
                          },
                        })
                      }
                      options={accountOptions}
                      placeholder="Select account..."
                    />
                  </div>
                </div>

                {/* Tax Ledgers */}
                {!isNoTax(editing) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
                    {/* Sales (INPUT) */}
                    <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                      <div className="font-semibold text-sm text-green-800 mb-3">
                        Sales (INPUT)
                      </div>
                      {!editing.isInterstate ? (
                        <div className="space-y-3">
                          <SearchableDropdown
                            value={editing.defaults?.inputCgstAccountId ?? ""}
                            onChange={(v) =>
                              setEditing({
                                ...editing,
                                defaults: {
                                  ...(editing.defaults || {}),
                                  inputCgstAccountId: v || null,
                                },
                              })
                            }
                            options={makeFilteredOpts(
                              "INPUT",
                              "CGST",
                              halfRate ?? undefined
                            )}
                            placeholder={`CGST ${
                              halfRate != null ? `(${halfRate}%)` : ""
                            }`}
                          />
                          <SearchableDropdown
                            value={editing.defaults?.inputSgstAccountId ?? ""}
                            onChange={(v) =>
                              setEditing({
                                ...editing,
                                defaults: {
                                  ...(editing.defaults || {}),
                                  inputSgstAccountId: v || null,
                                },
                              })
                            }
                            options={makeFilteredOpts(
                              "INPUT",
                              "SGST",
                              halfRate ?? undefined
                            )}
                            placeholder={`SGST ${
                              halfRate != null ? `(${halfRate}%)` : ""
                            }`}
                          />
                        </div>
                      ) : (
                        <SearchableDropdown
                          value={editing.defaults?.inputIgstAccountId ?? ""}
                          onChange={(v) =>
                            setEditing({
                              ...editing,
                              defaults: {
                                ...(editing.defaults || {}),
                                inputIgstAccountId: v || null,
                              },
                            })
                          }
                          options={makeFilteredOpts(
                            "INPUT",
                            "IGST",
                            igstRate ?? undefined
                          )}
                          placeholder={`IGST ${
                            igstRate != null ? `(${igstRate}%)` : ""
                          }`}
                        />
                      )}
                    </div>

                    {/* Purchase (OUTPUT) */}
                    <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                      <div className="font-semibold text-sm text-blue-800 mb-3">
                        Purchase (OUTPUT)
                      </div>
                      {!editing.isInterstate ? (
                        <div className="space-y-3">
                          <SearchableDropdown
                            value={editing.defaults?.outputCgstAccountId ?? ""}
                            onChange={(v) =>
                              setEditing({
                                ...editing,
                                defaults: {
                                  ...(editing.defaults || {}),
                                  outputCgstAccountId: v || null,
                                },
                              })
                            }
                            options={makeFilteredOpts(
                              "OUTPUT",
                              "CGST",
                              halfRate ?? undefined
                            )}
                            placeholder={`CGST ${
                              halfRate != null ? `(${halfRate}%)` : ""
                            }`}
                          />
                          <SearchableDropdown
                            value={editing.defaults?.outputSgstAccountId ?? ""}
                            onChange={(v) =>
                              setEditing({
                                ...editing,
                                defaults: {
                                  ...(editing.defaults || {}),
                                  outputSgstAccountId: v || null,
                                },
                              })
                            }
                            options={makeFilteredOpts(
                              "OUTPUT",
                              "SGST",
                              halfRate ?? undefined
                            )}
                            placeholder={`SGST ${
                              halfRate != null ? `(${halfRate}%)` : ""
                            }`}
                          />
                        </div>
                      ) : (
                        <SearchableDropdown
                          value={editing.defaults?.outputIgstAccountId ?? ""}
                          onChange={(v) =>
                            setEditing({
                              ...editing,
                              defaults: {
                                ...(editing.defaults || {}),
                                outputIgstAccountId: v || null,
                              },
                            })
                          }
                          options={makeFilteredOpts(
                            "OUTPUT",
                            "IGST",
                            igstRate ?? undefined
                          )}
                          placeholder={`IGST ${
                            igstRate != null ? `(${igstRate}%)` : ""
                          }`}
                        />
                      )}
                    </div>

                    {/* Sales Return (INPUT) */}
                    <div className="bg-amber-50 rounded-lg p-4 border-2 border-amber-200">
                      <div className="font-semibold text-sm text-amber-800 mb-3">
                        Sales Return (INPUT)
                      </div>
                      {!editing.isInterstate ? (
                        <div className="space-y-3">
                          <SearchableDropdown
                            value={editing.defaults?.inputCgstAccountId ?? ""}
                            onChange={(v) =>
                              setEditing({
                                ...editing,
                                defaults: {
                                  ...(editing.defaults || {}),
                                  inputCgstAccountId: v || null,
                                },
                              })
                            }
                            options={makeFilteredOpts(
                              "INPUT",
                              "CGST",
                              halfRate ?? undefined
                            )}
                            placeholder={`CGST ${
                              halfRate != null ? `(${halfRate}%)` : ""
                            }`}
                          />
                          <SearchableDropdown
                            value={editing.defaults?.inputSgstAccountId ?? ""}
                            onChange={(v) =>
                              setEditing({
                                ...editing,
                                defaults: {
                                  ...(editing.defaults || {}),
                                  inputSgstAccountId: v || null,
                                },
                              })
                            }
                            options={makeFilteredOpts(
                              "INPUT",
                              "SGST",
                              halfRate ?? undefined
                            )}
                            placeholder={`SGST ${
                              halfRate != null ? `(${halfRate}%)` : ""
                            }`}
                          />
                        </div>
                      ) : (
                        <SearchableDropdown
                          value={editing.defaults?.inputIgstAccountId ?? ""}
                          onChange={(v) =>
                            setEditing({
                              ...editing,
                              defaults: {
                                ...(editing.defaults || {}),
                                inputIgstAccountId: v || null,
                              },
                            })
                          }
                          options={makeFilteredOpts(
                            "INPUT",
                            "IGST",
                            igstRate ?? undefined
                          )}
                          placeholder={`IGST ${
                            igstRate != null ? `(${igstRate}%)` : ""
                          }`}
                        />
                      )}
                    </div>

                    {/* Purchase Return (OUTPUT) */}
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <div className="font-semibold text-sm text-purple-800 mb-3">
                        Purchase Return (OUTPUT)
                      </div>
                      {!editing.isInterstate ? (
                        <div className="space-y-3">
                          <SearchableDropdown
                            value={editing.defaults?.outputCgstAccountId ?? ""}
                            onChange={(v) =>
                              setEditing({
                                ...editing,
                                defaults: {
                                  ...(editing.defaults || {}),
                                  outputCgstAccountId: v || null,
                                },
                              })
                            }
                            options={makeFilteredOpts(
                              "OUTPUT",
                              "CGST",
                              halfRate ?? undefined
                            )}
                            placeholder={`CGST ${
                              halfRate != null ? `(${halfRate}%)` : ""
                            }`}
                          />
                          <SearchableDropdown
                            value={editing.defaults?.outputSgstAccountId ?? ""}
                            onChange={(v) =>
                              setEditing({
                                ...editing,
                                defaults: {
                                  ...(editing.defaults || {}),
                                  outputSgstAccountId: v || null,
                                },
                              })
                            }
                            options={makeFilteredOpts(
                              "OUTPUT",
                              "SGST",
                              halfRate ?? undefined
                            )}
                            placeholder={`SGST ${
                              halfRate != null ? `(${halfRate}%)` : ""
                            }`}
                          />
                        </div>
                      ) : (
                        <SearchableDropdown
                          value={editing.defaults?.outputIgstAccountId ?? ""}
                          onChange={(v) =>
                            setEditing({
                              ...editing,
                              defaults: {
                                ...(editing.defaults || {}),
                                outputIgstAccountId: v || null,
                              },
                            })
                          }
                          options={makeFilteredOpts(
                            "OUTPUT",
                            "IGST",
                            igstRate ?? undefined
                          )}
                          placeholder={`IGST ${
                            igstRate != null ? `(${igstRate}%)` : ""
                          }`}
                        />
                      )}
                    </div>
                  </div>
                )}

                {isNoTax(editing) && (
                  <div className="text-sm text-emerald-700 bg-emerald-50 border-2 border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>
                      No tax is applied for this slab. Only base accounts are
                      required.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t-2 border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                className="px-6 py-2.5 bg-averix-red-dark text-white rounded-lg hover:bg-averix-red-darker transition-all font-medium shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
