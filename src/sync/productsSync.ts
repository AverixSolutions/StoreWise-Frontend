// src/sync/productsSync.ts
import { startSync, stopSync, toIsoFromSqliteUtc } from "./core";

type Unit = "KG" | "NOS" | "LTR" | "MTR";
type Tax = "NT" | "P5" | "P12" | "P18" | "P28";

export function startProductsSync() {
  startSync({
    scope: "products",
    pushEndpoint: "/sync/product/push",
    getDirty: (licenseId, pageSize) =>
      (window as any).electronAPI.getDirtyProducts(licenseId, pageSize),
    markSynced: (ids, ts) =>
      (window as any).electronAPI.markProductsSynced(ids, ts),
    bulkUpsert: (items) =>
      (window as any).electronAPI.bulkUpsertProducts(items),
    mapItem: (p) => ({
      id: p.id,
      licenseId: p.licenseId,
      code: p.code,
      codeNumber: Number(p.codeNumber),
      barcode: p.barcode ?? null,
      name: p.name,
      brand: p.brand ?? null,
      category: p.category ?? null,
      unit: p.unit as Unit,
      tax: p.tax as Tax,
      hsn: p.hsn ?? null,
      costPrice: String(p.costPrice),
      salePrice: p.salePrice != null ? String(p.salePrice) : null,
      stock: Number(p.stock),
      createdAt: toIsoFromSqliteUtc(p.createdAt),
      updatedAt: toIsoFromSqliteUtc(p.updatedAt),
      deletedAt: p.deletedAt ? toIsoFromSqliteUtc(p.deletedAt) : null,
    }),
  });
}

export function stopProductsSync() {
  stopSync("products");
}
