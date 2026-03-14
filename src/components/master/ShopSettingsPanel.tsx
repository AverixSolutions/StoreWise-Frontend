// src/components/master/ShopSettingsPanel.tsx
"use client";

import { useEffect, useState } from "react";

type FormState = {
  shopName: string;
  logoDataUrl: string | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  mobile: string;
  email: string;
  gstin: string;
  footerNote: string;
  authorizedSignatory: string;
};

const initialState: FormState = {
  shopName: "",
  logoDataUrl: null,
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  mobile: "",
  email: "",
  gstin: "",
  footerNote: "",
  authorizedSignatory: "Authorized Signature",
};

export default function ShopSettingsPanel() {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const licenseId =
    typeof window !== "undefined"
      ? localStorage.getItem("licenseId") || "demo-license"
      : "demo-license";

  useEffect(() => {
    (async () => {
      try {
        const res = await (window as any).electronAPI.getShopSettings(
          licenseId,
        );

        if (res?.success && res.settings) {
          setForm({
            shopName: res.settings.shopName || "",
            logoDataUrl: res.settings.logoDataUrl || null,
            addressLine1: res.settings.addressLine1 || "",
            addressLine2: res.settings.addressLine2 || "",
            city: res.settings.city || "",
            state: res.settings.state || "",
            pincode: res.settings.pincode || "",
            mobile: res.settings.mobile || "",
            email: res.settings.email || "",
            gstin: res.settings.gstin || "",
            footerNote: res.settings.footerNote || "",
            authorizedSignatory:
              res.settings.authorizedSignatory || "Authorized Signature",
          });
        }
      } catch (err) {
        console.error("Failed to load shop settings", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [licenseId]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLogoChange(file: File | null) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setField("logoDataUrl", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.shopName.trim()) {
      alert("Shop name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await (window as any).electronAPI.saveShopSettings({
        licenseId,
        ...form,
      });

      if (res?.success) {
        alert("Shop settings saved successfully");
      } else {
        alert(res?.error || "Failed to save shop settings");
      }
    } catch (err: any) {
      alert(String(err?.message || err || "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-gray-600">Loading shop settings...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Shop Settings</h2>
        <p className="text-sm text-gray-600 mt-1">
          These details will be used in invoice printing and business identity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Shop Name
          </label>
          <input
            type="text"
            value={form.shopName}
            onChange={(e) => setField("shopName", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Enter shop name"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 1
          </label>
          <input
            type="text"
            value={form.addressLine1}
            onChange={(e) => setField("addressLine1", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Address line 1"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 2
          </label>
          <input
            type="text"
            value={form.addressLine2}
            onChange={(e) => setField("addressLine2", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Address line 2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setField("city", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="City"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            State
          </label>
          <input
            type="text"
            value={form.state}
            onChange={(e) => setField("state", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="State"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pincode
          </label>
          <input
            type="text"
            value={form.pincode}
            onChange={(e) => setField("pincode", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Pincode"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mobile
          </label>
          <input
            type="text"
            value={form.mobile}
            onChange={(e) => setField("mobile", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Mobile number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="text"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GSTIN
          </label>
          <input
            type="text"
            value={form.gstin}
            onChange={(e) => setField("gstin", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="GSTIN"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Authorized Signatory Label
          </label>
          <input
            type="text"
            value={form.authorizedSignatory}
            onChange={(e) => setField("authorizedSignatory", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Authorized Signature"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Footer Note / Terms
          </label>
          <textarea
            value={form.footerNote}
            onChange={(e) => setField("footerNote", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 min-h-[100px] outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Thank you for your business..."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Shop Logo
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleLogoChange(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-700"
          />
          {form.logoDataUrl && (
            <div className="mt-4 border border-gray-200 rounded-lg p-4 inline-block bg-gray-50">
              <img
                src={form.logoDataUrl}
                alt="Logo Preview"
                className="h-24 object-contain"
              />
            </div>
          )}
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-white font-medium hover:bg-orange-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Shop Settings"}
        </button>
      </div>
    </div>
  );
}
