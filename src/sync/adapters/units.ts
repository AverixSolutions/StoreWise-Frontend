// src/sync/adapters/units.ts
import type { SyncAdapter, DirtyRecord, SyncStateRecord } from "../SyncEngine";
import {
  STORES,
  idbDelete,
  idbGetAllByIndex,
  idbGetByKey,
  idbPut,
} from "@/platform/web/idb";

function api() {
  const w = window as any;
  if (!w.electronAPI) throw new Error("electronAPI not available");
  return w.electronAPI;
}

async function desktopGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  return api().getDirtyUnits(licenseId, 200);
}
async function desktopMarkSynced(ids: string[], serverUpdatedAt: string) {
  await api().markUnitsSynced(ids, serverUpdatedAt);
}
async function desktopUpsertFromServer(records: DirtyRecord[]) {
  console.log(
    "[units adapter] desktopUpsertFromServer called with",
    records.length,
    "records",
  );
  const result = await api().bulkUpsertUnits(records);
  console.log("[units adapter] bulkUpsert result:", JSON.stringify(result));
}
async function desktopGetSyncState(): Promise<SyncStateRecord> {
  const state = await api().getSyncState("units");
  return {
    lastPulledAt: state?.lastPulledAt ?? null,
    lastPushedAt: state?.lastPushedAt ?? null,
  };
}
async function desktopSetSyncState(state: Partial<SyncStateRecord>) {
  await api().setSyncState("units", state);
}

type IDBUnit = DirtyRecord & {
  licenseId: string;
  isSynced?: number;
  syncedAt?: string | null;
};

async function webGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  const all = await idbGetAllByIndex<IDBUnit>(
    STORES.UNITS,
    "licenseId",
    licenseId,
  );
  return all.filter((u) => Number(u.isSynced ?? 0) === 0);
}
async function webMarkSynced(ids: string[], serverUpdatedAt: string) {
  for (const id of ids) {
    const unit = await idbGetByKey<IDBUnit>(STORES.UNITS, id);
    if (unit)
      await idbPut(STORES.UNITS, {
        ...unit,
        isSynced: 1,
        syncedAt: serverUpdatedAt,
      });
  }
}
async function webUpsertFromServer(records: DirtyRecord[]) {
  for (const record of records) {
    const now = new Date().toISOString();
    const incomingTs = record.updatedAt
      ? new Date(record.updatedAt).getTime()
      : 0;

    // ── Resolve UUID conflict: same (licenseId, code) but different id ──────
    // This happens when web and desktop each seeded the 4 defaults independently.
    const allForLicense = await idbGetAllByIndex<IDBUnit>(
      STORES.UNITS,
      "licenseId",
      record.licenseId,
    );
    const sameCode = allForLicense.find(
      (u) => u.code === record.code && u.id !== record.id,
    );
    if (sameCode) {
      // Delete the stale local UUID so server's canonical id wins
      await idbDelete(STORES.UNITS, sameCode.id);
    }
    // ────────────────────────────────────────────────────────────────────────

    const existing = await idbGetByKey<IDBUnit>(STORES.UNITS, record.id);
    const localTs = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing) {
      await idbPut(STORES.UNITS, {
        ...record,
        isSynced: 1,
        syncedAt: now,
      });
    } else if (Number(existing.isSynced ?? 0) === 1 && incomingTs >= localTs) {
      await idbPut(STORES.UNITS, {
        ...existing,
        ...record,
        isSynced: 1,
        syncedAt: now,
      });
    }
    // If existing.isSynced === 0 (locally dirty), leave it — push wins
  }
}

const WEB_SYNC_KEY = "kynflow_sync_units";
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

export function createUnitsAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "unit",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
