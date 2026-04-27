// src/platform/web/tax.ts
import type {
  TaxCategoryRecord,
  TaxCategorySavePayload,
  TaxCategoryListResult,
  MutationResult,
  AccountListResult,
} from "../types";
import {
  STORES,
  idbGetAllByIndex,
  idbGetByKey,
  idbPut,
  idbDelete,
  newId,
} from "./idb";

// ── helpers ──────────────────────────────────────────────────────────────────

function nowISO() {
  return new Date().toISOString();
}

function buildIndiaGSTSlabs(): Omit<TaxCategoryRecord, "licenseId">[] {
  const slabs: Omit<TaxCategoryRecord, "licenseId">[] = [];
  const now = nowISO();

  // NT
  slabs.push({
    id: `seed-NT`,
    code: "NT",
    name: "No Tax",
    rate: 0,
    isInterstate: 0,
    cessRate: null,
    calcMethod: "FIXED",
    components: [],
    defaults: null,
    createdAt: now,
    updatedAt: now,
  });

  const pcts = [5, 12, 18, 28];
  for (const pct of pcts) {
    const half = pct / 2;

    // Intrastate (CGST + SGST)
    slabs.push({
      id: `seed-P${pct}`,
      code: `P${pct}`,
      name: `${pct}% (Intra)`,
      rate: pct,
      isInterstate: 0,
      cessRate: null,
      calcMethod: "FIXED",
      components: [
        { component: "CGST", rate: half },
        { component: "SGST", rate: half },
      ],
      defaults: null,
      createdAt: now,
      updatedAt: now,
    });

    // Interstate (IGST)
    slabs.push({
      id: `seed-P${pct}-I`,
      code: `P${pct}-I`,
      name: `${pct}% (Inter)`,
      rate: pct,
      isInterstate: 1,
      cessRate: null,
      calcMethod: "FIXED",
      components: [{ component: "IGST", rate: pct }],
      defaults: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return slabs;
}

async function hasTaxData(licenseId: string): Promise<boolean> {
  const all = await idbGetAllByIndex<TaxCategoryRecord>(
    STORES.TAX_CATEGORIES,
    "licenseId",
    licenseId,
  );
  return all.length > 0;
}

// ── public API ───────────────────────────────────────────────────────────────

export async function webListTaxCategories(
  licenseId: string,
): Promise<TaxCategoryListResult> {
  try {
    const all = await idbGetAllByIndex<TaxCategoryRecord>(
      STORES.TAX_CATEGORIES,
      "licenseId",
      licenseId,
    );
    const rows = all.sort(
      (a, b) => a.rate - b.rate || a.code.localeCompare(b.code),
    );
    return { success: true, rows };
  } catch (e: any) {
    return { success: false, rows: [], error: String(e?.message || e) };
  }
}

export async function webSaveTaxCategory(
  payload: TaxCategorySavePayload,
): Promise<MutationResult & { id?: string }> {
  try {
    const now = nowISO();
    const id = payload.id || newId();

    const existing = payload.id
      ? await idbGetByKey<TaxCategoryRecord>(STORES.TAX_CATEGORIES, payload.id)
      : undefined;

    const record: TaxCategoryRecord = {
      ...(existing || {}),
      id,
      licenseId: payload.licenseId,
      code: payload.code,
      name: payload.name,
      rate: Number(payload.rate || 0),
      isInterstate: payload.isInterstate ? 1 : 0,
      cessRate: payload.cessRate ?? null,
      calcMethod: payload.calcMethod ?? "FIXED",
      components: payload.components || [],
      defaults: payload.defaults ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await idbPut<TaxCategoryRecord>(STORES.TAX_CATEGORIES, record);
    return { success: true, id };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function webDeleteTaxCategory(
  id: string,
): Promise<MutationResult> {
  try {
    await idbDelete(STORES.TAX_CATEGORIES, id);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function webSeedIndiaGST(
  licenseId: string,
): Promise<MutationResult> {
  try {
    const slabs = buildIndiaGSTSlabs();
    const existing = await idbGetAllByIndex<TaxCategoryRecord>(
      STORES.TAX_CATEGORIES,
      "licenseId",
      licenseId,
    );
    const existingCodes = new Set(existing.map((r) => r.code));

    for (const slab of slabs) {
      // Upsert: use existing id if there's already a record with this code
      const existingRecord = existing.find((r) => r.code === slab.code);
      await idbPut<TaxCategoryRecord>(STORES.TAX_CATEGORIES, {
        ...slab,
        id: existingRecord?.id ?? slab.id,
        licenseId,
        // preserve existing defaults if already configured
        defaults: existingRecord?.defaults ?? slab.defaults,
      });
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

// Web has no accounts master — return empty list
export async function webListDefaultableAccounts(
  _licenseId: string,
): Promise<AccountListResult> {
  return { success: true, rows: [] };
}
