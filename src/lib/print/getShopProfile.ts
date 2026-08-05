// src/lib/print/getShopProfile.ts
import { platform } from "@/platform";

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

function cleanString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function resolveLogoUrl(settings: Record<string, any>): string | null {
  // Desktop stores the image as base64 data URL.
  // Web stores the image as a real public URL.
  const logoDataUrl = cleanString(settings.logoDataUrl);
  const logoUrl = cleanString(settings.logoUrl);

  if (logoDataUrl) return logoDataUrl;
  if (logoUrl) return logoUrl;

  return null;
}

export async function getShopProfile(
  licenseIdOverride?: string,
): Promise<ShopProfile> {
  if (typeof window === "undefined") return { name: "My Shop" };

  const licenseId =
    cleanString(licenseIdOverride) ||
    cleanString(localStorage.getItem("licenseId")) ||
    "demo-license";
  const isDesktop = !!(window as any).electronAPI;

  let s: Record<string, any> = {};

  try {
    if (isDesktop) {
      const res = await (window as any).electronAPI.getShopSettings(licenseId);
      s = res?.settings || {};
    } else {
      const res = await platform.getShopSettings(licenseId);
      s = res?.settings || {};
    }
  } catch (err) {
    console.error("[print] failed to load shop profile", err);
    s = {};
  }

  return {
    name: cleanString(s.shopName) || "My Shop",
    logoUrl: resolveLogoUrl(s),
    addressLine1: cleanString(s.addressLine1),
    addressLine2: cleanString(s.addressLine2),
    city: cleanString(s.city),
    state: cleanString(s.state),
    pincode: cleanString(s.pincode),
    mobile: cleanString(s.mobile),
    email: cleanString(s.email),
    gstin: cleanString(s.gstin),
    footerNote: cleanString(s.footerNote),
    authorizedSignatory:
      cleanString(s.authorizedSignatory) || "Authorized Signatory",
  };
}
