import type { DirtyRecord, SyncAdapter, SyncStateRecord } from "../SyncEngine";
import {
  STORES,
  idbGetAllByIndex,
  idbGetByKey,
  idbPut,
} from "@/platform/web/idb";
import { webReconcilePulledRateDefaults } from "@/platform/web/rates";

type RateEntity = "rateType" | "productRate" | "productBatchRate";

type RateAdapterConfig = {
  entity: RateEntity;
  store: string;
  desktopDirty:
    | "getDirtyRateTypes"
    | "getDirtyProductRates"
    | "getDirtyProductBatchRates";
  desktopMark:
    | "markRateTypesSynced"
    | "markProductRatesSynced"
    | "markProductBatchRatesSynced";
  desktopUpsert:
    | "bulkUpsertRateTypes"
    | "bulkUpsertProductRates"
    | "bulkUpsertProductBatchRates";
};

function withIndexKeys(entity: RateEntity, row: DirtyRecord) {
  return {
    ...row,
    dirtyKey: Number(row.isSynced ?? 0) ? 1 : 0,
    ...(entity === "rateType"
      ? {
          activeKey: row.isActive ? 1 : 0,
          defaultKey: row.isDefault ? 1 : 0,
        }
      : {}),
  };
}

function createAdapter(
  isDesktop: boolean,
  config: RateAdapterConfig,
): SyncAdapter {
  const syncKey = `kynflow_sync_${config.entity}`;
  const desktopApi = () => {
    if (!window.electronAPI) throw new Error("electronAPI not available");
    return window.electronAPI;
  };

  const desktopGetDirty = async (licenseId: string) => {
    const fn = desktopApi()[config.desktopDirty] as (
      licenseId: string,
      limit?: number,
    ) => Promise<DirtyRecord[]>;
    return fn(licenseId, 200);
  };
  const desktopMarkSynced = async (
    ids: string[],
    serverUpdatedAt: string,
  ) => {
    const fn = desktopApi()[config.desktopMark] as (
      ids: string[],
      ts?: string,
    ) => Promise<unknown>;
    await fn(ids, serverUpdatedAt);
  };
  const desktopUpsert = async (records: DirtyRecord[]) => {
    const fn = desktopApi()[config.desktopUpsert] as (
      records: DirtyRecord[],
    ) => Promise<unknown>;
    await fn(records);
  };
  const desktopGetState = async (): Promise<SyncStateRecord> => {
    const state = await desktopApi().getSyncState(config.entity);
    return {
      lastPulledAt: state?.lastPulledAt ?? null,
      lastPushedAt: state?.lastPushedAt ?? null,
    };
  };
  const desktopSetState = async (state: Partial<SyncStateRecord>) => {
    await desktopApi().setSyncState(config.entity, state);
  };

  const webGetDirty = async (licenseId: string) => {
    const rows = await idbGetAllByIndex<
      DirtyRecord & { licenseId: string; isSynced?: number | boolean }
    >(config.store, "licenseId", licenseId);
    return rows.filter((row) => Number(row.isSynced ?? 0) === 0);
  };
  const webMarkSynced = async (ids: string[], serverUpdatedAt: string) => {
    for (const id of ids) {
      const row = await idbGetByKey<DirtyRecord>(config.store, id);
      if (row) {
        await idbPut(config.store, withIndexKeys(config.entity, {
          ...row,
          isSynced: 1,
          syncedAt: serverUpdatedAt,
        }));
      }
    }
  };
  const webUpsert = async (records: DirtyRecord[]) => {
    const licenses = new Set<string>();
    for (const record of records) {
      const existing = await idbGetByKey<
        DirtyRecord & { isSynced?: number | boolean }
      >(config.store, record.id);
      const incomingTs = new Date(record.updatedAt || 0).getTime();
      const localTs = new Date(existing?.updatedAt || 0).getTime();
      if (!existing || (Number(existing.isSynced ?? 1) === 1 && incomingTs >= localTs)) {
        await idbPut(config.store, withIndexKeys(config.entity, {
          ...(existing || {}),
          ...record,
          isSynced: 1,
          syncedAt: new Date().toISOString(),
        }));
      }
      if (typeof record.licenseId === "string") licenses.add(record.licenseId);
    }
    for (const licenseId of licenses) {
      await webReconcilePulledRateDefaults(licenseId);
    }
  };
  const webGetState = async (): Promise<SyncStateRecord> => {
    try {
      const raw = localStorage.getItem(syncKey);
      return raw
        ? JSON.parse(raw)
        : { lastPulledAt: null, lastPushedAt: null };
    } catch {
      return { lastPulledAt: null, lastPushedAt: null };
    }
  };
  const webSetState = async (state: Partial<SyncStateRecord>) => {
    const current = await webGetState();
    localStorage.setItem(syncKey, JSON.stringify({ ...current, ...state }));
  };

  return {
    entity: config.entity,
    getDirtyRecords: isDesktop ? desktopGetDirty : webGetDirty,
    markSynced: isDesktop ? desktopMarkSynced : webMarkSynced,
    upsertFromServer: isDesktop ? desktopUpsert : webUpsert,
    getSyncState: isDesktop ? desktopGetState : webGetState,
    setSyncState: isDesktop ? desktopSetState : webSetState,
  };
}

export const createRateTypesAdapter = (isDesktop: boolean) =>
  createAdapter(isDesktop, {
    entity: "rateType",
    store: STORES.RATE_TYPES,
    desktopDirty: "getDirtyRateTypes",
    desktopMark: "markRateTypesSynced",
    desktopUpsert: "bulkUpsertRateTypes",
  });

export const createProductRatesAdapter = (isDesktop: boolean) =>
  createAdapter(isDesktop, {
    entity: "productRate",
    store: STORES.PRODUCT_RATES,
    desktopDirty: "getDirtyProductRates",
    desktopMark: "markProductRatesSynced",
    desktopUpsert: "bulkUpsertProductRates",
  });

export const createProductBatchRatesAdapter = (isDesktop: boolean) =>
  createAdapter(isDesktop, {
    entity: "productBatchRate",
    store: STORES.PRODUCT_BATCH_RATES,
    desktopDirty: "getDirtyProductBatchRates",
    desktopMark: "markProductBatchRatesSynced",
    desktopUpsert: "bulkUpsertProductBatchRates",
  });
