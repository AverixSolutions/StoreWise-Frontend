// src/platform/desktop/customers.ts

function requireElectronAPI() {
  if (typeof window === "undefined" || !window.electronAPI) {
    throw new Error("Electron API is not available");
  }
  return window.electronAPI;
}

export async function desktopListCustomers(
  licenseId: string,
  filters: any = {},
) {
  return requireElectronAPI().listCustomers(licenseId, filters);
}

export async function desktopGetCustomer(id: string) {
  return requireElectronAPI().getCustomer(id);
}

export async function desktopSaveCustomer(payload: any) {
  return requireElectronAPI().saveCustomer(payload);
}

export async function desktopDeleteCustomer(id: string, licenseId: string) {
  return requireElectronAPI().deleteCustomer(id, licenseId);
}

export async function desktopPeekNextCustomerCode(licenseId: string) {
  return requireElectronAPI().peekNextCustomerCode(licenseId);
}

export async function desktopGetCustomerCount(
  licenseId: string,
  params?: { q?: string },
) {
  return requireElectronAPI().getCustomerCount(licenseId, params);
}

export async function desktopGetCustomerDistincts(licenseId: string) {
  return requireElectronAPI().getCustomerDistincts(licenseId);
}
