// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ---- Product APIs ----
  getNextCode: (licenseId) => ipcRenderer.invoke("get-next-code", licenseId),
  createProduct: (product) => ipcRenderer.invoke("create-product", product),
  getProducts: (licenseId, pagination) =>
    ipcRenderer.invoke("get-products", licenseId, pagination),
  updateProduct: (productId, product) =>
    ipcRenderer.invoke("update-product", productId, product),
  deleteProduct: (productId) => ipcRenderer.invoke("delete-product", productId),
  getProduct: (productId) => ipcRenderer.invoke("get-product", productId),
  getFilteredProducts: (licenseId, filters, pagination) =>
    ipcRenderer.invoke("get-filtered-products", licenseId, filters, pagination),

  // Product sync
  getDirtyProducts: (licenseId, limit) =>
    ipcRenderer.invoke("get-dirty-products", licenseId, limit),
  markProductsSynced: (ids, serverSyncedAt) =>
    ipcRenderer.invoke("mark-products-synced", ids, serverSyncedAt),
  bulkUpsertProducts: (items) =>
    ipcRenderer.invoke("bulk-upsert-products", items),

  // ---- Purchase APIs ----
  createPurchase: (purchase, items) =>
    ipcRenderer.invoke("create-purchase", purchase, items),
  getPurchases: (licenseId, pagination) =>
    ipcRenderer.invoke("get-purchases", licenseId, pagination),
  markPurchasesSynced: (ids, serverSyncedAt) =>
    ipcRenderer.invoke("mark-purchases-synced", ids, serverSyncedAt),

  // Shared sync state
  getSyncState: (scope) => ipcRenderer.invoke("sync-state:get", scope),
  setSyncState: (scope, changes) =>
    ipcRenderer.invoke("sync-state:set", scope, changes),

  // Clears local DB
  wipeLocalData: () => ipcRenderer.invoke("wipe-local-data"),
});
