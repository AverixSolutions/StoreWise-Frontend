// src/components/sales-return/BillDetailsSectionReturn.tsx
import { Receipt, UserRound, CalendarClock, Wallet, Plus } from "lucide-react";
import { HeaderForm } from "@/components/sales/types";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import {
  toLocalDate,
  toLocalTime,
  fromDateTime,
} from "@/components/sales/utils";

interface Props {
  header: HeaderForm;
  setHeader: React.Dispatch<React.SetStateAction<HeaderForm>>;
  customers: Array<{ id: string; name: string }>;
  setShowCustomerModal: (b: boolean) => void;
  subTotal: number;
  grandTotal: number;
  onSave: () => void;
  onCancel: () => void;
  entryNo?: number;
  requireCustomer?: boolean;
}

const labelCls =
  "text-xs text-gray-600 font-medium mb-1 flex items-center gap-1";
const inputBase =
  "w-full h-9 px-3 text-sm border border-gray-300 rounded-md bg-white outline-none transition-colors focus:border-averix-red-dark focus:ring-2 focus:ring-averix-red-light/50";
const fieldWrap = "relative";
const leftIcon =
  "absolute inset-y-0 left-2 flex items-center text-gray-500 pointer-events-none";
const inputWithIcon = inputBase + " pl-9";

export default function BillDetailsSectionReturn({
  header,
  setHeader,
  customers,
  setShowCustomerModal,
  subTotal,
  grandTotal,
  onSave,
  onCancel,
  entryNo,
  requireCustomer,
}: Props) {
  return (
    <section className="col-span-1 bg-white max-w-[300px] border border-gray-200 -mt-px p-4 space-y-4 overflow-y-auto no-scrollbar">
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-averix-red-dark" />
        <h2 className="text-base font-semibold text-gray-900">
          Return Details
        </h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 justify-center">
          <div>
            <label className={labelCls}>
              <Receipt className="w-3.5 h-3.5" /> Entry No
            </label>
            <input
              className={inputBase + " bg-gray-50 text-gray-700"}
              value={entryNo ?? "—"}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className={labelCls}>
              <Wallet className="w-3.5 h-3.5" /> Return Type
            </label>
            <div className="inline-flex rounded-md overflow-hidden border border-gray-300">
              <button
                type="button"
                onClick={() => setHeader((s) => ({ ...s, saleType: "CASH" }))}
                className={
                  "px-3 h-9 text-sm " +
                  (header.saleType === "CASH"
                    ? "bg-averix-red-dark text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50")
                }
              >
                Cash
              </button>
              <button
                type="button"
                disabled={!header.customer}
                title={
                  !header.customer ? "Select a customer to enable CREDIT" : ""
                }
                onClick={() => setHeader((s) => ({ ...s, saleType: "CREDIT" }))}
                className={
                  "px-3 h-9 text-sm border-l border-gray-300 " +
                  (header.saleType === "CREDIT"
                    ? "bg-averix-red-dark text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50")
                }
              >
                Credit
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>
            <Receipt className="w-3.5 h-3.5" /> Bill No
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
              placeholder="Original bill (optional)"
            />
          </div>
        </div>

        {/* FIXED: Both Return Date and Entry Date now expose date + time */}
        <div className="grid grid-cols-2 gap-3 min-w-0">
          <div className="min-w-0">
            <label className={labelCls}>
              <CalendarClock className="w-3.5 h-3.5" /> Return Date
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                className={inputBase + " text-xs px-2"}
                type="date"
                value={toLocalDate(header.saleDate)}
                onChange={(e) => {
                  const d = e.target.value;
                  const t = toLocalTime(header.saleDate);
                  setHeader((s) => ({ ...s, saleDate: fromDateTime(d, t) }));
                }}
              />
              <input
                className={inputBase + " text-xs px-2 w-[90px]"}
                type="time"
                value={toLocalTime(header.saleDate)}
                onChange={(e) => {
                  const t = e.target.value;
                  const d = toLocalDate(header.saleDate);
                  setHeader((s) => ({ ...s, saleDate: fromDateTime(d, t) }));
                }}
              />
            </div>
          </div>
          <div className="min-w-0">
            <label className={labelCls}>
              <CalendarClock className="w-3.5 h-3.5" /> Entry Date
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
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
              <input
                className={inputBase + " text-xs px-2 w-[90px]"}
                type="time"
                value={toLocalTime(header.entryTime)}
                onChange={(e) => {
                  const t = e.target.value;
                  const d = toLocalDate(header.entryTime);
                  setHeader((s) => ({ ...s, entryTime: fromDateTime(d, t) }));
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>
            <UserRound className="w-3.5 h-3.5" />
            Customer{" "}
            {requireCustomer ? <span className="text-red-500">*</span> : null}
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchableDropdown
                value={header.customer?.id || ""}
                onChange={(val) => {
                  const cust = customers.find((c) => c.id === val);
                  setHeader((s) => ({ ...s, customer: cust || null }));
                }}
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select customer"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              className="h-9 px-3 bg-averix-red-dark text-white rounded-md hover:bg-averix-red-darker transition-colors"
              title="Add customer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="pt-3 border-t border-gray-200 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium text-gray-900">
              ₹{(subTotal || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span className="text-gray-900">Grand Total:</span>
            <span className="text-averix-red-dark">
              ₹{(grandTotal || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 h-9 px-4 text-sm font-medium text-white bg-averix-red-dark rounded-md hover:bg-averix-red-darker"
          >
            Save
          </button>
        </div>
      </div>
    </section>
  );
}
