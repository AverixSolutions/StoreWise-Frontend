import type {
  ProductBatchRateRecord,
  ProductRateRecord,
  RateTypeRecord,
  RateTypeSavePayload,
  RateValueInput,
} from "../types";
import {
  STORES,
  idbGetAllByIndex,
  idbGetByKey,
  idbPut,
  newId,
} from "./idb";

function withRateIndexKeys(
  store: string,
  row: Record<string, unknown>,
) {
  return {
    ...row,
    dirtyKey: Number(row.isSynced ?? false) ? 1 : 0,
    ...(store === STORES.RATE_TYPES
      ? {
          activeKey: row.isActive ? 1 : 0,
          defaultKey: row.isDefault ? 1 : 0,
        }
      : {}),
  };
}

function putRateRecord<T extends Record<string, unknown>>(
  store: string,
  row: T,
) {
  return idbPut(store, withRateIndexKeys(store, row));
}

function trigger(entity: "rateType" | "productRate" | "productBatchRate") {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => SyncManager.pushEntity(entity))
    .catch((error) => console.error(`[rates:${entity}:sync]`, error));
}

async function ensureDefault(licenseId: string): Promise<RateTypeRecord> {
  if (!licenseId.trim()) throw new Error("licenseId required");
  const all = await idbGetAllByIndex<RateTypeRecord>(
    STORES.RATE_TYPES,
    "licenseId",
    licenseId,
  );
  const current = all.find(
    (row) =>
      row.isDefault && row.isActive && !row.deletedAt,
  );
  if (current) return current;
  const now = new Date().toISOString();
  const retail = all.find(
    (row) => row.code.toUpperCase() === "RETAIL" && !row.deletedAt,
  );
  const row: RateTypeRecord = retail
    ? { ...retail, isDefault: true, isActive: true, updatedAt: now, isSynced: false }
    : {
        id: `retail-${licenseId}`,
        licenseId,
        code: "RETAIL",
        name: "Retail",
        isDefault: true,
        isActive: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        isSynced: false,
        syncedAt: null,
      };
  await putRateRecord(STORES.RATE_TYPES, row);

  const products = await idbGetAllByIndex<Record<string, unknown>>(
    STORES.PRODUCTS,
    "licenseId",
    licenseId,
  );
  for (const product of products) {
    const salePrice = product.salePrice;
    if (salePrice == null || Number.isNaN(Number(salePrice))) continue;
    const rates = await idbGetAllByIndex<ProductRateRecord>(
      STORES.PRODUCT_RATES,
      "productId",
      String(product.id),
    );
    if (!rates.some((rate) => rate.rateTypeId === row.id)) {
      await putRateRecord(STORES.PRODUCT_RATES, {
        id: `pr:${String(product.id)}:${row.id}`,
        licenseId,
        productId: String(product.id),
        rateTypeId: row.id,
        amount: Number(salePrice),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        isSynced: false,
        syncedAt: null,
      });
    }
  }
  const batches = await idbGetAllByIndex<Record<string, unknown>>(
    STORES.PRODUCT_BATCHES,
    "licenseId",
    licenseId,
  );
  for (const batch of batches) {
    const salePrice = batch.salePrice;
    if (salePrice == null || Number.isNaN(Number(salePrice))) continue;
    const rates = await idbGetAllByIndex<ProductBatchRateRecord>(
      STORES.PRODUCT_BATCH_RATES,
      "batchId",
      String(batch.id),
    );
    if (!rates.some((rate) => rate.rateTypeId === row.id)) {
      await putRateRecord(STORES.PRODUCT_BATCH_RATES, {
        id: `pbr:${String(batch.id)}:${row.id}`,
        licenseId,
        productId: String(batch.productId),
        batchId: String(batch.id),
        rateTypeId: row.id,
        amount: Number(salePrice),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        isSynced: false,
        syncedAt: null,
      });
    }
  }
  trigger("rateType");
  return row;
}

