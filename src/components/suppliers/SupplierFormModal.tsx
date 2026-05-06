// src/components/suppliers/SupplierFormModal.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { X, Truck, ReceiptIndianRupee } from "lucide-react";
import SearchableDropdown from "../ui/SearchableDropdown";
import SupplierLedgerModal from "../ledger/SupplierLedgerModal";
import { platform } from "@/platform";
import { webCreateSupplier, webUpdateSupplier } from "@/platform/web/suppliers";
import { SyncManager } from "@/sync/SyncManager";
import { isSyncEnabled } from "@/platform/mode";

type Supplier = {
  id?: string;
  code?: string;
  codeNumber?: number;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  department?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  category?: string;
  native?: string;
  language?: string;
  aadhaar?: string;
  pan?: string;
  license1?: string;
  license2?: string;
  settlementDays?: number;
  creditLimit?: number;
  openingBalance?: number;
  notes?: string;
};

// ── Shared input style ────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/15";

const inputDisabledCls =
  "w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-400 outline-none shadow-[0_1px_4px_rgba(0,0,0,0.06)] cursor-not-allowed font-mono";

// ── Section card ──────────────────────────────────────────────────────────────
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
export default function SupplierFormModal({
  isOpen,
  onClose,
  onSuccess,
  editSupplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editSupplier?: Supplier | null;
}) {
  const [form, setForm] = useState<Supplier>({ name: "" });
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [openingSide, setOpeningSide] = useState<"we_owe" | "they_owe">(
    "we_owe",
  );
  const [openingAmount, setOpeningAmount] = useState<number>(0);
  const [hasCreditLimit, setHasCreditLimit] = useState<boolean>(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const departmentRef = useRef<HTMLButtonElement>(null);
  const categoryRef = useRef<HTMLButtonElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);
  const languageRef = useRef<HTMLButtonElement>(null);
  const addressLine1Ref = useRef<HTMLInputElement>(null);
  const addressLine2Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLButtonElement>(null);
  const stateRef = useRef<HTMLButtonElement>(null);
  const pincodeRef = useRef<HTMLInputElement>(null);
  const gstinRef = useRef<HTMLInputElement>(null);
  const aadhaarRef = useRef<HTMLInputElement>(null);
  const panRef = useRef<HTMLInputElement>(null);
  const license1Ref = useRef<HTMLInputElement>(null);
  const license2Ref = useRef<HTMLInputElement>(null);
  const openingBalanceRef = useRef<HTMLInputElement>(null);
  const creditLimitRef = useRef<HTMLInputElement>(null);
  const settlementDaysRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const [code, setCode] = useState<string>("SUP00001");
  const [codeNumber, setCodeNumber] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message?: string;
  }>({ type: null });

  const [distincts, setDistincts] = useState<{
    categories: string[];
    departments: string[];
    cities: string[];
    states: string[];
    languages: string[];
  }>({
    categories: [],
    departments: [],
    cities: [],
    states: [],
    languages: [],
  });

  const inputRefs = [
    nameRef,
    phoneRef,
    emailRef,
    departmentRef,
    categoryRef,
    nativeRef,
    languageRef,
    addressLine1Ref,
    addressLine2Ref,
    cityRef,
    stateRef,
    pincodeRef,
    gstinRef,
    aadhaarRef,
    panRef,
    license1Ref,
    license2Ref,
    openingBalanceRef,
    creditLimitRef,
    settlementDaysRef,
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
      if (!(window as any).electronAPI) return;
      const d = await (window as any).electronAPI.getSupplierDistincts(
        licenseId,
      );
      setDistincts({
        categories: d.categories || [],
        departments: d.departments || [],
        cities: d.cities || [],
        states: d.states || [],
        languages: d.languages || [],
      });
    } catch (e) {
      console.error("supplier distincts failed", e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshDistincts();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setStatus({ type: null });

    if (editSupplier) {
      setForm(editSupplier);
      setCode((editSupplier as any).code || "SUP00001");
      setCodeNumber((editSupplier as any).codeNumber || 1);
      const ob = Number(editSupplier.openingBalance ?? 0);
      setOpeningSide(ob >= 0 ? "we_owe" : "they_owe");
      setOpeningAmount(Math.abs(ob));
      setHasCreditLimit(!!editSupplier.creditLimit);
    } else {
      setForm({
        name: "",
        phone: "",
        email: "",
        gstin: "",
        department: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        pincode: "",
        category: "",
        native: "",
        language: "",
        aadhaar: "",
        pan: "",
        license1: "",
        license2: "",
        settlementDays: undefined,
        creditLimit: undefined,
        notes: "",
      });
      setOpeningSide("we_owe");
      setOpeningAmount(0);
      setHasCreditLimit(false);

      const licenseId = localStorage.getItem("licenseId") || "demo-license";
      (async () => {
        try {
          if ((window as any).electronAPI) {
            const { code: c, codeNumber: n } = await (
              window as any
            ).electronAPI.getNextSupplierCode(licenseId);
            setCode(c);
            setCodeNumber(n);
          }
        } catch (error) {
          console.error("Error fetching next supplier code:", error);
        }
      })();
    }

    requestAnimationFrame(() => nameRef.current?.focus());
  }, [isOpen, editSupplier]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleChange = (k: keyof Supplier, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const saveSupplier = async (saveAndClose = false) => {
    setStatus({ type: null });
    setSaving(true);

    const licenseId = localStorage.getItem("licenseId") || "demo-license";
    const signedOpening =
      openingSide === "we_owe" ? openingAmount : -openingAmount;

    const payload = {
      licenseId,
      code,
      codeNumber,
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      gstin: form.gstin || null,
      department: form.department || null,
      addressLine1: form.addressLine1 || null,
      addressLine2: form.addressLine2 || null,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
      category: form.category || null,
      native: form.native || null,
      language: form.language || null,
      aadhaar: form.aadhaar || null,
      pan: form.pan || null,
      license1: form.license1 || null,
      license2: form.license2 || null,
      settlementDays: form.settlementDays ?? null,
      creditLimit: hasCreditLimit ? (form.creditLimit ?? null) : null,
      openingBalance: signedOpening ?? 0,
      notes: form.notes || null,
    };

    try {
      if (editSupplier?.id) {
        // ── UPDATE ──────────────────────────────────────────────────────────
        if ((window as any).electronAPI) {
          await (window as any).electronAPI.updateSupplier(
            editSupplier.id,
            payload,
          );
        } else {
          await webUpdateSupplier(editSupplier.id, payload);
        }
        // Trigger sync after update
        if (isSyncEnabled()) {
          SyncManager.pushEntity("supplier").catch(() => {});
        }
        onSuccess();
        onClose();
        return;
      }

      // ── CREATE ──────────────────────────────────────────────────────────
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.createSupplier(payload);
      } else {
        await webCreateSupplier(payload);
      }
      // Trigger sync after create
      if (isSyncEnabled()) {
        SyncManager.pushEntity("supplier").catch(() => {});
      }
      onSuccess();

      if (saveAndClose) {
        onClose();
        return;
      }

      setStatus({ type: "success", message: "Supplier created successfully." });

      if ((window as any).electronAPI) {
        const { code: nextC, codeNumber: nextN } = await (
          window as any
        ).electronAPI.getNextSupplierCode(licenseId);
        setCode(nextC);
        setCodeNumber(nextN);
      }

      setForm({
        name: "",
        phone: "",
        email: "",
        gstin: "",
        department: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        pincode: "",
        category: "",
        native: "",
        language: "",
        aadhaar: "",
        pan: "",
        license1: "",
        license2: "",
        settlementDays: undefined,
        creditLimit: undefined,
        notes: "",
      });
      setOpeningSide("we_owe");
      setOpeningAmount(0);
      setHasCreditLimit(false);
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
      await saveSupplier(false);
    } catch (error: any) {
      setStatus({
        type: "error",
        message: error?.message || "Failed to save supplier. Please try again.",
      });
    }
  };

  const handleSaveClick = async (saveAndClose: boolean) => {
    try {
      await saveSupplier(saveAndClose);
    } catch (error: any) {
      setStatus({
        type: "error",
        message: error?.message || "Failed to save supplier. Please try again.",
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
        className="w-full sm:max-w-3xl rounded-t-[24px] sm:rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(3,10,24,0.22)] flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="relative overflow-hidden rounded-t-[24px] bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-5 py-4 text-white shrink-0">
          <div className="pointer-events-none absolute -left-6 top-0 h-16 w-16 rounded-full bg-violet-400/20 blur-2xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full bg-cyan-500/15 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-400/20">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Supplier
                </p>
                <h3 className="text-base font-semibold text-white">
                  {editSupplier
                    ? `Edit — ${editSupplier.name}`
                    : "New Supplier"}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editSupplier?.id && (
                <button
                  type="button"
                  onClick={() => setLedgerOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 cursor-pointer"
                >
                  <ReceiptIndianRupee className="h-3.5 w-3.5" />
                  Ledger
                </button>
              )}
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
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
            {/* Identity */}
            <SectionCard
              icon={Truck}
              title="Identity"
              iconColor="text-violet-300"
            >
              <div className="grid grid-cols-[auto_1fr] gap-4">
                <Field label="Code">
                  <input
                    type="text"
                    value={code}
                    readOnly
                    className={inputDisabledCls + " w-32"}
                  />
                </Field>
                <Field label="Supplier Name *">
                  <input
                    ref={nameRef}
                    required
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 0)}
                    className={inputCls}
                    placeholder="Enter supplier name"
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Basic Information */}
            <SectionCard
              icon={Truck}
              title="Basic Information"
              iconColor="text-cyan-300"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <Field label="Department">
                  <SearchableDropdown
                    ref={departmentRef}
                    value={form.department || ""}
                    onChange={(v) => handleChange("department", v)}
                    onEnter={() => inputRefs[4].current?.focus()}
                    options={distincts.departments.map((d) => ({
                      value: d,
                      label: d,
                    }))}
                    placeholder="Department"
                    allowCustom
                    onCreate={(v) =>
                      setDistincts((d) => ({
                        ...d,
                        departments: Array.from(new Set([...d.departments, v])),
                      }))
                    }
                  />
                </Field>
                <Field label="Category">
                  <SearchableDropdown
                    ref={categoryRef}
                    value={form.category || ""}
                    onChange={(v) => handleChange("category", v)}
                    onEnter={() => inputRefs[5].current?.focus()}
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
                <Field label="Native">
                  <input
                    ref={nativeRef}
                    value={form.native || ""}
                    onChange={(e) => handleChange("native", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 5)}
                    className={inputCls}
                    placeholder="Native place"
                  />
                </Field>
                <Field label="Language">
                  <SearchableDropdown
                    ref={languageRef}
                    value={form.language || ""}
                    onChange={(v) => handleChange("language", v)}
                    onEnter={() => inputRefs[7].current?.focus()}
                    options={distincts.languages.map((l) => ({
                      value: l,
                      label: l,
                    }))}
                    placeholder="Language"
                    allowCustom
                    onCreate={(v) =>
                      setDistincts((d) => ({
                        ...d,
                        languages: Array.from(new Set([...d.languages, v])),
                      }))
                    }
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Address */}
            <SectionCard
              icon={Truck}
              title="Address Information"
              iconColor="text-emerald-300"
            >
              <div className="space-y-4">
                <Field label="Address Line 1">
                  <input
                    ref={addressLine1Ref}
                    value={form.addressLine1 || ""}
                    onChange={(e) =>
                      handleChange("addressLine1", e.target.value)
                    }
                    onKeyDown={(e) => handleKeyDown(e, 7)}
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
                    onKeyDown={(e) => handleKeyDown(e, 8)}
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
                      onEnter={() => inputRefs[10].current?.focus()}
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
                      onEnter={() => inputRefs[11].current?.focus()}
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
                      onKeyDown={(e) => handleKeyDown(e, 11)}
                      className={inputCls}
                      placeholder="PIN code"
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>

            {/* Legal & Tax */}
            <SectionCard
              icon={Truck}
              title="Legal & Tax Information"
              iconColor="text-rose-300"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="GSTIN">
                  <input
                    ref={gstinRef}
                    value={form.gstin || ""}
                    onChange={(e) => handleChange("gstin", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 12)}
                    className={inputCls}
                    placeholder="GST number"
                  />
                </Field>
                <Field label="Aadhaar">
                  <input
                    ref={aadhaarRef}
                    value={form.aadhaar || ""}
                    onChange={(e) => handleChange("aadhaar", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 13)}
                    className={inputCls}
                    placeholder="Aadhaar number"
                  />
                </Field>
                <Field label="PAN">
                  <input
                    ref={panRef}
                    value={form.pan || ""}
                    onChange={(e) => handleChange("pan", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 14)}
                    className={inputCls}
                    placeholder="PAN number"
                  />
                </Field>
                <Field label="License 1">
                  <input
                    ref={license1Ref}
                    value={form.license1 || ""}
                    onChange={(e) => handleChange("license1", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 15)}
                    className={inputCls}
                    placeholder="License number"
                  />
                </Field>
                <Field label="License 2">
                  <input
                    ref={license2Ref}
                    value={form.license2 || ""}
                    onChange={(e) => handleChange("license2", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 16)}
                    className={inputCls}
                    placeholder="Additional license"
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Financial */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Opening Balance */}
              <SectionCard
                icon={Truck}
                title="Opening Balance"
                iconColor="text-amber-300"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                    {(["we_owe", "they_owe"] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setOpeningSide(side)}
                        className={`flex-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all cursor-pointer ${
                          openingSide === side
                            ? "bg-[#1e3a5f] text-white shadow-[0_2px_8px_rgba(15,23,42,0.15)]"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {side === "we_owe" ? "We owe" : "They owe"}
                      </button>
                    ))}
                  </div>
                  <input
                    ref={openingBalanceRef}
                    type="number"
                    min={0}
                    step="0.01"
                    value={openingAmount}
                    disabled={!!editSupplier?.id}
                    onChange={(e) =>
                      setOpeningAmount(Math.max(0, Number(e.target.value || 0)))
                    }
                    onKeyDown={(e) => handleKeyDown(e, 17)}
                    className={editSupplier?.id ? inputDisabledCls : inputCls}
                    placeholder="0.00"
                  />
                  {editSupplier?.id && (
                    <p className="text-[11px] text-amber-600 font-medium">
                      Locked after creation.
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    {openingSide === "we_owe"
                      ? `Saved as +₹${(openingAmount || 0).toFixed(2)}`
                      : `Saved as −₹${(openingAmount || 0).toFixed(2)}`}
                  </p>
                </div>
              </SectionCard>

              {/* Credit Limit */}
              <SectionCard
                icon={Truck}
                title="Credit Limit"
                iconColor="text-cyan-300"
              >
                <div className="space-y-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasCreditLimit}
                      onChange={(e) => {
                        setHasCreditLimit(e.target.checked);
                        if (!e.target.checked)
                          handleChange("creditLimit", null);
                      }}
                      className="rounded"
                      style={{ accentColor: "#1e3a5f" }}
                    />
                    <span className="text-sm text-slate-600 font-medium">
                      Has credit limit
                    </span>
                  </label>
                  {hasCreditLimit && (
                    <input
                      ref={creditLimitRef}
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.creditLimit ?? ""}
                      onChange={(e) =>
                        handleChange(
                          "creditLimit",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      onKeyDown={(e) => handleKeyDown(e, 18)}
                      className={inputCls}
                      placeholder="0.00"
                    />
                  )}
                  <p className="text-[11px] text-slate-400">
                    Max outstanding with this supplier.
                  </p>
                </div>
              </SectionCard>

              {/* Settlement Days */}
              <SectionCard
                icon={Truck}
                title="Settlement Days"
                iconColor="text-violet-300"
              >
                <div className="space-y-3">
                  <input
                    ref={settlementDaysRef}
                    type="number"
                    min={0}
                    value={form.settlementDays ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "settlementDays",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    onKeyDown={(e) => handleKeyDown(e, 19)}
                    className={inputCls}
                    placeholder="e.g., 30"
                  />
                  <p className="text-[11px] text-slate-400">
                    Expected days to pay invoices.
                  </p>
                </div>
              </SectionCard>
            </div>

            {/* Notes */}
            <SectionCard
              icon={Truck}
              title="Additional Notes"
              iconColor="text-slate-400"
            >
              <Field label="Notes">
                <textarea
                  ref={notesRef}
                  value={form.notes || ""}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 20)}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Additional notes about the supplier..."
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

          {editSupplier ? (
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
                "Update Supplier"
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

      {editSupplier?.id && (
        <SupplierLedgerModal
          isOpen={ledgerOpen}
          onClose={() => setLedgerOpen(false)}
          licenseId={localStorage.getItem("licenseId") || "demo-license"}
          supplierId={editSupplier.id}
          supplierName={editSupplier.name}
        />
      )}
    </div>
  );
}
