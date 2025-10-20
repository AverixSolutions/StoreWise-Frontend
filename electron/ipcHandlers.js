// electron/ipcHandlers.js
const { registerProductHandlers } = require("./ipc/products");
const { registerProductSyncHandlers } = require("./ipc/productSync");
const { registerMaintenanceHandlers } = require("./ipc/maintenance");
const { registerPurchaseHandlers } = require("./ipc/purchases");
const { registerSupplierHandlers } = require("./ipc/suppliers");
const { registerSupplierSyncHandlers } = require("./ipc/SupplierSync");
const { registerPurchaseReturnHandlers } = require("./ipc/purchaseReturns");
const { registerSaleHandlers } = require("./ipc/sales");
const { registerSaleReturnHandlers } = require("./ipc/saleReturns");
const { registerCustomerHandlers } = require("./ipc/customers");

function registerAllHandlers() {
  registerProductHandlers();
  registerProductSyncHandlers();
  registerMaintenanceHandlers();
  registerPurchaseHandlers();
  registerSupplierHandlers();
  registerSupplierSyncHandlers();
  registerPurchaseReturnHandlers();
  registerSaleHandlers();
  registerSaleReturnHandlers();
  registerCustomerHandlers();
}

module.exports = { registerAllHandlers };
