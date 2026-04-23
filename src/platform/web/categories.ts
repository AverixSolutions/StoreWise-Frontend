// src/platform/web/categories.ts
import type { CategoryRecord, CategorySavePayload } from "../types";
import { STORES, idbGetByKey, idbPut, idbGetAllByIndex, newId } from "./idb";

export async function webListCategories(
  licenseId: string,
): Promise<{ success: boolean; rows: CategoryRecord[]; error?: string }> {
  try {
    const rows = await idbGetAllByIndex<CategoryRecord>(
      STORES.CATEGORIES,
      "licenseId",
      licenseId,
    );
    const live = rows
      .filter((r) => !(r as any).deletedAt)
      .sort((a, b) => {
        // parents first, then children, then alphabetical
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && !b.parentId) return 1;
        return a.name.localeCompare(b.name);
      });
    return { success: true, rows: live };
  } catch (err: any) {
    return { success: false, rows: [], error: String(err?.message || err) };
  }
}

export async function webSaveCategory(
  payload: CategorySavePayload,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!payload.licenseId || !payload.name?.trim()) {
      return { success: false, error: "licenseId and name are required" };
    }

    const now = new Date().toISOString();
    const id = payload.id || newId();
    const normalizedName = payload.name.trim();
    const normalizedParentId = payload.parentId ?? null;

    if (payload.id && normalizedParentId && payload.id === normalizedParentId) {
      return { success: false, error: "Category cannot be its own parent" };
    }

    const allRows = await idbGetAllByIndex<
      CategoryRecord & { deletedAt?: string | null }
    >(STORES.CATEGORIES, "licenseId", payload.licenseId);

    const liveRows = allRows.filter((r) => !r.deletedAt);

    if (normalizedParentId) {
      const parent = liveRows.find((r) => r.id === normalizedParentId);
      if (!parent) {
        return {
          success: false,
          error: "Selected parent category does not exist",
        };
      }
    }

    const duplicate = liveRows.find((r) => {
      const sameLevel = (r.parentId ?? null) === normalizedParentId;
      const sameName =
        r.name.trim().toLowerCase() === normalizedName.toLowerCase();
      const differentRow = r.id !== id;
      return sameLevel && sameName && differentRow;
    });

    if (duplicate) {
      return {
        success: false,
        error: "A category with the same name already exists here",
      };
    }

    const existing = payload.id
      ? await idbGetByKey<CategoryRecord & { deletedAt?: string | null }>(
          STORES.CATEGORIES,
          payload.id,
        )
      : undefined;

    const record: CategoryRecord & { deletedAt: null } = {
      ...(existing || {}),
      id,
      licenseId: payload.licenseId,
      name: normalizedName,
      parentId: normalizedParentId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      deletedAt: null,
    };

    await idbPut(STORES.CATEGORIES, record);
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeleteCategory(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await idbGetByKey<
      CategoryRecord & { deletedAt?: string | null }
    >(STORES.CATEGORIES, id);
    if (!existing) return { success: false, error: "NOT_FOUND" };

    const now = new Date().toISOString();

    // Soft-delete children first
    const children = await idbGetAllByIndex<
      CategoryRecord & { deletedAt?: string | null }
    >(STORES.CATEGORIES, "licenseId_parentId", [existing.licenseId, id]);
    for (const child of children.filter((c) => !c.deletedAt)) {
      await idbPut(STORES.CATEGORIES, {
        ...child,
        deletedAt: now,
        updatedAt: now,
      });
    }

    await idbPut(STORES.CATEGORIES, {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}
