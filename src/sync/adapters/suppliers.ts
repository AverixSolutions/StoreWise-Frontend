// frontend/src/sync/adapters/suppliers.ts
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
  return api().getDirtySuppliers(licenseId, 200) as Promise<DirtyRecord[]>;
}

async function desktopMarkSynced(ids: string[], serverUpdatedAt: string) {
  await api().markSuppliersSynced(ids, serverUpdatedAt);
}

async function desktopUpsertFromServer(records: DirtyRecord[]) {
  await api().bulkUpsertSuppliers(records);
}

async function desktopGetSyncState(): Promise<SyncStateRecord> {
  const state = await api().getSyncState("suppliers");
  return {
    lastPulledAt: state?.lastPulledAt ?? null,
    lastPushedAt: state?.lastPushedAt ?? null,
  };
}

async function desktopSetSyncState(state: Partial<SyncStateRecord>) {
  await api().setSyncState("suppliers", state);
}

// ── Web (IndexedDB) implementation ────────────────────────────────────────

type IDBSupplier = DirtyRecord & {
  licenseId: string;
  name: string;
  isSynced?: number | boolean;
  syncedAt?: string | null;
};

async function webGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  const all = await idbGetAllByIndex<IDBSupplier>(
    STORES.SUPPLIERS,
    "licenseId",
    licenseId,
  );
  return all.filter((s) => Number(s.isSynced ?? 0) === 0);
}

async function webMarkSynced(ids: string[], serverUpdatedAt: string) {
  for (const id of ids) {
    const supplier = await idbGetByKey<IDBSupplier>(STORES.SUPPLIERS, id);
    if (supplier) {
      await idbPut(STORES.SUPPLIERS, {
        ...supplier,
        isSynced: 1,
        syncedAt: serverUpdatedAt,
      });
    }
  }
}

async function webUpsertFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<IDBSupplier>(
      STORES.SUPPLIERS,
      record.id,
    );
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing) {
      await idbPut(STORES.SUPPLIERS, {
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    } else if (Number(existing.isSynced ?? 0) === 1 && incomingTs > localTs) {
      await idbPut(STORES.SUPPLIERS, {
        ...existing,
        ...record,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    }
  }
}

const WEB_SYNC_KEY = "kynflow_sync_suppliers";

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

export function createSuppliersAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "supplier",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
