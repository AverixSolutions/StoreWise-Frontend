// src/sync/adapters/shopSettings.ts
import type { SyncAdapter, DirtyRecord, SyncStateRecord } from "../SyncEngine";
import { STORES, idbGetByKey, idbPut } from "@/platform/web/idb";

// ── Desktop helpers ───────────────────────────────────────────────────────────

function api() {
  const w = window as any;
  if (!w.electronAPI) throw new Error("electronAPI not available");
  return w.electronAPI;
}

// ShopSettings is a single record per license — id = licenseId
async function desktopGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  return api().getDirtyShopSettings(licenseId);
}
async function desktopMarkSynced(ids: string[], serverUpdatedAt: string) {
  // ids[0] is the licenseId for shopSettings
  await api().markShopSettingsSynced(ids[0], serverUpdatedAt);
}
async function desktopUpsertFromServer(records: DirtyRecord[]) {
  if (records[0]) await api().upsertShopSettingsFromServer(records[0]);
}
async function desktopGetSyncState(): Promise<SyncStateRecord> {
  const state = await api().getSyncState("shopSettings");
  return {
    lastPulledAt: state?.lastPulledAt ?? null,
    lastPushedAt: state?.lastPushedAt ?? null,
  };
}
async function desktopSetSyncState(state: Partial<SyncStateRecord>) {
  await api().setSyncState("shopSettings", state);
}

// ── Web (IndexedDB) helpers — matches platform/web/shopSettings.ts storage ───

type IDBShopSettings = DirtyRecord & {
  licenseId: string;
  isSynced?: number;
  syncedAt?: string | null;
  syncStatus?: string;
};

async function webGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  try {
    const record = await idbGetByKey<IDBShopSettings>(
      STORES.SHOP_SETTINGS,
      licenseId,
    );
    if (!record) return [];
    // Check both isSynced (new) and syncStatus (existing shopSettings.ts pattern)
    const isDirty =
      Number(record.isSynced ?? 0) === 0 ||
      record.syncStatus === "PENDING" ||
      record.syncStatus === "SYNC_FAILED";
    return isDirty ? [record] : [];
  } catch {
    return [];
  }
}

async function webMarkSynced(_ids: string[], serverUpdatedAt: string) {
  try {
    // ids[0] is licenseId for shopSettings
    const licenseId = _ids[0];
    if (!licenseId) return;
    const record = await idbGetByKey<IDBShopSettings>(
      STORES.SHOP_SETTINGS,
      licenseId,
    );
    if (record) {
      await idbPut(STORES.SHOP_SETTINGS, {
        ...record,
        isSynced: 1,
        syncedAt: serverUpdatedAt,
        syncStatus: "SYNCED",
        lastSyncedAt: serverUpdatedAt,
      });
    }
  } catch {
    /* best effort */
  }
}

async function webUpsertFromServer(records: DirtyRecord[]) {
  if (!records[0]) return;
  try {
    const record = records[0];
    const existing = await idbGetByKey<IDBShopSettings>(
      STORES.SHOP_SETTINGS,
      record.licenseId ?? record.id,
    );

    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing) {
      await idbPut(STORES.SHOP_SETTINGS, {
        ...record,
        licenseId: record.licenseId ?? record.id,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
        syncStatus: "SYNCED",
        lastSyncedAt: new Date().toISOString(),
      });
    } else if (incomingTs > localTs) {
      await idbPut(STORES.SHOP_SETTINGS, {
        ...existing,
        ...record,
        licenseId: existing.licenseId,
        isSynced: 1,
        syncedAt: new Date().toISOString(),
        syncStatus: "SYNCED",
        lastSyncedAt: new Date().toISOString(),
      });
    }
  } catch {
    /* best effort */
  }
}

const WEB_SYNC_KEY = "kynflow_sync_shopSettings";

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

export function createShopSettingsAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "shopSettings",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
