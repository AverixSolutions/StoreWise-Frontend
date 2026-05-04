// src/components/suppliers/SupplierFormModal.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import SearchableDropdown from "../ui/SearchableDropdown";
import SupplierLedgerModal from "../ledger/SupplierLedgerModal";
import { platform } from "@/platform";
import { webCreateSupplier, webUpdateSupplier } from "@/platform/web/suppliers";

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

// Shared input className for all text inputs
const inputCls =
  "w-full px-3 py-2 rounded-md text-sm " +
  "bg-[var(--kyn-surface-3)] border border-[var(--kyn-border)] " +
  "text-[var(--kyn-text)] placeholder:text-[var(--kyn-text-muted)] " +
  "focus:outline-none focus:border-[var(--kyn-primary)] focus:ring-1 focus:ring-[var(--kyn-glow-primary)] " +
  "transition-all duration-150";

const inputDisabledCls =
  "w-full px-3 py-2 rounded-md text-sm " +
  "bg-[var(--kyn-surface)] border border-[var(--kyn-border)] " +
  "text-[var(--kyn-text-muted)] " +
  "cursor-not-allowed";

const labelCls =
  "block text-xs font-medium text-[var(--kyn-text-muted)] mb-1 uppercase tracking-wide";

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

  const handleChange = (k: keyof Supplier, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (
    e: React.FormEvent,
    saveAndClose: boolean = false,
  ) => {
    e.preventDefault();
    setStatus({ type: null });

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
        if ((window as any).electronAPI) {
          await (window as any).electronAPI.updateSupplier(
            editSupplier.id,
            payload,
          );
        } else {
          await webUpdateSupplier(editSupplier.id, payload);
        }
        onSuccess();
        onClose();
      } else {
        if ((window as any).electronAPI) {
          await (window as any).electronAPI.createSupplier(payload);
        } else {
          await webCreateSupplier(payload);
        }
        onSuccess();

        if (saveAndClose) {
          onClose();
        } else {
          setStatus({
            type: "success",
            message: "Supplier created successfully.",
          });
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
        }
      }
    } catch (error: any) {
      console.error("Error saving supplier:", error);
      setStatus({
        type: "error",
        message: error?.message || "Failed to save supplier. Please try again.",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden"
        style={{
          background: "var(--kyn-surface)",
          border: "1px solid var(--kyn-border)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.6), 0 0 40px var(--kyn-glow-primary)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex-shrink-0 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--kyn-border)" }}
        >
          <h3 className="text-base font-semibold text-[var(--kyn-text)]">
            {editSupplier ? "Edit Supplier" : "Add Supplier"}
          </h3>
          <div className="flex items-center gap-2">
            {editSupplier?.id && (
              <button
                type="button"
                onClick={() => setLedgerOpen(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(32,183,255,0.15), rgba(176,38,255,0.12))",
                  border: "1px solid var(--kyn-border)",
                  color: "var(--kyn-primary)",
                }}
              >
                Open Ledger
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--kyn-text-muted)] hover:text-[var(--kyn-text)] hover:bg-[var(--kyn-surface-3)] transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status banners */}
        {status.type && (
          <div className="px-6 pt-3">
            {status.type === "success" && (
              <div
                className="rounded-md px-3 py-2 text-sm flex items-center gap-2"
                style={{
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  color: "var(--kyn-success)",
                }}
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
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
              <div
                className="rounded-md px-3 py-2 text-sm flex items-center gap-2"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "var(--kyn-danger)",
                }}
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <form onSubmit={(e) => handleSubmit(e)} className="p-6 space-y-8">
            {/* Code + Name hero row */}
            <div
              className="p-4 rounded-lg"
              style={{
                background: "var(--kyn-surface-2)",
                border: "1px solid var(--kyn-border)",
              }}
            >
              <div className="flex items-end gap-4">
                <div>
                  <label className={labelCls}>Supplier Code</label>
                  <input
                    type="text"
                    value={code}
                    readOnly
                    className={inputDisabledCls + " w-32 font-mono"}
                  />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>
                    Supplier Name{" "}
                    <span className="text-[var(--kyn-primary)]">*</span>
                  </label>
                  <input
                    ref={nameRef}
                    required
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 0)}
                    className={inputCls}
                    placeholder="Enter supplier name"
                  />
                </div>
              </div>
            </div>

            {/* Section: Basic Information */}
            <Section title="Basic Information">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            </Section>

            {/* Section: Address */}
            <Section title="Address Information">
              <div className="grid grid-cols-1 gap-4">
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </Section>

            {/* Section: Legal & Tax */}
            <Section title="Legal & Tax Information">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            </Section>

            {/* Section: Financial */}
            <Section title="Financial Information">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Opening Balance */}
                <div className="space-y-3">
                  <label className={labelCls}>Opening Balance</label>
                  <div className="flex gap-2">
                    {(["we_owe", "they_owe"] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setOpeningSide(side)}
                        className="flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150"
                        style={
                          openingSide === side
                            ? {
                                background:
                                  "linear-gradient(135deg, rgba(32,183,255,0.2), rgba(176,38,255,0.15))",
                                border: "1px solid var(--kyn-primary)",
                                color: "var(--kyn-primary)",
                              }
                            : {
                                background: "var(--kyn-surface-3)",
                                border: "1px solid var(--kyn-border)",
                                color: "var(--kyn-text-muted)",
                              }
                        }
                      >
                        {side === "we_owe"
                          ? "We owe supplier"
                          : "Supplier owes us"}
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
                    <p
                      className="text-xs"
                      style={{ color: "var(--kyn-warning)" }}
                    >
                      Opening balance is locked after supplier creation.
                    </p>
                  )}
                  <p className="text-xs text-[var(--kyn-text-muted)]">
                    {openingSide === "we_owe"
                      ? `Saved as +₹${(openingAmount || 0).toFixed(2)} (we owe)`
                      : `Saved as -₹${(openingAmount || 0).toFixed(2)} (they owe)`}
                  </p>
                </div>

                {/* Credit Limit */}
                <div className="space-y-3">
                  <label className={labelCls}>Credit Limit</label>
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
                      style={{ accentColor: "var(--kyn-primary)" }}
                    />
                    <span className="text-sm text-[var(--kyn-text-soft)]">
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
                  <p className="text-xs text-[var(--kyn-text-muted)]">
                    Max outstanding comfortable with this supplier.
                  </p>
                </div>

                {/* Settlement Days */}
                <div className="space-y-3">
                  <label className={labelCls}>Settlement Days</label>
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
                  <p className="text-xs text-[var(--kyn-text-muted)]">
                    Expected days to pay invoices.
                  </p>
                </div>
              </div>
            </Section>

            {/* Section: Notes */}
            <Section title="Additional Information">
              <Field label="Notes">
                <textarea
                  ref={notesRef}
                  value={form.notes || ""}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 20)}
                  rows={3}
                  className={inputCls + " resize-none"}
                  placeholder="Additional notes about the supplier..."
                />
              </Field>
            </Section>
          </form>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-end gap-3 flex-shrink-0"
          style={{ borderTop: "1px solid var(--kyn-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md transition-all duration-150"
            style={{
              background: "var(--kyn-surface-3)",
              border: "1px solid var(--kyn-border)",
              color: "var(--kyn-text-muted)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--kyn-text)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--kyn-text-muted)")
            }
          >
            Cancel
          </button>

          {editSupplier ? (
            <button
              type="submit"
              onClick={(e) => handleSubmit(e)}
              className="px-4 py-2 text-sm font-medium rounded-md transition-all duration-150"
              style={{
                background:
                  "linear-gradient(135deg, var(--kyn-primary), var(--kyn-secondary))",
                color: "var(--kyn-white)",
                boxShadow: "0 0 16px var(--kyn-glow-primary)",
              }}
            >
              Update Supplier
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="px-4 py-2 text-sm font-medium rounded-md transition-all duration-150"
                style={{
                  background: "var(--kyn-surface-3)",
                  border: "1px solid var(--kyn-primary)",
                  color: "var(--kyn-primary)",
                }}
              >
                Save & Close
              </button>
              <button
                type="submit"
                onClick={(e) => handleSubmit(e)}
                className="px-4 py-2 text-sm font-medium rounded-md transition-all duration-150"
                style={{
                  background:
                    "linear-gradient(135deg, var(--kyn-primary), var(--kyn-secondary))",
                  color: "var(--kyn-white)",
                  boxShadow: "0 0 16px var(--kyn-glow-primary)",
                }}
              >
                Save & Add Another
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

// ── Small layout helpers ────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4
        className="text-xs font-semibold uppercase tracking-widest mb-4 pb-2"
        style={{
          color: "var(--kyn-text-muted)",
          borderBottom: "1px solid var(--kyn-border)",
        }}
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-xs font-medium uppercase tracking-wide mb-1"
        style={{ color: "var(--kyn-text-muted)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
