// src/platform/desktop/sales.ts
import type {
  SaleCreatePayload,
  SaleItemInput,
  CreateSaleResult,
  SaleUpdatePayload,
  MutationResult,
  SaleListFilters,
  SaleListResult,
  SaleFullResult,
  SlNoResult,
  SaleHoldSavePayload,
  SaleHoldSaveResult,
  SaleHoldsListResult,
  SaleHoldGetResult,
  CustomerListFilters,
  CustomerListResult,
  Pagination,
} from "../types";

function api() {
  if (typeof window === "undefined" || !window.electronAPI) {
    throw new Error("Electron API is not available in this runtime");
  }
  return window.electronAPI as any;
}

// ── Sales (unchanged — these already work correctly) ──────────────────────────

export async function desktopCreateSale(
  sale: SaleCreatePayload,
  items: SaleItemInput[],
): Promise<CreateSaleResult> {
  return api().createSale(sale, items);
}

export async function desktopUpdateSale(
  payload: SaleUpdatePayload,
): Promise<MutationResult> {
  return api().updateSale(payload);
}

export async function desktopDeleteSale(
  id: string,
): Promise<MutationResult & { deletedAt?: string }> {
  return api().deleteSale(id);
}

export async function desktopListSales(
  licenseId: string,
  filters?: SaleListFilters,
): Promise<SaleListResult> {
  return api().listSales(licenseId, filters ?? {});
}

export async function desktopGetSaleFull(id: string): Promise<SaleFullResult> {
  return api().getSaleFull(id);
}

export async function desktopPeekNextSaleSlNo(
  licenseId: string,
): Promise<SlNoResult> {
  return api().getNextSaleSlNo(licenseId);
}

// ── Holds — SQLite-only (sync adapter handles push/pull) ─────────────────────

export async function desktopSaveSaleHold(
  payload: SaleHoldSavePayload,
): Promise<SaleHoldSaveResult> {
  return api().saveSaleHold(payload);
}

export async function desktopListSaleHolds(
  licenseId: string,
  pagination?: Pagination,
): Promise<SaleHoldsListResult> {
  return api().listSaleHolds(licenseId, pagination ?? {});
}

export async function desktopGetSaleHold(
  id: string,
): Promise<SaleHoldGetResult> {
  return api().getSaleHold(id);
}

export async function desktopDeleteSaleHold(
  id: string,
): Promise<MutationResult> {
  return api().deleteSaleHold(id);
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function desktopListCustomers(
  licenseId: string,
  filters?: CustomerListFilters,
): Promise<CustomerListResult> {
  const res = await api().listCustomers(licenseId, {
    q: filters?.q ?? "",
    page: filters?.page ?? 1,
    pageSize: filters?.pageSize ?? 100,
  });
  return {
    customers: (res?.customers ?? []).map((c: any) => ({
      id: c.id,
      licenseId: c.licenseId ?? licenseId,
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      gstin: c.gstin ?? null,
      code: c.code ?? null,
      codeNumber: c.codeNumber,
      addressLine1: c.addressLine1 ?? null,
      addressLine2: c.addressLine2 ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      pincode: c.pincode ?? null,
      openingBalance: c.openingBalance ?? 0,
      notes: c.notes ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      deletedAt: c.deletedAt ?? null,
    })),
    total: res?.total ?? 0,
  };
}
