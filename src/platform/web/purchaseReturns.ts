// src/platform/web/purchaseReturns.ts
import type {
  PurchaseReturnCreatePayload,
  PurchaseReturnItemInput,
  CreatePurchaseReturnResult,
  PurchaseReturnUpdatePayload,
  MutationResult,
  PurchaseReturnListFilters,
  PurchaseReturnListResult,
  PurchaseReturnFullResult,
  PurchaseReturnRow,
  SlNoResult,
  PurchaseReturnHoldSavePayload,
  PurchaseReturnHoldSaveResult,
  PurchaseReturnHoldsListResult,
  PurchaseReturnHoldGetResult,
  Pagination,
} from "../types";
import { STORES, idbGetByKey, idbPut, idbGetAllByIndex } from "./idb";
import {
  getActiveToken,
  getActiveLicenseId,
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

// After a write, trigger a pull so IDB stays fresh (fire-and-forget)
function triggerPurchaseReturnPull() {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pullNow("purchaseReturn").catch(() => {});
      SyncManager.pullNow("purchaseReturnItem").catch(() => {});
      SyncManager.pullNow("supplierTransaction").catch(() => {});
      SyncManager.pullNow("cashTransaction").catch(() => {});
      SyncManager.pullNow("product").catch(() => {});
    })
    .catch(() => {});
}

// ── IDB helpers for purchase returns ──────────────────────────────────────────

type IDBPurchaseReturn = PurchaseReturnRow & {
  licenseId: string;
  isSynced?: number;
  [key: string]: any;
};

type IDBPurchaseReturnItem = {
  id: string;
  licenseId: string;
  purchaseReturnId: string;
  [key: string]: any;
};

// ── READS from IDB ────────────────────────────────────────────────────────────

export async function webListPurchaseReturns(
  licenseId: string,
  filters: PurchaseReturnListFilters = {},
): Promise<PurchaseReturnListResult> {
  try {
    let rows = await idbGetAllByIndex<IDBPurchaseReturn>(
      STORES.PURCHASE_RETURNS,
      "licenseId",
      licenseId,
    );

    // Exclude soft-deleted records
    rows = rows.filter((r) => !r.deletedAt);

    // Apply filters
    if (filters.supplierId) {
      rows = rows.filter((r) => r.supplierId === filters.supplierId);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      rows = rows.filter(
        (r) => r.returnDate && new Date(r.returnDate).getTime() >= from,
      );
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      rows = rows.filter(
        (r) => r.returnDate && new Date(r.returnDate).getTime() < to,
      );
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.billNo || "").toLowerCase().includes(q) ||
          (r.supplierName || "").toLowerCase().includes(q),
      );
    }

    // Sort newest first by returnDate, then entryTime
    rows.sort((a, b) => {
      const da = new Date(a.returnDate || 0).getTime();
      const db = new Date(b.returnDate || 0).getTime();
      if (db !== da) return db - da;
      return (b.slNo ?? 0) - (a.slNo ?? 0);
    });

    const total = rows.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const offset = (page - 1) * pageSize;
    const paged = rows.slice(offset, offset + pageSize);

    return { returns: paged, total };
  } catch (err: any) {
    return { returns: [], total: 0 };
  }
}

export async function webGetPurchaseReturnFull(
  id: string,
): Promise<PurchaseReturnFullResult> {
  try {
    // Try IDB first
    const purchaseReturn = await idbGetByKey<IDBPurchaseReturn>(
      STORES.PURCHASE_RETURNS,
      id,
    );
    const items = purchaseReturn
      ? await idbGetAllByIndex<IDBPurchaseReturnItem>(
          STORES.PURCHASE_RETURN_ITEMS,
          "purchaseReturnId",
          id,
        )
      : [];

    if (purchaseReturn) {
      const liveItems = items.filter((i) => !i.deletedAt);
      return {
        success: true,
        purchaseReturn: purchaseReturn as any,
        items: liveItems,
      };
    }

    // Fallback to API if not in IDB yet
    const data = await apiFetch<PurchaseReturnFullResult>(
      `/api/purchase-returns/${id}`,
    );
    return data;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webPeekNextPurchaseReturnSlNo(
  licenseId: string,
): Promise<SlNoResult> {
  try {
    await import("@/sync/SyncManager")
      .then(({ SyncManager }) =>
        SyncManager.pullNow("purchaseReturn").catch(() => {}),
      )
      .catch(() => {});

    const data = await apiFetch<SlNoResult>(
      `/api/purchase-returns/next-slno?licenseId=${encodeURIComponent(licenseId)}`,
    );
    return data;
  } catch {
    return { nextSlNo: 1 };
  }
}

// ── WRITES via API ────────────────────────────────────────────────────────────

export async function webCreatePurchaseReturn(payload: {
  header: PurchaseReturnCreatePayload;
  items: PurchaseReturnItemInput[];
}): Promise<CreatePurchaseReturnResult> {
  try {
    const res = await apiFetch<CreatePurchaseReturnResult>(
      "/api/purchase-returns",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    if (res.success) triggerPurchaseReturnPull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webUpdatePurchaseReturn(
  payload: PurchaseReturnUpdatePayload,
): Promise<MutationResult & { returnId?: string; totalAmount?: number }> {
  try {
    const res = await apiFetch<
      MutationResult & { returnId?: string; totalAmount?: number }
    >(`/api/purchase-returns/${payload.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (res.success) triggerPurchaseReturnPull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeletePurchaseReturn(
  id: string,
): Promise<MutationResult & { deletedAt?: string }> {
  try {
    const res = await apiFetch<MutationResult & { deletedAt?: string }>(
      `/api/purchase-returns/${id}`,
      { method: "DELETE" },
    );
    if (res.success) triggerPurchaseReturnPull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

// ── HOLDS (API-backed, ephemeral drafts) ─────────────────────────────────────

export async function webSavePurchaseReturnHold(
  payload: PurchaseReturnHoldSavePayload,
): Promise<PurchaseReturnHoldSaveResult> {
  try {
    const res = await apiFetch<PurchaseReturnHoldSaveResult>(
      "/api/purchase-returns/holds",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webListPurchaseReturnHolds(
  licenseId: string,
  pagination: Pagination = {},
): Promise<PurchaseReturnHoldsListResult> {
  try {
    const p = pagination.page ?? 1;
    const ps = pagination.pageSize ?? 50;
    const data = await apiFetch<PurchaseReturnHoldsListResult>(
      `/api/purchase-returns/holds?licenseId=${encodeURIComponent(licenseId)}&page=${p}&pageSize=${ps}`,
    );
    return data;
  } catch {
    return { holds: [], total: 0 };
  }
}

export async function webGetPurchaseReturnHold(
  id: string,
): Promise<PurchaseReturnHoldGetResult> {
  try {
    return await apiFetch<PurchaseReturnHoldGetResult>(
      `/api/purchase-returns/holds/${id}`,
    );
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeletePurchaseReturnHold(
  id: string,
): Promise<MutationResult> {
  try {
    return await apiFetch<MutationResult>(`/api/purchase-returns/holds/${id}`, {
      method: "DELETE",
    });
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}
