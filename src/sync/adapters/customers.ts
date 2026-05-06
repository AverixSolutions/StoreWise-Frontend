// src/sync/adapters/customers.ts
import type { SyncAdapter, DirtyRecord } from "../SyncEngine";

async function desktopGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  const result = await (window as any).electronAPI.getDirtyCustomers(
    licenseId,
    200,
  );
  return result?.records || [];
}

async function desktopMarkSynced(ids: string[], serverUpdatedAt: string) {
  await (window as any).electronAPI.markCustomersSynced(ids, serverUpdatedAt);
}

async function desktopUpsertFromServer(records: DirtyRecord[]) {
  await (window as any).electronAPI.bulkUpsertCustomers(records);
}

async function desktopGetSyncState() {
  return (window as any).electronAPI.getSyncState("customer");
}

async function desktopSetSyncState(state: any) {
  await (window as any).electronAPI.setSyncState("customer", state);
}

async function webGetDirty(_licenseId: string): Promise<DirtyRecord[]> {
  return [];
}
async function webMarkSynced(_ids: string[], _ts: string) {}
async function webUpsertFromServer(_records: DirtyRecord[]) {}

function _webStateKey() {
  return "syncState:customer";
}

async function webGetSyncState() {
  try {
    const raw = sessionStorage.getItem(_webStateKey());
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function webSetSyncState(state: any) {
  try {
    const prev = await webGetSyncState();
    sessionStorage.setItem(
      _webStateKey(),
      JSON.stringify({ ...prev, ...state }),
    );
  } catch {}
}

export function createCustomersAdapter(isDesktop: boolean): SyncAdapter {
  return {
    entity: "customer",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
