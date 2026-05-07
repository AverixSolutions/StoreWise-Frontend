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
import Dropdown from "@/components/ui/Dropdown";
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
  transactionTypes: Array<{ id: string; name: string; isDefault: number }>;
}

const labelCls =
  "text-[10px] text-slate-500 font-semibold uppercase tracking-[0.1em] mb-0.5 flex items-center gap-1";

// Single source of truth for all input heights — h-7 = 28px
const inputBase =
  "w-full h-7 px-2 text-xs border border-slate-300 rounded " +
  "bg-white text-slate-800 outline-none transition-colors " +
  "focus:border-[#20b7ff] focus:ring-1 focus:ring-[#20b7ff]/20";
const fieldWrap = "relative";
const leftIcon =
  "absolute inset-y-0 left-2 flex items-center text-slate-400 pointer-events-none";
const inputWithIcon = inputBase + " pl-6";

// Shared height token used for buttons/dropdowns that must match inputs
const H = "h-7";

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
      className="col-span-1 bg-white w-full md:max-w-[240px] lg:max-w-[300px] border-r border-slate-200
                 shadow-lg -mt-px overflow-y-auto no-scrollbar
                 h-full flex flex-col transition-all duration-200"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1e3a5f] shrink-0">
        <div className="flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-white/70" />
          <h2 className="text-xs font-semibold text-white tracking-wide">
            Bill Details
          </h2>
          {entryNo && (
            <span className="ml-1 text-[10px] font-mono text-white/50">
              #{entryNo}
            </span>
          )}
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

      {/* Fields */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-2.5 space-y-2">
        {/* Purchase Type */}
        <div>
          <label className={labelCls}>
            <Wallet className="w-3 h-3" />
            Purchase Type
          </label>
          <div
            className={`inline-flex w-full rounded overflow-hidden border border-slate-300 ${H}`}
          >
            <button
              type="button"
              onClick={() => setHeader((s) => ({ ...s, purchaseType: "CASH" }))}
              className={
                `flex-1 ${H} text-xs transition-colors cursor-pointer font-medium ` +
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
                `flex-1 ${H} text-xs border-l border-slate-300 transition-colors font-medium ` +
                (header.purchaseType === "CREDIT"
                  ? "bg-[#1e3a5f] text-white cursor-pointer"
                  : "bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed")
              }
            >
              Credit
            </button>
          </div>
        </div>

        {/* Transaction Type */}
        {transactionTypes.length > 0 && (
          <div>
            <label className={labelCls}>
              <Layers className="w-3 h-3" />
              Transaction Type
            </label>
            <Dropdown
              value={header.typeId || ""}
              onChange={(val) =>
                setHeader((s) => ({ ...s, typeId: val || null }))
              }
              options={[
                { value: "", label: "-- None --" },
                ...transactionTypes.map((t) => ({
                  value: t.id,
                  label: t.name,
                })),
              ]}
              placeholder="-- None --"
              className={`[&_button]:${H} [&_button]:text-xs [&_button]:rounded [&_button]:px-2 [&_button]:border-slate-300 [&_button]:py-0`}
            />
          </div>
        )}

        {/* Bill No */}
        <div>
          <label className={labelCls}>
            <Receipt className="w-3 h-3" />
            Bill No <span className="text-rose-500">*</span>
          </label>
          <input
            className={inputBase}
            value={header.billNo}
            onChange={(e) =>
              setHeader((s) => ({ ...s, billNo: e.target.value }))
            }
            placeholder="Enter bill number"
            id="bill-details-billno"
          />
        </div>

        {/* Supplier */}
        <div>
          <label className={labelCls}>
            <UserRound className="w-3 h-3" />
            Supplier
            {requireSupplier ? <span className="text-rose-500">*</span> : null}
          </label>
          <div className="flex gap-1.5 items-center">
            <div className="flex-1 min-w-0">
              <SearchableDropdown
                value={header.supplier?.id || ""}
                onChange={(v) => {
                  const sup = suppliers.find((s) => s.id === v);
                  setHeader((s) => ({ ...s, supplier: sup || null }));
                }}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select supplier..."
                controlClassName={`${H} text-xs px-2`}
                inputClassName={`${H} text-xs`}
                optionClassName="text-xs"
                menuClassName="text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowSupplierModal(true)}
              className={`px-2 ${H} rounded bg-[#1e3a5f] text-white hover:bg-[#16304f]
                         transition-colors inline-flex items-center justify-center cursor-pointer shrink-0`}
              title="Add New Supplier"
            >
              <Plus className="w-4 h-6" />
            </button>
          </div>
        </div>

        {/* Purchase Date */}
        <div>
          <label className={labelCls}>
            <CalendarClock className="w-3 h-3" />
            Purchase Date
          </label>
          <div className="grid grid-cols-[1fr_80px] gap-1">
            <input
              className={inputBase + " px-1.5"}
              type="date"
              value={toLocalDate(header.purchaseDate)}
              onChange={(e) => {
                const d = e.target.value;
                const t = toLocalTime(header.purchaseDate);
                setHeader((s) => ({ ...s, purchaseDate: fromDateTime(d, t) }));
              }}
            />
            <input
              className={inputBase + " px-1 min-w-0"}
              type="time"
              value={toLocalTime(header.purchaseDate)}
              onChange={(e) => {
                const t = e.target.value;
                const d = toLocalDate(header.purchaseDate);
                setHeader((s) => ({ ...s, purchaseDate: fromDateTime(d, t) }));
              }}
            />
          </div>
        </div>

        {/* Entry Date */}
        <div>
          <label className={labelCls}>
            <CalendarClock className="w-3 h-3" />
            Entry Date
          </label>
          <input
            className={inputBase + " px-1.5"}
            type="date"
            value={toLocalDate(header.entryTime)}
            onChange={(e) => {
              const d = e.target.value;
              const t = toLocalTime(header.entryTime);
              setHeader((s) => ({ ...s, entryTime: fromDateTime(d, t) }));
            }}
          />
        </div>

        {/* Dept + Debit A/c */}
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className={labelCls}>
              <Building2 className="w-3 h-3" />
              Department
            </label>
            <input
              className={inputBase}
              value={header.department}
              onChange={(e) =>
                setHeader((s) => ({ ...s, department: e.target.value }))
              }
              placeholder="Dept"
            />
          </div>
          <div>
            <label className={labelCls}>
              <Landmark className="w-3 h-3" />
              Debit A/c
            </label>
            <input
              className={inputBase}
              value={header.debitAccount}
              onChange={(e) =>
                setHeader((s) => ({ ...s, debitAccount: e.target.value }))
              }
              placeholder="A/c"
            />
          </div>
        </div>

        {/* Nature of Entry */}
        <div>
          <label className={labelCls}>
            <FileText className="w-3 h-3" />
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
            <Percent className="w-3 h-3" />
            Header Discount (₹)
          </label>
          <div className={fieldWrap}>
            <div className={leftIcon}>
              <IndianRupee className="w-3 h-3" />
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
      <div className="shrink-0 mx-2.5 mb-2 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-[#20b7ff] to-[#b026ff]" />
        <div className="px-3 py-2 space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Sub Total</span>
            <span className="font-semibold text-slate-700">
              ₹ {Number(subTotal).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Discount</span>
            <span className="font-semibold text-rose-500">
              - ₹ {Number(header.discount ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700">
              Grand Total
            </span>
            <span className="text-base font-bold text-[#1e3a5f]">
              ₹ {Number(grandTotal).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex gap-2 px-2.5 pb-2.5">
        <button
          onClick={onSave}
          disabled={header.purchaseType === "CREDIT" && !header.supplier}
          className={
            "flex-1 h-8 px-3 rounded transition-colors font-semibold inline-flex " +
            "items-center justify-center gap-1.5 text-xs " +
            (header.purchaseType === "CREDIT" && !header.supplier
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-[#1e3a5f] text-white hover:bg-[#16304f] cursor-pointer")
          }
        >
          <Receipt className="w-3.5 h-3.5" />
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 h-8 bg-white border border-slate-300 px-3 rounded
                     hover:bg-slate-50 transition-colors font-semibold text-slate-600 text-xs cursor-pointer"
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
  ...props
}: BillDetailsSectionProps & { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onClose}
      />
      <div
        className={`
        fixed bottom-0 left-0 right-0 z-50 md:hidden
        bg-white rounded-t-2xl shadow-2xl
        max-h-[90dvh] flex flex-col
        transition-transform duration-300
        ${isOpen ? "translate-y-0" : "translate-y-full"}
      `}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-6">
          <BillDetailsSection {...props} isOpen={true} onToggle={onClose} />
        </div>
      </div>
    </>
  );
}
