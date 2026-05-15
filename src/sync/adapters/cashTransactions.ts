import type { SyncAdapter, DirtyRecord } from "../SyncEngine";

async function desktopGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  const res = await (window as any).electronAPI.getDirtyCashTransactions(
    licenseId,
    200,
  );
  return res?.records ?? [];
}

async function desktopMarkSynced(ids: string[], serverUpdatedAt: string) {
  await (window as any).electronAPI.markCashTransactionsSynced(
    ids,
    serverUpdatedAt,
  );
}

async function desktopUpsertFromServer(records: DirtyRecord[]) {
  if (!records.length) return;
  await (window as any).electronAPI.bulkUpsertCashTransactions(records);
}

async function desktopGetSyncState() {
  return (window as any).electronAPI.getSyncState("cashTransaction");
}

async function desktopSetSyncState(state: any) {
  await (window as any).electronAPI.setSyncState("cashTransaction", state);
}

async function webGetDirty(_licenseId: string): Promise<DirtyRecord[]> {
  return [];
}

async function webMarkSynced(_ids: string[], _ts: string) {}

async function webUpsertFromServer(_records: DirtyRecord[]) {
  // Web receipt and ledger screens read from the backend API directly.
}

function webStateKey() {
  return "syncState:cashTransaction";
}

async function webGetSyncState() {
  try {
    const raw = sessionStorage.getItem(webStateKey());
    return raw ? JSON.parse(raw) : { lastPulledAt: null, lastPushedAt: null };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null };
  }
}

async function webSetSyncState(state: any) {
  try {
    const prev = await webGetSyncState();
    sessionStorage.setItem(webStateKey(), JSON.stringify({ ...prev, ...state }));
  } catch {}
}

export function createCashTransactionsAdapter(
  isDesktop: boolean,
): SyncAdapter {
  return {
    entity: "cashTransaction",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
