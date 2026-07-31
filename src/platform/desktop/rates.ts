import type {
  ProductBatchRateListResult,
  ProductRateListResult,
  RateTypeListResult,
  RateTypeBulkCreatePayload,
  RateTypeBulkCreateResult,
  RateTypeRecord,
} from "../types";

function api() {
  if (typeof window === "undefined" || !window.electronAPI) {
    throw new Error("Electron API is not available in this runtime");
  }
  return window.electronAPI;
}

function normalizeRateType(row: {
  id: string;
  licenseId: string;
  code: string;
  name: string;
  isDefault: number | boolean;
  isActive: number | boolean;
  sortOrder: number;
  createdAt?: string | null;
  updatedAt: string;
  deletedAt?: string | null;
  isSynced: number | boolean;
  syncedAt?: string | null;
}): RateTypeRecord {
  return {
    ...row,
    isDefault: Boolean(row.isDefault),
    isActive: Boolean(row.isActive),
    isSynced: Boolean(row.isSynced),
  };
}

export async function desktopListRateTypes(
  licenseId: string,
  includeInactive = true,
): Promise<RateTypeListResult> {
  const result = await api().listRateTypes(licenseId, includeInactive);
  return {
    ...result,
    rows: (result.rows || []).map(normalizeRateType),
  };
}

export async function desktopCreateRateTypesBulk(
  payload: RateTypeBulkCreatePayload,
): Promise<RateTypeBulkCreateResult> {
  const result = await api().createRateTypesBulk(payload);
  return {
    ...result,
    rows: (result.rows || []).map(normalizeRateType),
  };
}

export async function desktopListProductRates(
  licenseId: string,
  productId: string,
): Promise<ProductRateListResult> {
  const result = await api().listProductRates(licenseId, productId);
  return {
    ...result,
    rows: (result.rows || []).map((row) => ({
      ...row,
      amount: Number(row.amount),
      isSynced: Boolean(row.isSynced),
    })),
  };
}

export async function desktopListProductBatchRates(
  licenseId: string,
  productId: string,
  batchId: string,
): Promise<ProductBatchRateListResult> {
  const result = await api().listProductBatchRates(
    licenseId,
    productId,
    batchId,
  );
  return {
    ...result,
    rows: (result.rows || []).map((row) => ({
      ...row,
      batchId: row.batchId || batchId,
      amount: Number(row.amount),
      isSynced: Boolean(row.isSynced),
    })),
  };
}
