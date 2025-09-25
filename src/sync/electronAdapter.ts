// src/sync/electronAdapter.ts
export const createElectronAdapter = (eapi: any) => ({
  getDirtyProducts: (licenseId: string, limit = 200) =>
    eapi.getDirtyProducts(licenseId, limit),
  markProductsSynced: (ids: string[], ts?: string) =>
    eapi.markProductsSynced(ids, ts),
  bulkUpsertProducts: (items: any[]) => eapi.bulkUpsertProducts(items),

  getDirtySuppliers: (licenseId: string, limit = 200) =>
    eapi.getDirtySuppliers(licenseId, limit),
  markSuppliersSynced: (ids: string[], ts?: string) =>
    eapi.markSuppliersSynced(ids, ts),
  bulkUpsertSuppliers: (items: any[]) => eapi.bulkUpsertSuppliers(items),

  // purchases
  getDirtyPurchases: (licenseId: string, limit = 200) =>
    eapi.getDirtyPurchases
      ? eapi.getDirtyPurchases(licenseId, limit)
      : Promise.resolve([]),
  markPurchasesSynced: (ids: string[], ts?: string) =>
    eapi.markPurchasesSynced(ids, ts),

  getSyncState: (scope: string) => eapi.getSyncState(scope),
  setSyncState: (scope: string, changes: any) =>
    eapi.setSyncState(scope, changes),

  wipeLocalData: () => eapi.wipeLocalData(),
});
