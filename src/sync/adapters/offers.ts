import type { DirtyRecord, SyncAdapter, SyncStateRecord } from "../SyncEngine";
import {
  STORES,
  idbGetAllByIndex,
  idbGetByKey,
  idbPut,
} from "@/platform/web/idb";

function api() {
  const w = window as any;
  if (!w.electronAPI) throw new Error("electronAPI not available");
  return w.electronAPI;
}

function syncKey(entity: string) {
  return `kynflow_sync_${entity}`;
}

async function webGetState(entity: string): Promise<SyncStateRecord> {
  try {
    const raw = localStorage.getItem(syncKey(entity));
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function webSetState(entity: string, state: Partial<SyncStateRecord>) {
  const current = await webGetState(entity);
  localStorage.setItem(syncKey(entity), JSON.stringify({ ...current, ...state }));
}

function newerOrMissing(existing: DirtyRecord | undefined, record: DirtyRecord) {
  const incomingTs = record.updatedAt ? new Date(record.updatedAt).getTime() : 0;
  const localTs = existing?.updatedAt
    ? new Date(existing.updatedAt).getTime()
    : 0;
  return !existing || Number(existing.isSynced ?? 1) === 1 || incomingTs > localTs;
}

async function webGetDirtyFromStore(
  store: string,
  licenseId: string,
): Promise<DirtyRecord[]> {
  try {
    const rows = await idbGetAllByIndex<DirtyRecord>(
      store,
      "licenseId",
      licenseId,
    );
    return rows.filter((r) => Number(r.isSynced ?? 0) === 0);
  } catch {
    return [];
  }
}

async function webMarkStoreSynced(store: string, ids: string[], ts: string) {
  for (const id of ids) {
    const row = await idbGetByKey<DirtyRecord>(store, id);
    if (row) await idbPut(store, { ...row, isSynced: 1, syncedAt: ts });
  }
}

async function webUpsertStore(store: string, records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<DirtyRecord>(store, record.id);
    if (newerOrMissing(existing, record)) {
      await idbPut(store, {
        ...existing,
        ...record,
        isActive:
          record.isActive === true ? 1 : record.isActive === false ? 0 : record.isActive,
        customerRequired:
          record.customerRequired === true
            ? 1
            : record.customerRequired === false
              ? 0
              : record.customerRequired,
        oncePerBill:
          record.oncePerBill === true
            ? 1
            : record.oncePerBill === false
              ? 0
              : record.oncePerBill,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
      });
    }
  }
}

function makeAdapter(config: {
  entity: string;
  store: string;
  desktopGetDirty: string;
  desktopMarkSynced: string;
  desktopBulkUpsert: string;
}): SyncAdapter {
  return {
    entity: config.entity,
    getDirtyRecords: async (licenseId) => {
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        const res = await api()[config.desktopGetDirty]?.(licenseId, 500);
        return res?.records ?? [];
      }
      return webGetDirtyFromStore(config.store, licenseId);
    },
    markSynced: async (ids, ts) => {
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        await api()[config.desktopMarkSynced]?.(ids, ts);
        return;
      }
      await webMarkStoreSynced(config.store, ids, ts);
    },
    upsertFromServer: async (records) => {
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        await api()[config.desktopBulkUpsert]?.(records);
        return;
      }
      await webUpsertStore(config.store, records);
    },
    getSyncState: async () => {
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        const state = await api().getSyncState(config.entity);
        return {
          lastPulledAt: state?.lastPulledAt ?? null,
          lastPushedAt: state?.lastPushedAt ?? null,
        };
      }
      return webGetState(config.entity);
    },
    setSyncState: async (state) => {
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        await api().setSyncState(config.entity, state);
        return;
      }
      await webSetState(config.entity, state);
    },
  };
}

export function createOffersAdapter(_isDesktop: boolean): SyncAdapter {
  return makeAdapter({
    entity: "offer",
    store: STORES.OFFERS,
    desktopGetDirty: "getDirtyOffers",
    desktopMarkSynced: "markOffersSynced",
    desktopBulkUpsert: "bulkUpsertOffers",
  });
}

export function createOfferTargetProductsAdapter(
  _isDesktop: boolean,
): SyncAdapter {
  return makeAdapter({
    entity: "offerTargetProduct",
    store: STORES.OFFER_TARGET_PRODUCTS,
    desktopGetDirty: "getDirtyOfferTargetProducts",
    desktopMarkSynced: "markOfferTargetProductsSynced",
    desktopBulkUpsert: "bulkUpsertOfferTargetProducts",
  });
}
