// src/sync/adapters/sales.ts

import type { SyncAdapter, DirtyRecord, SyncStateRecord } from "../SyncEngine";
import { STORES, idbGetByKey, idbPut } from "@/platform/web/idb";

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

// ── Sale header adapter ───────────────────────────────────────────────────────

async function desktopGetDirtySales(licenseId: string): Promise<DirtyRecord[]> {
  try {
    const res = await api().getDirtySales(licenseId, 200);
    return res?.records ?? [];
  } catch {
    return [];
  }
}

async function desktopMarkSalesSynced(ids: string[], serverUpdatedAt: string) {
  await api().markSalesSynced(ids, serverUpdatedAt);
}

async function desktopUpsertSalesFromServer(records: DirtyRecord[]) {
  if (!records.length) return;
  await api().bulkUpsertSales(records);
}

async function webGetDirtySales(_licenseId: string): Promise<DirtyRecord[]> {
  return [];
}

async function webMarkSalesSynced(_ids: string[], _serverUpdatedAt: string) {}

async function webUpsertSalesFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<DirtyRecord>(STORES.SALES, record.id);
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing || incomingTs >= localTs) {
      await idbPut(STORES.SALES, {
        ...record,
        saleDate: toIsoString(record.saleDate),
        entryTime: toIsoString(record.entryTime) ?? null,
        updatedAt: toIsoString(record.updatedAt),
        createdAt: toIsoString(record.createdAt),
        deletedAt: toIsoString(record.deletedAt) ?? null,
      });
    }
  }
}

function saleSyncKey() {
  return `kynflow_sync_sale`;
}

async function getSaleSyncState(): Promise<SyncStateRecord> {
  try {
    const raw = localStorage.getItem(saleSyncKey());
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function setSaleSyncState(state: Partial<SyncStateRecord>) {
  const current = await getSaleSyncState();
  localStorage.setItem(saleSyncKey(), JSON.stringify({ ...current, ...state }));
}

async function desktopGetSaleSyncState(): Promise<SyncStateRecord> {
  try {
    const state = await api().getSyncState("sale");
    return {
      lastPulledAt: state?.lastPulledAt ?? null,
      lastPushedAt: state?.lastPushedAt ?? null,
    };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function desktopSetSaleSyncState(state: Partial<SyncStateRecord>) {
  try {
    await api().setSyncState("sale", state);
  } catch {}
}

export function createSalesAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "sale",
    getDirtyRecords: isDesktop ? desktopGetDirtySales : webGetDirtySales,
    markSynced: isDesktop ? desktopMarkSalesSynced : webMarkSalesSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertSalesFromServer
      : webUpsertSalesFromServer,
    getSyncState: isDesktop ? desktopGetSaleSyncState : getSaleSyncState,
    setSyncState: isDesktop ? desktopSetSaleSyncState : setSaleSyncState,
  };
}

// ── Sale item adapter ─────────────────────────────────────────────────────────

async function desktopGetDirtySaleItems(
  licenseId: string,
): Promise<DirtyRecord[]> {
  try {
    const res = await api().getDirtySaleItems(licenseId, 500);
    return res?.records ?? [];
  } catch {
    return [];
  }
}

async function desktopMarkSaleItemsSynced(ids: string[], ts: string) {
  await api().markSaleItemsSynced(ids, ts);
}

async function desktopUpsertSaleItemsFromServer(records: DirtyRecord[]) {
  if (!records.length) return;
  await api().bulkUpsertSaleItems(records);
}

async function webGetDirtySaleItems(
  _licenseId: string,
): Promise<DirtyRecord[]> {
  return [];
}

async function webMarkSaleItemsSynced(_ids: string[], _ts: string) {}

async function webUpsertSaleItemsFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<DirtyRecord>(
      STORES.SALE_ITEMS,
      record.id,
    );
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing || incomingTs >= localTs) {
      await idbPut(STORES.SALE_ITEMS, {
        ...record,
        updatedAt: toIsoString(record.updatedAt),
        createdAt: toIsoString(record.createdAt),
        deletedAt: toIsoString(record.deletedAt) ?? null,
        isFree: record.isFree === true || record.isFree === 1 ? 1 : 0,
      });
    }
  }
}

function saleItemSyncKey() {
  return `kynflow_sync_saleItem`;
}

