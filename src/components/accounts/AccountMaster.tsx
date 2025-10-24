// src/components/accounts/AccountMaster.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Save, X, FolderTree } from "lucide-react";

type Group = {
  id: string;
  name: string;
  nature: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";
  parentId: string | null;
  code?: string | null;
  section?: string | null;
  sortOrder?: number | null;
  isSystem: number;
};

type Account = {
  id: string;
  name: string;
  code?: string | null;
  groupId: string;
  isSystem: number;
  taxType?: string | null;
  gstComponent?: string | null;
  rate?: number | null;
  // opening balance (joined)
  openingAmount?: number | null;
  openingSide?: "DR" | "CR" | null;
  openingAsOfDate?: string | null;
  openingFyStart?: string | null;
};

type OpeningState = {
  amount: number | "";
  side: "DR" | "CR";
  asOfDate: string; // YYYY-MM-DD
  fyStart: string; // YYYY-MM-DD
};

// FY utils (India)
function getIndiaFYStartISO(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0=Jan
  const fyYear = m < 3 ? y - 1 : y;
  const dt = new Date(fyYear, 3, 1); // local Apr 1
  // to YYYY-MM-DD
  return dt.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AccountMaster() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [q, setQ] = useState("");
  const [fyStart, setFyStart] = useState<string>(getIndiaFYStartISO());
  const [editing, setEditing] = useState<Partial<Account> | null>(null);
  const [opening, setOpening] = useState<OpeningState>({
    amount: "",
    side: "DR",
    asOfDate: todayISO(),
    fyStart: getIndiaFYStartISO(),
  });

  const licenseId =
    typeof window !== "undefined"
      ? localStorage.getItem("licenseId") || "demo-license"
      : "demo-license";

  // load groups
  const loadGroups = async () => {
    const res = await (window as any).electronAPI.listAccountGroups();
    if (res?.success) {
      setGroups(res.rows);
      if (!selectedGroupId && res.rows.length) {
        setSelectedGroupId(res.rows[0].id);
      }
    }
  };

  const loadAccounts = async () => {
    if (!selectedGroupId) return;
    const res = await (window as any).electronAPI.listAccounts({
      licenseId,
      groupId: selectedGroupId,
      q,
      page: 1,
      pageSize: 200,
      fyStart,
    });
    if (res?.success) setAccounts(res.rows);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [selectedGroupId, q]);

  // When FY changes, reload accounts and sync editor opening.fyStart
  useEffect(() => {
    setOpening((o) => ({ ...o, fyStart }));
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fyStart]);

  const currentGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const groupedBySection = useMemo(() => {
    const map = new Map<string, Group[]>();
    for (const g of groups) {
      const key = g.section || "OTHER";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    for (const arr of map.values())
      arr.sort(
        (a, b) =>
          (a.sortOrder || 9999) - (b.sortOrder || 9999) ||
          a.name.localeCompare(b.name)
      );
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [groups]);

  const resetForm = () => {
    setEditing(null);
    setOpening({ amount: "", side: "DR", asOfDate: todayISO(), fyStart });
  };

  const startNew = () => {
    setEditing({ id: undefined, name: "", code: "" });
    setOpening({
      amount: "",
      side: "DR",
      asOfDate: todayISO(),
      fyStart,
    });
  };

  const startEdit = (row: Account) => {
    setEditing(row);
    setOpening({
      amount: typeof row.openingAmount === "number" ? row.openingAmount : "",
      side: (row.openingSide as "DR" | "CR") || "DR",
      asOfDate: row.openingAsOfDate || todayISO(),
      fyStart: row.openingFyStart || fyStart,
    });
  };

  const onSave = async () => {
    if (!editing?.name || !selectedGroupId) return;

    const payload: any = {
      id: editing.id,
      licenseId,
      name: editing.name,
      code: editing.code || null,
      groupId: selectedGroupId,
      taxType: editing.taxType || null,
      gstComponent: editing.gstComponent || null,
      rate: editing.rate != null ? Number(editing.rate) : null,
    };

    // include opening if user provided an amount (0 is valid)
    if (opening.amount !== "") {
      payload.opening = {
        amount: Number(opening.amount),
        side: opening.side,
        asOfDate: opening.asOfDate,
        fyStart: opening.fyStart || fyStart,
      };
    }

    const res = await (window as any).electronAPI.saveAccount(payload);
    if (res?.success) {
      resetForm();
      loadAccounts();
    } else {
      alert(res?.error || "Failed to save");
    }
  };

  const onDelete = async (row: Account) => {
    if (!confirm(`Delete account "${row.name}"?`)) return;
    const res = await (window as any).electronAPI.deleteAccount(row.id);
    if (res?.success) loadAccounts();
    else alert(res?.error || "Delete failed");
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* LEFT: Groups */}
      <div className="col-span-12 lg:col-span-4 xl:col-span-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FolderTree className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-800">Account Groups</h3>
          </div>
          <div className="space-y-4 max-h-[70vh] overflow-auto pr-1">
            {groupedBySection.map(([section, arr]) => (
              <div key={section}>
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {section}
                </div>
                <div className="space-y-1">
                  {arr.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                        selectedGroupId === g.id
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : "hover:bg-gray-50 text-gray-700 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{g.name}</span>
                        {g.code ? (
                          <span className="text-[10px] text-gray-500">
                            {g.code}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Accounts */}
      <div className="col-span-12 lg:col-span-8 xl:col-span-9">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <div className="text-sm text-gray-500">Selected Group</div>
              <div className="text-lg font-semibold text-gray-900">
                {currentGroup ? currentGroup.name : "—"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">FY start</label>
              <input
                type="date"
                value={fyStart}
                onChange={(e) => setFyStart(e.target.value)}
                className="border rounded-lg px-2 py-1 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <input
              placeholder="Search accounts..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={startNew}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={!selectedGroupId}
            >
              <Plus className="w-4 h-4" /> New Account
            </button>
          </div>

          {/* list */}
          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Code</th>
                  <th className="text-left px-3 py-2">Opening</th>
                  <th className="px-3 py-2 w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2">{a.code || ""}</td>
                    <td className="px-3 py-2">
                      {typeof a.openingAmount === "number"
                        ? `${
                            a.openingSide || "DR"
                          } ${a.openingAmount.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          className="p-1.5 rounded-md hover:bg-gray-100"
                          onClick={() => startEdit(a)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"
                          onClick={() => onDelete(a)}
                          disabled={a.isSystem === 1}
                          title={a.isSystem ? "System account" : "Delete"}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      No accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* editor */}
          {editing && (
            <div className="mt-4 border rounded-lg p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Name
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={editing.name || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Code
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={editing.code || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, code: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Opening Balance Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Opening Amount (FY)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={opening.amount}
                    onChange={(e) =>
                      setOpening((o) => ({
                        ...o,
                        amount:
                          e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    placeholder="e.g. 5000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Side
                  </label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={opening.side}
                    onChange={(e) =>
                      setOpening((o) => ({
                        ...o,
                        side: e.target.value as "DR" | "CR",
                      }))
                    }
                  >
                    <option value="DR">DR</option>
                    <option value="CR">CR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    As of Date
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={opening.asOfDate}
                    onChange={(e) =>
                      setOpening((o) => ({ ...o, asOfDate: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    FY Start
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={opening.fyStart}
                    onChange={(e) =>
                      setOpening((o) => ({ ...o, fyStart: e.target.value }))
                    }
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Default is India FY (Apr 1). Change only if needed.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 justify-end">
                <button
                  className="px-3 py-2 rounded-lg border"
                  onClick={resetForm}
                >
                  <X className="w-4 h-4 inline mr-1" /> Cancel
                </button>
                <button
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={onSave}
                >
                  <Save className="w-4 h-4 inline mr-1" /> Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
