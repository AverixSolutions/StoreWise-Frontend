// src/platform/desktop/quotations.ts
import type {
  QuotationCreatePayload,
  QuotationItemInput,
  CreateQuotationResult,
  QuotationUpdatePayload,
  MutationResult,
  QuotationListFilters,
  QuotationListResult,
  QuotationFullResult,
  ConvertQuotationResult,
} from "../types";

function api() {
  if (typeof window === "undefined" || !window.electronAPI) {
    throw new Error("Electron API is not available in this runtime");
  }
  return window.electronAPI as any;
}

export async function desktopCreateQuotation(
  header: QuotationCreatePayload,
  items: QuotationItemInput[],
): Promise<CreateQuotationResult> {
  return api().createQuotation(header, items);
}

export async function desktopUpdateQuotation(
  payload: QuotationUpdatePayload,
): Promise<MutationResult> {
  return api().updateQuotation(payload);
}

export async function desktopDeleteQuotation(
  id: string,
): Promise<MutationResult & { deletedAt?: string }> {
  return api().deleteQuotation(id);
}

export async function desktopListQuotations(
  licenseId: string,
  filters?: QuotationListFilters,
): Promise<QuotationListResult> {
  return api().listQuotations(licenseId, filters ?? {});
}

export async function desktopGetQuotationFull(
  id: string,
): Promise<QuotationFullResult> {
  return api().getQuotation(id);
}

export async function desktopPeekNextQuotationSlNo(
  licenseId: string,
): Promise<{ nextSlNo: number; nextQuotationNo: string }> {
  return api().peekNextQuotationSlNo(licenseId);
}

export async function desktopConvertQuotationToSale(
  quotationId: string,
  overrides?: { billNo?: string | null; saleType?: "CASH" | "CREDIT"; saleDate?: string },
): Promise<ConvertQuotationResult> {
  return api().convertQuotationToSale(quotationId, overrides ?? {});
}
