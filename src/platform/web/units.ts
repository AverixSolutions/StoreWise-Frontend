// src/platform/web/units.ts
import type { UnitRecord, UnitSavePayload } from "../types";
import { STORES, idbGetAllByIndex, idbGetByKey, idbPut, newId } from "./idb";

const DEFAULT_UNITS = [
  { code: "KG", label: "Kilograms", sortOrder: 1 },
  { code: "NOS", label: "Numbers", sortOrder: 2 },
  { code: "LTR", label: "Liters", sortOrder: 3 },
  { code: "MTR", label: "Meters", sortOrder: 4 },
];

async function seedDefaults(licenseId: string) {
  const now = new Date().toISOString();
  for (const u of DEFAULT_UNITS) {
    const all = await idbGetAllByIndex<UnitRecord>(
      STORES.UNITS,
      "licenseId",
      licenseId,
    );
    const exists = all.find((r) => r.code === u.code && !(r as any).deletedAt);
    if (!exists) {
      await idbPut<UnitRecord>(STORES.UNITS, {
        id: newId(),
        licenseId,
        code: u.code,
        label: u.label,
        isDefault: 1,
        sortOrder: u.sortOrder,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        isSynced: 0,
        syncedAt: null,
      } as any);
    }
  }
  _triggerSync();
}

export async function webListUnits(
  licenseId: string,
): Promise<{ success: boolean; rows: UnitRecord[]; error?: string }> {
  try {
    const all = await idbGetAllByIndex<UnitRecord>(
      STORES.UNITS,
      "licenseId",
      licenseId,
    );
    const live = all.filter((r) => !(r as any).deletedAt);
    if (live.filter((r) => r.isDefault).length === 0) {
      await seedDefaults(licenseId);
      return webListUnits(licenseId);
    }
    return {
      success: true,
      rows: live.sort(
        (a, b) =>
          (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
          a.label.localeCompare(b.label),
      ),
    };
  } catch (e: any) {
    return { success: false, rows: [], error: String(e?.message || e) };
  }
}

export async function webSaveUnit(
  payload: UnitSavePayload,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const trimCode = (payload.code || "").trim().toUpperCase();
    const trimLabel = (payload.label || "").trim();
    if (!payload.licenseId || !trimCode || !trimLabel) {
      return {
        success: false,
        error: "licenseId, code and label are required",
      };
    }
    const now = new Date().toISOString();
    const id = payload.id || newId();
    const all = await idbGetAllByIndex<UnitRecord>(
      STORES.UNITS,
      "licenseId",
      payload.licenseId,
    );

    if (payload.id) {
      const existing = all.find((r) => r.id === payload.id);
      if (!existing) return { success: false, error: "Unit not found" };
      if (existing.isDefault && existing.code !== trimCode) {
        return {
          success: false,
          error: "Cannot change the code of a built-in unit",
        };
      }
      const conflict = all.find(
        (r) => r.code === trimCode && !(r as any).deletedAt && r.id !== id,
      );
      if (conflict)
        return {
          success: false,
          error: `Code "${trimCode}" is already in use`,
        };
      await idbPut(STORES.UNITS, {
        ...existing,
        code: trimCode,
        label: trimLabel,
        updatedAt: now,
        isSynced: 0,
        syncedAt: (existing as any).syncedAt ?? null,
      });
      _triggerSync();
      return { success: true, id };
    }

    const duplicate = all.find(
      (r) => r.code === trimCode && !(r as any).deletedAt,
    );
    if (duplicate)
      return { success: false, error: `Code "${trimCode}" already exists` };
    await idbPut<UnitRecord>(STORES.UNITS, {
      id,
      licenseId: payload.licenseId,
      code: trimCode,
      label: trimLabel,
      isDefault: 0,
      sortOrder: 999,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      isSynced: 0,
      syncedAt: null,
    } as any);
    _triggerSync();
    return { success: true, id };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function webDeleteUnit(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const unit = await idbGetByKey<UnitRecord>(STORES.UNITS, id);
    if (!unit || (unit as any).deletedAt)
      return { success: false, error: "NOT_FOUND" };
    if (unit.isDefault)
      return { success: false, error: "Built-in units cannot be deleted" };
    const now = new Date().toISOString();
    await idbPut(STORES.UNITS, {
      ...unit,
      deletedAt: now,
      updatedAt: now,
      isSynced: 0,
      syncedAt: (unit as any).syncedAt ?? null,
    });
    _triggerSync();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

function _triggerSync() {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pushEntity("unit").catch(() => {});
    })
    .catch(() => {});
}