async function refreshMirrors(licenseId: string, rateTypeId: string) {
  const now = new Date().toISOString();
  const productRates = await idbGetAllByIndex<ProductRateRecord>(
    STORES.PRODUCT_RATES,
    "licenseId",
    licenseId,
  );
  const byProduct = new Map(
    productRates
      .filter((row) => row.rateTypeId === rateTypeId && !row.deletedAt)
      .map((row) => [row.productId, row.amount]),
  );
  const products = await idbGetAllByIndex<Record<string, unknown>>(
    STORES.PRODUCTS,
    "licenseId",
    licenseId,
  );
  for (const product of products) {
    await idbPut(STORES.PRODUCTS, {
      ...product,
      salePrice: byProduct.get(String(product.id)) ?? null,
      updatedAt: now,
      isSynced: false,
      syncedAt: null,
    });
  }
  const batchRates = await idbGetAllByIndex<ProductBatchRateRecord>(
    STORES.PRODUCT_BATCH_RATES,
    "licenseId",
    licenseId,
  );
  const byBatch = new Map(
    batchRates
      .filter((row) => row.rateTypeId === rateTypeId && !row.deletedAt)
      .map((row) => [row.batchId, row.amount]),
  );
  const batches = await idbGetAllByIndex<Record<string, unknown>>(
    STORES.PRODUCT_BATCHES,
    "licenseId",
    licenseId,
  );
  for (const batch of batches) {
    await idbPut(STORES.PRODUCT_BATCHES, {
      ...batch,
      salePrice:
        byBatch.get(String(batch.id)) ??
        byProduct.get(String(batch.productId)) ??
        null,
      updatedAt: now,
    });
  }
}

async function refreshBatchFallbacksForProduct(
  productId: string,
  rateTypeId: string,
  productAmount: number | null,
) {
  const now = new Date().toISOString();
  const batches = await idbGetAllByIndex<Record<string, unknown>>(
    STORES.PRODUCT_BATCHES,
    "productId",
    productId,
  );
  for (const batch of batches) {
    const batchRates = await idbGetAllByIndex<ProductBatchRateRecord>(
      STORES.PRODUCT_BATCH_RATES,
      "batchId",
      String(batch.id),
    );
    const hasOverride = batchRates.some(
      (rate) => rate.rateTypeId === rateTypeId && !rate.deletedAt,
    );
    if (!hasOverride) {
      await idbPut(STORES.PRODUCT_BATCHES, {
        ...batch,
        salePrice: productAmount,
        updatedAt: now,
      });
    }
  }
}

export async function webReconcilePulledRateDefaults(licenseId: string) {
  const all = await idbGetAllByIndex<RateTypeRecord>(
    STORES.RATE_TYPES,
    "licenseId",
    licenseId,
  );
  const active = all.filter((row) => row.isActive && !row.deletedAt);
  if (active.length === 0) return;
  const defaults = active
    .filter((row) => row.isDefault)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
        a.id.localeCompare(b.id),
    );
  const winner =
    defaults[0] ||
    [...active].sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
        a.id.localeCompare(b.id),
    )[0];
  for (const row of active) {
    if (row.isDefault !== (row.id === winner.id)) {
      await putRateRecord(STORES.RATE_TYPES, {
        ...row,
        isDefault: row.id === winner.id,
        isSynced: true,
      });
    }
  }
  await refreshMirrors(licenseId, winner.id);
}

export async function webListRateTypes(
  licenseId: string,
  includeInactive = true,
) {
  try {
    await ensureDefault(licenseId);
    const all = await idbGetAllByIndex<RateTypeRecord>(
      STORES.RATE_TYPES,
      "licenseId",
      licenseId,
    );
    return {
      success: true,
      rows: all
        .filter((row) => !row.deletedAt && (includeInactive || row.isActive))
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
    };
  } catch (error) {
    return { success: false, rows: [], error: String(error) };
  }
}

