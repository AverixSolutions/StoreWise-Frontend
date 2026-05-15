// src/platform/web/sales.ts
import type {
  SaleCreatePayload,
  SaleItemInput,
  CreateSaleResult,
  SaleUpdatePayload,
  MutationResult,
  SaleListFilters,
  SaleListResult,
  SaleFullResult,
  SaleRow,
  SaleItemRow,
  SlNoResult,
  SaleHoldSavePayload,
  SaleHoldSaveResult,
  SaleHoldsListResult,
  SaleHoldGetResult,
  CustomerListFilters,
  CustomerListResult,
  Pagination,
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

function triggerSalePull() {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pullNow("sale").catch(() => {});
      SyncManager.pullNow("saleItem").catch(() => {});
      SyncManager.pullNow("customerTransaction").catch(() => {});
      SyncManager.pullNow("cashTransaction").catch(() => {});
      SyncManager.pullNow("product").catch(() => {});
    })
    .catch(() => {});
}

type IDBSale = SaleRow & { licenseId: string; [key: string]: any };
type IDBSaleItem = SaleItemRow & { [key: string]: any };

// ── READS from IDB ────────────────────────────────────────────────────────────

export async function webListSales(
  licenseId: string,
  filters: SaleListFilters = {},
): Promise<SaleListResult> {
  try {
    let rows = await idbGetAllByIndex<IDBSale>(
      STORES.SALES,
      "licenseId",
      licenseId,
    );

    if (!filters.includeDeleted) {
      rows = rows.filter((r) => !r.deletedAt);
    }

    if (filters.customerId) {
      rows = rows.filter((r) => r.customerId === filters.customerId);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      rows = rows.filter(
        (r) => r.saleDate && new Date(r.saleDate).getTime() >= from,
      );
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      rows = rows.filter(
        (r) => r.saleDate && new Date(r.saleDate).getTime() < to,
      );
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.billNo || "").toLowerCase().includes(q) ||
          (r.customerName || "").toLowerCase().includes(q),
      );
    }

    rows.sort((a, b) => {
      const da = new Date(a.saleDate || 0).getTime();
      const db = new Date(b.saleDate || 0).getTime();
      if (db !== da) return db - da;
      return (b.slNo ?? 0) - (a.slNo ?? 0);
    });

    const total = rows.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const paged = rows.slice((page - 1) * pageSize, page * pageSize);

    return { success: true, total, page, pageSize, rows: paged };
  } catch (err: any) {
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

export async function webGetSaleFull(id: string): Promise<SaleFullResult> {
  try {
    const sale = await idbGetByKey<IDBSale>(STORES.SALES, id);
    const items = sale
      ? await idbGetAllByIndex<IDBSaleItem>(STORES.SALE_ITEMS, "saleId", id)
      : [];

    if (sale) {
      return {
        success: true,
        sale: sale as any,
        items: items.filter((i) => !i.deletedAt),
      };
    }

    return await apiFetch<SaleFullResult>(`/api/sales/${id}`);
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webPeekNextSaleSlNo(
  licenseId: string,
): Promise<SlNoResult> {
  try {
    return await apiFetch<SlNoResult>(
      `/api/sales/next-slno?licenseId=${encodeURIComponent(licenseId)}`,
    );
  } catch {
    return { nextSlNo: 1 };
  }
}

// ── WRITES via API ────────────────────────────────────────────────────────────

export async function webCreateSale(
  sale: SaleCreatePayload,
  items: SaleItemInput[],
): Promise<CreateSaleResult> {
  try {
    const res = await apiFetch<CreateSaleResult>("/api/sales", {
      method: "POST",
      body: JSON.stringify({ sale, items }),
    });
    if (res.success) triggerSalePull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webUpdateSale(
  payload: SaleUpdatePayload,
): Promise<MutationResult> {
  try {
    const res = await apiFetch<MutationResult>(`/api/sales/${payload.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (res.success) triggerSalePull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeleteSale(
  id: string,
): Promise<MutationResult & { deletedAt?: string }> {
  try {
    const res = await apiFetch<MutationResult & { deletedAt?: string }>(
      `/api/sales/${id}`,
      { method: "DELETE" },
    );
    if (res.success) triggerSalePull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

// ── HOLDS ─────────────────────────────────────────────────────────────────────

export async function webSaveSaleHold(
  payload: SaleHoldSavePayload,
): Promise<SaleHoldSaveResult> {
  try {
    return await apiFetch<SaleHoldSaveResult>("/api/sales/holds", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webListSaleHolds(
  licenseId: string,
  pagination: Pagination = {},
): Promise<SaleHoldsListResult> {
  try {
    const p = pagination.page ?? 1;
    const ps = pagination.pageSize ?? 50;
    return await apiFetch<SaleHoldsListResult>(
      `/api/sales/holds?licenseId=${encodeURIComponent(licenseId)}&page=${p}&pageSize=${ps}`,
    );
  } catch {
    return { holds: [], total: 0 };
  }
}

export async function webGetSaleHold(id: string): Promise<SaleHoldGetResult> {
  try {
    return await apiFetch<SaleHoldGetResult>(`/api/sales/holds/${id}`);
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeleteSaleHold(id: string): Promise<MutationResult> {
  try {
    return await apiFetch<MutationResult>(`/api/sales/holds/${id}`, {
      method: "DELETE",
    });
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

// ── CUSTOMERS from IDB ────────────────────────────────────────────────────────

export async function webListCustomers(
  licenseId: string,
  filters: CustomerListFilters = {},
): Promise<CustomerListResult> {
  try {
    // Customers may not be in IDB yet — fallback to API
    const data = await apiFetch<CustomerListResult>(
      `/api/customers?licenseId=${encodeURIComponent(licenseId)}&q=${encodeURIComponent(filters.q ?? "")}&page=${filters.page ?? 1}&pageSize=${filters.pageSize ?? 100}`,
    );
    return data;
  } catch {
    return { customers: [], total: 0 };
  }
}
