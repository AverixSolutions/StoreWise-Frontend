import {
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Landmark,
  Layers,
  Plus,
  Receipt,
  UserRound,
  Wallet,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { HeaderForm } from "./types";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import CompactDropdown from "@/components/ui/CompactDropdown";
import { toLocalDate, toLocalTime, fromDateTime } from "./utils";
import {
  DEFAULT_SALES_UI_SETTINGS,
  type SalesUiSettings,
} from "./salesUiSettings";

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
  billNoPreview?: string;
  offerSavings?: number;
  requireCustomer?: boolean;
  isEditing?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  transactionTypes: Array<{ id: string; name: string; isDefault: number }>;
  uiSettings?: SalesUiSettings;
  onFocusItems?: () => void;
}

type HeaderField =
  | "saleType"
  | "transactionType"
  | "customer"
  | "saleDate"
  | "saleTime"
  | "entryDate"
  | "department"
  | "debitAccount"
  | "natureOfEntry"
  | "headerDiscount";

const labelCls =
  "mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600";
const inputBase =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 shadow-sm outline-none transition focus:border-[#20b7ff] focus:ring-2 focus:ring-[#20b7ff]/15";

export default function BillDetailsSection({
  header,
  setHeader,
  customers,
  setShowCustomerModal,
  subTotal,
  grandTotal,
  onSave,
  onCancel,
  entryNo,
  billNoPreview,
  offerSavings = 0,
  requireCustomer,
  isEditing = false,
  isOpen,
  onToggle,
  transactionTypes,
  uiSettings = DEFAULT_SALES_UI_SETTINGS,
  onFocusItems,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayBillNo = isEditing
    ? header.billNo || ""
    : billNoPreview || header.billNo || "";

  const headerFields = useMemo<HeaderField[]>(() => {
    const fields: HeaderField[] = ["saleType"];
    if (uiSettings.showTransactionType && transactionTypes.length > 0)
      fields.push("transactionType");
    fields.push("customer", "saleDate");
    if (uiSettings.showSaleTime) fields.push("saleTime");
    if (uiSettings.showEntryDate) fields.push("entryDate");
    if (uiSettings.showDepartment) fields.push("department");
    if (uiSettings.showDebitAccount) fields.push("debitAccount");
    if (uiSettings.showNatureOfEntry) fields.push("natureOfEntry");
    if (uiSettings.showHeaderDiscount) fields.push("headerDiscount");
    return fields;
  }, [transactionTypes.length, uiSettings]);

  function keepHeaderFieldVisible(target: HTMLElement) {
    const scrollPanel = scrollRef.current;
    if (!scrollPanel) return;

    const panelRect = scrollPanel.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const safeTop = panelRect.top + 12;
    const safeBottom = panelRect.bottom - 24;

    if (targetRect.top < safeTop) {
      scrollPanel.scrollTop -= safeTop - targetRect.top;
    } else if (targetRect.bottom > safeBottom) {
      scrollPanel.scrollTop += targetRect.bottom - safeBottom;
    }
  }

  function focusHeaderField(field: HeaderField) {
    window.setTimeout(() => {
      const root = sectionRef.current;
      if (!root) return;

      const selector =
        field === "saleType"
          ? '[data-sales-header-focus="saleType"][aria-pressed="true"]'
          : `[data-sales-header-focus="${field}"]`;
      const target = root.querySelector<HTMLElement>(selector);
      if (!target) return;

      target.focus({ preventScroll: true });
      if (target instanceof HTMLInputElement) target.select();

      window.requestAnimationFrame(() => {
        keepHeaderFieldVisible(target);
      });
    }, 0);
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
    const focusTarget = source.closest<HTMLElement>(
      "[data-sales-header-focus]",
    );
    const field = focusTarget?.dataset.salesHeaderFocus as
      HeaderField | undefined;
    if (!field) return;

    const isDropdownTrigger = Boolean(
      source.closest<HTMLElement>('[aria-haspopup="listbox"]'),
    );
    if (isDropdownTrigger && event.key !== "Tab" && !event.shiftKey) return;

    event.preventDefault();
    event.stopPropagation();
    moveHeaderFocus(field, event.shiftKey ? -1 : 1);
  }

  if (!isOpen) {
    return (
      <aside
        className="flex w-11 cursor-pointer select-none flex-col items-center gap-4 border-r border-slate-700 bg-slate-900 py-3 transition-all duration-200"
        onClick={onToggle}
        title="Show Bill Details (Ctrl+\)"
      >
        <ChevronRight className="h-4 w-4 shrink-0 text-white/70" />
        <span
          className="text-[10px] font-semibold uppercase tracking-widest text-white/60"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Bill Details
        </span>
        {requireCustomer && !header.customer ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-rose-400"
            title="Customer required"
          />
        ) : null}
      </aside>
    );
  }

  return (
    <section
      ref={sectionRef}
      onKeyDownCapture={handleHeaderKeyDownCapture}
      className="col-span-1 -mt-px flex h-full w-full flex-col overflow-hidden border-r border-slate-200 bg-white shadow-[8px_0_24px_rgba(15,23,42,0.08)] transition-all duration-200 md:max-w-[280px] lg:max-w-[320px]"
    >
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
          <kbd className="hidden rounded border border-white/35 bg-white/20 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-white lg:inline-flex">
            Ctrl+\
          </kbd>
        </div>
        <button
          type="button"
          onClick={onToggle}
          title="Hide Bill Details (Ctrl+\)"
          className="text-white/60 transition-colors hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 overflow-y-auto scroll-smooth"
      >
        <div className="space-y-3 bg-white px-3 pb-4 pt-3">
          <div>
            <label className={labelCls}>
              <Wallet className="h-3 w-3" />
              Sale Type
            </label>
            <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200">
              {(["CASH", "CREDIT"] as const).map((saleType) => (
                <button
                  key={saleType}
                  type="button"
                  data-sales-header-field="saleType"
                  data-sales-header-focus="saleType"
                  aria-pressed={header.saleType === saleType}
                  disabled={saleType === "CREDIT" && !header.customer}
                  title={
                    saleType === "CREDIT" && !header.customer
                      ? "Select a customer to enable CREDIT"
                      : ""
                  }
                  onClick={() =>
                    setHeader((current) => ({ ...current, saleType }))
                  }
                  className={`h-8 text-xs font-semibold transition ${header.saleType === saleType ? "bg-[#1e3a5f] text-white" : "bg-white text-slate-600 hover:bg-slate-50"} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {saleType === "CASH" ? "Cash" : "Credit"}
                </button>
              ))}
            </div>
          </div>

          {uiSettings.showTransactionType && transactionTypes.length > 0 ? (
            <div>
              <label className={labelCls}>
                <Layers className="h-3 w-3" />
                Transaction Type
              </label>
              <CompactDropdown
                value={header.typeId || ""}
                onChange={(value) =>
                  setHeader((current) => ({
                    ...current,
                    typeId: value || null,
                  }))
                }
                onEnter={(direction) =>
                  moveHeaderFocus("transactionType", direction)
                }
                autoOpenOnFocus
                menuPortal
                menuMinWidth={220}
                hideMenuScrollbar
                options={[
                  { value: "", label: "-- None --" },
                  ...transactionTypes.map((type) => ({
                    value: type.id,
                    label: type.name,
                  })),
                ]}
                placeholder="-- None --"
                selectedLabel={
                  transactionTypes.find((type) => type.id === header.typeId)
                    ?.name || "-- None --"
                }
                className="w-full [&_*]:text-xs [&_button]:h-8 [&_button]:px-2"
                menuClassName="text-xs"
                buttonProps={{
                  "data-sales-header-field": "transactionType",
                  "data-sales-header-focus": "transactionType",
                  title: "Enter to open/select, Shift+Enter to move backward",
                }}
              />
            </div>
          ) : null}

          <div>
            <label className={labelCls}>
              <Receipt className="h-3 w-3" />
              Bill No
            </label>
            <input
              id="bill-details-billno"
              className={
                inputBase + " cursor-not-allowed bg-slate-100 text-slate-500"
              }
              value={displayBillNo}
              readOnly
              disabled
              placeholder="Auto generated"
            />
          </div>

          <div data-sales-header-field-wrapper="customer">
            <label className={labelCls}>
              <UserRound className="h-3 w-3" />
              Customer{" "}
              {requireCustomer ? (
                <span className="text-rose-500">*</span>
              ) : null}
            </label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <SearchableDropdown
                  value={header.customer?.id || ""}
                  onChange={(value) => {
                    const customer = customers.find(
                      (item) => item.id === value,
                    );
                    setHeader((current) => ({
                      ...current,
                      customer: customer || null,
                      saleType: customer ? current.saleType : "CASH",
                    }));
                  }}
                  options={[
                    ...(header.customer &&
                    !customers.some((item) => item.id === header.customer?.id)
                      ? [
                          {
                            value: header.customer.id,
                            label: header.customer.name || header.customer.id,
                          },
                        ]
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
                  menuClassName="text-xs"
                  onEnter={(direction) =>
                    moveHeaderFocus("customer", direction)
                  }
                  buttonProps={{
                    "data-sales-header-field": "customer",
                    "data-sales-header-focus": "customer",
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
              <CalendarClock className="h-3 w-3" />
              Sale Date
            </label>
            <div
              className={`grid gap-1.5 ${uiSettings.showSaleTime ? "grid-cols-[1fr_88px]" : "grid-cols-1"}`}
            >
              <input
                className={inputBase}
                type="date"
                data-sales-header-field="saleDate"
                data-sales-header-focus="saleDate"
                value={toLocalDate(header.saleDate)}
                onChange={(event) => {
                  const date = event.target.value;
                  const time = toLocalTime(header.saleDate);
                  setHeader((current) => ({
                    ...current,
                    saleDate: fromDateTime(date, time),
                  }));
                }}
              />
              {uiSettings.showSaleTime ? (
                <input
                  className={inputBase + " px-1"}
                  type="time"
                  data-sales-header-field="saleTime"
                  data-sales-header-focus="saleTime"
                  value={toLocalTime(header.saleDate)}
                  onChange={(event) => {
                    const time = event.target.value;
                    const date = toLocalDate(header.saleDate);
                    setHeader((current) => ({
                      ...current,
                      saleDate: fromDateTime(date, time),
                    }));
                  }}
                />
              ) : null}
            </div>
          </div>

          {uiSettings.showEntryDate ? (
            <div>
              <label className={labelCls}>
                <CalendarClock className="h-3 w-3" />
                Entry Date
              </label>
              <input
                className={inputBase}
                type="date"
                data-sales-header-field="entryDate"
                data-sales-header-focus="entryDate"
                value={toLocalDate(header.entryTime)}
                onChange={(event) => {
                  const date = event.target.value;
                  const time = toLocalTime(header.entryTime);
                  setHeader((current) => ({
                    ...current,
                    entryTime: fromDateTime(date, time),
                  }));
                }}
              />
            </div>
          ) : null}

          {uiSettings.showDepartment ? (
            <div>
              <label className={labelCls}>
                <Building2 className="h-3 w-3" />
                Department
              </label>
              <input
                className={inputBase}
                data-sales-header-field="department"
                data-sales-header-focus="department"
                value={header.department}
                onChange={(event) =>
                  setHeader((current) => ({
                    ...current,
                    department: event.target.value,
                  }))
                }
                placeholder="Department"
              />
            </div>
          ) : null}
          {uiSettings.showDebitAccount ? (
            <div>
              <label className={labelCls}>
                <Landmark className="h-3 w-3" />
                Debit Account
              </label>
              <input
                className={inputBase}
                data-sales-header-field="debitAccount"
                data-sales-header-focus="debitAccount"
                value={header.debitAccount}
                onChange={(event) =>
                  setHeader((current) => ({
                    ...current,
                    debitAccount: event.target.value,
                  }))
                }
                placeholder="Debit account"
              />
            </div>
          ) : null}
          {uiSettings.showNatureOfEntry ? (
            <div>
              <label className={labelCls}>
                <FileText className="h-3 w-3" />
                Nature of Entry
              </label>
              <input
                className={inputBase}
                data-sales-header-field="natureOfEntry"
                data-sales-header-focus="natureOfEntry"
                value={header.natureOfEntry}
                onChange={(event) =>
                  setHeader((current) => ({
                    ...current,
                    natureOfEntry: event.target.value,
                  }))
                }
                placeholder="Nature of entry"
              />
            </div>
          ) : null}
          {uiSettings.showHeaderDiscount ? (
            <div>
              <label className={labelCls}>
                <Wallet className="h-3 w-3" />
                Bill Discount
              </label>
              <input
                className={inputBase}
                type="number"
                min={0}
                step="0.01"
                data-sales-header-field="headerDiscount"
                data-sales-header-focus="headerDiscount"
                value={header.discount || 0}
                onChange={(event) =>
                  setHeader((current) => ({
                    ...current,
                    discount: Math.max(
                      0,
                      Math.min(Number(event.target.value || 0), subTotal),
                    ),
                  }))
                }
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
                  ₹ {Number(subTotal).toFixed(2)}
                </span>
              </div>
              {offerSavings > 0 ? (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Offer Savings</span>
                  <span className="font-semibold text-emerald-600">
                    ₹ {Number(offerSavings).toFixed(2)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Bill Discount</span>
                <span className="font-semibold text-rose-500">
                  - ₹ {Number(header.discount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Grand Total
                </span>
                <span className="text-base font-bold text-[#1e3a5f]">
                  ₹ {Number(grandTotal).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white px-3 py-3">
        <button
          type="button"
          onClick={onSave}
          disabled={Boolean(requireCustomer && !header.customer)}
          className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${requireCustomer && !header.customer ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-[#1e3a5f] text-white hover:bg-[#16304f]"}`}
        >
          <Receipt className="h-3.5 w-3.5" />
          {isEditing ? "Update" : "Save"}
          <kbd className="rounded border border-white/30 bg-white/15 px-1 py-0.5 font-mono text-[8px] text-white">
            Ctrl+S
          </kbd>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {isEditing ? "New Bill" : "Clear"}
          <kbd className="ml-1 rounded border border-slate-300 bg-slate-100 px-1 py-0.5 font-mono text-[8px] text-slate-500">
            Ctrl+N
          </kbd>
        </button>
      </div>
    </section>
  );
}
