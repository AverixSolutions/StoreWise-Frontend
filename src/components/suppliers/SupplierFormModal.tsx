// src/components/suppliers/SupplierFormModal.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import SearchableDropdown from "../ui/SearchableDropdown";
import SupplierLedgerModal from "../ledger/SupplierLedgerModal";

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

  // Derived UI state for opening balance
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

      // Initialize opening balance UI state
      const ob = Number(editSupplier.openingBalance ?? 0);
      setOpeningSide(ob >= 0 ? "we_owe" : "they_owe");
      setOpeningAmount(Math.abs(ob));

      // Initialize credit limit UI state
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

      // Reset UI state for new supplier
      setOpeningSide("we_owe");
      setOpeningAmount(0);
      setHasCreditLimit(false);

      const licenseId = localStorage.getItem("licenseId") || "demo-license";
      (async () => {
        try {
          const { code: c, codeNumber: n } = await (
            window as any
          ).electronAPI.getNextSupplierCode(licenseId);
          setCode(c);
          setCodeNumber(n);
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

    // Calculate signed opening balance from UI state
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
        await (window as any).electronAPI.updateSupplier(
          editSupplier.id,
          payload,
        );
        onSuccess();
        onClose();
      } else {
        await (window as any).electronAPI.createSupplier(payload);
        onSuccess();

        if (saveAndClose) {
          onClose();
        } else {
          setStatus({
            type: "success",
            message: "Supplier created successfully.",
          });

          const { code: nextC, codeNumber: nextN } = await (
            window as any
          ).electronAPI.getNextSupplierCode(licenseId);
          setCode(nextC);
          setCodeNumber(nextN);

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

          // Reset UI state
          setOpeningSide("we_owe");
          setOpeningAmount(0);
          setHasCreditLimit(false);

          await refreshDistincts();
          requestAnimationFrame(() => nameRef.current?.focus());

          setTimeout(() => {
            setStatus({ type: null });
          }, 3000);
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
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] shadow-xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">
            {editSupplier ? "Edit Supplier" : "Add Supplier"}
          </h3>
          {editSupplier?.id && (
            <button
              type="button"
              onClick={() => setLedgerOpen(true)}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              Open Ledger
            </button>
          )}
        </div>

        {status.type && (
          <div className="px-6 mt-3">
            {status.type === "success" && (
              <div className="mb-3 rounded-md bg-green-50 text-green-800 border border-green-200 px-3 py-2 text-sm flex items-center">
                <svg
                  className="w-4 h-4 mr-2 flex-shrink-0"
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
              <div className="mb-3 rounded-md bg-red-50 text-red-800 border border-red-200 px-3 py-2 text-sm flex items-center">
                <svg
                  className="w-4 h-4 mr-2 flex-shrink-0"
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

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <form onSubmit={(e) => handleSubmit(e)} className="p-6">
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    readOnly
                    className="w-32 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm font-mono"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    ref={nameRef}
                    required
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                    placeholder="Enter supplier name"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      ref={phoneRef}
                      value={form.phone || ""}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      ref={emailRef}
                      type="email"
                      value={form.email || ""}
                      onChange={(e) => handleChange("email", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 2)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="Email address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department
                    </label>
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
                          departments: Array.from(
                            new Set([...d.departments, v]),
                          ),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Native
                    </label>
                    <input
                      ref={nativeRef}
                      value={form.native || ""}
                      onChange={(e) => handleChange("native", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 5)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="Native place"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Language
                    </label>
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
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Address Information
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1
                    </label>
                    <input
                      ref={addressLine1Ref}
                      value={form.addressLine1 || ""}
                      onChange={(e) =>
                        handleChange("addressLine1", e.target.value)
                      }
                      onKeyDown={(e) => handleKeyDown(e, 7)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="Street address, building, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 2
                    </label>
                    <input
                      ref={addressLine2Ref}
                      value={form.addressLine2 || ""}
                      onChange={(e) =>
                        handleChange("addressLine2", e.target.value)
                      }
                      onKeyDown={(e) => handleKeyDown(e, 8)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="Apartment, suite, unit, etc."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
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
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
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
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pincode
                      </label>
                      <input
                        ref={pincodeRef}
                        value={form.pincode || ""}
                        onChange={(e) =>
                          handleChange("pincode", e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, 11)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                        placeholder="PIN code"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Legal & Tax Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GSTIN
                    </label>
                    <input
                      ref={gstinRef}
                      value={form.gstin || ""}
                      onChange={(e) => handleChange("gstin", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 12)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="GST number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Aadhaar
                    </label>
                    <input
                      ref={aadhaarRef}
                      value={form.aadhaar || ""}
                      onChange={(e) => handleChange("aadhaar", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 13)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="Aadhaar number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PAN
                    </label>
                    <input
                      ref={panRef}
                      value={form.pan || ""}
                      onChange={(e) => handleChange("pan", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 14)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="PAN number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License 1
                    </label>
                    <input
                      ref={license1Ref}
                      value={form.license1 || ""}
                      onChange={(e) => handleChange("license1", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 15)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="License number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License 2
                    </label>
                    <input
                      ref={license2Ref}
                      value={form.license2 || ""}
                      onChange={(e) => handleChange("license2", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 16)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="Additional license"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Financial Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Opening Balance */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Opening Balance
                    </label>

                    {/* Side selector buttons */}
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setOpeningSide("we_owe")}
                          className={`flex-1 px-3 py-2 rounded-md border text-sm transition-colors ${
                            openingSide === "we_owe"
                              ? "bg-averix-red-light text-white border-averix-red-light"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          We owe supplier
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpeningSide("they_owe")}
                          className={`flex-1 px-3 py-2 rounded-md border text-sm transition-colors ${
                            openingSide === "they_owe"
                              ? "bg-averix-red-light text-white border-averix-red-light"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          Supplier owes us
                        </button>
                      </div>

                      {/* Amount input */}
                      <div className="space-y-2">
                        <input
                          ref={openingBalanceRef}
                          type="number"
                          min={0}
                          step="0.01"
                          value={openingAmount}
                          disabled={!!editSupplier?.id}
                          onChange={(e) =>
                            setOpeningAmount(
                              Math.max(0, Number(e.target.value || 0)),
                            )
                          }
                          onKeyDown={(e) => handleKeyDown(e, 17)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                          placeholder="0.00"
                        />
                        {editSupplier?.id && (
                          <p className="text-xs text-amber-600">
                            Opening balance is locked after supplier creation to
                            keep ledger data consistent.
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          {openingSide === "we_owe"
                            ? `Will be saved as +₹${(
                                openingAmount || 0
                              ).toFixed(2)} (we owe)`
                            : `Will be saved as -₹${(
                                openingAmount || 0
                              ).toFixed(2)} (they owe)`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Credit Limit */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Credit Limit
                    </label>

                    <div className="space-y-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={hasCreditLimit}
                          onChange={(e) => {
                            setHasCreditLimit(e.target.checked);
                            if (!e.target.checked)
                              handleChange("creditLimit", null);
                          }}
                          className="rounded border-gray-300 text-averix-red-light focus:ring-averix-red-light"
                        />
                        <span className="text-sm text-gray-700">
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                          placeholder="0.00"
                        />
                      )}

                      <p className="text-xs text-gray-500">
                        Max outstanding you're comfortable with for this
                        supplier.
                      </p>
                    </div>
                  </div>

                  {/* Settlement Days */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Settlement Days
                    </label>

                    <div className="space-y-2">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                        placeholder="e.g., 30"
                      />
                      <p className="text-xs text-gray-500">
                        Expected days to pay invoices (used for
                        reminders/aging).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Additional Information
                </h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    ref={notesRef}
                    value={form.notes || ""}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 20)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent resize-none"
                    placeholder="Additional notes about the supplier..."
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>

          {editSupplier ? (
            <button
              type="submit"
              onClick={(e) => handleSubmit(e)}
              className="px-4 py-2 text-sm font-medium text-white bg-averix-red-dark hover:bg-averix-red-darker rounded-md transition-colors"
            >
              Update Supplier
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="px-4 py-2 text-sm font-medium text-averix-red-dark bg-white border border-averix-red-dark hover:bg-averix-red-light/10 rounded-md transition-colors"
              >
                Save & Close
              </button>
              <button
                type="submit"
                onClick={(e) => handleSubmit(e)}
                className="px-4 py-2 text-sm font-medium text-white bg-averix-red-dark hover:bg-averix-red-darker rounded-md transition-colors"
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
