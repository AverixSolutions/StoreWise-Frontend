// src/sync/adapters/purchaseReturns.ts
import type { SyncAdapter, DirtyRecord } from "../SyncEngine";
import { STORES, idbGetAllByIndex, idbPut } from "@/platform/web/idb";

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

// ── Web: Purchase Returns ─────────────────────────────────────────────────────

async function webGetDirtyReturns(licenseId: string): Promise<DirtyRecord[]> {
  try {
    const rows = await idbGetAllByIndex<any>(
      STORES.PURCHASE_RETURNS,
      "licenseId",
      licenseId,
    );
    return rows.filter((r) => r.isSynced !== true && !r.syncedAt);
  } catch {
    return [];
  }
}

async function webMarkReturnsSynced(ids: string[], ts: string) {
  try {
    for (const id of ids) {
      const row = await (
        await import("@/platform/web/idb")
      ).idbGetByKey<any>(STORES.PURCHASE_RETURNS, id);
      if (row) {
        await idbPut(STORES.PURCHASE_RETURNS, {
          ...row,
          isSynced: true,
          syncedAt: ts,
        });
      }
    }
  } catch {}
}

async function webUpsertReturnsFromServer(records: DirtyRecord[]) {
  try {
    for (const record of records) {
      await idbPut(STORES.PURCHASE_RETURNS, record);
    }
  } catch {}
}

// ── Web: Purchase Return Items ────────────────────────────────────────────────

async function webGetDirtyReturnItems(
  licenseId: string,
): Promise<DirtyRecord[]> {
  try {
    const rows = await idbGetAllByIndex<any>(
      STORES.PURCHASE_RETURN_ITEMS,
      "licenseId",
      licenseId,
    );
    return rows.filter((r) => r.isSynced !== true && !r.syncedAt);
  } catch {
    return [];
  }
}

async function webMarkReturnItemsSynced(ids: string[], ts: string) {
  try {
    for (const id of ids) {
      const row = await (
        await import("@/platform/web/idb")
      ).idbGetByKey<any>(STORES.PURCHASE_RETURN_ITEMS, id);
      if (row) {
        await idbPut(STORES.PURCHASE_RETURN_ITEMS, {
          ...row,
          isSynced: true,
          syncedAt: ts,
        });
      }
    }
  } catch {}
}

async function webUpsertReturnItemsFromServer(records: DirtyRecord[]) {
  try {
    for (const record of records) {
      await idbPut(STORES.PURCHASE_RETURN_ITEMS, record);
    }
  } catch {}
}

// ── Web: Purchase Return Holds ────────────────────────────────────────────────

async function webGetDirtyReturnHolds(
  licenseId: string,
): Promise<DirtyRecord[]> {
  try {
    const rows = await idbGetAllByIndex<any>(
      STORES.PURCHASE_RETURN_HOLDS,
      "licenseId",
      licenseId,
    );
    return rows.filter((r) => r.isSynced !== true && !r.syncedAt);
  } catch {
    return [];
  }
}

async function webMarkReturnHoldsSynced(ids: string[], ts: string) {
  try {
    for (const id of ids) {
      const row = await (
        await import("@/platform/web/idb")
      ).idbGetByKey<any>(STORES.PURCHASE_RETURN_HOLDS, id);
      if (row) {
        await idbPut(STORES.PURCHASE_RETURN_HOLDS, {
          ...row,
          isSynced: true,
          syncedAt: ts,
        });
      }
    }
  } catch {}
}

async function webUpsertReturnHoldsFromServer(records: DirtyRecord[]) {
  try {
    for (const record of records) {
      await idbPut(STORES.PURCHASE_RETURN_HOLDS, record);
    }
  } catch {}
}

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
    getDirtyRecords: isDesktop ? desktopGetDirtyReturns : webGetDirtyReturns,
    markSynced: isDesktop ? desktopMarkReturnsSynced : webMarkReturnsSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertReturnsFromServer
      : webUpsertReturnsFromServer,
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
    getDirtyRecords: isDesktop
      ? desktopGetDirtyReturnItems
      : webGetDirtyReturnItems,
    markSynced: isDesktop
      ? desktopMarkReturnItemsSynced
      : webMarkReturnItemsSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertReturnItemsFromServer
      : webUpsertReturnItemsFromServer,
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
    getDirtyRecords: isDesktop
      ? desktopGetDirtyReturnHolds
      : webGetDirtyReturnHolds,
    markSynced: isDesktop
      ? desktopMarkReturnHoldsSynced
      : webMarkReturnHoldsSynced,
    upsertFromServer: isDesktop
      ? desktopUpsertReturnHoldsFromServer
      : webUpsertReturnHoldsFromServer,
    getSyncState: isDesktop ? desktopGetReturnHoldsSyncState : ws.get,
    setSyncState: isDesktop ? desktopSetReturnHoldsSyncState : ws.set,
  };
}
