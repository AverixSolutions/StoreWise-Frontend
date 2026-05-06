// src/sync/adapters/purchaseReturns.ts
import type { SyncAdapter, DirtyRecord } from "../SyncEngine";

// ── Desktop ───────────────────────────────────────────────────────────────────

async function desktopGetDirtyReturns(
  licenseId: string,
): Promise<DirtyRecord[]> {
  const result = await (window as any).electronAPI.getDirtyPurchaseReturns(
    licenseId,
    200,
  );
  return result?.records || [];
}
async function desktopMarkReturnsSynced(ids: string[], ts: string) {
  await (window as any).electronAPI.markPurchaseReturnsSynced(ids, ts);
}
async function desktopUpsertReturnsFromServer(records: DirtyRecord[]) {
  await (window as any).electronAPI.bulkUpsertPurchaseReturns(records);
}
async function desktopGetReturnsSyncState() {
  return (window as any).electronAPI.getSyncState("purchaseReturn");
}
async function desktopSetReturnsSyncState(state: any) {
  await (window as any).electronAPI.setSyncState("purchaseReturn", state);
}

// ── Desktop items ─────────────────────────────────────────────────────────────

async function desktopGetDirtyReturnItems(
  licenseId: string,
): Promise<DirtyRecord[]> {
  const result = await (window as any).electronAPI.getDirtyPurchaseReturnItems(
    licenseId,
    500,
  );
  return result?.records || [];
}
async function desktopMarkReturnItemsSynced(ids: string[], ts: string) {
  await (window as any).electronAPI.markPurchaseReturnItemsSynced(ids, ts);
}
async function desktopUpsertReturnItemsFromServer(records: DirtyRecord[]) {
  await (window as any).electronAPI.bulkUpsertPurchaseReturnItems(records);
}
async function desktopGetReturnItemsSyncState() {
  return (window as any).electronAPI.getSyncState("purchaseReturnItem");
}
async function desktopSetReturnItemsSyncState(state: any) {
  await (window as any).electronAPI.setSyncState("purchaseReturnItem", state);
}

// ── Desktop holds ─────────────────────────────────────────────────────────────

async function desktopGetDirtyReturnHolds(
  licenseId: string,
): Promise<DirtyRecord[]> {
  const result = await (window as any).electronAPI.getDirtyPurchaseReturnHolds(
    licenseId,
    200,
  );
  return result?.records || [];
}
async function desktopMarkReturnHoldsSynced(ids: string[], ts: string) {
  await (window as any).electronAPI.markPurchaseReturnHoldsSynced(ids, ts);
}
async function desktopUpsertReturnHoldsFromServer(records: DirtyRecord[]) {
  await (window as any).electronAPI.bulkUpsertPurchaseReturnHolds(records);
}
async function desktopGetReturnHoldsSyncState() {
  return (window as any).electronAPI.getSyncState("purchaseReturnHold");
}
async function desktopSetReturnHoldsSyncState(state: any) {
  await (window as any).electronAPI.setSyncState("purchaseReturnHold", state);
}

// ── Web stubs ─────────────────────────────────────────────────────────────────

async function webGetDirty(_licenseId: string): Promise<DirtyRecord[]> {
  return [];
}
async function webMarkSynced(_ids: string[], _ts: string) {}
async function webUpsertFromServer(_records: DirtyRecord[]) {}

function makeWebState(key: string) {
  return {
    get: async () => {
      try {
        const raw = sessionStorage.getItem(key);
        return raw
          ? JSON.parse(raw)
          : { lastPulledAt: null, lastPushedAt: null };
      } catch {
        return { lastPulledAt: null, lastPushedAt: null };
      }
    },
    set: async (state: any) => {
      try {
        const prev = await makeWebState(key).get();
        sessionStorage.setItem(key, JSON.stringify({ ...prev, ...state }));
      } catch {}
    },
  };
}

// ── Factories ─────────────────────────────────────────────────────────────────

export function createPurchaseReturnsAdapter(isDesktop: boolean): SyncAdapter {
  const ws = makeWebState("syncState:purchaseReturn");
  return {
    entity: "purchaseReturn",
    getDirtyRecords: isDesktop ? desktopGetDirtyReturns : webGetDirty,
    markSynced: isDesktop ? desktopMarkReturnsSynced : webMarkSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertReturnsFromServer
      : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetReturnsSyncState : ws.get,
    setSyncState: isDesktop ? desktopSetReturnsSyncState : ws.set,
  };
}

export function createPurchaseReturnItemsAdapter(
  isDesktop: boolean,
): SyncAdapter {
  const ws = makeWebState("syncState:purchaseReturnItem");
  return {
    entity: "purchaseReturnItem",
    getDirtyRecords: isDesktop ? desktopGetDirtyReturnItems : webGetDirty,
    markSynced: isDesktop ? desktopMarkReturnItemsSynced : webMarkSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertReturnItemsFromServer
      : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetReturnItemsSyncState : ws.get,
    setSyncState: isDesktop ? desktopSetReturnItemsSyncState : ws.set,
  };
}

export function createPurchaseReturnHoldsAdapter(
  isDesktop: boolean,
): SyncAdapter {
  const ws = makeWebState("syncState:purchaseReturnHold");
  return {
    entity: "purchaseReturnHold",
    getDirtyRecords: isDesktop ? desktopGetDirtyReturnHolds : webGetDirty,
    markSynced: isDesktop ? desktopMarkReturnHoldsSynced : webMarkSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertReturnHoldsFromServer
      : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetReturnHoldsSyncState : ws.get,
    setSyncState: isDesktop ? desktopSetReturnHoldsSyncState : ws.set,
  };
}
