// electron/ipcHandlers.js
const { registerProductHandlers } = require("./ipc/products");
const { registerProductSyncHandlers } = require("./ipc/productSync");
const { registerMaintenanceHandlers } = require("./ipc/maintenance");
const { registerPurchaseHandlers } = require("./ipc/purchases");
const { registerSupplierHandlers } = require("./ipc/suppliers");
const { registerSupplierSyncHandlers } = require("./ipc/SupplierSync");

function registerAllHandlers() {
  registerProductHandlers();
  registerProductSyncHandlers();
  registerMaintenanceHandlers();
  registerPurchaseHandlers();
  registerSupplierHandlers();
  registerSupplierSyncHandlers();
}

module.exports = { registerAllHandlers };
