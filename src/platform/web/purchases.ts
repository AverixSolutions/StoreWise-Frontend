// src/platform/web/purchases.ts
import type {
  PurchaseCreatePayload,
  PurchaseItemInput,
  CreatePurchaseResult,
  PurchaseUpdatePayload,
  MutationResult,
  PurchaseListFilters,
  PurchaseListResult,
  PurchaseFullResult,
  PurchaseRow,
  PurchaseItemRow,
  SlNoResult,
  HoldNoResult,
  PurchaseHoldSavePayload,
  PurchaseHoldSaveResult,
  PurchaseHoldsListResult,
  PurchaseHoldGetResult,
  SupplierListFilters,
  SupplierListResult,
  SupplierRecord,
  BulkPriceUpdate,
  Pagination,
} from "../types";
import {
  STORES,
  idbGetByKey,
  idbPut,
  idbGetAll,
  idbGetAllByIndex,
} from "./idb";
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
function triggerPurchasePull() {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pullNow("purchase").catch(() => {});
      SyncManager.pullNow("purchaseItem").catch(() => {});
    })
    .catch(() => {});
}

// ── IDB helpers for purchases ─────────────────────────────────────────────────

type IDBPurchase = PurchaseRow & {
  licenseId: string;
  isSynced?: number;
  [key: string]: any;
};

type IDBPurchaseItem = PurchaseItemRow & {
  [key: string]: any;
};

// ── READS from IDB ────────────────────────────────────────────────────────────

