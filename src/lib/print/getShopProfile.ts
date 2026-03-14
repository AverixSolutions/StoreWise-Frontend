// src/lib/print/getShopProfile.ts
export type ShopProfile = {
  name: string;
  logoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  mobile?: string | null;
  email?: string | null;
  gstin?: string | null;
  footerNote?: string | null;
  authorizedSignatory?: string | null;
};

export async function getShopProfile(): Promise<ShopProfile> {
  if (typeof window === "undefined") {
    return { name: "My Shop" };
  }

  const licenseId = localStorage.getItem("licenseId") || "demo-license";
  const api = (window as any).electronAPI;

  if (!api?.getShopSettings) {
    return { name: "My Shop" };
  }

  const res = await api.getShopSettings(licenseId);
  const s = res?.settings || {};

  return {
    name: s.shopName || "My Shop",
    logoUrl: s.logoDataUrl || null,
    addressLine1: s.addressLine1 || null,
    addressLine2: s.addressLine2 || null,
    city: s.city || null,
    state: s.state || null,
    pincode: s.pincode || null,
    mobile: s.mobile || null,
    email: s.email || null,
    gstin: s.gstin || null,
    footerNote: s.footerNote || null,
    authorizedSignatory: s.authorizedSignatory || "Authorized Signature",
  };
}
