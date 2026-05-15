import type {
  MutationResult,
  OfferListFilters,
  OfferListResult,
  OfferMutationResult,
  OfferRecord,
  OfferSavePayload,
  OfferTargetListResult,
  OfferTargetProductRecord,
  OfferTargetSavePayload,
} from "../types";
import {
  STORES,
  idbGetAllByIndex,
  idbGetByKey,
  idbPut,
  newId,
} from "./idb";

function nowISO() {
  return new Date().toISOString();
}

function triggerSync(entity: string) {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pushEntity(entity).catch(() => {});
    })
    .catch(() => {});
}

function normalizeOffer(record: Partial<OfferRecord>): OfferRecord {
  const now = nowISO();
  return {
    id: record.id || newId(),
    licenseId: record.licenseId || "",
    name: (record.name || "").trim(),
    type: record.type || "SPECIAL_PRICE",
    isActive: record.isActive === 0 ? 0 : 1,
    applyScope: record.applyScope || "ALL_PRODUCTS",
    priority: Number(record.priority ?? 0),
    startsAt: record.startsAt ?? null,
    endsAt: record.endsAt ?? null,
    timeStart: record.timeStart ?? null,
    timeEnd: record.timeEnd ?? null,
    minQty: record.minQty ?? null,
    maxQty: record.maxQty ?? null,
    fixedUnitPrice: record.fixedUnitPrice ?? null,
    discountPercent: record.discountPercent ?? null,
    discountAmount: record.discountAmount ?? null,
    triggerKind: record.triggerKind ?? null,
    triggerScope: record.triggerScope ?? null,
    minAmount: record.minAmount ?? null,
    maxAmount: record.maxAmount ?? null,
    unit: record.unit ?? null,
    benefitTarget: record.benefitTarget ?? null,
    benefitKind: record.benefitKind ?? null,
    benefitQtyMode: record.benefitQtyMode ?? null,
    fixedBenefitQty: record.fixedBenefitQty ?? null,
    maxBenefitQty: record.maxBenefitQty ?? null,
    maxBenefitAmount: record.maxBenefitAmount ?? null,
    customerRequired:
      record.customerRequired == null ? 0 : record.customerRequired ? 1 : 0,
    oncePerBill: record.oncePerBill == null ? 1 : record.oncePerBill ? 1 : 0,
    notes: record.notes ?? null,
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now,
    deletedAt: record.deletedAt ?? null,
    isSynced: record.isSynced ?? 0,
    syncedAt: record.syncedAt ?? null,
  };
}

function filterOffers(rows: OfferRecord[], filters: OfferListFilters = {}) {
  let next = rows;
  if (!filters.includeDeleted) next = next.filter((r) => !r.deletedAt);
  if (!filters.includeInactive) next = next.filter((r) => r.isActive !== 0);
  if (filters.type) next = next.filter((r) => r.type === filters.type);
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    next = next.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.notes || "").toLowerCase().includes(q),
    );
  }
  return next.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if ((b.priority ?? 0) !== (a.priority ?? 0)) {
      return (b.priority ?? 0) - (a.priority ?? 0);
    }
    return a.name.localeCompare(b.name);
  });
}

export async function webListOffers(
  licenseId: string,
  filters: OfferListFilters = {},
): Promise<OfferListResult> {
  try {
    const rows = await idbGetAllByIndex<OfferRecord>(
      STORES.OFFERS,
      "licenseId",
      licenseId,
    );
    return { success: true, rows: filterOffers(rows, filters) };
  } catch (e: any) {
    return { success: false, rows: [], error: String(e?.message || e) };
  }
}

export async function webListActiveOffers(
  licenseId: string,
  _saleDateTime?: string,
): Promise<OfferListResult> {
  return webListOffers(licenseId, { includeInactive: false });
}

export async function webGetOffer(
  id: string,
  licenseId?: string,
): Promise<OfferRecord | null> {
  const row = await idbGetByKey<OfferRecord>(STORES.OFFERS, id);
  if (!row || row.deletedAt) return null;
  if (licenseId && row.licenseId !== licenseId) return null;
  return row;
}

export async function webSaveOffer(
  payload: OfferSavePayload,
): Promise<OfferMutationResult> {
  try {
    const existing = payload.id
      ? await idbGetByKey<OfferRecord>(STORES.OFFERS, payload.id)
      : undefined;
    const id = payload.id || newId();
    const record = normalizeOffer({
      ...existing,
      ...payload,
      id,
      createdAt: existing?.createdAt,
      updatedAt: nowISO(),
      isSynced: 0,
      syncedAt: null,
    });
    await idbPut(STORES.OFFERS, record);
    triggerSync("offer");
    return { success: true, id };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function webDeleteOffer(
  id: string,
  licenseId: string,
): Promise<MutationResult> {
  try {
    const row = await webGetOffer(id, licenseId);
    if (!row) return { success: false, error: "Offer not found" };
    await idbPut(STORES.OFFERS, {
      ...row,
      deletedAt: nowISO(),
      updatedAt: nowISO(),
      isSynced: 0,
      syncedAt: null,
    });
    triggerSync("offer");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function webToggleOffer(
  id: string,
  licenseId: string,
  isActive: boolean,
): Promise<MutationResult> {
  try {
    const row = await webGetOffer(id, licenseId);
    if (!row) return { success: false, error: "Offer not found" };
    await idbPut(STORES.OFFERS, {
      ...row,
      isActive: isActive ? 1 : 0,
      updatedAt: nowISO(),
      isSynced: 0,
      syncedAt: null,
    });
    triggerSync("offer");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function webListOfferTargetProducts(
  offerId: string,
): Promise<OfferTargetListResult> {
  try {
    const rows = await idbGetAllByIndex<OfferTargetProductRecord>(
      STORES.OFFER_TARGET_PRODUCTS,
      "offerId",
      offerId,
    );
    return {
      success: true,
      rows: rows.filter((r) => !r.deletedAt),
    };
  } catch (e: any) {
    return { success: false, rows: [], error: String(e?.message || e) };
  }
}

export async function webSaveOfferTargetProducts(
  payload: OfferTargetSavePayload,
): Promise<OfferMutationResult> {
  try {
    const now = nowISO();
    const existing = await idbGetAllByIndex<OfferTargetProductRecord>(
      STORES.OFFER_TARGET_PRODUCTS,
      "offerId",
      payload.offerId,
    );
    const wanted = new Map(
      payload.rows.map((r) => [`${r.productId}:${r.targetRole}`, r]),
    );

    for (const row of existing) {
      const key = `${row.productId}:${row.targetRole}`;
      if (!wanted.has(key) && !row.deletedAt) {
        await idbPut(STORES.OFFER_TARGET_PRODUCTS, {
          ...row,
          deletedAt: now,
          updatedAt: now,
          isSynced: 0,
          syncedAt: null,
        });
      }
    }

    for (const row of payload.rows) {
      const found = existing.find(
        (r) => r.productId === row.productId && r.targetRole === row.targetRole,
      );
      await idbPut<OfferTargetProductRecord>(STORES.OFFER_TARGET_PRODUCTS, {
        id: found?.id || newId(),
        licenseId: payload.licenseId,
        offerId: payload.offerId,
        productId: row.productId,
        targetRole: row.targetRole,
        createdAt: found?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
        isSynced: 0,
        syncedAt: null,
      });
    }

    triggerSync("offerTargetProduct");
    return { success: true, id: payload.offerId };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}