export async function webListPurchases(
  licenseId: string,
  filters: PurchaseListFilters = {},
): Promise<PurchaseListResult> {
  try {
    let rows = await idbGetAllByIndex<IDBPurchase>(
      STORES.PURCHASES,
      "licenseId",
      licenseId,
    );

    // Exclude deleted unless asked
    if (!filters.includeDeleted) {
      rows = rows.filter((r) => !r.deletedAt);
    }

    // Apply filters
    if (filters.supplierId) {
      rows = rows.filter((r) => r.supplierId === filters.supplierId);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      rows = rows.filter(
        (r) => r.purchaseDate && new Date(r.purchaseDate).getTime() >= from,
      );
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      rows = rows.filter(
        (r) => r.purchaseDate && new Date(r.purchaseDate).getTime() < to,
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

    // Sort newest first
    rows.sort((a, b) => {
      const da = new Date(a.purchaseDate || 0).getTime();
      const db = new Date(b.purchaseDate || 0).getTime();
      if (db !== da) return db - da;
      return (b.slNo ?? 0) - (a.slNo ?? 0);
    });

    const total = rows.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const offset = (page - 1) * pageSize;
    const paged = rows.slice(offset, offset + pageSize);

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

export async function webGetPurchaseFull(
  id: string,
): Promise<PurchaseFullResult> {
  try {
    // Try IDB first
    const purchase = await idbGetByKey<IDBPurchase>(STORES.PURCHASES, id);
    const items = purchase
      ? await idbGetAllByIndex<IDBPurchaseItem>(
          STORES.PURCHASE_ITEMS,
          "purchaseId",
          id,
        )
      : [];

    if (purchase) {
      const liveItems = items.filter((i) => !i.deletedAt);
      return { success: true, purchase: purchase as any, items: liveItems };
    }

    // Fallback to API if not in IDB yet
    const data = await apiFetch<PurchaseFullResult>(`/api/purchases/${id}`);
    return data;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webPeekNextPurchaseSlNo(
  licenseId: string,
): Promise<SlNoResult> {
  try {
    await import("@/sync/SyncManager")
      .then(({ SyncManager }) =>
        SyncManager.pullNow("purchase").catch(() => {}),
      )
      .catch(() => {});

    const data = await apiFetch<SlNoResult>(
      `/api/purchases/next-slno?licenseId=${encodeURIComponent(licenseId)}`,
    );
    return data;
  } catch {
    return { nextSlNo: 1 };
  }
}

// ── WRITES via API ────────────────────────────────────────────────────────────

export async function webCreatePurchase(
  purchase: PurchaseCreatePayload,
  items: PurchaseItemInput[],
): Promise<CreatePurchaseResult> {
  try {
    const res = await apiFetch<CreatePurchaseResult>("/api/purchases", {
      method: "POST",
      body: JSON.stringify({ purchase, items }),
    });
    if (res.success) triggerPurchasePull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webUpdatePurchase(
  payload: PurchaseUpdatePayload,
): Promise<MutationResult> {
  try {
    const res = await apiFetch<MutationResult>(`/api/purchases/${payload.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (res.success) triggerPurchasePull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeletePurchase(
  id: string,
): Promise<MutationResult & { deletedAt?: string }> {
  try {
    const res = await apiFetch<MutationResult & { deletedAt?: string }>(
      `/api/purchases/${id}`,
      { method: "DELETE" },
    );
    if (res.success) triggerPurchasePull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

// ── HOLDS (API-backed, no IDB caching — holds are ephemeral drafts) ────────────

export async function webSavePurchaseHold(
  payload: PurchaseHoldSavePayload,
): Promise<PurchaseHoldSaveResult> {
  try {
    const res = await apiFetch<PurchaseHoldSaveResult>("/api/purchases/holds", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webListPurchaseHolds(
  licenseId: string,
  pagination: Pagination = {},
): Promise<PurchaseHoldsListResult> {
  try {
    const p = pagination.page ?? 1;
    const ps = pagination.pageSize ?? 50;
    const data = await apiFetch<PurchaseHoldsListResult>(
      `/api/purchases/holds?licenseId=${encodeURIComponent(licenseId)}&page=${p}&pageSize=${ps}`,
    );
    return data;
  } catch {
    return { holds: [], total: 0 };
  }
}

export async function webGetPurchaseHold(
  id: string,
): Promise<PurchaseHoldGetResult> {
  try {
    return await apiFetch<PurchaseHoldGetResult>(`/api/purchases/holds/${id}`);
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeletePurchaseHold(
  id: string,
): Promise<MutationResult> {
  try {
    return await apiFetch<MutationResult>(`/api/purchases/holds/${id}`, {
      method: "DELETE",
    });
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webPeekNextHoldNo(
  licenseId: string,
): Promise<HoldNoResult> {
  try {
    return await apiFetch<HoldNoResult>(
      `/api/purchases/holds/next-no?licenseId=${encodeURIComponent(licenseId)}`,
    );
  } catch {
    return { nextHoldNo: 1 };
  }
}

// ── SUPPLIERS from IDB (synced from Neon via suppliers adapter) ───────────────

export async function webListSuppliers(
  licenseId: string,
  filters: SupplierListFilters = {},
): Promise<SupplierListResult> {
  try {
    let all = await idbGetAllByIndex<SupplierRecord>(
      STORES.SUPPLIERS,
      "licenseId",
      licenseId,
    );

    let live = all.filter((s) => !s.deletedAt);

    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      live = live.filter((s) => s.name.toLowerCase().includes(q));
    }

    live.sort((a, b) => a.name.localeCompare(b.name));

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 100;
    const offset = (page - 1) * pageSize;

    return {
      suppliers: live.slice(offset, offset + pageSize),
      total: live.length,
    };
  } catch {
    return { suppliers: [], total: 0 };
  }
}

// ── BULK PRICE UPDATE (update IDB + push products) ────────────────────────────

export async function webBulkUpdateProductPrices(
  updates: BulkPriceUpdate[],
): Promise<MutationResult> {
  if (!updates.length) return { success: true };

  try {
    const now = new Date().toISOString();
    for (const u of updates) {
      const product = await idbGetByKey<any>(STORES.PRODUCTS, u.productId);
      if (!product) continue;
      await idbPut(STORES.PRODUCTS, {
        ...product,
        ...(u.salePrice !== undefined ? { salePrice: u.salePrice } : {}),
        ...(u.costPrice !== undefined ? { costPrice: u.costPrice } : {}),
        ...(u.unit !== undefined ? { unit: u.unit } : {}),
        updatedAt: now,
        isSynced: 0,
        syncedAt: null,
      });
    }
    // Push updated products to server
    if (typeof window !== "undefined") {
      import("@/sync/SyncManager")
        .then(({ SyncManager }) => {
          SyncManager.pushEntity("product").catch(() => {});
        })
        .catch(() => {});
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}
