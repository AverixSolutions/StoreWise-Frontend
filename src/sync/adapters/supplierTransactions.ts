// src/sync/adapters/supplierTransactions.ts
import type { SyncAdapter, DirtyRecord } from "../SyncEngine";

// ── Desktop adapter ───────────────────────────────────────────────────────────

async function desktopGetDirty(licenseId: string): Promise<DirtyRecord[]> {
  const api = (window as any).electronAPI;
  const result = await api.getDirtySupplierTransactions(licenseId, 200);
  return (result?.records || []).map((r: any) => ({
    ...r,
    // inflate embedded settlements JSON string → array
    settlements: r.settlementsJson
      ? (() => {
          try {
            return JSON.parse(r.settlementsJson);
          } catch {
            return [];
          }
        })()
      : [],
  }));
}

async function desktopMarkSynced(ids: string[], serverUpdatedAt: string) {
  await (window as any).electronAPI.markSupplierTransactionsSynced(
    ids,
    serverUpdatedAt,
  );
}

async function desktopUpsertFromServer(records: DirtyRecord[]) {
  await (window as any).electronAPI.bulkUpsertSupplierTransactions(records);
}

async function desktopGetSyncState() {
  return (window as any).electronAPI.getSyncState("supplierTransaction");
}

async function desktopSetSyncState(state: any) {
  await (window as any).electronAPI.setSyncState("supplierTransaction", state);
}

// ── Web adapter ───────────────────────────────────────────────────────────────
// Web writes directly to the server DB via API — no local dirty queue needed.
// Pull still runs so the web client stays fresh when desktop pushes new data.

async function webGetDirty(_licenseId: string): Promise<DirtyRecord[]> {
  return [];
}

async function webMarkSynced(_ids: string[], _ts: string) {}

async function webUpsertFromServer(_records: DirtyRecord[]) {
  // Web reads live from the server API — no local store to upsert into.
  // The payment page refreshes via the kynflow:sync:updated event dispatched
  // by SyncEngine after a pull, so no action needed here.
}

function _webStateKey() {
  return "syncState:supplierTransaction";
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

// ── Factory ───────────────────────────────────────────────────────────────────

export function createSupplierTransactionsAdapter(
  isDesktop: boolean,
): SyncAdapter {
  return {
    entity: "supplierTransaction",
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsertFromServer : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetSyncState : webGetSyncState,
    setSyncState: isDesktop ? desktopSetSyncState : webSetSyncState,
  };
}
