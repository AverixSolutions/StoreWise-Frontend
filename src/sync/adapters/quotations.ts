// src/sync/adapters/quotations.ts
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

// ── Quotation header adapter ──────────────────────────────────────────────────

async function desktopGetDirtyQuotations(
  licenseId: string,
): Promise<DirtyRecord[]> {
  try {
    const res = await api().getDirtyQuotations(licenseId, 200);
    return res?.records ?? [];
  } catch {
    return [];
  }
}

async function desktopMarkQuotationsSynced(ids: string[], ts: string) {
  await api().markQuotationsSynced(ids, ts);
}

async function desktopUpsertQuotationsFromServer(records: DirtyRecord[]) {
  if (!records.length) return;
  await api().bulkUpsertQuotations(records);
}

async function webGetDirtyQuotations(_licenseId: string): Promise<DirtyRecord[]> {
  return [];
}

async function webMarkQuotationsSynced(_ids: string[], _ts: string) {}

async function webUpsertQuotationsFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<DirtyRecord>(STORES.QUOTATIONS, record.id);
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing || incomingTs >= localTs) {
      await idbPut(STORES.QUOTATIONS, {
        ...record,
        quotationDate: toIsoString(record.quotationDate),
        entryTime: toIsoString(record.entryTime) ?? null,
        updatedAt: toIsoString(record.updatedAt),
        createdAt: toIsoString(record.createdAt),
        deletedAt: toIsoString(record.deletedAt) ?? null,
      });
    }
  }
}

function quotationSyncKey() {
  return `kynflow_sync_quotation`;
}

async function getQuotationSyncState(): Promise<SyncStateRecord> {
  try {
    const raw = localStorage.getItem(quotationSyncKey());
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function setQuotationSyncState(state: Partial<SyncStateRecord>) {
  const current = await getQuotationSyncState();
  localStorage.setItem(
    quotationSyncKey(),
    JSON.stringify({ ...current, ...state }),
  );
}

async function desktopGetQuotationSyncState(): Promise<SyncStateRecord> {
  try {
    const state = await api().getSyncState("quotation");
    return {
      lastPulledAt: state?.lastPulledAt ?? null,
      lastPushedAt: state?.lastPushedAt ?? null,
    };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function desktopSetQuotationSyncState(state: Partial<SyncStateRecord>) {
  try {
    await api().setSyncState("quotation", state);
  } catch {}
}

export function createQuotationsAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "quotation",
    getDirtyRecords: isDesktop
      ? desktopGetDirtyQuotations
      : webGetDirtyQuotations,
    markSynced: isDesktop
      ? desktopMarkQuotationsSynced
      : webMarkQuotationsSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertQuotationsFromServer
      : webUpsertQuotationsFromServer,
    getSyncState: isDesktop
      ? desktopGetQuotationSyncState
      : getQuotationSyncState,
    setSyncState: isDesktop
      ? desktopSetQuotationSyncState
      : setQuotationSyncState,
  };
}

// ── Quotation item adapter ────────────────────────────────────────────────────

async function desktopGetDirtyQuotationItems(
  licenseId: string,
): Promise<DirtyRecord[]> {
  try {
    const res = await api().getDirtyQuotationItems(licenseId, 500);
    return res?.records ?? [];
  } catch {
    return [];
  }
}

async function desktopMarkQuotationItemsSynced(ids: string[], ts: string) {
  await api().markQuotationItemsSynced(ids, ts);
}

async function desktopUpsertQuotationItemsFromServer(records: DirtyRecord[]) {
  if (!records.length) return;
  await api().bulkUpsertQuotationItems(records);
}

async function webGetDirtyQuotationItems(
  _licenseId: string,
): Promise<DirtyRecord[]> {
  return [];
}

async function webMarkQuotationItemsSynced(_ids: string[], _ts: string) {}

async function webUpsertQuotationItemsFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const existing = await idbGetByKey<DirtyRecord>(
      STORES.QUOTATION_ITEMS,
      record.id,
    );
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing || incomingTs >= localTs) {
      await idbPut(STORES.QUOTATION_ITEMS, {
        ...record,
        updatedAt: toIsoString(record.updatedAt),
        createdAt: toIsoString(record.createdAt),
        deletedAt: toIsoString(record.deletedAt) ?? null,
      });
    }
  }
}

function quotationItemSyncKey() {
  return `kynflow_sync_quotationItem`;
}

async function getQuotationItemSyncState(): Promise<SyncStateRecord> {
  try {
    const raw = localStorage.getItem(quotationItemSyncKey());
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function setQuotationItemSyncState(state: Partial<SyncStateRecord>) {
  const current = await getQuotationItemSyncState();
  localStorage.setItem(
    quotationItemSyncKey(),
    JSON.stringify({ ...current, ...state }),
  );
}

async function desktopGetQuotationItemSyncState(): Promise<SyncStateRecord> {
  try {
    const state = await api().getSyncState("quotationItem");
    return {
      lastPulledAt: state?.lastPulledAt ?? null,
      lastPushedAt: state?.lastPushedAt ?? null,
    };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function desktopSetQuotationItemSyncState(
  state: Partial<SyncStateRecord>,
) {
  try {
    await api().setSyncState("quotationItem", state);
  } catch {}
}

export function createQuotationItemsAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "quotationItem",
    getDirtyRecords: isDesktop
      ? desktopGetDirtyQuotationItems
      : webGetDirtyQuotationItems,
    markSynced: isDesktop
      ? desktopMarkQuotationItemsSynced
      : webMarkQuotationItemsSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertQuotationItemsFromServer
      : webUpsertQuotationItemsFromServer,
    getSyncState: isDesktop
      ? desktopGetQuotationItemSyncState
      : getQuotationItemSyncState,
    setSyncState: isDesktop
      ? desktopSetQuotationItemSyncState
      : setQuotationItemSyncState,
  };
}
