// src/platform/web/brands.ts
import type {
  BrandRecord,
  BrandSavePayload,
  BrandListResult,
  BrandMutationResult,
  MutationResult,
} from "../types";
import { STORES, idbGetByKey, idbPut, idbGetAllByIndex, newId } from "./idb";

type WebBrandRecord = BrandRecord & {
  isSynced: number;
  syncedAt: string | null;
  deletedAt?: string | null;
};

export async function webListBrands(
  licenseId: string,
): Promise<BrandListResult> {
  try {
    const rows = await idbGetAllByIndex<WebBrandRecord>(
      STORES.BRANDS,
      "licenseId",
      licenseId,
    );
    const live = rows
      .filter((r) => !r.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { success: true, rows: live };
  } catch (err: any) {
    return { success: false, rows: [], error: String(err?.message || err) };
  }
}

export async function webSaveBrand(
  payload: BrandSavePayload,
): Promise<BrandMutationResult> {
  try {
    if (!payload.licenseId || !payload.name?.trim()) {
      return { success: false, error: "licenseId and name are required" };
    }

    const now = new Date().toISOString();
    const id = payload.id || newId();
    const normalizedName = payload.name.trim();

    const allRows = await idbGetAllByIndex<WebBrandRecord>(
      STORES.BRANDS,
      "licenseId",
      payload.licenseId,
    );
    const liveRows = allRows.filter((r) => !r.deletedAt);

    const duplicate = liveRows.find(
      (r) =>
        r.name.trim().toLowerCase() === normalizedName.toLowerCase() &&
        r.id !== id,
    );
    if (duplicate) return { success: false, error: "Brand already exists" };

    const existing = payload.id
      ? await idbGetByKey<WebBrandRecord>(STORES.BRANDS, payload.id)
      : undefined;

    // ── mark dirty on save ────────────────────────────────────────────────────
    const record: WebBrandRecord = {
      ...(existing || {}),
      id,
      licenseId: payload.licenseId,
      name: normalizedName,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      deletedAt: null,
      isSynced: 0,
      syncedAt: existing?.syncedAt ?? null,
    };

    await idbPut(STORES.BRANDS, record);
    _triggerSync();

    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeleteBrand(id: string): Promise<MutationResult> {
  try {
    const existing = await idbGetByKey<WebBrandRecord>(STORES.BRANDS, id);
    if (!existing) return { success: false, error: "NOT_FOUND" };

    const products = await idbGetAllByIndex<any>(
      STORES.PRODUCTS,
      "licenseId",
      existing.licenseId,
    );

    const usageCount = products.filter(
      (p) =>
        !p.deletedAt &&
        typeof p.brand === "string" &&
        p.brand.trim().toLowerCase() === existing.name.trim().toLowerCase(),
    ).length;

    if (usageCount > 0) {
      return {
        success: false,
        error: `Brand is used by ${usageCount} product(s)`,
      };
    }

    const now = new Date().toISOString();

    // ── mark dirty on delete ──────────────────────────────────────────────────
    await idbPut(STORES.BRANDS, {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      isSynced: 0,
      syncedAt: existing.syncedAt ?? null,
    });

    _triggerSync();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

// Lazy import to avoid circular deps
function _triggerSync() {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pushEntity("brand").catch(() => {});
    })
    .catch(() => {});
}
