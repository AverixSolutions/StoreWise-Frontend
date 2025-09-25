// src/sync/registry.ts
import { SyncManager } from "./SyncManager";
import { createElectronAdapter } from "./electronAdapter";

let adapter: ReturnType<typeof createElectronAdapter> | null = null;
const managers: Record<string, any> = {};

export function initSyncRegistry(eapi: any) {
  adapter = createElectronAdapter(eapi);
  return adapter;
}

export function createProductsManager() {
  if (!adapter) throw new Error("Adapter not initialized");
  const mgr = new SyncManager({
    scope: "products",
    pushEndpoint: "/sync/product/push",
    getDirty: (licenseId, pageSize) =>
      adapter!.getDirtyProducts(licenseId, pageSize),
    markSynced: (ids, ts) => adapter!.markProductsSynced(ids, ts),
    bulkUpsert: (items) => adapter!.bulkUpsertProducts(items),
    mapItem: (p) => ({
      id: p.id,
      licenseId: p.licenseId,
      code: p.code,
      codeNumber: Number(p.codeNumber),
      barcode: p.barcode ?? null,
      name: p.name,
      brand: p.brand ?? null,
      category: p.category ?? null,
      unit: p.unit,
      tax: p.tax,
      hsn: p.hsn ?? null,
      costPrice: String(p.costPrice),
      salePrice: p.salePrice != null ? String(p.salePrice) : null,
      stock: Number(p.stock),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt ?? null,
    }),
  });
  managers.products = mgr;
  return mgr;
}

export function createSuppliersManager() {
  if (!adapter) throw new Error("Adapter not initialized");
  const mgr = new SyncManager({
    scope: "suppliers",
    pushEndpoint: "/sync/suppliers/push",
    getDirty: (licenseId, pageSize) =>
      adapter!.getDirtySuppliers(licenseId, pageSize),
    markSynced: (ids, ts) => adapter!.markSuppliersSynced(ids, ts),
    bulkUpsert: (items) => adapter!.bulkUpsertSuppliers(items),
    mapItem: (s) => ({
      id: s.id,
      licenseId: s.licenseId,
      code: s.code ?? null,
      codeNumber: s.codeNumber != null ? Number(s.codeNumber) : null,
      name: s.name,
      phone: s.phone ?? null,
      email: s.email ?? null,
      gstin: s.gstin ?? null,
      department: s.department ?? null,
      addressLine1: s.addressLine1 ?? null,
      addressLine2: s.addressLine2 ?? null,
      city: s.city ?? null,
      state: s.state ?? null,
      pincode: s.pincode ?? null,
      category: s.category ?? null,
      native: s.native ?? null,
      language: s.language ?? null,
      aadhaar: s.aadhaar ?? null,
      pan: s.pan ?? null,
      license1: s.license1 ?? null,
      license2: s.license2 ?? null,
      settlementDays:
        s.settlementDays != null ? Number(s.settlementDays) : null,
      creditLimit: s.creditLimit != null ? String(s.creditLimit) : null,
      openingBalance: String(s.openingBalance || "0"),
      notes: s.notes ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      deletedAt: s.deletedAt ?? null,
    }),
  });
  managers.suppliers = mgr;
  return mgr;
}

export function getManager(scope: string) {
  return managers[scope];
}
