// src/sync/adapters/taxCategories.ts
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
  // Returns records with nested components + defaults already attached
  return api().getDirtyTaxCategories(licenseId, 200);
}
async function desktopMarkSynced(ids: string[], serverUpdatedAt: string) {
  await api().markTaxCategoriesSynced(ids, serverUpdatedAt);
}
async function desktopUpsertFromServer(records: DirtyRecord[]) {
  await api().bulkUpsertTaxCategories(records);
}
async function desktopGetSyncState(): Promise<SyncStateRecord> {
  const state = await api().getSyncState("taxCategories");
  return {
    lastPulledAt: state?.lastPulledAt ?? null,
    lastPushedAt: state?.lastPushedAt ?? null,
  };
}
async function desktopSetSyncState(state: Partial<SyncStateRecord>) {
  await api().setSyncState("taxCategories", state);
}

// ── Web (IndexedDB) helpers ───────────────────────────────────────────────────
// Tax categories on web are stored in IDB (STORES.TAX_CATEGORIES)

type IDBTaxCategory = DirtyRecord & {
  licenseId: string;
  isSynced?: number;
  syncedAt?: string | null;
  deletedAt?: string | null;
  components?: any[];
  defaults?: any;
};

async function webGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  try {
    const all = await idbGetAllByIndex<IDBTaxCategory>(
      STORES.TAX_CATEGORIES,
      "licenseId",
      licenseId,
    );
    return all.filter((t) => Number(t.isSynced ?? 0) === 0);
  } catch {
    return [];
  }
}

async function webMarkSynced(ids: string[], serverUpdatedAt: string) {
  for (const id of ids) {
    const cat = await idbGetByKey<IDBTaxCategory>(STORES.TAX_CATEGORIES, id);
    if (cat) {
      await idbPut(STORES.TAX_CATEGORIES, {
        ...cat,
        isSynced: 1,
        syncedAt: serverUpdatedAt,
      });
    }
  }
}

async function webUpsertFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<IDBTaxCategory>(
      STORES.TAX_CATEGORIES,
      record.id,
    );
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing) {
      await idbPut(STORES.TAX_CATEGORIES, {
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    } else if (Number(existing.isSynced ?? 0) === 1 && incomingTs > localTs) {
      await idbPut(STORES.TAX_CATEGORIES, {
        ...existing,
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    }
    // If local is dirty (isSynced=0), skip — push cycle will handle it
  }
}

const WEB_SYNC_KEY = "kynflow_sync_taxCategories";
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

export function createTaxCategoriesAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "taxCategory",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
