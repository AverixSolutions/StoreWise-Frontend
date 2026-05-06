// src/platform/web/transactionTypes.ts
import type {
  TransactionTypeRecord,
  TransactionTypeListResult,
  TransactionTypeSavePayload,
  TransactionTypeMutationResult,
  MutationResult,
} from "../types";
import { STORES, idbGetAllByIndex, idbGetByKey, idbPut, newId } from "./idb";

function nowISO() {
  return new Date().toISOString();
}

function _triggerSync(entity: string) {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pushEntity(entity).catch(() => {});
    })
    .catch(() => {});
}

export async function webListTransactionTypes(
  licenseId: string,
  category: string,
): Promise<TransactionTypeListResult> {
  try {
    const all = await idbGetAllByIndex<TransactionTypeRecord>(
      STORES.TRANSACTION_TYPES,
      "licenseId",
      licenseId,
    );
    const rows = all
      .filter(
        (r) => r.category === category && (!r.deletedAt || r.deletedAt === ""),
      )
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
    return { success: true, rows };
  } catch (e: any) {
    return { success: false, rows: [], error: String(e?.message || e) };
  }
}

export async function webListAllTransactionTypes(
  licenseId: string,
): Promise<TransactionTypeListResult> {
  try {
    const all = await idbGetAllByIndex<TransactionTypeRecord>(
      STORES.TRANSACTION_TYPES,
      "licenseId",
      licenseId,
    );
    const rows = all
      .filter((r) => !r.deletedAt || r.deletedAt === "")
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.sortOrder - b.sortOrder ||
          a.name.localeCompare(b.name),
      );
    return { success: true, rows };
  } catch (e: any) {
    return { success: false, rows: [], error: String(e?.message || e) };
  }
}

export async function webSaveTransactionType(
  payload: TransactionTypeSavePayload,
): Promise<TransactionTypeMutationResult> {
  try {
    const now = nowISO();
    const id = payload.id || newId();

    const existing = payload.id
      ? await idbGetByKey<TransactionTypeRecord>(
          STORES.TRANSACTION_TYPES,
          payload.id,
        )
      : undefined;

    const cleanCode =
      typeof payload.code === "string" && payload.code.trim() !== ""
        ? payload.code.trim().toUpperCase()
        : null;

    const record: TransactionTypeRecord = {
      ...(existing || {}),
      id,
      licenseId: payload.licenseId,
      name: payload.name.trim(),
      code: cleanCode,
      category: payload.category,
      isDefault: payload.isDefault ? 1 : 0,
      sortOrder: payload.sortOrder ?? 999,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: existing?.deletedAt ?? null,
      isSynced: 0,
      syncedAt: (existing as any)?.syncedAt ?? null,
    };

    await idbPut<TransactionTypeRecord>(STORES.TRANSACTION_TYPES, record);
    _triggerSync("transactionType");

    return { success: true, id };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function webDeleteTransactionType(
  id: string,
): Promise<MutationResult> {
  try {
    const existing = await idbGetByKey<TransactionTypeRecord>(
      STORES.TRANSACTION_TYPES,
      id,
    );
    if (!existing) return { success: false, error: "Record not found" };
    if (existing.isDefault) {
      return {
        success: false,
        error: "Cannot delete the default type. Set another as default first.",
      };
    }
    await idbPut<TransactionTypeRecord>(STORES.TRANSACTION_TYPES, {
      ...existing,
      deletedAt: nowISO(),
      updatedAt: nowISO(),
      isSynced: 0,
    });
    _triggerSync("transactionType");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function webSetDefaultTransactionType(
  id: string,
  licenseId: string,
  category: string,
): Promise<MutationResult> {
  try {
    const now = nowISO();
    const all = await idbGetAllByIndex<TransactionTypeRecord>(
      STORES.TRANSACTION_TYPES,
      "licenseId",
      licenseId,
    );
    // Clear existing defaults for this category
    for (const r of all) {
      if (r.category === category && r.isDefault && !r.deletedAt) {
        await idbPut<TransactionTypeRecord>(STORES.TRANSACTION_TYPES, {
          ...r,
          isDefault: 0,
          updatedAt: now,
          isSynced: 0,
        });
      }
    }
    // Set new default
    const target = await idbGetByKey<TransactionTypeRecord>(
      STORES.TRANSACTION_TYPES,
      id,
    );
    if (!target) return { success: false, error: "Record not found" };
    await idbPut<TransactionTypeRecord>(STORES.TRANSACTION_TYPES, {
      ...target,
      isDefault: 1,
      updatedAt: now,
      isSynced: 0,
    });
    _triggerSync("transactionType");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function webGetDefaultTransactionType(
  licenseId: string,
  category: string,
): Promise<{ success: boolean; row: TransactionTypeRecord | null }> {
  try {
    const all = await idbGetAllByIndex<TransactionTypeRecord>(
      STORES.TRANSACTION_TYPES,
      "licenseId",
      licenseId,
    );
    const row =
      all.find(
        (r) =>
          r.category === category &&
          r.isDefault &&
          (!r.deletedAt || r.deletedAt === ""),
      ) ?? null;
    return { success: true, row };
  } catch (e: any) {
    return { success: false, row: null };
  }
}
