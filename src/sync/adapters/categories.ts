// src/sync/adapters/categories.ts
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
  return api().getDirtyCategories(licenseId, 200);
}
async function desktopMarkSynced(ids: string[], serverUpdatedAt: string) {
  await api().markCategoriesSynced(ids, serverUpdatedAt);
}
async function desktopUpsertFromServer(records: DirtyRecord[]) {
  await api().bulkUpsertCategories(records);
}
async function desktopGetSyncState(): Promise<SyncStateRecord> {
  const state = await api().getSyncState("categories");
  return {
    lastPulledAt: state?.lastPulledAt ?? null,
    lastPushedAt: state?.lastPushedAt ?? null,
  };
}
async function desktopSetSyncState(state: Partial<SyncStateRecord>) {
  await api().setSyncState("categories", state);
}

// ── Web (IndexedDB) helpers ───────────────────────────────────────────────────

type IDBCategory = DirtyRecord & {
  licenseId: string;
  isSynced?: number;
  syncedAt?: string | null;
};

async function webGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  const all = await idbGetAllByIndex<IDBCategory>(
    STORES.CATEGORIES,
    "licenseId",
    licenseId,
  );
  return all.filter((c) => Number(c.isSynced ?? 0) === 0);
}

async function webMarkSynced(ids: string[], serverUpdatedAt: string) {
  for (const id of ids) {
    const cat = await idbGetByKey<IDBCategory>(STORES.CATEGORIES, id);
    if (cat)
      await idbPut(STORES.CATEGORIES, {
        ...cat,
        isSynced: 1,
        syncedAt: serverUpdatedAt,
      });
  }
}

async function webUpsertFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<IDBCategory>(
      STORES.CATEGORIES,
      record.id,
    );
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing) {
      await idbPut(STORES.CATEGORIES, {
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    } else if (Number(existing.isSynced ?? 0) === 1 && incomingTs > localTs) {
      await idbPut(STORES.CATEGORIES, {
        ...existing,
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    }
    // If local is dirty (isSynced=0), skip — push cycle will handle it
  }
}

const WEB_SYNC_KEY = "kynflow_sync_categories";
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

export function createCategoriesAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "category",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
