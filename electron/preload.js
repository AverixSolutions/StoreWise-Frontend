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
});
