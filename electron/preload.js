// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ---- DASHBOARD ----
  getDashboardOverview: (licenseId, days = 7) =>
    ipcRenderer.invoke("dashboard:getOverview", { licenseId, days }),

  // ----- BARCODE -----
  listBarcodesForProduct: (licenseId, productId) =>
    ipcRenderer.invoke("barcode:listForProduct", { licenseId, productId }),

  peekNextBarcode: (licenseId) =>
    ipcRenderer.invoke("barcode:peekNext", licenseId),

  reserveBarcodes: (licenseId, count) =>
    ipcRenderer.invoke("barcode:reserve", { licenseId, count }),

  createBarcodeForProduct: (payload) =>
    ipcRenderer.invoke("barcode:createForProduct", payload),

  deleteBarcode: (licenseId, batchId) =>
    ipcRenderer.invoke("barcode:deleteForProduct", { licenseId, batchId }),

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
  getProductByBarcode: (licenseId, barcode) =>
    ipcRenderer.invoke("get-product-by-barcode", licenseId, barcode),
  getProductByCode: (licenseId, code) =>
    ipcRenderer.invoke("get-product-by-code", licenseId, code),
  bulkUpdateProductPrices: (updates) =>
    ipcRenderer.invoke("bulk-update-product-prices", updates),

  // Product sync
  getDirtyProducts: (licenseId, limit) =>
    ipcRenderer.invoke("get-dirty-products", licenseId, limit),
  markProductsSynced: (ids, serverSyncedAt) =>
    ipcRenderer.invoke("mark-products-synced", ids, serverSyncedAt),
  bulkUpsertProducts: (items) =>
    ipcRenderer.invoke("bulk-upsert-products", items),

  // ----- Batches (UI) -----
  listBatchesForProduct: (productId, includeDeleted = false) =>
    ipcRenderer.invoke("product.batch:list", { productId, includeDeleted }),
  saveBatch: (payload) => ipcRenderer.invoke("product.batch:save", payload),
  deleteBatch: (batchId) =>
    ipcRenderer.invoke("product.batch:delete", { batchId }),
  rebuildProductStock: (productId) =>
    ipcRenderer.invoke("product:rebuild-stock", productId),

  // Optional richer fetch
  getProductWithBatches: (productId) =>
    ipcRenderer.invoke("product:getWithBatches", productId),

  // ---- Purchase APIs ----
  createPurchase: (purchase, items) =>
    ipcRenderer.invoke("create-purchase", purchase, items),
  getPurchases: (licenseId, pagination) =>
    ipcRenderer.invoke("get-purchases", licenseId, pagination),
  markPurchasesSynced: (ids, serverSyncedAt) =>
    ipcRenderer.invoke("mark-purchases-synced", ids, serverSyncedAt),
  getNextPurchaseSlNo: (licenseId) =>
    ipcRenderer.invoke("purchase:peek-next-slno", licenseId),

  // ---- Purchase Return APIs ----
  createPurchaseReturn: (payload) =>
    ipcRenderer.invoke("purchase-return:create", payload),
  listPurchaseReturns: (licenseId, pagination) =>
    ipcRenderer.invoke("purchase-return:list", licenseId, pagination),
  markPurchaseReturnsSynced: (ids, serverSyncedAt) =>
    ipcRenderer.invoke("purchase-return:mark-synced", ids, serverSyncedAt),
  getNextPurchaseReturnSlNo: (licenseId) =>
    ipcRenderer.invoke("purchase-return:peek-next-slno", licenseId),
  getPurchaseReturn: (id) => ipcRenderer.invoke("purchase-return:get", id),
  getPurchaseReturnFull: (id) =>
    ipcRenderer.invoke("purchase-return:getFull", id),
  updatePurchaseReturn: (payload) =>
    ipcRenderer.invoke("purchase-return:update", payload),
  deletePurchaseReturn: (id) =>
    ipcRenderer.invoke("purchase-return:delete", id),

  // ---- Purchase Holds ----
  savePurchaseHold: (payload) =>
    ipcRenderer.invoke("purchase-hold:save", payload),
  listPurchaseHolds: (licenseId, pagination) =>
    ipcRenderer.invoke("purchase-hold:list", licenseId, pagination),
  getPurchaseHold: (id) => ipcRenderer.invoke("purchase-hold:get", id),
  deletePurchaseHold: (id) => ipcRenderer.invoke("purchase-hold:delete", id),
  getNextHoldNo: (licenseId) =>
    ipcRenderer.invoke("purchase-hold:peek-next-no", licenseId),

  // Purchase report
  listPurchases: (licenseId, filters) =>
    ipcRenderer.invoke("purchase:list", licenseId, filters),
  getPurchaseFull: (id) => ipcRenderer.invoke("purchase:getFull", id),
  updatePurchase: (payload) => ipcRenderer.invoke("purchase:update", payload),
  deletePurchase: (id) => ipcRenderer.invoke("purchase:delete", id),

  // ---- Purchase Return Holds ----
  savePurchaseReturnHold: (payload) =>
    ipcRenderer.invoke("purchase-return-hold:save", payload),
  listPurchaseReturnHolds: (licenseId, pagination) =>
    ipcRenderer.invoke("purchase-return-hold:list", licenseId, pagination),
  getPurchaseReturnHold: (id) =>
    ipcRenderer.invoke("purchase-return-hold:get", id),
  deletePurchaseReturnHold: (id) =>
    ipcRenderer.invoke("purchase-return-hold:delete", id),
  getNextPurchaseReturnHoldNo: (licenseId) =>
    ipcRenderer.invoke("purchase-return-hold:peek-next-no", licenseId),

  // Suppliers
  createSupplier: (payload) => ipcRenderer.invoke("supplier:create", payload),
  updateSupplier: (id, changes) =>
    ipcRenderer.invoke("supplier:update", id, changes),
  deleteSupplier: (id) => ipcRenderer.invoke("supplier:delete", id),
  getSupplier: (id) => ipcRenderer.invoke("supplier:get", id),
  getSupplierSummary: (licenseId, supplierId) =>
    ipcRenderer.invoke("supplier:summary", licenseId, supplierId),
  getNextSupplierCode: (licenseId) =>
    ipcRenderer.invoke("supplier:get-next-code", licenseId),
  getSupplierCount: (licenseId, params) =>
    ipcRenderer.invoke("supplier:count", licenseId, params),
  listSuppliers: (licenseId, params) =>
    ipcRenderer.invoke("supplier:list", licenseId, params),
  getSupplierDistincts: (licenseId) =>
    ipcRenderer.invoke("supplier:distinct", licenseId),

  // Supplier Ledger
  getSupplierLedger: (params) =>
    ipcRenderer.invoke("supplier-ledger:list", params),
  createSupplierPayment: (payload) =>
    ipcRenderer.invoke("supplier-ledger:payment:create", payload),
  getSupplierOutstandingBills: (params) =>
    ipcRenderer.invoke("supplier:outstanding-bills", params),
  listPayments: (filters) => ipcRenderer.invoke("payments:list", filters),

  // Supplier sync
  getDirtySuppliers: (licenseId, limit) =>
    ipcRenderer.invoke("get-dirty-suppliers", licenseId, limit),
  markSuppliersSynced: (ids, serverSyncedAt) =>
    ipcRenderer.invoke("mark-suppliers-synced", ids, serverSyncedAt),
  bulkUpsertSuppliers: (items) =>
    ipcRenderer.invoke("bulk-upsert-suppliers", items),

  // SALES
  listSales: (licenseId, filters) =>
    ipcRenderer.invoke("sale:list", licenseId, filters),
  getSale: (id) => ipcRenderer.invoke("sale:get", id),
  getSaleFull: (id) => ipcRenderer.invoke("sale:getFull", id),
  createSale: (header, items) =>
    ipcRenderer.invoke("create-sale", header, items),
  updateSale: (payload) => ipcRenderer.invoke("sale:update", payload),
  deleteSale: (id) => ipcRenderer.invoke("sale:delete", id),
  getNextSaleSlNo: (licenseId) =>
    ipcRenderer.invoke("sale:peek-next-slno", licenseId),
  markSalesSynced: (ids, ts) => ipcRenderer.invoke("sale:mark-synced", ids, ts),

  // SALE HOLDS
  saveSaleHold: (payload) => ipcRenderer.invoke("sale-hold:save", payload),
  listSaleHolds: (licenseId, paging) =>
    ipcRenderer.invoke("sale-hold:list", licenseId, paging),
  getSaleHold: (id) => ipcRenderer.invoke("sale-hold:get", id),
  deleteSaleHold: (id) => ipcRenderer.invoke("sale-hold:delete", id),
  peekNextSaleHoldNo: (licenseId) =>
    ipcRenderer.invoke("sale-hold:peek-next-no", licenseId),

  // SALE RETURNS
  createSaleReturn: (payload) =>
    ipcRenderer.invoke("sale-return:create", payload),
  listSaleReturns: (licenseId, paging) =>
    ipcRenderer.invoke("sale-return:list", licenseId, paging),
  getSaleReturn: (id) => ipcRenderer.invoke("sale-return:get", id),
  getSaleReturnFull: (id) => ipcRenderer.invoke("sale-return:getFull", id),
  updateSaleReturn: (payload) =>
    ipcRenderer.invoke("sale-return:update", payload),
  deleteSaleReturn: (id) => ipcRenderer.invoke("sale-return:delete", id),
  markSaleReturnsSynced: (ids, ts) =>
    ipcRenderer.invoke("sale-return:mark-synced", ids, ts),
  getNextSaleReturnSlNo: (licenseId) =>
    ipcRenderer.invoke("sale-return:peek-next-slno", licenseId),

  // CUSTOMERS
  listCustomers: (licenseId, filters) =>
    ipcRenderer.invoke("customer:list", licenseId, filters),
  getCustomer: (id) => ipcRenderer.invoke("customer:get", id),
  saveCustomer: (payload) => ipcRenderer.invoke("customer:save", payload),
  deleteCustomer: (id) => ipcRenderer.invoke("customer:delete", id),
  peekNextCustomerCode: (licenseId) =>
    ipcRenderer.invoke("customer:peek-next-code", licenseId),
  getCustomerCount: (licenseId, params) =>
    ipcRenderer.invoke("customer:count", licenseId, params),
  getCustomerDistincts: (licenseId) =>
    ipcRenderer.invoke("customer:distinct", licenseId),

  // ---- Account Master ----
  listAccountGroups: () => ipcRenderer.invoke("accountGroup:list"),
  saveAccountGroup: (payload) =>
    ipcRenderer.invoke("accountGroup:save", payload),
  deleteAccountGroup: (id) => ipcRenderer.invoke("accountGroup:delete", id),

  listAccounts: (params) => ipcRenderer.invoke("account:list", params),
  getAccount: (id) => ipcRenderer.invoke("account:get", id),
  saveAccount: (payload) => ipcRenderer.invoke("account:save", payload),
  deleteAccount: (id) => ipcRenderer.invoke("account:delete", id),
  getAccountCount: (licenseId) =>
    ipcRenderer.invoke("account:count", licenseId),

  // ----- Tax ------
  listTaxCategories: (licenseId) =>
    ipcRenderer.invoke("tax:listCategories", licenseId),
  saveTaxCategory: (payload) => ipcRenderer.invoke("tax:saveCategory", payload),
  deleteTaxCategory: (id) => ipcRenderer.invoke("tax:deleteCategory", id),
  saveTaxCodeMap: (payload) => ipcRenderer.invoke("tax:saveCodeMap", payload),
  getTaxCodeMap: (licenseId) => ipcRenderer.invoke("tax:getCodeMap", licenseId),
  seedIndiaGST: (licenseId) =>
    ipcRenderer.invoke("tax:seedIndiaGST", licenseId),
  listDefaultableAccounts: (licenseId) =>
    ipcRenderer.invoke("tax:listDefaultableAccounts", licenseId),

  // Shared sync state
  getSyncState: (scope) => ipcRenderer.invoke("sync-state:get", scope),
  setSyncState: (scope, changes) =>
    ipcRenderer.invoke("sync-state:set", scope, changes),

  // print
  printHtml: (html, options) => ipcRenderer.invoke("print:html", html, options),

  // SHOP SETTINGS
  getShopSettings: (licenseId) =>
    ipcRenderer.invoke("shop-settings:get", licenseId),
  saveShopSettings: (payload) =>
    ipcRenderer.invoke("shop-settings:save", payload),

  // Label printing
  listLabelPrinters: (licenseId) =>
    ipcRenderer.invoke("label:printer:list", { licenseId }),

  saveLabelPrinter: (payload) =>
    ipcRenderer.invoke("label:printer:save", payload),

  listLabelTemplates: (licenseId) =>
    ipcRenderer.invoke("label:template:list", { licenseId }),

  getLabelTemplate: (licenseId, templateId) =>
    ipcRenderer.invoke("label:template:get", { licenseId, templateId }),

  saveLabelTemplate: (payload) =>
    ipcRenderer.invoke("label:template:save", payload),

  printLabelsNative: (payload) => ipcRenderer.invoke("label:print", payload),

  listLabelJobs: (licenseId, limit) =>
    ipcRenderer.invoke("label:job:list", { licenseId, limit }),

  // Clears local DB
  wipeLocalData: () => ipcRenderer.invoke("wipe-local-data"),
});
