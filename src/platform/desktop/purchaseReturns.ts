//src/platform/desktop/purchaseReturns.ts
import type {
  PurchaseReturnCreatePayload,
  PurchaseReturnItemInput,
  CreatePurchaseReturnResult,
  PurchaseReturnUpdatePayload,
  MutationResult,
  PurchaseReturnListFilters,
  PurchaseReturnListResult,
  PurchaseReturnFullResult,
  SlNoResult,
  Pagination,
  PurchaseReturnHoldSavePayload,
  PurchaseReturnHoldSaveResult,
  PurchaseReturnHoldsListResult,
  PurchaseReturnHoldGetResult,
} from "../types";

function api() {
  if (typeof window === "undefined" || !window.electronAPI) {
    throw new Error("Electron API is not available in this runtime");
  }
  return window.electronAPI as any;
}

export async function desktopCreatePurchaseReturn(payload: {
  header: PurchaseReturnCreatePayload;
  items: PurchaseReturnItemInput[];
}): Promise<CreatePurchaseReturnResult> {
  return api().createPurchaseReturn(payload);
}

export async function desktopUpdatePurchaseReturn(
  payload: PurchaseReturnUpdatePayload,
): Promise<MutationResult & { returnId?: string; totalAmount?: number }> {
  return api().updatePurchaseReturn(payload);
}

export async function desktopDeletePurchaseReturn(
  id: string,
): Promise<MutationResult & { deletedAt?: string }> {
  return api().deletePurchaseReturn(id);
}

export async function desktopListPurchaseReturns(
  licenseId: string,
  filters?: PurchaseReturnListFilters,
): Promise<PurchaseReturnListResult> {
  // Convert null → undefined for optional string fields
  const cleanFilters = filters
    ? {
        q: filters.q,
        supplierId: filters.supplierId ?? undefined,
        dateFrom: filters.dateFrom ?? undefined,
        dateTo: filters.dateTo ?? undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      }
    : undefined;
  return api().listPurchaseReturns(licenseId, cleanFilters);
}

export async function desktopGetPurchaseReturnFull(
  id: string,
): Promise<PurchaseReturnFullResult> {
  return api().getPurchaseReturnFull(id);
}

export async function desktopPeekNextPurchaseReturnSlNo(
  licenseId: string,
): Promise<SlNoResult> {
  return api().getNextPurchaseReturnSlNo(licenseId);
}

export async function desktopSavePurchaseReturnHold(
  payload: PurchaseReturnHoldSavePayload,
): Promise<PurchaseReturnHoldSaveResult> {
  return api().savePurchaseReturnHold(payload);
}

export async function desktopListPurchaseReturnHolds(
  licenseId: string,
  pagination?: Pagination,
): Promise<PurchaseReturnHoldsListResult> {
  return api().listPurchaseReturnHolds(licenseId, pagination ?? {});
}

export async function desktopGetPurchaseReturnHold(
  id: string,
): Promise<PurchaseReturnHoldGetResult> {
  return api().getPurchaseReturnHold(id);
}

export async function desktopDeletePurchaseReturnHold(
  id: string,
): Promise<MutationResult> {
  return api().deletePurchaseReturnHold(id);
}