export async function webSaveRateType(payload: RateTypeSavePayload) {
  try {
    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();
    if (!payload.licenseId || !/^[A-Z0-9_-]{1,30}$/.test(code) || !name) {
      throw new Error("A valid rate code, name and license are required");
    }
    const all = await idbGetAllByIndex<RateTypeRecord>(
      STORES.RATE_TYPES,
      "licenseId",
      payload.licenseId,
    );
    const duplicate = all.find(
      (row) =>
        row.id !== payload.id &&
        !row.deletedAt &&
        (row.code.toLowerCase() === code.toLowerCase() ||
          row.name.toLowerCase() === name.toLowerCase()),
    );
    if (duplicate) throw new Error("Rate code or name already exists");
    const existing = payload.id
      ? all.find((row) => row.id === payload.id)
      : undefined;
    if (payload.id && !existing) throw new Error("Rate type not found");
    if (existing?.isDefault && payload.isActive === false) {
      throw new Error("Set another active rate as default before deactivating this rate");
    }
    const now = new Date().toISOString();
    const id = existing?.id || newId();
    await putRateRecord(STORES.RATE_TYPES, {
      id,
      licenseId: payload.licenseId,
      code,
      name,
      isDefault: existing?.isDefault || Boolean(payload.isDefault),
      isActive: payload.isActive !== false,
      sortOrder: Number(payload.sortOrder ?? existing?.sortOrder ?? 0),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      deletedAt: null,
      isSynced: false,
      syncedAt: null,
    });
    if (payload.isDefault) await webSetDefaultRateType(payload.licenseId, id);
    else await ensureDefault(payload.licenseId);
    trigger("rateType");
    return { success: true, id };
  } catch (error) {
    return { success: false, error: String((error as Error).message || error) };
  }
}

export async function webSetDefaultRateType(licenseId: string, id: string) {
  try {
    const all = await idbGetAllByIndex<RateTypeRecord>(
      STORES.RATE_TYPES,
      "licenseId",
      licenseId,
    );
    const selected = all.find(
      (row) => row.id === id && row.isActive && !row.deletedAt,
    );
    if (!selected) throw new Error("Only an active rate can be set as default");
    const now = new Date().toISOString();
    for (const row of all.filter((item) => !item.deletedAt)) {
      await putRateRecord(STORES.RATE_TYPES, {
        ...row,
        isDefault: row.id === id,
        updatedAt: now,
        isSynced: false,
        syncedAt: null,
      });
    }
    await refreshMirrors(licenseId, id);
    trigger("rateType");
    return { success: true };
  } catch (error) {
    return { success: false, error: String((error as Error).message || error) };
  }
}

export async function webToggleRateType(
  licenseId: string,
  id: string,
  isActive: boolean,
) {
  const row = await idbGetByKey<RateTypeRecord>(STORES.RATE_TYPES, id);
  if (!row || row.licenseId !== licenseId || row.deletedAt) {
    return { success: false, error: "Rate type not found" };
  }
  if (row.isDefault && !isActive) {
    return {
      success: false,
      error: "Set another active rate as default before deactivating this rate",
    };
  }
  await putRateRecord(STORES.RATE_TYPES, {
    ...row,
    isActive,
    updatedAt: new Date().toISOString(),
    isSynced: false,
    syncedAt: null,
  });
  trigger("rateType");
  return { success: true };
}

export async function webDeleteRateType(licenseId: string, id: string) {
  const row = await idbGetByKey<RateTypeRecord>(STORES.RATE_TYPES, id);
  if (!row || row.licenseId !== licenseId || row.deletedAt) {
    return { success: false, error: "Rate type not found" };
  }
  if (row.isDefault) return { success: false, error: "The default rate cannot be deleted" };
  const now = new Date().toISOString();
  await putRateRecord(STORES.RATE_TYPES, {
    ...row,
    isActive: false,
    deletedAt: now,
    updatedAt: now,
    isSynced: false,
    syncedAt: null,
  });
  trigger("rateType");
  return { success: true };
}

export async function webListProductRates(licenseId: string, productId: string) {
  const rows = await idbGetAllByIndex<ProductRateRecord>(
    STORES.PRODUCT_RATES,
    "productId",
    productId,
  );
  return {
    success: true,
    rows: rows.filter((row) => row.licenseId === licenseId && !row.deletedAt),
  };
}

