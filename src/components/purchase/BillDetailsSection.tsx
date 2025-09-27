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
  Clock3,
  IndianRupee,
  Wallet,
  CreditCard,
} from "lucide-react";
import { HeaderForm } from "./types";
import { toLocalInput, fromLocalInput } from "./utils";
import SearchableDropdown from "@/components/ui/SearchableDropdown";

interface BillDetailsSectionProps {
  header: HeaderForm;
  setHeader: React.Dispatch<React.SetStateAction<HeaderForm>>;
  suppliers: Array<{ id: string; name: string }>;
  setShowSupplierModal: (show: boolean) => void;
  subTotal: number;
  grandTotal: number;
  onSave: () => void;
  onCancel: () => void;
}

const labelCls =
  "text-xs text-gray-600 font-medium mb-1 flex items-center gap-1";
const inputBase =
  "w-full h-9 px-3 text-sm border border-gray-300 rounded-md " +
  "bg-white outline-none transition-colors " +
  "focus:border-averix-red-dark focus:ring-2 focus:ring-averix-red-light/50";

const fieldWrap = "relative";
const leftIcon =
  "absolute inset-y-0 left-2 flex items-center text-gray-500 pointer-events-none";
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
}: BillDetailsSectionProps) {
  return (
    <section className="col-span-3 bg-white rounded-xl shadow-lg border border-gray-100 p-4 space-y-4 overflow-y-auto no-scrollbar">
      {/* Title */}
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-averix-red-dark" />
        <h2 className="text-base font-semibold text-gray-900">Bill Details</h2>
      </div>

      <div className="space-y-3">
        {/* Bill No */}
        <div>
          <label className={labelCls}>
            <Receipt className="w-3.5 h-3.5" />
            Bill No
          </label>
          <div className={fieldWrap}>
            <div className={leftIcon}>
              <Receipt className="w-4 h-4" />
            </div>
            <input
              className={inputWithIcon}
              value={header.billNo}
              onChange={(e) =>
                setHeader((s) => ({ ...s, billNo: e.target.value }))
              }
              placeholder="Enter bill number"
            />
          </div>
        </div>

        {/* Supplier + add */}
        <div>
          <label className={labelCls}>
            <UserRound className="w-3.5 h-3.5" />
            Supplier <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchableDropdown
                value={header.supplier?.id || ""}
                onChange={(v) => {
                  const sup = suppliers.find((s) => s.id === v);
                  setHeader((s) => ({ ...s, supplier: sup || null }));
                }}
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
                placeholder="Select supplier..."
                // compact control
                controlClassName="h-9 text-sm px-2"
                inputClassName="h-9 text-sm"
                optionClassName="text-sm"
                menuClassName="text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowSupplierModal(true)}
              className="px-3 h-9 rounded-md bg-averix-red-dark text-white hover:bg-averix-red-accent transition-colors inline-flex items-center justify-center"
              title="Add New Supplier"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Purchase Type */}
        <div>
          <label className={labelCls}>
            <Wallet className="w-3.5 h-3.5" />
            Purchase Type
          </label>
          <div className="inline-flex rounded-md overflow-hidden border border-gray-300">
            <button
              type="button"
              onClick={() => setHeader((s) => ({ ...s, purchaseType: "CASH" }))}
              className={
                "px-3 h-9 text-sm " +
                (header.purchaseType === "CASH"
                  ? "bg-averix-red-dark text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50")
              }
            >
              Cash
            </button>
            <button
              type="button"
              onClick={() =>
                setHeader((s) => ({ ...s, purchaseType: "CREDIT" }))
              }
              className={
                "px-3 h-9 text-sm border-l border-gray-300 " +
                (header.purchaseType === "CREDIT"
                  ? "bg-averix-red-dark text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50")
              }
            >
              Credit
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
                // block minus, plus, exponent chars
                if (
                  e.key === "-" ||
                  e.key === "+" ||
                  e.key.toLowerCase() === "e"
                ) {
                  e.preventDefault();
                }
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

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              <CalendarClock className="w-3.5 h-3.5" />
              Purchase Date
            </label>
            <input
              className={inputBase}
              type="datetime-local"
              value={toLocalInput(header.purchaseDate)}
              onChange={(e) =>
                setHeader((s) => ({
                  ...s,
                  purchaseDate: fromLocalInput(e.target.value),
                }))
              }
            />
          </div>
          <div>
            <label className={labelCls}>
              <Clock3 className="w-3.5 h-3.5" />
              Entry Time
            </label>
            <input
              className={inputBase}
              type="datetime-local"
              value={toLocalInput(header.entryTime)}
              onChange={(e) =>
                setHeader((s) => ({
                  ...s,
                  entryTime: fromLocalInput(e.target.value),
                }))
              }
            />
          </div>
        </div>
      </div>

      {/* Summary Card (compact) */}
      <div className="mt-2 p-3 bg-gradient-to-r from-averix-red-dark to-averix-red-accent rounded-lg text-white">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="opacity-90">Sub Total</span>
            <span className="font-medium">₹ {Number(subTotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="opacity-90">Discount</span>
            <span className="font-medium">
              - ₹ {Number(header.discount ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="border-t border-white/20 pt-2 flex justify-between items-center">
            <span className="font-semibold">Grand Total</span>
            <span className="font-bold text-lg">
              ₹ {Number(grandTotal).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          className="flex-1 h-9 bg-averix-red-dark text-white px-3 rounded-md hover:bg-averix-red-accent transition-colors font-medium inline-flex items-center justify-center gap-2"
        >
          <Receipt className="w-4 h-4" />
          Save Bill
        </button>
        <button
          onClick={onCancel}
          className="flex-1 h-9 bg-white border border-gray-200 px-3 rounded-md hover:bg-gray-50 transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
