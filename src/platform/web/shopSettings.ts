// src/platform/web/shopSettings.ts
import type {
  ShopSettingsPayload,
  GetShopSettingsResult,
  SaveShopSettingsResult,
} from "../types";
import {
  STORES,
  idbDelete,
  idbGetAll,
  idbGetByKey,
  idbPut,
  type SyncJob,
} from "./idb";

type WebShopSettingsRecord = ShopSettingsPayload & {
  createdAt: string;
  updatedAt: string;
  syncStatus: "LOCAL_ONLY" | "PENDING" | "SYNCED" | "SYNC_FAILED";
  lastSyncedAt: string | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_KYNFLOW_API_BASE || "").replace(
  /\/+$/,
  "",
);

function defaultSettings(licenseId: string): WebShopSettingsRecord {
  const now = new Date().toISOString();
  return {
    licenseId,
    shopName: "My Shop",
    logoDataUrl: null,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    mobile: "",
    email: "",
    gstin: "",
    footerNote: "",
    authorizedSignatory: "Authorized Signature",
    createdAt: now,
    updatedAt: now,
    syncStatus: API_BASE ? "PENDING" : "LOCAL_ONLY",
    lastSyncedAt: null,
  };
}

function getSyncUrl() {
  return API_BASE ? `${API_BASE}/shop-settings/upsert` : "";
}

function getShopSettingsJobId(licenseId: string) {
  return `shop_settings:${licenseId}`;
}

async function pushShopSettingsToRemote(record: WebShopSettingsRecord) {
  const url = getSyncUrl();
  if (!url) {
    return { skipped: true, reason: "API base not configured" as const };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { skipped: true, reason: "Browser offline" as const };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    let message = `Remote sync failed (${response.status})`;
    try {
      const data = await response.json();
      message = data?.error || data?.message || message;
    } catch (_) {}
    throw new Error(message);
  }
  return { skipped: false as const };
}

export async function getWebShopSettings(
  licenseId: string,
): Promise<GetShopSettingsResult> {
  if (!licenseId) {
    return { success: false, error: "licenseId required" };
  }

  const saved = await idbGetByKey<WebShopSettingsRecord>(
    STORES.SHOP_SETTINGS,
    licenseId,
  );

  return {
    success: true,
    settings: saved || defaultSettings(licenseId),
    source: "web-local",
  };
}

export async function saveWebShopSettings(
  payload: ShopSettingsPayload,
): Promise<SaveShopSettingsResult> {
  if (!payload?.licenseId) {
    return { success: false, error: "licenseId required" };
  }

  const existing = await idbGetByKey<WebShopSettingsRecord>(
    STORES.SHOP_SETTINGS,
    payload.licenseId,
  );

  const now = new Date().toISOString();
  const record: WebShopSettingsRecord = {
    ...(existing || defaultSettings(payload.licenseId)),
    ...payload,
    shopName: payload.shopName?.trim() || "My Shop",
    updatedAt: now,
    syncStatus: API_BASE ? "PENDING" : "LOCAL_ONLY",
    lastSyncedAt: existing?.lastSyncedAt || null,
  };

  await idbPut(STORES.SHOP_SETTINGS, record);

  if (API_BASE) {
    const job: SyncJob = {
      id: getShopSettingsJobId(payload.licenseId),
      entityType: "shop_settings",
      entityKey: payload.licenseId,
      operation: "UPSERT",
      payload: record,
      createdAt: now,
      lastTriedAt: null,
      status: "PENDING",
      error: null,
    };
    await idbPut(STORES.SYNC_QUEUE, job);

    const syncResult = await syncShopSettingsForLicense(payload.licenseId);
    if (!syncResult.success) {
      return {
        success: true,
        settings: record,
        localOnly: true,
        warning: syncResult.error || "Saved locally. Remote sync pending.",
      };
    }
    return { success: true, settings: syncResult.settings, synced: true };
  }

  return { success: true, settings: record, localOnly: true };
}

export async function syncShopSettingsForLicense(licenseId: string) {
  const record = await idbGetByKey<WebShopSettingsRecord>(
    STORES.SHOP_SETTINGS,
    licenseId,
  );
  if (!record) {
    return {
      success: false,
      error: "No local settings found",
      localSaved: false,
    };
  }
  if (!API_BASE) {
    return {
      success: false,
      error: "API base not configured",
      localSaved: true,
    };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { success: false, error: "Browser offline", localSaved: true };
  }

  try {
    await pushShopSettingsToRemote(record);
    const syncedAt = new Date().toISOString();
    const syncedRecord: WebShopSettingsRecord = {
      ...record,
      syncStatus: "SYNCED",
      lastSyncedAt: syncedAt,
    };
    await idbPut(STORES.SHOP_SETTINGS, syncedRecord);
    await idbDelete(STORES.SYNC_QUEUE, getShopSettingsJobId(licenseId));
    return { success: true, settings: syncedRecord };
  } catch (error: any) {
    const failedRecord: WebShopSettingsRecord = {
      ...record,
      syncStatus: "SYNC_FAILED",
    };
    await idbPut(STORES.SHOP_SETTINGS, failedRecord);

    await idbPut(STORES.SYNC_QUEUE, {
      id: getShopSettingsJobId(licenseId),
      entityType: "shop_settings",
      entityKey: licenseId,
      operation: "UPSERT",
      payload: record,
      createdAt: record.updatedAt,
      status: "FAILED",
      error: String(error?.message || error || "Sync failed"),
      lastTriedAt: new Date().toISOString(),
    });

    return {
      success: false,
      error: String(error?.message || error || "Sync failed"),
      localSaved: true,
    };
  }
}

export async function syncAllPendingShopSettings() {
  const jobs = await idbGetAll<SyncJob>(STORES.SYNC_QUEUE);
  const licenseIds = Array.from(
    new Set(
      jobs
        .filter((job) => job.entityType === "shop_settings")
        .map((job) => job.entityKey),
    ),
  );
  for (const licenseId of licenseIds) {
    await syncShopSettingsForLicense(licenseId);
  }
}
