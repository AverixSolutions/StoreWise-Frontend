// src/components/customers/CustomerFormModal.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import SearchableDropdown from "../ui/SearchableDropdown";

type Customer = {
  id?: string;
  code?: string;
  codeNumber?: number;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  category?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  openingBalance?: number;
  notes?: string;
};

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

  // Derived UI state for opening balance
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
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message?: string;
  }>({ type: null });

  const [distincts, setDistincts] = useState<{
    categories: string[];
    cities: string[];
    states: string[];
  }>({
    categories: [],
    cities: [],
    states: [],
  });

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
      const { categories, cities, states } = await (
        window as any
      ).electronAPI.getCustomerDistincts(licenseId);
      setDistincts({ categories, cities, states });
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

      // Initialize opening balance UI state
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
      // Reset UI state for new customer
      setOpeningSide("they_owe");
      setOpeningAmount(0);

      const licenseId = localStorage.getItem("licenseId") || "demo-license";
      (async () => {
        try {
          const { suggestedCode, nextCodeNumber } = await (
            window as any
          ).electronAPI.peekNextCustomerCode(licenseId);
          setCode(suggestedCode);
          setCodeNumber(nextCodeNumber);
        } catch (error) {
          console.error("Error fetching next customer code:", error);
        }
      })();
    }

    requestAnimationFrame(() => nameRef.current?.focus());
  }, [isOpen, editCustomer]);

  const handleChange = (k: keyof Customer, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const saveCustomer = async (saveAndClose: boolean = false) => {
    setStatus({ type: null });

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

    if (editCustomer?.id) {
      await (window as any).electronAPI.saveCustomer({
        ...payload,
        id: editCustomer.id,
      });
      onSuccess();
      onClose();
      return;
    }

    await (window as any).electronAPI.saveCustomer(payload);
    onSuccess();

    if (saveAndClose) {
      onClose();
      return;
    }

    setStatus({ type: "success", message: "Customer created successfully." });

    const { suggestedCode: nextC, nextCodeNumber: nextN } = await (
      window as any
    ).electronAPI.peekNextCustomerCode(licenseId);
    setCode(nextC);
    setCodeNumber(nextN);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCustomer(false);
    } catch (error: any) {
      console.error("Error saving customer:", error);
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
      console.error("Error saving customer:", error);
      setStatus({
        type: "error",
        message: error?.message || "Failed to save customer. Please try again.",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] shadow-xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-xl font-semibold text-gray-900">
            {editCustomer ? "Edit Customer" : "Add Customer"}
          </h3>
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
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Code
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
                    Customer Name *
                  </label>
                  <input
                    ref={nameRef}
                    required
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                    placeholder="Enter customer name"
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
                      Category
                    </label>
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
                      onKeyDown={(e) => handleKeyDown(e, 4)}
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
                      onKeyDown={(e) => handleKeyDown(e, 5)}
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
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
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
                        onKeyDown={(e) => handleKeyDown(e, 8)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                        placeholder="PIN code"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Tax Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GSTIN
                    </label>
                    <input
                      ref={gstinRef}
                      value={form.gstin || ""}
                      onChange={(e) => handleChange("gstin", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 9)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                      placeholder="GST number"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Financial Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          onClick={() => setOpeningSide("they_owe")}
                          className={`flex-1 px-3 py-2 rounded-md border text-sm transition-colors ${
                            openingSide === "they_owe"
                              ? "bg-averix-red-light text-white border-averix-red-light"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          Customer owes us
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpeningSide("we_owe")}
                          className={`flex-1 px-3 py-2 rounded-md border text-sm transition-colors ${
                            openingSide === "we_owe"
                              ? "bg-averix-red-light text-white border-averix-red-light"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          We owe customer
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
                          onChange={(e) =>
                            setOpeningAmount(
                              Math.max(0, Number(e.target.value || 0)),
                            )
                          }
                          onKeyDown={(e) => handleKeyDown(e, 10)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                          placeholder="0.00"
                        />
                        <p className="text-xs text-gray-500">
                          {openingSide === "they_owe"
                            ? `Will be saved as +₹${(
                                openingAmount || 0
                              ).toFixed(2)} (they owe)`
                            : `Will be saved as -₹${(
                                openingAmount || 0
                              ).toFixed(2)} (we owe)`}
                        </p>
                      </div>
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
                    onKeyDown={(e) => handleKeyDown(e, 11)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent resize-none"
                    placeholder="Additional notes about the customer..."
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

          {editCustomer ? (
            <button
              type="button"
              onClick={() => handleSaveClick(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-averix-red-dark hover:bg-averix-red-darker rounded-md transition-colors"
            >
              Update Customer
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleSaveClick(true)}
                className="px-4 py-2 text-sm font-medium text-averix-red-dark bg-white border border-averix-red-dark hover:bg-averix-red-light/10 rounded-md transition-colors"
              >
                Save & Close
              </button>
              <button
                type="button"
                onClick={() => handleSaveClick(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-averix-red-dark hover:bg-averix-red-darker rounded-md transition-colors"
              >
                Save & Add Another
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
