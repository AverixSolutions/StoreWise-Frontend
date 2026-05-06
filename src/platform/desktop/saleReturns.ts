//src/platform/desktop/saleReturns.ts
import type {
  SaleReturnCreatePayload,
  SaleReturnItemInput,
  CreateSaleReturnResult,
  SaleReturnUpdatePayload,
  MutationResult,
  SaleReturnListFilters,
  SaleReturnListResult,
  SaleReturnFullResult,
  SlNoResult,
  Pagination,
  SaleReturnHoldSavePayload,
  SaleReturnHoldSaveResult,
  SaleReturnHoldsListResult,
  SaleReturnHoldGetResult,
} from "../types";

function api() {
  if (typeof window === "undefined" || !window.electronAPI) {
    throw new Error("Electron API is not available in this runtime");
  }
  return window.electronAPI as any;
}

export async function desktopCreateSaleReturn(payload: {
  header: SaleReturnCreatePayload;
  items: SaleReturnItemInput[];
}): Promise<CreateSaleReturnResult> {
  return api().createSaleReturn(payload);
}

export async function desktopUpdateSaleReturn(
  payload: SaleReturnUpdatePayload,
): Promise<MutationResult & { returnId?: string; totalAmount?: number }> {
  return api().updateSaleReturn(payload);
}

export async function desktopDeleteSaleReturn(
  id: string,
): Promise<MutationResult & { deletedAt?: string }> {
  return api().deleteSaleReturn(id);
}

export async function desktopListSaleReturns(
  licenseId: string,
  filters?: SaleReturnListFilters,
): Promise<SaleReturnListResult> {
  const cleanFilters = filters
    ? {
        q: filters.q,
        customerId: filters.customerId ?? undefined,
        dateFrom: filters.dateFrom ?? undefined,
        dateTo: filters.dateTo ?? undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      }
    : undefined;
  return api().listSaleReturns(licenseId, cleanFilters);
}

export async function desktopGetSaleReturnFull(
  id: string,
): Promise<SaleReturnFullResult> {
  return api().getSaleReturnFull(id);
}

export async function desktopPeekNextSaleReturnSlNo(
  licenseId: string,
): Promise<SlNoResult> {
  // preload exposes getNextSaleReturnSlNo → "sale-return:peek-next-slno"
  return api().getNextSaleReturnSlNo(licenseId);
}

// Hold operations are not exposed in preload.js — return stubs

export async function desktopSaveSaleReturnHold(
  _payload: SaleReturnHoldSavePayload,
): Promise<SaleReturnHoldSaveResult> {
  return { success: false, error: "not_supported" };
}

export async function desktopListSaleReturnHolds(
  _licenseId: string,
  _pagination?: Pagination,
): Promise<SaleReturnHoldsListResult> {
  return { holds: [], total: 0 };
}

export async function desktopGetSaleReturnHold(
  _id: string,
): Promise<SaleReturnHoldGetResult> {
  return { success: false, error: "not_supported" };
}

export async function desktopDeleteSaleReturnHold(
  _id: string,
): Promise<MutationResult> {
  return { success: false, error: "not_supported" };
}
