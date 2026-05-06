// src/sync/adapters/transactionTypes.ts
import type { SyncAdapter, DirtyRecord, SyncStateRecord } from "../SyncEngine";
import {
  STORES,
  idbGetAllByIndex,
  idbGetByKey,
  idbPut,
} from "@/platform/web/idb";

type IDBTransactionType = DirtyRecord & {
  licenseId: string;
  isSynced?: number;
  syncedAt?: string | null;
  deletedAt?: string | null;
};

// ── Desktop helpers ───────────────────────────────────────────────────────────

function api() {
  const w = window as any;
  if (!w.electronAPI) throw new Error("electronAPI not available");
  return w.electronAPI;
}

async function desktopGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  return api().getDirtyTransactionTypes?.(licenseId, 200) ?? [];
}
async function desktopMarkSynced(ids: string[], ts: string) {
  await api().markTransactionTypesSynced?.(ids, ts);
}
async function desktopUpsertFromServer(records: DirtyRecord[]) {
  await api().bulkUpsertTransactionTypes?.(records);
}
async function desktopGetSyncState(): Promise<SyncStateRecord> {
  const state = await api().getSyncState("transactionTypes");
  return {
    lastPulledAt: state?.lastPulledAt ?? null,
    lastPushedAt: state?.lastPushedAt ?? null,
  };
}
async function desktopSetSyncState(state: Partial<SyncStateRecord>) {
  await api().setSyncState("transactionTypes", state);
}

// ── Web (IndexedDB) helpers ───────────────────────────────────────────────────

async function webGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  try {
    const all = await idbGetAllByIndex<IDBTransactionType>(
      STORES.TRANSACTION_TYPES,
      "licenseId",
      licenseId,
    );
    return all.filter((r) => Number(r.isSynced ?? 0) === 0);
  } catch {
    return [];
  }
}

async function webMarkSynced(ids: string[], ts: string) {
  for (const id of ids) {
    const rec = await idbGetByKey<IDBTransactionType>(
      STORES.TRANSACTION_TYPES,
      id,
    );
    if (rec) {
      await idbPut(STORES.TRANSACTION_TYPES, {
        ...rec,
        isSynced: 1,
        syncedAt: ts,
      });
    }
  }
}

async function webUpsertFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<IDBTransactionType>(
      STORES.TRANSACTION_TYPES,
      record.id,
    );
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing) {
      await idbPut(STORES.TRANSACTION_TYPES, {
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    } else if (Number(existing.isSynced ?? 0) === 1 && incomingTs > localTs) {
      await idbPut(STORES.TRANSACTION_TYPES, {
        ...existing,
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    }
    // local dirty wins — push cycle handles it
  }
}

const WEB_SYNC_KEY = "kynflow_sync_transactionTypes";
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

export function createTransactionTypesAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "transactionType",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
