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
const { registerAccountHandlers } = require("./ipc/accounts");
const { registerTaxHandlers } = require("./ipc/tax");
const { registerPrintingHandlers } = require("./ipc/printing");
const { registerBarcodeHandlers } = require("./ipc/barcodes");
const { registerShopSettingsHandlers } = require("./ipc/shopSettings");
const { registerLabelPrintingHandlers } = require("./ipc/labelPrinting");

function registerAllHandlers() {
  registerProductHandlers();
  registerProductSyncHandlers();
  registerMaintenanceHandlers();
  registerBarcodeHandlers();
  registerPurchaseHandlers();
  registerSupplierHandlers();
  registerSupplierSyncHandlers();
  registerPurchaseReturnHandlers();
  registerSaleHandlers();
  registerSaleReturnHandlers();
  registerCustomerHandlers();
  registerAccountHandlers();
  registerTaxHandlers();
  registerPrintingHandlers();
  registerShopSettingsHandlers();
  registerLabelPrintingHandlers();
}

module.exports = { registerAllHandlers };
