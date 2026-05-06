// src/sync/adapters/saleReturns.ts
import type { SyncAdapter, DirtyRecord } from "../SyncEngine";

// ── Desktop ───────────────────────────────────────────────────────────────────

// getDirtySaleReturns is not exposed in preload.js — stub returns empty
async function desktopGetDirtyReturns(
  _licenseId: string,
): Promise<DirtyRecord[]> {
  return [];
}

// markSaleReturnsSynced IS in preload: "sale-return:mark-synced"
async function desktopMarkReturnsSynced(ids: string[], ts: string) {
  await (window as any).electronAPI.markSaleReturnsSynced(ids, ts);
}

// bulkUpsertSaleReturns is not exposed in preload.js — no-op
async function desktopUpsertReturnsFromServer(_records: DirtyRecord[]) {}

async function desktopGetReturnsSyncState() {
  return (window as any).electronAPI.getSyncState("saleReturn");
}
async function desktopSetReturnsSyncState(state: any) {
  await (window as any).electronAPI.setSyncState("saleReturn", state);
}

// ── Desktop items ─────────────────────────────────────────────────────────────

// getDirtySaleReturnItems is not exposed in preload.js — stub returns empty
async function desktopGetDirtyReturnItems(
  _licenseId: string,
): Promise<DirtyRecord[]> {
  return [];
}

// markSaleReturnItemsSynced is not exposed in preload.js — no-op
async function desktopMarkReturnItemsSynced(_ids: string[], _ts: string) {}

// bulkUpsertSaleReturnItems is not exposed in preload.js — no-op
async function desktopUpsertReturnItemsFromServer(_records: DirtyRecord[]) {}

async function desktopGetReturnItemsSyncState() {
  return (window as any).electronAPI.getSyncState("saleReturnItem");
}
async function desktopSetReturnItemsSyncState(state: any) {
  await (window as any).electronAPI.setSyncState("saleReturnItem", state);
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

export function createSaleReturnsAdapter(isDesktop: boolean): SyncAdapter {
  const ws = makeWebState("syncState:saleReturn");
  return {
    entity: "saleReturn",
    getDirtyRecords: isDesktop ? desktopGetDirtyReturns : webGetDirty,
    markSynced: isDesktop ? desktopMarkReturnsSynced : webMarkSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertReturnsFromServer
      : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetReturnsSyncState : ws.get,
    setSyncState: isDesktop ? desktopSetReturnsSyncState : ws.set,
  };
}

export function createSaleReturnItemsAdapter(isDesktop: boolean): SyncAdapter {
  const ws = makeWebState("syncState:saleReturnItem");
  return {
    entity: "saleReturnItem",
    getDirtyRecords: isDesktop ? desktopGetDirtyReturnItems : webGetDirty,
    markSynced: isDesktop ? desktopMarkReturnItemsSynced : webMarkSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertReturnItemsFromServer
      : webUpsertFromServer,
    getSyncState: isDesktop ? desktopGetReturnItemsSyncState : ws.get,
    setSyncState: isDesktop ? desktopSetReturnItemsSyncState : ws.set,
  };
}