async function getSaleItemSyncState(): Promise<SyncStateRecord> {
  try {
    const raw = localStorage.getItem(saleItemSyncKey());
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function setSaleItemSyncState(state: Partial<SyncStateRecord>) {
  const current = await getSaleItemSyncState();
  localStorage.setItem(
    saleItemSyncKey(),
    JSON.stringify({ ...current, ...state }),
  );
}

async function desktopGetSaleItemSyncState(): Promise<SyncStateRecord> {
  try {
    const state = await api().getSyncState("saleItem");
    return {
      lastPulledAt: state?.lastPulledAt ?? null,
      lastPushedAt: state?.lastPushedAt ?? null,
    };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function desktopSetSaleItemSyncState(state: Partial<SyncStateRecord>) {
  try {
    await api().setSyncState("saleItem", state);
  } catch {}
}

export function createSaleItemsAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "saleItem",
    getDirtyRecords: isDesktop
      ? desktopGetDirtySaleItems
      : webGetDirtySaleItems,
    markSynced: isDesktop ? desktopMarkSaleItemsSynced : webMarkSaleItemsSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertSaleItemsFromServer
      : webUpsertSaleItemsFromServer,
    getSyncState: isDesktop
      ? desktopGetSaleItemSyncState
      : getSaleItemSyncState,
    setSyncState: isDesktop
      ? desktopSetSaleItemSyncState
      : setSaleItemSyncState,
  };
}

// ── Sale hold adapter ─────────────────────────────────────────────────────────
// Holds are not stored in IDB on web (web reads directly from the API).
// On desktop, holds live in SQLite and sync via push/pull like sales.
// Web side: getDirtyRecords returns [] (nothing to push), upsertFromServer
// is a no-op (web always reads live from API, not from IDB).

async function desktopGetDirtySaleHolds(
  licenseId: string,
): Promise<DirtyRecord[]> {
  try {
    const res = await api().getDirtySaleHolds(licenseId, 200);
    return res?.records ?? [];
  } catch {
    return [];
  }
}

async function desktopMarkSaleHoldsSynced(ids: string[], ts: string) {
  await api().markSaleHoldsSynced(ids, ts);
}

async function desktopUpsertSaleHoldsFromServer(records: DirtyRecord[]) {
  if (!records.length) return;
  await api().bulkUpsertSaleHolds(records);
}

// Web has nothing to push — holds go straight to the API on write
async function webGetDirtySaleHolds(
  _licenseId: string,
): Promise<DirtyRecord[]> {
  return [];
}

async function webMarkSaleHoldsSynced(_ids: string[], _ts: string) {}

// Web has nothing to upsert locally — it reads directly from API
async function webUpsertSaleHoldsFromServer(_records: DirtyRecord[]) {}

function saleHoldSyncKey() {
  return `kynflow_sync_saleHold`;
}

async function getSaleHoldSyncState(): Promise<SyncStateRecord> {
  try {
    const raw = localStorage.getItem(saleHoldSyncKey());
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function setSaleHoldSyncState(state: Partial<SyncStateRecord>) {
  const current = await getSaleHoldSyncState();
  localStorage.setItem(
    saleHoldSyncKey(),
    JSON.stringify({ ...current, ...state }),
  );
}

async function desktopGetSaleHoldSyncState(): Promise<SyncStateRecord> {
  try {
    const state = await api().getSyncState("saleHold");
    return {
      lastPulledAt: state?.lastPulledAt ?? null,
      lastPushedAt: state?.lastPushedAt ?? null,
    };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function desktopSetSaleHoldSyncState(state: Partial<SyncStateRecord>) {
  try {
    await api().setSyncState("saleHold", state);
  } catch {}
}

export function createSaleHoldsAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "saleHold",
    getDirtyRecords: isDesktop
      ? desktopGetDirtySaleHolds
      : webGetDirtySaleHolds,
    markSynced: isDesktop ? desktopMarkSaleHoldsSynced : webMarkSaleHoldsSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertSaleHoldsFromServer
      : webUpsertSaleHoldsFromServer,
    getSyncState: isDesktop
      ? desktopGetSaleHoldSyncState
      : getSaleHoldSyncState,
    setSyncState: isDesktop
      ? desktopSetSaleHoldSyncState
      : setSaleHoldSyncState,
  };
}
