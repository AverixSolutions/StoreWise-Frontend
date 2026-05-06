// src/components/customers/CustomerFormModal.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { X, UserPlus, User } from "lucide-react";
import SearchableDropdown from "../ui/SearchableDropdown";
import { platform } from "@/platform";

type Customer = {
  id?: string;
  code?: string | null;
  codeNumber?: number | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  category?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  openingBalance?: number | null;
  notes?: string | null;
};

// ── Shared input style (mirrors TaxSettings inputCls) ─────────────────────────
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/15";

// ── Section card (dark header strip + light body) ─────────────────────────────
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

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({
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

// ── Main modal ────────────────────────────────────────────────────────────────
export default function CustomerFormModal({
  isOpen,
  onClose,
  onSuccess,
  editCustomer,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editCustomer?: Customer | null;
}) {
  const [form, setForm] = useState<Customer>({ name: "" });
  const [openingSide, setOpeningSide] = useState<"they_owe" | "we_owe">(
    "they_owe",
  );
  const [openingAmount, setOpeningAmount] = useState<number>(0);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLButtonElement>(null);
  const addressLine1Ref = useRef<HTMLInputElement>(null);
  const addressLine2Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLButtonElement>(null);
  const stateRef = useRef<HTMLButtonElement>(null);
  const pincodeRef = useRef<HTMLInputElement>(null);
  const gstinRef = useRef<HTMLInputElement>(null);
  const openingBalanceRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const [code, setCode] = useState<string>("C00001");
  const [codeNumber, setCodeNumber] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message?: string;
  }>({ type: null });

  const [distincts, setDistincts] = useState<{
    categories: string[];
    cities: string[];
    states: string[];
  }>({ categories: [], cities: [], states: [] });

  const inputRefs = [
    nameRef,
    phoneRef,
    emailRef,
    categoryRef,
    addressLine1Ref,
    addressLine2Ref,
    cityRef,
    stateRef,
    pincodeRef,
    gstinRef,
    openingBalanceRef,
    notesRef,
  ];

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    index: number,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        if (index > 0) inputRefs[index - 1].current?.focus();
      } else {
        if (index < inputRefs.length - 1) {
          inputRefs[index + 1].current?.focus();
        } else {
          (document.activeElement as HTMLElement).blur();
          const form = (e.currentTarget as HTMLElement).closest(
            "form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        }
      }
    }
  };

  const refreshDistincts = async () => {
    const licenseId = localStorage.getItem("licenseId") || "demo-license";
    try {
      const res = await platform.getCustomerDistincts?.(licenseId);
      setDistincts({
        categories: res?.categories || [],
        cities: res?.cities || [],
        states: res?.states || [],
      });
    } catch (e) {
      console.error("customer distincts failed", e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshDistincts();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setStatus({ type: null });

    if (editCustomer) {
      setForm(editCustomer);
      setCode((editCustomer as any).code || "C00001");
      setCodeNumber((editCustomer as any).codeNumber || 1);
      const ob = Number(editCustomer.openingBalance ?? 0);
      setOpeningSide(ob >= 0 ? "they_owe" : "we_owe");
      setOpeningAmount(Math.abs(ob));
    } else {
      setForm({
        name: "",
        phone: "",
        email: "",
        gstin: "",
        category: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        pincode: "",
        openingBalance: 0,
        notes: "",
      });
      setOpeningSide("they_owe");
      setOpeningAmount(0);

      const licenseId = localStorage.getItem("licenseId") || "demo-license";
      (async () => {
        try {
          const codeRes = await platform.peekNextCustomerCode?.(licenseId);
          setCode(codeRes?.suggestedCode || "C00001");
          setCodeNumber(codeRes?.nextCodeNumber || 1);
        } catch (error) {
          console.error("Error fetching next customer code:", error);
        }
      })();
    }

    requestAnimationFrame(() => nameRef.current?.focus());
  }, [isOpen, editCustomer]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleChange = (k: keyof Customer, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const saveCustomer = async (saveAndClose: boolean = false) => {
    setStatus({ type: null });
    setSaving(true);

    const licenseId = localStorage.getItem("licenseId") || "demo-license";
    const signedOpening =
      openingSide === "they_owe" ? openingAmount : -openingAmount;

    const payload = {
      licenseId,
      code,
      codeNumber,
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      gstin: form.gstin || null,
      category: form.category || null,
      addressLine1: form.addressLine1 || null,
      addressLine2: form.addressLine2 || null,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
      openingBalance: signedOpening ?? 0,
      notes: form.notes || null,
    };

    try {
      if (editCustomer?.id) {
        await platform.saveCustomer?.({
          ...payload,
          id: editCustomer.id,
        });
        onSuccess();
        onClose();
        return;
      }

      await platform.saveCustomer?.(payload);
      onSuccess();

      if (saveAndClose) {
        onClose();
        return;
      }

      setStatus({ type: "success", message: "Customer created successfully." });

      const nextRes = await platform.peekNextCustomerCode?.(licenseId);
      setCode(nextRes?.suggestedCode || "C00001");
      setCodeNumber(nextRes?.nextCodeNumber || 1);

      setForm({
        name: "",
        phone: "",
        email: "",
        gstin: "",
        category: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        pincode: "",
        openingBalance: 0,
        notes: "",
      });
      setOpeningSide("they_owe");
      setOpeningAmount(0);

      await refreshDistincts();
      requestAnimationFrame(() => nameRef.current?.focus());
      setTimeout(() => setStatus({ type: null }), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCustomer(false);
    } catch (error: any) {
      setStatus({
        type: "error",
        message: error?.message || "Failed to save customer. Please try again.",
      });
    }
  };

  const handleSaveClick = async (saveAndClose: boolean) => {
    try {
      await saveCustomer(saveAndClose);
    } catch (error: any) {
      setStatus({
        type: "error",
        message: error?.message || "Failed to save customer. Please try again.",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl rounded-t-[24px] sm:rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(3,10,24,0.22)] flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="relative overflow-hidden rounded-t-[24px] bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-5 py-4 text-white shrink-0">
          <div className="pointer-events-none absolute -left-6 top-0 h-16 w-16 rounded-full bg-cyan-400/20 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full bg-fuchsia-500/15 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/20">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Customer
                </p>
                <h3 className="text-base font-semibold text-white">
                  {editCustomer
                    ? `Edit — ${editCustomer.name}`
                    : "New Customer"}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Status Banner ── */}
        {status.type && (
          <div className="px-5 pt-4 shrink-0">
            {status.type === "success" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-sm font-medium text-emerald-700 flex items-center gap-2">
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                {status.message}
              </div>
            )}
            {status.type === "error" && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-medium text-rose-700 flex items-center gap-2">
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {status.message}
              </div>
            )}
          </div>
        )}

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Customer Code + Name */}
            <SectionCard icon={User} title="Identity" iconColor="text-cyan-300">
              <div className="grid grid-cols-[auto_1fr] gap-4">
                <Field label="Code">
                  <input
                    type="text"
                    value={code}
                    readOnly
                    className="w-28 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-mono text-slate-500 outline-none shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  />
                </Field>
                <Field label="Customer Name *">
                  <input
                    ref={nameRef}
                    required
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 0)}
                    className={inputCls}
                    placeholder="Enter customer name"
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Basic Information */}
            <SectionCard
              icon={User}
              title="Basic Information"
              iconColor="text-emerald-300"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Phone">
                  <input
                    ref={phoneRef}
                    value={form.phone || ""}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 1)}
                    className={inputCls}
                    placeholder="Phone number"
                  />
                </Field>
                <Field label="Email">
                  <input
                    ref={emailRef}
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => handleChange("email", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 2)}
                    className={inputCls}
                    placeholder="Email address"
                  />
                </Field>
                <Field label="Category">
                  <SearchableDropdown
                    ref={categoryRef}
                    value={form.category || ""}
                    onChange={(v) => handleChange("category", v)}
                    onEnter={() => inputRefs[4].current?.focus()}
                    options={distincts.categories.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                    placeholder="Category"
                    allowCustom
                    onCreate={(v) =>
                      setDistincts((d) => ({
                        ...d,
                        categories: Array.from(new Set([...d.categories, v])),
                      }))
                    }
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Address */}
            <SectionCard
              icon={User}
              title="Address Information"
              iconColor="text-violet-300"
            >
              <div className="space-y-4">
                <Field label="Address Line 1">
                  <input
                    ref={addressLine1Ref}
                    value={form.addressLine1 || ""}
                    onChange={(e) =>
                      handleChange("addressLine1", e.target.value)
                    }
                    onKeyDown={(e) => handleKeyDown(e, 4)}
                    className={inputCls}
                    placeholder="Street address, building, etc."
                  />
                </Field>
                <Field label="Address Line 2">
                  <input
                    ref={addressLine2Ref}
                    value={form.addressLine2 || ""}
                    onChange={(e) =>
                      handleChange("addressLine2", e.target.value)
                    }
                    onKeyDown={(e) => handleKeyDown(e, 5)}
                    className={inputCls}
                    placeholder="Apartment, suite, unit, etc."
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="City">
                    <SearchableDropdown
                      ref={cityRef}
                      value={form.city || ""}
                      onChange={(v) => handleChange("city", v)}
                      onEnter={() => inputRefs[7].current?.focus()}
                      options={distincts.cities.map((c) => ({
                        value: c,
                        label: c,
                      }))}
                      placeholder="City"
                      allowCustom
                      onCreate={(v) =>
                        setDistincts((d) => ({
                          ...d,
                          cities: Array.from(new Set([...d.cities, v])),
                        }))
                      }
                    />
                  </Field>
                  <Field label="State">
                    <SearchableDropdown
                      ref={stateRef}
                      value={form.state || ""}
                      onChange={(v) => handleChange("state", v)}
                      onEnter={() => inputRefs[8].current?.focus()}
                      options={distincts.states.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      placeholder="State"
                      allowCustom
                      onCreate={(v) =>
                        setDistincts((d) => ({
                          ...d,
                          states: Array.from(new Set([...d.states, v])),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Pincode">
                    <input
                      ref={pincodeRef}
                      value={form.pincode || ""}
                      onChange={(e) => handleChange("pincode", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 8)}
                      className={inputCls}
                      placeholder="PIN code"
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>

            {/* Tax + Financial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SectionCard
                icon={User}
                title="Tax Information"
                iconColor="text-rose-300"
              >
                <Field label="GSTIN">
                  <input
                    ref={gstinRef}
                    value={form.gstin || ""}
                    onChange={(e) => handleChange("gstin", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 9)}
                    className={inputCls}
                    placeholder="GST number"
                  />
                </Field>
              </SectionCard>

              <SectionCard
                icon={User}
                title="Opening Balance"
                iconColor="text-amber-300"
              >
                <div className="space-y-3">
                  {/* Side toggle */}
                  <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setOpeningSide("they_owe")}
                      className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        openingSide === "they_owe"
                          ? "bg-[#1e3a5f] text-white shadow-[0_2px_8px_rgba(15,23,42,0.15)]"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      They owe us
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpeningSide("we_owe")}
                      className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        openingSide === "we_owe"
                          ? "bg-[#1e3a5f] text-white shadow-[0_2px_8px_rgba(15,23,42,0.15)]"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      We owe them
                    </button>
                  </div>
                  <input
                    ref={openingBalanceRef}
                    type="number"
                    min={0}
                    step="0.01"
                    value={openingAmount}
                    onChange={(e) =>
                      setOpeningAmount(Math.max(0, Number(e.target.value || 0)))
                    }
                    onKeyDown={(e) => handleKeyDown(e, 10)}
                    className={inputCls}
                    placeholder="0.00"
                  />
                  <p className="text-[11px] text-slate-400">
                    {openingSide === "they_owe"
                      ? `Saved as +₹${(openingAmount || 0).toFixed(2)}`
                      : `Saved as −₹${(openingAmount || 0).toFixed(2)}`}
                  </p>
                </div>
              </SectionCard>
            </div>

            {/* Notes */}
            <SectionCard
              icon={User}
              title="Additional Notes"
              iconColor="text-slate-400"
            >
              <Field label="Notes">
                <textarea
                  ref={notesRef}
                  value={form.notes || ""}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 11)}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Additional notes about the customer..."
                />
              </Field>
            </SectionCard>
          </form>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 py-4 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>

          {editCustomer ? (
            <button
              type="button"
              onClick={() => handleSaveClick(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(32,183,255,0.22)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving…
                </>
              ) : (
                "Update Customer"
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleSaveClick(true)}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
              >
                Save & Close
              </button>
              <button
                type="button"
                onClick={() => handleSaveClick(false)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(32,183,255,0.22)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  "Save & Add Another"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
