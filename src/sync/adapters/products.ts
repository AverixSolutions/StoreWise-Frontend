// frontend/src/sync/adapters/products.ts
import type { SyncAdapter, DirtyRecord, SyncStateRecord } from "../SyncEngine";
import {
  STORES,
  idbGetAllByIndex,
  idbGetByKey,
  idbPut,
} from "@/platform/web/idb";

// ── Desktop (Electron) helpers ────────────────────────────────────────────

function api() {
  const w = window as any;
  if (!w.electronAPI) throw new Error("electronAPI not available");
  return w.electronAPI;
}

async function desktopGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  return api().getDirtyProducts(licenseId, 200) as Promise<DirtyRecord[]>;
}

async function desktopMarkSynced(ids: string[], serverUpdatedAt: string) {
  await api().markProductsSynced(ids, serverUpdatedAt);
}

async function desktopUpsertFromServer(records: DirtyRecord[]) {
  await api().bulkUpsertProducts(records);
}

async function desktopGetSyncState(): Promise<SyncStateRecord> {
  const state = await api().getSyncState("products");
  return {
    lastPulledAt: state?.lastPulledAt ?? null,
    lastPushedAt: state?.lastPushedAt ?? null,
  };
}

async function desktopSetSyncState(state: Partial<SyncStateRecord>) {
  await api().setSyncState("products", state);
}

// ── Web (IndexedDB) implementation ────────────────────────────────────────

type IDBProduct = DirtyRecord & {
  licenseId: string;
  isSynced?: number | boolean;
  syncedAt?: string | null;
};

async function webGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  const all = await idbGetAllByIndex<IDBProduct>(
    STORES.PRODUCTS,
    "licenseId",
    licenseId,
  );
  return all.filter((p) => Number(p.isSynced ?? 0) === 0);
}

async function webMarkSynced(ids: string[], serverUpdatedAt: string) {
  for (const id of ids) {
    const product = await idbGetByKey<IDBProduct>(STORES.PRODUCTS, id);
    if (product) {
      await idbPut(STORES.PRODUCTS, {
        ...product,
        isSynced: 1,
        syncedAt: serverUpdatedAt,
      });
    }
  }
}

async function webUpsertFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<IDBProduct>(STORES.PRODUCTS, record.id);

    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;

    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    const existingCategory = (existing as any)?.category ?? null;
    const existingSubcategory = (existing as any)?.subcategory ?? null;
    const incomingCategory = (record as any)?.category ?? null;
    const incomingSubcategory = (record as any)?.subcategory ?? null;

    const shouldRepairSameTimestampMissingFields =
      incomingTs === localTs &&
      ((!existingCategory && !!incomingCategory) ||
        (!existingSubcategory && !!incomingSubcategory));

    if (
      !existing ||
      incomingTs > localTs ||
      shouldRepairSameTimestampMissingFields
    ) {
      await idbPut(STORES.PRODUCTS, {
        ...(existing ?? {}),
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    }
  }
}

const WEB_SYNC_KEY = "kynflow_sync_products";

async function webGetSyncState(): Promise<SyncStateRecord> {
  try {
    const raw = localStorage.getItem(WEB_SYNC_KEY);
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function webSetSyncState(state: Partial<SyncStateRecord>) {
  const current = await webGetSyncState();
  localStorage.setItem(WEB_SYNC_KEY, JSON.stringify({ ...current, ...state }));
}

// ── Factory ───────────────────────────────────────────────────────────────

export function createProductsAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "product",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
