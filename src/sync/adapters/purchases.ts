// src/sync/adapters/purchases.ts

import type { SyncAdapter, DirtyRecord, SyncStateRecord } from "../SyncEngine";
import {
  STORES,
  idbGetAllByIndex,
  idbGetByKey,
  idbPut,
} from "@/platform/web/idb";

// ── Helpers ───────────────────────────────────────────────────────────────────

function api() {
  const w = window as any;
  if (!w.electronAPI) throw new Error("electronAPI not available");
  return w.electronAPI;
}

function toIsoString(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return v as string;
}

// ── Purchase header adapter ───────────────────────────────────────────────────

// Desktop
async function desktopGetDirtyPurchases(
  licenseId: string,
): Promise<DirtyRecord[]> {
  try {
    const res = await api().getDirtyPurchases(licenseId, 200);
    return res?.records ?? [];
  } catch {
    return [];
  }
}

async function desktopMarkPurchasesSynced(
  ids: string[],
  serverUpdatedAt: string,
) {
  await api().markPurchasesSynced(ids, serverUpdatedAt);
}

async function desktopUpsertPurchasesFromServer(records: DirtyRecord[]) {
  if (!records.length) return;
  await api().bulkUpsertPurchases(records);
}

// Web — purchases arrive via pull (never dirty from IDB side since writes go via API)
async function webGetDirtyPurchases(
  _licenseId: string,
): Promise<DirtyRecord[]> {
  return []; // Web writes go via API — nothing is dirty in IDB
}

async function webMarkPurchasesSynced(
  _ids: string[],
  _serverUpdatedAt: string,
) {
  // No-op — IDB purchases are always considered clean (server is source of truth)
}

async function webUpsertPurchasesFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<DirtyRecord>(
      STORES.PURCHASES,
      record.id,
    );
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing || incomingTs >= localTs) {
      await idbPut(STORES.PURCHASES, {
        ...record,
        // Normalize date fields from Prisma (Date objects → ISO strings)
        purchaseDate: toIsoString(record.purchaseDate),
        entryTime: toIsoString(record.entryTime) ?? null,
        updatedAt: toIsoString(record.updatedAt),
        createdAt: toIsoString(record.createdAt),
        deletedAt: toIsoString(record.deletedAt) ?? null,
      });
    }
  }
}

// Sync state — localStorage keyed per entity
function purchaseSyncKey() {
  return `kynflow_sync_purchase`;
}

async function getPurchaseSyncState(): Promise<SyncStateRecord> {
  try {
    const raw = localStorage.getItem(purchaseSyncKey());
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function setPurchaseSyncState(state: Partial<SyncStateRecord>) {
  const current = await getPurchaseSyncState();
  localStorage.setItem(
    purchaseSyncKey(),
    JSON.stringify({ ...current, ...state }),
  );
}

// Desktop uses IPC sync-state
async function desktopGetPurchaseSyncState(): Promise<SyncStateRecord> {
  try {
    const state = await api().getSyncState("purchase");
    return {
      lastPulledAt: state?.lastPulledAt ?? null,
      lastPushedAt: state?.lastPushedAt ?? null,
    };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function desktopSetPurchaseSyncState(state: Partial<SyncStateRecord>) {
  try {
    await api().setSyncState("purchase", state);
  } catch {}
}

export function createPurchasesAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "purchase",
    getDirtyRecords: isDesktop
      ? desktopGetDirtyPurchases
      : webGetDirtyPurchases,
    markSynced: isDesktop ? desktopMarkPurchasesSynced : webMarkPurchasesSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertPurchasesFromServer
      : webUpsertPurchasesFromServer,
    getSyncState: isDesktop
      ? desktopGetPurchaseSyncState
      : getPurchaseSyncState,
    setSyncState: isDesktop
      ? desktopSetPurchaseSyncState
      : setPurchaseSyncState,
  };
}

// ── Purchase item adapter ─────────────────────────────────────────────────────

// Desktop
async function desktopGetDirtyPurchaseItems(
  licenseId: string,
): Promise<DirtyRecord[]> {
  try {
    const res = await api().getDirtyPurchaseItems(licenseId, 500);
    return res?.records ?? [];
  } catch {
    return [];
  }
}

async function desktopMarkPurchaseItemsSynced(
  ids: string[],
  serverUpdatedAt: string,
) {
  await api().markPurchaseItemsSynced(ids, serverUpdatedAt);
}

async function desktopUpsertPurchaseItemsFromServer(records: DirtyRecord[]) {
  if (!records.length) return;
  await api().bulkUpsertPurchaseItems(records);
}

// Web
async function webGetDirtyPurchaseItems(
  _licenseId: string,
): Promise<DirtyRecord[]> {
  return []; // Writes go via API
}

async function webMarkPurchaseItemsSynced(_ids: string[], _ts: string) {}

async function webUpsertPurchaseItemsFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<DirtyRecord>(
      STORES.PURCHASE_ITEMS,
      record.id,
    );
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing || incomingTs >= localTs) {
      await idbPut(STORES.PURCHASE_ITEMS, {
        ...record,
        updatedAt: toIsoString(record.updatedAt),
        createdAt: toIsoString(record.createdAt),
        deletedAt: toIsoString(record.deletedAt) ?? null,
        // Normalize boolean isFree
        isFree: record.isFree === true || record.isFree === 1 ? 1 : 0,
      });
    }
  }
}

function purchaseItemSyncKey() {
  return `kynflow_sync_purchaseItem`;
}

async function getPurchaseItemSyncState(): Promise<SyncStateRecord> {
  try {
    const raw = localStorage.getItem(purchaseItemSyncKey());
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function setPurchaseItemSyncState(state: Partial<SyncStateRecord>) {
  const current = await getPurchaseItemSyncState();
  localStorage.setItem(
    purchaseItemSyncKey(),
    JSON.stringify({ ...current, ...state }),
  );
}

async function desktopGetPurchaseItemSyncState(): Promise<SyncStateRecord> {
  try {
    const state = await api().getSyncState("purchaseItem");
    return {
      lastPulledAt: state?.lastPulledAt ?? null,
      lastPushedAt: state?.lastPushedAt ?? null,
    };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function desktopSetPurchaseItemSyncState(
  state: Partial<SyncStateRecord>,
) {
  try {
    await api().setSyncState("purchaseItem", state);
  } catch {}
}

export function createPurchaseItemsAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "purchaseItem",
    getDirtyRecords: isDesktop
      ? desktopGetDirtyPurchaseItems
      : webGetDirtyPurchaseItems,
    markSynced: isDesktop
      ? desktopMarkPurchaseItemsSynced
      : webMarkPurchaseItemsSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertPurchaseItemsFromServer
      : webUpsertPurchaseItemsFromServer,
    getSyncState: isDesktop
      ? desktopGetPurchaseItemSyncState
      : getPurchaseItemSyncState,
    setSyncState: isDesktop
      ? desktopSetPurchaseItemSyncState
      : setPurchaseItemSyncState,
  };
}
