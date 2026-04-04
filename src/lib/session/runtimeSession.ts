// src/lib/session/runtimeSession.ts
import { getCurrentUser } from "@/hooks/useAuth";

export function getActiveUser() {
  try {
    return getCurrentUser?.() || null;
  } catch {
    return null;
  }
}

export function getActiveLicenseId() {
  const user: any = getActiveUser();

  return (
    user?.licenseId ||
    user?.license?.id ||
    user?.license ||
    user?.userId ||
    user?.id ||
    localStorage.getItem("licenseId") ||
    ""
  );
}

export function getActiveLicenseName() {
  const user: any = getActiveUser();

  return user?.licenseName || user?.shopName || "";
}
