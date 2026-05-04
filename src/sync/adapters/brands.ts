// src/sync/adapters/brands.ts
import type { SyncAdapter, DirtyRecord, SyncStateRecord } from "../SyncEngine";
import {
  STORES,
  idbGetAllByIndex,
  idbGetByKey,
  idbPut,
} from "@/platform/web/idb";

// ── Desktop helpers ───────────────────────────────────────────────────────────

function api() {
  const w = window as any;
  if (!w.electronAPI) throw new Error("electronAPI not available");
  return w.electronAPI;
}

async function desktopGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  return api().getDirtyBrands(licenseId, 200);
}
async function desktopMarkSynced(ids: string[], serverUpdatedAt: string) {
  await api().markBrandsSynced(ids, serverUpdatedAt);
}
async function desktopUpsertFromServer(records: DirtyRecord[]) {
  await api().bulkUpsertBrands(records);
}
async function desktopGetSyncState(): Promise<SyncStateRecord> {
  const state = await api().getSyncState("brands");
  return {
    lastPulledAt: state?.lastPulledAt ?? null,
    lastPushedAt: state?.lastPushedAt ?? null,
  };
}
async function desktopSetSyncState(state: Partial<SyncStateRecord>) {
  await api().setSyncState("brands", state);
}

// ── Web (IndexedDB) helpers ───────────────────────────────────────────────────

type IDBBrand = DirtyRecord & {
  licenseId: string;
  isSynced?: number;
  syncedAt?: string | null;
};

async function webGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  const all = await idbGetAllByIndex<IDBBrand>(
    STORES.BRANDS,
    "licenseId",
    licenseId,
  );
  return all.filter((b) => Number(b.isSynced ?? 0) === 0);
}

async function webMarkSynced(ids: string[], serverUpdatedAt: string) {
  for (const id of ids) {
    const brand = await idbGetByKey<IDBBrand>(STORES.BRANDS, id);
    if (brand)
      await idbPut(STORES.BRANDS, {
        ...brand,
        isSynced: 1,
        syncedAt: serverUpdatedAt,
      });
  }
}

async function webUpsertFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<IDBBrand>(STORES.BRANDS, record.id);
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing) {
      await idbPut(STORES.BRANDS, {
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    } else if (Number(existing.isSynced ?? 0) === 1 && incomingTs > localTs) {
      await idbPut(STORES.BRANDS, {
        ...existing,
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    }
    // If local is dirty (isSynced=0), skip — push cycle will handle it
  }
}

const WEB_SYNC_KEY = "kynflow_sync_brands";
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

// ── Factory ───────────────────────────────────────────────────────────────────

export function createBrandsAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "brand",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
