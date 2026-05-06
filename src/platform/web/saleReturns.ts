// src/platform/web/saleReturns.ts
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
  SaleReturnHoldSavePayload,
  SaleReturnHoldSaveResult,
  SaleReturnHoldsListResult,
  SaleReturnHoldGetResult,
  Pagination,
} from "../types";
import {
  getActiveToken,
} from "@/lib/session/runtimeSession";

// ── API helper ────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_KYNFLOW_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getActiveToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

// ── READS via API ─────────────────────────────────────────────────────────────

export async function webListSaleReturns(
  licenseId: string,
  filters: SaleReturnListFilters = {},
): Promise<SaleReturnListResult> {
  try {
    const params = new URLSearchParams({ licenseId });
    if (filters.q) params.set("q", filters.q);
    if (filters.customerId) params.set("customerId", filters.customerId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.page != null) params.set("page", String(filters.page));
    if (filters.pageSize != null)
      params.set("pageSize", String(filters.pageSize));
    const data = await apiFetch<any>(
      `/api/sale-returns?${params.toString()}`,
    );
    return { returns: data.returns ?? [], total: data.total ?? 0 };
  } catch {
    return { returns: [], total: 0 };
  }
}

export async function webGetSaleReturnFull(
  id: string,
): Promise<SaleReturnFullResult> {
  try {
    return await apiFetch<SaleReturnFullResult>(`/api/sale-returns/${id}`);
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webPeekNextSaleReturnSlNo(
  licenseId: string,
): Promise<SlNoResult> {
  try {
    const data = await apiFetch<SlNoResult>(
      `/api/sale-returns/next-slno?licenseId=${encodeURIComponent(licenseId)}`,
    );
    return data;
  } catch {
    return { nextSlNo: 1 };
  }
}

// ── WRITES via API ────────────────────────────────────────────────────────────

export async function webCreateSaleReturn(payload: {
  header: SaleReturnCreatePayload;
  items: SaleReturnItemInput[];
}): Promise<CreateSaleReturnResult> {
  try {
    const res = await apiFetch<CreateSaleReturnResult>("/api/sale-returns", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webUpdateSaleReturn(
  payload: SaleReturnUpdatePayload,
): Promise<MutationResult & { returnId?: string; totalAmount?: number }> {
  try {
    const res = await apiFetch<
      MutationResult & { returnId?: string; totalAmount?: number }
    >(`/api/sale-returns/${payload.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeleteSaleReturn(
  id: string,
): Promise<MutationResult & { deletedAt?: string }> {
  try {
    const res = await apiFetch<MutationResult & { deletedAt?: string }>(
      `/api/sale-returns/${id}`,
      { method: "DELETE" },
    );
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

// ── HOLDS — not supported in backend (no SaleReturnHold schema) ───────────────

export async function webSaveSaleReturnHold(
  _payload: SaleReturnHoldSavePayload,
): Promise<SaleReturnHoldSaveResult> {
  return { success: false, error: "not_supported" };
}

export async function webListSaleReturnHolds(
  _licenseId: string,
  _pagination: Pagination = {},
): Promise<SaleReturnHoldsListResult> {
  return { holds: [], total: 0 };
}

export async function webGetSaleReturnHold(
  _id: string,
): Promise<SaleReturnHoldGetResult> {
  return { success: false, error: "not_supported" };
}

export async function webDeleteSaleReturnHold(
  _id: string,
): Promise<MutationResult> {
  return { success: false, error: "not_supported" };
}
