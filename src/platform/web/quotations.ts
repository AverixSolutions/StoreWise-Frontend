// src/platform/web/quotations.ts
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
  QuotationRow,
  QuotationItemRow,
} from "../types";
import { STORES, idbGetByKey, idbGetAllByIndex } from "./idb";
import { getActiveToken } from "@/lib/session/runtimeSession";

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

type IDBQuotation = QuotationRow & { licenseId: string; [key: string]: any };
type IDBQuotationItem = QuotationItemRow & { [key: string]: any };

function triggerQuotationPull(extraEntities: string[] = []) {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pullNow("quotation").catch(() => {});
      SyncManager.pullNow("quotationItem").catch(() => {});
      extraEntities.forEach((entity) => {
        SyncManager.pullNow(entity).catch(() => {});
      });
    })
    .catch(() => {});
}

// ── reads from IDB (with API fallback) ────────────────────────────────────────

export async function webListQuotations(
  licenseId: string,
  filters: QuotationListFilters = {},
): Promise<QuotationListResult> {
  try {
    let rows = await idbGetAllByIndex<IDBQuotation>(
      STORES.QUOTATIONS,
      "licenseId",
      licenseId,
    );

    rows = rows.filter((r) => !r.deletedAt);

    if (filters.status) {
      rows = rows.filter((r) => r.status === filters.status);
    }
    if (filters.customerId) {
      rows = rows.filter((r) => r.customerId === filters.customerId);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      rows = rows.filter(
        (r) => r.quotationDate && new Date(r.quotationDate).getTime() >= from,
      );
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      rows = rows.filter(
        (r) => r.quotationDate && new Date(r.quotationDate).getTime() < to,
      );
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.quotationNo || "").toLowerCase().includes(q) ||
          (r.customerName || "").toLowerCase().includes(q),
      );
    }

    rows.sort((a, b) => {
      const da = new Date(a.quotationDate || 0).getTime();
      const db = new Date(b.quotationDate || 0).getTime();
      if (db !== da) return db - da;
      return (b.slNo ?? 0) - (a.slNo ?? 0);
    });

    const total = rows.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const paged = rows.slice((page - 1) * pageSize, page * pageSize);

    return { success: true, total, page, pageSize, rows: paged };
  } catch (err: any) {
    // fallback to API for Mode 1 web
    try {
      const params = new URLSearchParams({ licenseId });
      if (filters.status) params.set("status", filters.status);
      if (filters.customerId) params.set("customerId", filters.customerId);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.q) params.set("q", filters.q);
      params.set("page", String(filters.page ?? 1));
      params.set("pageSize", String(filters.pageSize ?? 50));
      return await apiFetch<QuotationListResult>(`/api/quotations?${params}`);
    } catch {
      return {
        success: false,
        total: 0,
        page: 1,
        pageSize: 50,
        rows: [],
        error: String(err?.message || err),
      };
    }
  }
}

export async function webGetQuotationFull(id: string): Promise<QuotationFullResult> {
  try {
    const quotation = await idbGetByKey<IDBQuotation>(STORES.QUOTATIONS, id);
    if (quotation) {
      const items = await idbGetAllByIndex<IDBQuotationItem>(
        STORES.QUOTATION_ITEMS,
        "quotationId",
        id,
      );
      return {
        success: true,
        quotation: quotation as any,
        items: items.filter((i) => !i.deletedAt),
      };
    }
    return await apiFetch<QuotationFullResult>(`/api/quotations/${id}`);
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webPeekNextQuotationSlNo(
  licenseId: string,
): Promise<{ nextSlNo: number; nextQuotationNo: string }> {
  try {
    return await apiFetch(
      `/api/quotations/next-slno?licenseId=${encodeURIComponent(licenseId)}`,
    );
  } catch {
    return { nextSlNo: 1, nextQuotationNo: "QT-0001" };
  }
}

// ── writes via API ─────────────────────────────────────────────────────────────

export async function webCreateQuotation(
  header: QuotationCreatePayload,
  items: QuotationItemInput[],
): Promise<CreateQuotationResult> {
  try {
    const res = await apiFetch<CreateQuotationResult>("/api/quotations", {
      method: "POST",
      body: JSON.stringify({ header, items }),
    });
    if (res.success) triggerQuotationPull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webUpdateQuotation(
  payload: QuotationUpdatePayload,
): Promise<MutationResult> {
  try {
    const res = await apiFetch<MutationResult>(`/api/quotations/${payload.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (res.success) triggerQuotationPull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeleteQuotation(
  id: string,
): Promise<MutationResult & { deletedAt?: string }> {
  try {
    const res = await apiFetch<MutationResult & { deletedAt?: string }>(
      `/api/quotations/${id}`,
      { method: "DELETE" },
    );
    if (res.success) triggerQuotationPull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webConvertQuotationToSale(
  quotationId: string,
  overrides?: { billNo?: string | null; saleType?: "CASH" | "CREDIT"; saleDate?: string },
): Promise<ConvertQuotationResult> {
  try {
    const res = await apiFetch<ConvertQuotationResult>(
      `/api/quotations/${quotationId}/convert`,
      {
        method: "POST",
        body: JSON.stringify(overrides ?? {}),
      },
    );
    if (res.success) {
      triggerQuotationPull([
        "sale",
        "saleItem",
        "customerTransaction",
        "cashTransaction",
        "product",
      ]);
    }
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}
