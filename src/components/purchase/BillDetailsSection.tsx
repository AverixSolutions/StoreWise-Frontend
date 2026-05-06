// src/components/purchase/BillDetailsSection.tsx
import {
  Plus,
  Receipt,
  UserRound,
  Building2,
  Landmark,
  FileText,
  Percent,
  CalendarClock,
  IndianRupee,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { HeaderForm } from "./types";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import { toLocalDate, toLocalTime, fromDateTime } from "./utils";

interface BillDetailsSectionProps {
  header: HeaderForm;
  setHeader: React.Dispatch<React.SetStateAction<HeaderForm>>;
  suppliers: Array<{ id: string; name: string }>;
  setShowSupplierModal: (show: boolean) => void;
  subTotal: number;
  grandTotal: number;
  onSave: () => void;
  onCancel: () => void;
  entryNo?: number;
  requireSupplier?: boolean;
  isEditing?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  // new
  transactionTypes: Array<{ id: string; name: string; isDefault: number }>;
}

const labelCls =
  "text-xs text-slate-600 font-medium mb-1 flex items-center gap-1";
const inputBase =
  "w-full h-9 px-3 text-sm border border-slate-300 rounded-md " +
  "bg-white text-slate-800 outline-none transition-colors " +
  "focus:border-[#20b7ff] focus:ring-2 focus:ring-[#20b7ff]/20";
const fieldWrap = "relative";
const leftIcon =
  "absolute inset-y-0 left-2 flex items-center text-slate-400 pointer-events-none";
const inputWithIcon = inputBase + " pl-9";

export default function BillDetailsSection({
  header,
  setHeader,
  suppliers,
  setShowSupplierModal,
  subTotal,
  grandTotal,
  onSave,
  onCancel,
  entryNo,
  requireSupplier,
  isOpen,
  onToggle,
  transactionTypes,
}: BillDetailsSectionProps) {
  // ── COLLAPSED STRIP ──────────────────────────────────────────
  if (!isOpen) {
    return (
      <aside
        className="w-10 bg-[#1e3a5f] flex flex-col items-center py-3 gap-4
                   border-r border-slate-300 cursor-pointer select-none
                   transition-all duration-200"
        onClick={onToggle}
        title="Show Bill Details (Ctrl+\\)"
      >
        <ChevronRight className="w-4 h-4 text-white/70 flex-shrink-0" />
        <span
          className="text-white/60 text-[10px] font-semibold uppercase tracking-widest"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Bill Details
        </span>
        {/* Red dot if required fields missing */}
        {(!header.billNo || (requireSupplier && !header.supplier)) && (
          <span
            className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0"
            title="Required fields incomplete"
          />
        )}
      </aside>
    );
  }

  // ── EXPANDED PANEL ───────────────────────────────────────────
  return (
    <section
      className="col-span-1 bg-white w-full md:max-w-[240px] lg:max-w-[300px] border-r border-slate-300
                        shadow-lg -mt-px p-4 space-y-4 overflow-y-auto no-scrollbar
                        h-full flex flex-col transition-all duration-200"
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between -mx-4 -mt-4 px-4 py-2.5
                      bg-[#1e3a5f] rounded-t-none mb-4"
      >
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-white/70" />
          <h2 className="text-sm font-semibold text-white">Bill Details</h2>
        </div>
        <button
          type="button"
          onClick={onToggle}
          title="Hide Bill Details (Ctrl+\\)"
          className="text-white/60 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 justify-center">
          {/* Entry No */}
          <div>
            <label className={labelCls}>
              <Receipt className="w-3.5 h-3.5" />
              Entry No
            </label>
            <input
              className={
                inputBase + " bg-slate-100 text-slate-500 cursor-not-allowed"
              }
              value={entryNo ?? "—"}
              readOnly
              disabled
            />
          </div>

          {/* Purchase Type toggle */}
          <div>
            <label className={labelCls}>
              <Wallet className="w-3.5 h-3.5" />
              Purchase Type
            </label>
            <div className="inline-flex rounded-md overflow-hidden border border-slate-200">
              <button
                type="button"
                onClick={() =>
                  setHeader((s) => ({ ...s, purchaseType: "CASH" }))
                }
                className={
                  "px-3 h-9 text-sm transition-colors cursor-pointer " +
                  (header.purchaseType === "CASH"
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50")
                }
              >
                Cash
              </button>
              <button
                type="button"
                disabled={!header.supplier}
                title={
                  !header.supplier ? "Select a supplier to enable CREDIT" : ""
                }
                onClick={() =>
                  setHeader((s) => ({ ...s, purchaseType: "CREDIT" }))
                }
                className={
                  "px-3 h-9 text-sm border-l border-slate-200 transition-colors " +
                  (header.purchaseType === "CREDIT"
                    ? "bg-[#1e3a5f] text-white cursor-pointer"
                    : "bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed")
                }
              >
                Credit
              </button>
            </div>
          </div>
        </div>

        {/* Transaction Type */}
        {transactionTypes.length > 0 && (
          <div>
            <label className={labelCls}>
              <Layers className="w-3.5 h-3.5" />
              Transaction Type
            </label>
            <select
              className={inputBase}
              value={header.typeId || ""}
              onChange={(e) =>
                setHeader((s) => ({
                  ...s,
                  typeId: e.target.value || null,
                }))
              }
            >
              <option value="">-- None --</option>
              {transactionTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Bill No */}
        <div>
          <label className={labelCls}>
            <Receipt className="w-3.5 h-3.5" />
            Bill No <span className="text-rose-500">*</span>
          </label>
          <input
            className={inputBase}
            value={header.billNo}
            onChange={(e) =>
              setHeader((s) => ({ ...s, billNo: e.target.value }))
            }
            placeholder="Enter bill number"
            autoFocus={false}
            id="bill-details-billno"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3 min-w-0">
          <div className="min-w-0">
            <label className={labelCls}>
              <CalendarClock className="w-3.5 h-3.5" />
              Purchase Date
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-1.5">
              <input
                className={inputBase + " text-xs px-2"}
                type="date"
                value={toLocalDate(header.purchaseDate)}
                onChange={(e) => {
                  const d = e.target.value;
                  const t = toLocalTime(header.purchaseDate);
                  setHeader((s) => ({
                    ...s,
                    purchaseDate: fromDateTime(d, t),
                  }));
                }}
              />
              <input
                className={inputBase + " text-xs px-2 w-[80px]"}
                type="time"
                value={toLocalTime(header.purchaseDate)}
                onChange={(e) => {
                  const t = e.target.value;
                  const d = toLocalDate(header.purchaseDate);
                  setHeader((s) => ({
                    ...s,
                    purchaseDate: fromDateTime(d, t),
                  }));
                }}
              />
            </div>
          </div>
          <div className="min-w-0">
            <label className={labelCls}>
              <CalendarClock className="w-3.5 h-3.5" />
              Entry Date
            </label>
            <input
              className={inputBase + " text-xs px-2"}
              type="date"
              value={toLocalDate(header.entryTime)}
              onChange={(e) => {
                const d = e.target.value;
                const t = toLocalTime(header.entryTime);
                setHeader((s) => ({ ...s, entryTime: fromDateTime(d, t) }));
              }}
            />
          </div>
        </div>

        {/* Supplier */}
        <div>
          <label className={labelCls}>
            <UserRound className="w-3.5 h-3.5" />
            Supplier
            {requireSupplier ? <span className="text-rose-500">*</span> : null}
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchableDropdown
                value={header.supplier?.id || ""}
                onChange={(v) => {
                  const sup = suppliers.find((s) => s.id === v);
                  setHeader((s) => ({ ...s, supplier: sup || null }));
                }}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select supplier..."
                controlClassName="h-9 text-sm px-2"
                inputClassName="h-9 text-sm"
                optionClassName="text-sm"
                menuClassName="text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowSupplierModal(true)}
              className="px-3 h-9 rounded-md bg-[#1e3a5f] text-white hover:bg-[#16304f]
                         transition-colors inline-flex items-center justify-center cursor-pointer"
              title="Add New Supplier"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dept + Debit A/c */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              <Building2 className="w-3.5 h-3.5" />
              Department
            </label>
            <input
              className={inputBase}
              value={header.department}
              onChange={(e) =>
                setHeader((s) => ({ ...s, department: e.target.value }))
              }
              placeholder="Department"
            />
          </div>
          <div>
            <label className={labelCls}>
              <Landmark className="w-3.5 h-3.5" />
              Debit A/c
            </label>
            <input
              className={inputBase}
              value={header.debitAccount}
              onChange={(e) =>
                setHeader((s) => ({ ...s, debitAccount: e.target.value }))
              }
              placeholder="Account"
            />
          </div>
        </div>

        {/* Nature of Entry */}
        <div>
          <label className={labelCls}>
            <FileText className="w-3.5 h-3.5" />
            Nature of Entry
          </label>
          <input
            className={inputBase}
            value={header.natureOfEntry}
            onChange={(e) =>
              setHeader((s) => ({ ...s, natureOfEntry: e.target.value }))
            }
            placeholder="Nature of entry"
          />
        </div>

        {/* Header Discount */}
        <div>
          <label className={labelCls}>
            <Percent className="w-3.5 h-3.5" />
            Header Discount (₹)
          </label>
          <div className={fieldWrap}>
            <div className={leftIcon}>
              <IndianRupee className="w-4 h-4" />
            </div>
            <input
              className={inputWithIcon}
              type="number"
              value={header.discount}
              min={0}
              step={1}
              inputMode="numeric"
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              onKeyDown={(e) => {
                if (
                  e.key === "-" ||
                  e.key === "+" ||
                  e.key.toLowerCase() === "e"
                )
                  e.preventDefault();
              }}
              onChange={(e) => {
                const n = e.currentTarget.valueAsNumber;
                const clamped = Number.isFinite(n)
                  ? Math.max(0, Math.min(n, subTotal))
                  : 0;
                setHeader((s) => ({ ...s, discount: clamped }));
              }}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Summary card */}
      <div
        className="mt-2 rounded-xl border border-slate-300 bg-white
                      shadow-[0_4px_20px_rgba(3,10,24,0.06)] overflow-hidden"
      >
        <div className="h-1 bg-gradient-to-r from-[#20b7ff] to-[#b026ff]" />
        <div className="p-3 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Sub Total</span>
            <span className="font-medium text-slate-700">
              ₹ {Number(subTotal).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Discount</span>
            <span className="font-medium text-rose-500">
              - ₹ {Number(header.discount ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-700">
              Grand Total
            </span>
            <span className="text-lg font-bold text-[#1e3a5f]">
              ₹ {Number(grandTotal).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={header.purchaseType === "CREDIT" && !header.supplier}
          className={
            "flex-1 h-9 px-3 rounded-md transition-colors font-medium inline-flex " +
            "items-center justify-center gap-2 text-sm " +
            (header.purchaseType === "CREDIT" && !header.supplier
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-[#1e3a5f] text-white hover:bg-[#16304f] cursor-pointer")
          }
        >
          <Receipt className="w-4 h-4" />
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 h-9 bg-white border border-slate-200 px-3 rounded-md
                     hover:bg-slate-50 transition-colors font-medium text-slate-600 text-sm cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

export function MobileBillSheet({
  isOpen,
  onClose,
  ...props // all BillDetailsSection props
}: BillDetailsSectionProps & { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={`
        fixed bottom-0 left-0 right-0 z-50 md:hidden
        bg-white rounded-t-2xl shadow-2xl
        max-h-[90dvh] flex flex-col
        transition-transform duration-300
        ${isOpen ? "translate-y-0" : "translate-y-full"}
      `}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        {/* Reuse the same expanded panel content */}
        <div className="overflow-y-auto flex-1 px-4 pb-6">
          <BillDetailsSection {...props} isOpen={true} onToggle={onClose} />
        </div>
      </div>
    </>
  );
}