async function saveValues(
  licenseId: string,
  productId: string,
  rates: RateValueInput[],
  batchId?: string,
) {
  const product = await idbGetByKey<Record<string, unknown>>(
    STORES.PRODUCTS,
    productId,
  );
  if (!product || product.licenseId !== licenseId) {
    throw new Error("Product not found for this license");
  }
  if (batchId) {
    const batch = await idbGetByKey<Record<string, unknown>>(
      STORES.PRODUCT_BATCHES,
      batchId,
    );
    if (
      !batch ||
      batch.licenseId !== licenseId ||
      batch.productId !== productId
    ) {
      throw new Error("Batch not found for this product and license");
    }
  }
  const rateTypes = await idbGetAllByIndex<RateTypeRecord>(
    STORES.RATE_TYPES,
    "licenseId",
    licenseId,
  );
  const defaultRate = rateTypes.find(
    (row) => row.isDefault && row.isActive && !row.deletedAt,
  ) || (await ensureDefault(licenseId));
  const store = batchId ? STORES.PRODUCT_BATCH_RATES : STORES.PRODUCT_RATES;
  const index = batchId ? "batchId" : "productId";
  const existing = await idbGetAllByIndex<ProductBatchRateRecord | ProductRateRecord>(
    store,
    index,
    batchId || productId,
  );
  const now = new Date().toISOString();
  for (const input of rates) {
    const rateType = rateTypes.find(
      (row) =>
        row.id === input.rateTypeId && !row.deletedAt,
    );
    if (!rateType) throw new Error("Rate type not found for this license");
    const previous = existing.find((row) => row.rateTypeId === input.rateTypeId);
    if (input.amount == null) {
      if (previous) {
        await putRateRecord(store, {
          ...previous,
          deletedAt: now,
          updatedAt: now,
          isSynced: false,
          syncedAt: null,
        });
      }
      if (input.rateTypeId === defaultRate.id) {
        const ownerStore = batchId ? STORES.PRODUCT_BATCHES : STORES.PRODUCTS;
        const owner = await idbGetByKey<Record<string, unknown>>(
          ownerStore,
          batchId || productId,
        );
        if (owner) {
          await idbPut(ownerStore, {
            ...owner,
            salePrice: batchId
              ? (
                  await idbGetAllByIndex<ProductRateRecord>(
                    STORES.PRODUCT_RATES,
                    "productId",
                    productId,
                  )
                ).find(
                  (rate) =>
                    rate.rateTypeId === input.rateTypeId && !rate.deletedAt,
                )?.amount ?? null
              : null,
            updatedAt: now,
            ...(batchId ? {} : { isSynced: false, syncedAt: null }),
          });
        }
        if (!batchId) {
          await refreshBatchFallbacksForProduct(
            productId,
            input.rateTypeId,
            null,
          );
        }
      }
      continue;
    }
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Rate amounts must be finite non-negative numbers");
    }
    await putRateRecord(store, {
      id:
        previous?.id ||
        (batchId
          ? `pbr:${batchId}:${input.rateTypeId}`
          : `pr:${productId}:${input.rateTypeId}`),
      licenseId,
      productId,
      ...(batchId ? { batchId } : {}),
      rateTypeId: input.rateTypeId,
      amount,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      deletedAt: null,
      isSynced: false,
      syncedAt: null,
    });
    if (input.rateTypeId === defaultRate.id) {
      const ownerStore = batchId ? STORES.PRODUCT_BATCHES : STORES.PRODUCTS;
      const owner = await idbGetByKey<Record<string, unknown>>(
        ownerStore,
        batchId || productId,
      );
      if (owner) {
        await idbPut(ownerStore, {
          ...owner,
          salePrice: amount,
          updatedAt: now,
          ...(batchId ? {} : { isSynced: false, syncedAt: null }),
        });
      }
      if (!batchId) {
        await refreshBatchFallbacksForProduct(
          productId,
          input.rateTypeId,
          amount,
        );
      }
    }
  }
  trigger(batchId ? "productBatchRate" : "productRate");
}

export async function webSaveProductRates(payload: {
  licenseId: string;
  productId: string;
  rates: RateValueInput[];
}) {
  try {
    await saveValues(payload.licenseId, payload.productId, payload.rates);
    return { success: true };
  } catch (error) {
    return { success: false, error: String((error as Error).message || error) };
  }
}

export async function webListProductBatchRates(
  licenseId: string,
  productId: string,
  batchId: string,
) {
  const rows = await idbGetAllByIndex<ProductBatchRateRecord>(
    STORES.PRODUCT_BATCH_RATES,
    "batchId",
    batchId,
  );
  return {
    success: true,
    rows: rows.filter(
      (row) =>
        row.licenseId === licenseId &&
        row.productId === productId &&
        !row.deletedAt,
    ),
  };
}

export async function webSaveProductBatchRates(payload: {
  licenseId: string;
  productId: string;
  batchId: string;
  rates: RateValueInput[];
}) {
  try {
    await saveValues(
      payload.licenseId,
      payload.productId,
      payload.rates,
      payload.batchId,
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: String((error as Error).message || error) };
  }
}
