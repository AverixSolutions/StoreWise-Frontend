import type {
  ProductBatchRateRecord,
  ProductRateRecord,
  RateSource,
  RateTypeRecord,
  SellingRateSnapshot,
} from "@/platform/types";

export type ResolvedRate = {
  rateTypeId: string | null;
  rateTypeCode: string | null;
  rateTypeName: string | null;
  rateSource: RateSource;
  amount: number | null;
  configured: boolean;
  resolvedFrom: "BATCH" | "PRODUCT" | "LEGACY" | "CUSTOM" | "NONE";
};

export function orderActiveRateTypes(rateTypes: RateTypeRecord[]) {
  return rateTypes
    .filter((rate) => rate.isActive && !rate.deletedAt)
    .sort(
      (a, b) =>
        Number(b.isDefault) - Number(a.isDefault) ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name),
    );
}

export function findDefaultRateType(rateTypes: RateTypeRecord[]) {
  return (
    orderActiveRateTypes(rateTypes).find((rate) => rate.isDefault) ?? null
  );
}

export function resolveNamedRate(args: {
  rateType: RateTypeRecord;
  productRates: ProductRateRecord[];
  batchRates?: ProductBatchRateRecord[];
}): ResolvedRate {
  const { rateType, productRates, batchRates = [] } = args;
  const batch = batchRates.find(
    (rate) => rate.rateTypeId === rateType.id && !rate.deletedAt,
  );
  const product = productRates.find(
    (rate) => rate.rateTypeId === rateType.id && !rate.deletedAt,
  );
  const amount = batch?.amount ?? product?.amount ?? null;
  return {
    rateTypeId: rateType.id,
    rateTypeCode: rateType.code,
    rateTypeName: rateType.name,
    rateSource: "MASTER",
    amount,
    configured: amount != null && Number.isFinite(Number(amount)),
    resolvedFrom: batch ? "BATCH" : product ? "PRODUCT" : "NONE",
  };
}

export function resolveLegacyRate(
  rate: number | null | undefined,
  salePrice?: number | null,
): ResolvedRate {
  const value = rate ?? salePrice ?? null;
  return {
    rateTypeId: null,
    rateTypeCode: null,
    rateTypeName: "Legacy",
    rateSource: "LEGACY",
    amount: value,
    configured: value != null && Number.isFinite(Number(value)),
    resolvedFrom: "LEGACY",
  };
}

export function createCustomRate(amount: number): ResolvedRate {
  return {
    rateTypeId: null,
    rateTypeCode: null,
    rateTypeName: "Custom",
    rateSource: "CUSTOM",
    amount,
    configured: Number.isFinite(amount),
    resolvedFrom: "CUSTOM",
  };
}

export function createSellingRateSnapshot(
  rateTypes: RateTypeRecord[],
  values: Array<{ rateTypeId: string; amount: number | null | undefined }>,
): SellingRateSnapshot[] {
  const byId = new Map(rateTypes.map((rate) => [rate.id, rate]));
  return values.flatMap((value) => {
    const rateType = byId.get(value.rateTypeId);
    if (!rateType || value.amount == null || !Number.isFinite(value.amount)) {
      return [];
    }
    return [
      {
        rateTypeId: rateType.id,
        code: rateType.code,
        name: rateType.name,
        amount: value.amount,
      },
    ];
  });
}

export function compatibilitySalePrice(
  rateTypes: RateTypeRecord[],
  values: Array<{ rateTypeId: string; amount: number | null | undefined }>,
): number | null {
  const defaultRate = findDefaultRateType(rateTypes);
  if (!defaultRate) return null;
  const value = values.find((rate) => rate.rateTypeId === defaultRate.id)?.amount;
  return value == null || !Number.isFinite(value) ? null : value;
}

export function snapshotFromResolvedRate(rate: ResolvedRate) {
  return {
    rateTypeId: rate.rateTypeId,
    rateTypeCode: rate.rateTypeCode,
    rateTypeName: rate.rateTypeName,
    rateSource: rate.rateSource,
  };
}
