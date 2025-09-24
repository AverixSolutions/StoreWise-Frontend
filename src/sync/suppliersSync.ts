// src/sync/suppliersSync.ts
import { startSync, stopSync, toIsoFromSqliteUtc } from "./core";

export function startSuppliersSync() {
  console.log("Starting suppliers sync...");
  startSync({
    scope: "suppliers",
    pushEndpoint: "/sync/suppliers/push",
    getDirty: (licenseId, pageSize) => {
      console.log(`Fetching dirty suppliers for licenseId: ${licenseId}`);
      return (window as any).electronAPI.getDirtySuppliers(licenseId, pageSize);
    },
    markSynced: (ids, ts) => {
      console.log(`Marking suppliers as synced: ${ids}`);
      return (window as any).electronAPI.markSuppliersSynced(ids, ts);
    },
    bulkUpsert: (items) => {
      console.log(`Upserting suppliers: ${items.length} items`);
      return (window as any).electronAPI.bulkUpsertSuppliers(items);
    },
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
      openingBalance: s.openingBalance != null ? String(s.openingBalance) : "0",
      notes: s.notes ?? null,
      createdAt: toIsoFromSqliteUtc(s.createdAt),
      updatedAt: toIsoFromSqliteUtc(s.updatedAt),
      deletedAt: s.deletedAt ? toIsoFromSqliteUtc(s.deletedAt) : null,
    }),
  });
}

export function stopSuppliersSync() {
  stopSync("suppliers");
}

export function debugSupplierSync() {
  console.log("=== Supplier Sync Debug ===");

  const licenseId = localStorage.getItem("licenseId");
  if (!licenseId) {
    console.error("No licenseId found");
    return;
  }

  (window as any).electronAPI.getSyncState("suppliers").then((state: any) => {
    console.log("Suppliers sync state:", state);
  });

  (window as any).electronAPI
    .getDirtySuppliers(licenseId, 10)
    .then((suppliers: any) => {
      console.log("Dirty suppliers:", suppliers);
    });

  (window as any).electronAPI.getSupplierCount(licenseId).then((count: any) => {
    console.log("Total suppliers:", count);
  });
}
