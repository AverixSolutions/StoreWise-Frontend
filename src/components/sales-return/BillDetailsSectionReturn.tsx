"use client";

import {
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Landmark,
  Plus,
  Receipt,
  UserRound,
  Wallet,
} from "lucide-react";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import {
  fromDateTime,
  toLocalDate,
  toLocalTime,
} from "@/components/sales/utils";
import type { SalesReturnHeader, SourceSaleOption } from "./types";
import type { SalesReturnUiSettings } from "./salesReturnUiSettings";

const labelCls =
  "mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600";
const inputCls =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 shadow-sm outline-none transition focus:border-[#20b7ff] focus:ring-2 focus:ring-[#20b7ff]/15";

export default function BillDetailsSectionReturn(props: {
  expanded: boolean;
  onToggle: () => void;
  mobileSheet?: boolean;
  header: SalesReturnHeader;
  setHeader: React.Dispatch<React.SetStateAction<SalesReturnHeader>>;
  customers: Array<{ id: string; name: string }>;
  onCustomerChange: (id: string) => void;
  setShowCustomerModal: (b: boolean) => void;
  sourceSales: SourceSaleOption[];
  sourceSalesLoading: boolean;
  sourceSaleId: string | null;
  onSourceSaleChange: (id: string) => void;
  subTotal: number;
  grandTotal: number;
  entryNo?: number;
  settings: SalesReturnUiSettings;
  onSave: () => void | Promise<unknown>;
  onCancel: () => void;
  isEditing?: boolean;
  saving?: boolean;
  onFocusItems?: () => void;
}) {
  const {
    expanded,
    onToggle,
    mobileSheet = false,
    header,
    setHeader,
    customers,
    onCustomerChange,
    setShowCustomerModal,
    sourceSales,
    sourceSalesLoading,
    sourceSaleId,
    onSourceSaleChange,
    subTotal,
    grandTotal,
    entryNo,
    settings,
    onSave,
    onCancel,
    isEditing = false,
    saving = false,
    onFocusItems,
  } = props;

  if (!expanded && !mobileSheet) {
    return (
      <aside
        className="flex w-11 cursor-pointer select-none flex-col items-center gap-4 border-r border-slate-700 bg-slate-900 py-3 transition-all duration-200"
        onClick={onToggle}
        title="Show Bill Details (Ctrl+\\)"
      >
        <ChevronRight className="h-4 w-4 shrink-0 text-white/70" />
        <span
          className="text-[10px] font-semibold uppercase tracking-widest text-white/60"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Bill Details
        </span>
        {header.saleType === "CREDIT" && !header.customer ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-rose-400"
            title="Required fields incomplete"
          />
        ) : null}
      </aside>
    );
  }

  const visible = settings.billDetails;
  type HeaderField =
    | "saleType"
    | "customer"
    | "sourceSale"
    | "returnDate"
    | "entryTime"
    | "department"
    | "debitAccount"
    | "natureOfEntry"
    | "discount";

  const headerFields: HeaderField[] = [
    ...(sourceSaleId ? [] : (["saleType"] as HeaderField[])),
    "customer",
    "sourceSale",
    ...(visible.returnDate ? (["returnDate"] as HeaderField[]) : []),
    ...(visible.entryTime ? (["entryTime"] as HeaderField[]) : []),
    ...(visible.department ? (["department"] as HeaderField[]) : []),
    ...(visible.debitAccount ? (["debitAccount"] as HeaderField[]) : []),
    ...(visible.natureOfEntry ? (["natureOfEntry"] as HeaderField[]) : []),
    ...(visible.discount ? (["discount"] as HeaderField[]) : []),
  ];

  function focusHeaderField(field: HeaderField) {
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-sr-header-focus="${field}"]`,
      );
      if (!target || target.hasAttribute("disabled")) return;
      target.focus({ preventScroll: true });
      if (target instanceof HTMLInputElement) {
        try {
          target.select();
        } catch {}
      }
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function moveHeaderFocus(field: HeaderField, direction: 1 | -1) {
    const index = headerFields.indexOf(field);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0) {
      focusHeaderField(headerFields[0]);
      return;
    }
    if (nextIndex >= headerFields.length) {
      onFocusItems?.();
      return;
    }
    focusHeaderField(headerFields[nextIndex]);
  }

  function handleHeaderKeyDownCapture(event: React.KeyboardEvent<HTMLElement>) {
    if (
      event.key !== "Enter" &&
      event.key !== "NumpadEnter" &&
      event.key !== "Tab"
    )
      return;

    const source = event.target as HTMLElement;
    const focusTarget = source.closest<HTMLElement>("[data-sr-header-focus]");
    const field = focusTarget?.dataset.srHeaderFocus as HeaderField | undefined;
    if (!field) return;

    const isDropdownTrigger = Boolean(
      source.closest<HTMLElement>('[aria-haspopup="listbox"]'),
    );
    if (isDropdownTrigger && event.key !== "Tab" && !event.shiftKey) return;

    event.preventDefault();
    event.stopPropagation();
    moveHeaderFocus(field, event.shiftKey ? -1 : 1);
  }

  const panelClass = mobileSheet
    ? "flex min-h-0 w-full flex-col overflow-hidden bg-white"
    : "col-span-1 -mt-px flex h-full w-full flex-col overflow-hidden border-r border-slate-200 bg-white shadow-[8px_0_24px_rgba(15,23,42,0.08)] transition-all duration-200 md:max-w-[280px] lg:max-w-[320px]";

  return (
    <section
      className={panelClass}
      onKeyDownCapture={handleHeaderKeyDownCapture}
    >
      {!mobileSheet ? (
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#1e3a5f] px-3.5 py-2.5">
          <div className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-white/70" />
            <h2 className="text-xs font-semibold tracking-wide text-white">
              Bill Details
            </h2>
            {entryNo ? (
              <span className="ml-1 font-mono text-[10px] text-white/50">
                #{entryNo}
              </span>
            ) : null}
            <kbd
              title="Toggle Bill Details (Ctrl+\\)"
              className="hidden rounded border border-white/35 bg-white/20 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-white lg:inline-flex"
            >
              Ctrl+\
            </kbd>
          </div>
          <button
            type="button"
            onClick={onToggle}
            title="Hide Bill Details (Ctrl+\\)"
            className="text-white/60 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto scroll-smooth">
        <div className="space-y-3 bg-white px-3 pb-4 pt-3">
          <div>
            <label className={labelCls}>
              <Wallet className="h-3 w-3" />
              Return Type
            </label>
            <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200">
              {(["CASH", "CREDIT"] as const).map((saleType) => (
                <button
                  key={saleType}
                  type="button"
                  disabled={Boolean(sourceSaleId)}
                  onClick={() => setHeader((state) => ({ ...state, saleType }))}
                  {...(header.saleType === saleType
                    ? { "data-sr-header-focus": "saleType" }
                    : {})}
                  aria-pressed={header.saleType === saleType}
                  className={`h-8 text-xs font-semibold transition ${
                    header.saleType === saleType
                      ? "bg-[#1e3a5f] text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  {saleType === "CASH" ? "Cash" : "Credit"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>
              <UserRound className="h-3 w-3" />
              Customer
              {header.saleType === "CREDIT" ? (
                <span className="text-rose-500">*</span>
              ) : (
                <span className="font-normal normal-case tracking-normal text-slate-400">
                  optional
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <SearchableDropdown
                  value={header.customer?.id || ""}
                  onChange={onCustomerChange}
                  onEnter={(direction) =>
                    moveHeaderFocus("customer", direction)
                  }
                  options={[
                    ...(header.saleType === "CASH"
                      ? [{ value: "", label: "Cash Customer / No customer" }]
                      : []),
                    ...customers.map((customer) => ({
                      value: customer.id,
                      label: customer.name,
                    })),
                  ]}
                  placeholder="Select customer..."
                  controlClassName="h-8 px-2 text-xs"
                  inputClassName="h-8 text-xs"
                  optionClassName="text-xs"
                  menuClassName="z-[1150] max-h-64 text-xs"
                  buttonProps={{
                    "data-sr-header-focus": "customer",
                    title:
                      "Enter to select customer, Shift+Enter to move backward",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1e3a5f] text-white transition hover:bg-[#16304f]"
                title="Add new customer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              <FileText className="h-3 w-3" />
              Sale Bill
              <span className="font-normal normal-case tracking-normal text-slate-400">
                (Optional)
              </span>
              {sourceSaleId ? (
                <span className="ml-auto rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-emerald-700">
                  Linked
                </span>
              ) : null}
            </label>
            <SearchableDropdown
              value={sourceSaleId || ""}
              onChange={onSourceSaleChange}
              onEnter={(direction) => moveHeaderFocus("sourceSale", direction)}
              options={sourceSales.map((sale) => ({
                value: sale.id,
                label: `${sale.billNo || `Sale ${sale.slNo || ""}`} - ${new Date(
                  sale.saleDate,
                ).toLocaleDateString("en-IN")} - Rs. ${Number(
                  sale.totalAmount || 0,
                ).toFixed(2)}`,
              }))}
              placeholder={
                !header.customer
                  ? "Select customer first"
                  : sourceSalesLoading
                    ? "Loading customer bills..."
                    : sourceSales.length
                      ? "Select Sale bill..."
                      : "No Sale bills found"
              }
              controlClassName="h-8 text-xs px-2"
              inputClassName="h-8 text-xs"
              optionClassName="text-xs"
              menuClassName="z-[1150] max-h-64 text-xs"
              buttonProps={{
                "data-sr-header-focus": "sourceSale",
                "aria-label": "Sale bill",
                title:
                  "Enter to select Sale bill, Shift+Enter to move backward",
              }}
            />
            <p className="mt-1 text-[9px] leading-4 text-slate-500">
              {header.customer
                ? "Optional: choose a Sale bill to link this return and enforce remaining quantities, or leave blank for a normal return."
                : "Normal return is available. Select a customer to optionally load Sale bills."}
            </p>
          </div>

          {visible.returnDate ? (
            <div>
              <label className={labelCls}>
                <CalendarClock className="h-3 w-3" />
                Return Date
              </label>
              <input
                type="date"
                value={toLocalDate(header.saleDate)}
                onChange={(event) =>
                  setHeader((state) => ({
                    ...state,
                    saleDate: fromDateTime(
                      event.target.value,
                      toLocalTime(state.saleDate),
                    ),
                  }))
                }
                data-sr-header-focus="returnDate"
                className={inputCls}
              />
            </div>
          ) : null}

          {visible.entryTime ? (
            <div>
              <label className={labelCls}>
                <CalendarClock className="h-3 w-3" />
                Entry Time
              </label>
              <input
                type="time"
                value={toLocalTime(header.entryTime)}
                onChange={(event) =>
                  setHeader((state) => ({
                    ...state,
                    entryTime: fromDateTime(
                      toLocalDate(state.entryTime),
                      event.target.value,
                    ),
                  }))
                }
                data-sr-header-focus="entryTime"
                className={inputCls}
              />
            </div>
          ) : null}

          {visible.department ? (
            <div>
              <label className={labelCls}>
                <Building2 className="h-3 w-3" />
                Department
              </label>
              <input
                value={header.department || ""}
                onChange={(event) =>
                  setHeader((state) => ({
                    ...state,
                    department: event.target.value,
                  }))
                }
                data-sr-header-focus="department"
                className={inputCls}
                placeholder="Department"
              />
            </div>
          ) : null}

          {visible.debitAccount ? (
            <div>
              <label className={labelCls}>
                <Landmark className="h-3 w-3" />
                Debit Account
              </label>
              <input
                value={header.debitAccount || ""}
                onChange={(event) =>
                  setHeader((state) => ({
                    ...state,
                    debitAccount: event.target.value,
                  }))
                }
                data-sr-header-focus="debitAccount"
                className={inputCls}
                placeholder="Debit account"
              />
            </div>
          ) : null}

          {visible.natureOfEntry ? (
            <div>
              <label className={labelCls}>
                <FileText className="h-3 w-3" />
                Nature of Entry
              </label>
              <input
                value={header.natureOfEntry || ""}
                onChange={(event) =>
                  setHeader((state) => ({
                    ...state,
                    natureOfEntry: event.target.value,
                  }))
                }
                data-sr-header-focus="natureOfEntry"
                className={inputCls}
                placeholder="Nature of entry"
              />
            </div>
          ) : null}

          {visible.discount ? (
            <div>
              <label className={labelCls}>
                <Wallet className="h-3 w-3" />
                Bill Discount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={header.discount || 0}
                onChange={(event) =>
                  setHeader((state) => ({
                    ...state,
                    discount: Math.max(
                      0,
                      Math.min(Number(event.target.value || 0), subTotal),
                    ),
                  }))
                }
                data-sr-header-focus="discount"
                className={inputCls}
                placeholder="0.00"
              />
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="h-0.5 bg-gradient-to-r from-[#20b7ff] to-[#b026ff]" />
            <div className="space-y-1 px-3 py-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Sub Total</span>
                <span className="font-semibold text-slate-700">
                  Rs. {Number(subTotal).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Bill Discount</span>
                <span className="font-semibold text-rose-500">
                  - Rs. {Number(header.discount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Return Total
                </span>
                <span className="text-base font-bold text-[#1e3a5f]">
                  Rs. {Number(grandTotal).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white px-3 py-3">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={
            saving || (header.saleType === "CREDIT" && !header.customer)
          }
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 text-xs font-semibold text-white transition hover:bg-[#16304f] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Receipt className="h-3.5 w-3.5" />
          {saving ? "Saving..." : isEditing ? "Update" : "Save"}
          <kbd className="rounded border border-white/30 bg-white/15 px-1 py-0.5 font-mono text-[8px] text-white">
            Ctrl+S
          </kbd>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {isEditing ? "New Return" : "Clear"}
          <kbd className="ml-1 rounded border border-slate-300 bg-slate-100 px-1 py-0.5 font-mono text-[8px] text-slate-500">
            Ctrl+N
          </kbd>
        </button>
      </div>
    </section>
  );
}
