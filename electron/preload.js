// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Product operations
  getNextCode: (licenseId) => ipcRenderer.invoke("get-next-code", licenseId),
  createProduct: (product) => ipcRenderer.invoke("create-product", product),
  getProducts: (licenseId) => ipcRenderer.invoke("get-products", licenseId),
  updateProduct: (productId, product) =>
    ipcRenderer.invoke("update-product", productId, product),
  deleteProduct: (productId) => ipcRenderer.invoke("delete-product", productId),
  getProduct: (productId) => ipcRenderer.invoke("get-product", productId),

  // sync-specific
  getDirtyProducts: (licenseId, limit) =>
    ipcRenderer.invoke("get-dirty-products", licenseId, limit),
  markProductsSynced: (ids, serverSyncedAt) =>
    ipcRenderer.invoke("mark-products-synced", ids, serverSyncedAt),
  bulkUpsertProducts: (items) =>
    ipcRenderer.invoke("bulk-upsert-products", items),
  getSyncState: (scope) => ipcRenderer.invoke("sync-state:get", scope),
  setSyncState: (scope, changes) =>
    ipcRenderer.invoke("sync-state:set", scope, changes),

  // Clears local DB
  wipeLocalData: () => ipcRenderer.invoke("wipe-local-data"),
});
