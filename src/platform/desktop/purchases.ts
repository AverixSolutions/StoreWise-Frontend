// src/platform/desktop/purchases.ts
import type {
  PurchaseCreatePayload,
  PurchaseItemInput,
  CreatePurchaseResult,
  PurchaseUpdatePayload,
  MutationResult,
  PurchaseListFilters,
  PurchaseListResult,
  PurchaseFullResult,
  SlNoResult,
  HoldNoResult,
  PurchaseHoldSavePayload,
  PurchaseHoldSaveResult,
  PurchaseHoldsListResult,
  PurchaseHoldGetResult,
  SupplierListFilters,
  SupplierListResult,
  BulkPriceUpdate,
  Pagination,
} from "../types";

function api() {
  if (typeof window === "undefined" || !window.electronAPI) {
    throw new Error("Electron API is not available in this runtime");
  }
  return window.electronAPI as any;
}

export async function desktopCreatePurchase(
  purchase: PurchaseCreatePayload,
  items: PurchaseItemInput[],
): Promise<CreatePurchaseResult> {
  return api().createPurchase(purchase, items);
}

export async function desktopUpdatePurchase(
  payload: PurchaseUpdatePayload,
): Promise<MutationResult> {
  return api().updatePurchase(payload);
}

export async function desktopDeletePurchase(
  id: string,
): Promise<MutationResult & { deletedAt?: string }> {
  return api().deletePurchase(id);
}

export async function desktopListPurchases(
  licenseId: string,
  filters?: PurchaseListFilters,
): Promise<PurchaseListResult> {
  return api().listPurchases(licenseId, filters ?? {});
}

export async function desktopGetPurchaseFull(
  id: string,
): Promise<PurchaseFullResult> {
  return api().getPurchaseFull(id);
}

export async function desktopPeekNextPurchaseSlNo(
  licenseId: string,
): Promise<SlNoResult> {
  return api().getNextPurchaseSlNo(licenseId);
}

export async function desktopSavePurchaseHold(
  payload: PurchaseHoldSavePayload,
): Promise<PurchaseHoldSaveResult> {
  return api().savePurchaseHold(payload);
}

export async function desktopListPurchaseHolds(
  licenseId: string,
  pagination?: Pagination,
): Promise<PurchaseHoldsListResult> {
  return api().listPurchaseHolds(licenseId, pagination ?? {});
}

export async function desktopGetPurchaseHold(
  id: string,
): Promise<PurchaseHoldGetResult> {
  return api().getPurchaseHold(id);
}

export async function desktopDeletePurchaseHold(
  id: string,
): Promise<MutationResult> {
  return api().deletePurchaseHold(id);
}

export async function desktopPeekNextHoldNo(
  licenseId: string,
): Promise<HoldNoResult> {
  return api().getNextHoldNo(licenseId);
}

export async function desktopListSuppliers(
  licenseId: string,
  filters?: SupplierListFilters,
): Promise<SupplierListResult> {
  const res = await api().listSuppliers(licenseId, {
    q: filters?.q ?? "",
    page: filters?.page ?? 1,
    pageSize: filters?.pageSize ?? 100,
  });
  return {
    suppliers: (res?.suppliers ?? []).map((s: any) => ({
      id: s.id,
      licenseId: s.licenseId ?? licenseId,
      name: s.name,
      phone: s.phone ?? null,
      email: s.email ?? null,
      gstin: s.gstin ?? null,
      code: s.code ?? null,
      codeNumber: s.codeNumber,
      category: s.category ?? null,
      addressLine1: s.addressLine1 ?? null,
      addressLine2: s.addressLine2 ?? null,
      city: s.city ?? null,
      state: s.state ?? null,
      pincode: s.pincode ?? null,
      openingBalance: s.openingBalance ?? 0,
      notes: s.notes ?? null,
      settlementDays: s.settlementDays ?? null,
      creditLimit: s.creditLimit ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      deletedAt: s.deletedAt ?? null,
    })),
    total: res?.total ?? 0,
  };
}

export async function desktopBulkUpdateProductPrices(
  updates: BulkPriceUpdate[],
): Promise<MutationResult> {
  return api().bulkUpdateProductPrices(updates);
}
