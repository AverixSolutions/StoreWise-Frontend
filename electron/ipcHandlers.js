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
const { registerDashboardHandlers } = require("./ipc/dashboard");
const { registerCategoryHandlers } = require("./ipc/categories");
const { registerBrandHandlers } = require("./ipc/brands");
const { registerUnitHandlers } = require("./ipc/units");
const { registerTransactionTypeHandlers } = require("./ipc/transactionTypes");
const { registerOfferHandlers } = require("./ipc/offers");
const {
  registerSupplierLedgerSyncHandlers,
} = require("./ipc/supplierLedgerSync");
const { registerCustomerLedgerHandlers } = require("./ipc/customerLedger");
const { registerQuotationHandlers } = require("./ipc/quotations");
const { registerLicenseFeatureHandlers } = require("./licenseFeatures");

function registerAllHandlers() {
  registerLicenseFeatureHandlers();
  registerProductHandlers();
  registerCategoryHandlers();
  registerBrandHandlers();
  registerUnitHandlers();
  registerTransactionTypeHandlers();
  registerOfferHandlers();
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
  registerDashboardHandlers();
  registerSupplierLedgerSyncHandlers();
  registerCustomerLedgerHandlers();
  registerQuotationHandlers();
}

module.exports = { registerAllHandlers };
