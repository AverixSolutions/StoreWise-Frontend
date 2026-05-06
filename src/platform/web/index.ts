import type {
  PlatformAPI,
  Pagination,
  ProductFilters,
  ProductInput,
  BatchSavePayload,
  ShopSettingsPayload,
  BatchUpdatePayload,
  BatchMutationResult,
  CategoryListResult,
  CategorySavePayload,
  CategoryMutationResult,
  BrandListResult,
  BrandSavePayload,
  BrandMutationResult,
  MutationResult,
  UnitListResult,
  UnitSavePayload,
  UnitMutationResult,
  PurchaseCreatePayload,
  PurchaseUpdatePayload,
  PurchaseItemInput,
  CreatePurchaseResult,
  PurchaseListFilters,
  PurchaseListResult,
  PurchaseFullResult,
  PurchaseHoldSavePayload,
  PurchaseHoldSaveResult,
  PurchaseHoldsListResult,
  PurchaseHoldGetResult,
  SupplierListFilters,
  SupplierListResult,
  BulkPriceUpdate,
  SlNoResult,
  HoldNoResult,
} from "../types";
import {
  getWebShopSettings,
  saveWebShopSettings,
  syncAllPendingShopSettings,
  syncShopSettingsForLicense,
} from "./shopSettings";
import {
  webGetNextCode,
  webCreateProduct,
  webUpdateProduct,
  webDeleteProduct,
  webGetProduct,
  webGetProducts,
  webGetFilteredProducts,
  webGetProductByBarcode,
  webGetProductByCode,
  webGetProductByShortCode,
  webGetProductImageDataUrl,
  webListBatchesForProduct,
  webSaveBatch,
  webPeekNextBarcode,
  webReserveBarcodes,
  webListBarcodesForProduct,
  webCreateBarcodeForProduct,
  webDeleteBarcode,
  webDeleteBatch,
  webUpdateBatch,
  webRebuildProductStock,
} from "./products";
import {
  webListCategories,
  webSaveCategory,
  webDeleteCategory,
} from "./categories";
import { webListBrands, webSaveBrand, webDeleteBrand } from "./brands";
import { webListUnits, webSaveUnit, webDeleteUnit } from "./units";
import {
  webListTaxCategories,
  webSaveTaxCategory,
  webDeleteTaxCategory,
  webSeedIndiaGST,
  webListDefaultableAccounts,
} from "./tax";
import {
  webListTransactionTypes,
  webListAllTransactionTypes,
  webSaveTransactionType,
  webDeleteTransactionType,
  webSetDefaultTransactionType,
  webGetDefaultTransactionType,
} from "./transactionTypes";
// ── purchase imports ──────────────────────────────────────────────────────────
import {
  webListPurchases,
  webGetPurchaseFull,
  webCreatePurchase,
  webUpdatePurchase,
  webDeletePurchase,
  webPeekNextPurchaseSlNo,
  webSavePurchaseHold,
  webListPurchaseHolds,
  webGetPurchaseHold,
  webDeletePurchaseHold,
  webPeekNextHoldNo,
  webListSuppliers,
  webBulkUpdateProductPrices,
} from "./purchases";

import { webDeleteSupplier } from "./suppliers";

import {
  webGetSupplierLedger,
  webGetSupplierOutstandingBills,
  webCreateSupplierPayment,
  webListPayments,
  webMarkChequeReceived,
} from "./supplierLedger";

import {
  webListSales,
  webGetSaleFull,
  webCreateSale,
  webUpdateSale,
  webDeleteSale,
  webPeekNextSaleSlNo,
  webSaveSaleHold,
  webListSaleHolds,
  webGetSaleHold,
  webDeleteSaleHold,
} from "./sales";

import {
  webGetCustomerLedger,
  webGetCustomerOutstandingSales,
  webCreateCustomerReceipt,
  webListReceipts,
  webMarkCustomerChequeReceived,
} from "./customerLedger";

import {
  webListCustomers as webListCustomersFromModule,
  webGetCustomer,
  webSaveCustomer,
  webDeleteCustomer,
  webPeekNextCustomerCode,
  webGetCustomerCount,
  webGetCustomerDistincts,
} from "./customers";

// ── sale return imports ───────────────────────────────────────────────────────
import {
  webCreateSaleReturn,
  webUpdateSaleReturn,
  webDeleteSaleReturn,
  webListSaleReturns,
  webGetSaleReturnFull,
  webPeekNextSaleReturnSlNo,
  webSaveSaleReturnHold,
  webListSaleReturnHolds,
  webGetSaleReturnHold,
  webDeleteSaleReturnHold,
} from "./saleReturns";

let onlineHookRegistered = false;
function ensureOnlineSyncHook() {
  if (typeof window === "undefined" || onlineHookRegistered) return;
  window.addEventListener("online", () => {
    void syncAllPendingShopSettings();
  });
  onlineHookRegistered = true;
}

export const webPlatform: PlatformAPI = {
  getRuntimeInfo: () => ({
    runtime: "web",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
  }),

  getMasterCounts: async (_licenseId: string) => ({
    supplierCount: 0,
    customerCount: 0,
    accountCount: 0,
  }),

  getDashboardOverview: async (_licenseId: string, _days = 7) => ({
    success: false,
    unsupported: true,
  }),

  // ── Products ──────────────────────────────────────────────────────────────

  getNextCode: (licenseId: string) => webGetNextCode(licenseId),

  getProducts: (licenseId: string, pagination?: Pagination) =>
    webGetProducts(licenseId, pagination),

  getFilteredProducts: (
    licenseId: string,
    filters: ProductFilters,
    pagination?: Pagination,
  ) => webGetFilteredProducts(licenseId, filters, pagination),

  getProduct: (productId: string) => webGetProduct(productId),

  getProductImageDataUrl: (productId: string) =>
    webGetProductImageDataUrl(productId),

  getProductByBarcode: (licenseId: string, barcode: string) =>
    webGetProductByBarcode(licenseId, barcode),

  getProductByCode: (licenseId: string, code: string) =>
    webGetProductByCode(licenseId, code),

  getProductByShortCode: (licenseId: string, shortCode: string) =>
    webGetProductByShortCode(licenseId, shortCode),

  createProduct: (product: ProductInput) => webCreateProduct(product),

  updateProduct: (productId: string, product: ProductInput) =>
    webUpdateProduct(productId, product),

  deleteProduct: (productId: string) => webDeleteProduct(productId),

  listBatchesForProduct: (productId: string, includeDeleted = false) =>
    webListBatchesForProduct(productId, includeDeleted),

  saveBatch: (payload: BatchSavePayload) => webSaveBatch(payload),

  updateBatch: (payload: BatchUpdatePayload): Promise<BatchMutationResult> =>
    webUpdateBatch(payload),

  peekNextBarcode: (licenseId: string) => webPeekNextBarcode(licenseId),
  reserveBarcodes: (licenseId: string, count: number) =>
    webReserveBarcodes(licenseId, count),
  listBarcodesForProduct: (licenseId: string, productId: string) =>
    webListBarcodesForProduct(licenseId, productId),
  createBarcodeForProduct: (payload: any) =>
    webCreateBarcodeForProduct(payload),
  deleteBarcode: (licenseId: string, batchId: string) =>
    webDeleteBarcode(licenseId, batchId),
  deleteBatch: (batchId: string) => webDeleteBatch(batchId),
  rebuildProductStock: (productId: string) => webRebuildProductStock(productId),

  // ── Categories ────────────────────────────────────────────────────────────
  listCategories: (licenseId: string): Promise<CategoryListResult> =>
    webListCategories(licenseId),
  saveCategory: (
    payload: CategorySavePayload,
  ): Promise<CategoryMutationResult> => webSaveCategory(payload),
  deleteCategory: (id: string): Promise<MutationResult> =>
    webDeleteCategory(id),

  // ── Brands ────────────────────────────────────────────────────────────────
  listBrands: (licenseId: string): Promise<BrandListResult> =>
    webListBrands(licenseId),
  saveBrand: (payload: BrandSavePayload): Promise<any> => webSaveBrand(payload),
  deleteBrand: (id: string): Promise<MutationResult> => webDeleteBrand(id),

  // ── Units ────────────────────────────────────────────────────────────────
  listUnits: (licenseId: string): Promise<UnitListResult> =>
    webListUnits(licenseId),
  saveUnit: (payload: UnitSavePayload): Promise<UnitMutationResult> =>
    webSaveUnit(payload),
  deleteUnit: (id: string): Promise<MutationResult> => webDeleteUnit(id),

  // ── Tax ───────────────────────────────────────────────────────────────────
  listTaxCategories: (licenseId: string) => webListTaxCategories(licenseId),
  saveTaxCategory: (payload) => webSaveTaxCategory(payload),
  deleteTaxCategory: (id: string) => webDeleteTaxCategory(id),
  seedIndiaGST: (licenseId: string) => webSeedIndiaGST(licenseId),
  listDefaultableAccounts: (licenseId: string) =>
    webListDefaultableAccounts(licenseId),

  // ── Shop Settings ─────────────────────────────────────────────────────────
  getShopSettings: async (licenseId: string) => {
    ensureOnlineSyncHook();
    return getWebShopSettings(licenseId);
  },
  saveShopSettings: async (payload: ShopSettingsPayload) => {
    ensureOnlineSyncHook();
    return saveWebShopSettings(payload);
  },
  syncShopSettings: async (licenseId: string) => {
    ensureOnlineSyncHook();
    return syncShopSettingsForLicense(licenseId);
  },

  listTransactionTypes: (licenseId, category) =>
    webListTransactionTypes(licenseId, category),
  listAllTransactionTypes: (licenseId) => webListAllTransactionTypes(licenseId),
  saveTransactionType: (payload) => webSaveTransactionType(payload),
  deleteTransactionType: (id, licenseId) => webDeleteTransactionType(id),
  setDefaultTransactionType: (id, licenseId, category) =>
    webSetDefaultTransactionType(id, licenseId, category),
  getDefaultTransactionType: (licenseId, category) =>
    webGetDefaultTransactionType(licenseId, category),

  // ── Purchases ─────────────────────────────────────────────────────────────
  createPurchase: (
    purchase: PurchaseCreatePayload,
    items: PurchaseItemInput[],
  ): Promise<CreatePurchaseResult> => webCreatePurchase(purchase, items),

  updatePurchase: (payload: PurchaseUpdatePayload): Promise<MutationResult> =>
    webUpdatePurchase(payload),

  deletePurchase: (
    id: string,
  ): Promise<MutationResult & { deletedAt?: string }> => webDeletePurchase(id),

  listPurchases: (
    licenseId: string,
    filters?: PurchaseListFilters,
  ): Promise<PurchaseListResult> => webListPurchases(licenseId, filters),

  getPurchaseFull: (id: string): Promise<PurchaseFullResult> =>
    webGetPurchaseFull(id),

  peekNextPurchaseSlNo: (licenseId: string): Promise<SlNoResult> =>
    webPeekNextPurchaseSlNo(licenseId),

  savePurchaseHold: (
    payload: PurchaseHoldSavePayload,
  ): Promise<PurchaseHoldSaveResult> => webSavePurchaseHold(payload),

  listPurchaseHolds: (
    licenseId: string,
    pagination?: Pagination,
  ): Promise<PurchaseHoldsListResult> =>
    webListPurchaseHolds(licenseId, pagination),

  getPurchaseHold: (id: string): Promise<PurchaseHoldGetResult> =>
    webGetPurchaseHold(id),

  deletePurchaseHold: (id: string): Promise<MutationResult> =>
    webDeletePurchaseHold(id),

  peekNextHoldNo: (licenseId: string): Promise<HoldNoResult> =>
    webPeekNextHoldNo(licenseId),

  listSuppliers: (
    licenseId: string,
    filters?: SupplierListFilters,
  ): Promise<SupplierListResult> => webListSuppliers(licenseId, filters),

  deleteSupplier: (id: string): Promise<MutationResult> =>
    webDeleteSupplier(id),

  getSupplierLedger: webGetSupplierLedger,
  getSupplierOutstandingBills: webGetSupplierOutstandingBills,
  createSupplierPayment: webCreateSupplierPayment,
  listPayments: webListPayments,
  markChequeReceived: webMarkChequeReceived,

  getCustomerLedger: webGetCustomerLedger,
  getCustomerOutstandingSales: webGetCustomerOutstandingSales,
  createCustomerReceipt: webCreateCustomerReceipt,
  listReceipts: webListReceipts,
  markCustomerChequeReceived: webMarkCustomerChequeReceived,

  listCustomers: webListCustomersFromModule,
  getCustomer: webGetCustomer,
  saveCustomer: webSaveCustomer,
  deleteCustomer: webDeleteCustomer,
  peekNextCustomerCode: webPeekNextCustomerCode,
  getCustomerCount: webGetCustomerCount,
  getCustomerDistincts: webGetCustomerDistincts,

  bulkUpdateProductPrices: (
    updates: BulkPriceUpdate[],
  ): Promise<MutationResult> => webBulkUpdateProductPrices(updates),

  // ── Sales ─────────────────────────────────────────────────────────────────
  createSale: (sale, items) => webCreateSale(sale, items),
  updateSale: (payload) => webUpdateSale(payload),
  deleteSale: (id) => webDeleteSale(id),
  listSales: (licenseId, filters) => webListSales(licenseId, filters),
  getSaleFull: (id) => webGetSaleFull(id),
  peekNextSaleSlNo: (licenseId) => webPeekNextSaleSlNo(licenseId),
  saveSaleHold: (payload) => webSaveSaleHold(payload),
  listSaleHolds: (licenseId, pagination) =>
    webListSaleHolds(licenseId, pagination),
  getSaleHold: (id) => webGetSaleHold(id),
  deleteSaleHold: (id) => webDeleteSaleHold(id),

  // ── Sale Returns ──────────────────────────────────────────────────────────
  createSaleReturn: (payload) => webCreateSaleReturn(payload),
  updateSaleReturn: (payload) => webUpdateSaleReturn(payload),
  deleteSaleReturn: (id) => webDeleteSaleReturn(id),
  listSaleReturns: (licenseId, filters) => webListSaleReturns(licenseId, filters),
  getSaleReturnFull: (id) => webGetSaleReturnFull(id),
  peekNextSaleReturnSlNo: (licenseId) => webPeekNextSaleReturnSlNo(licenseId),
  saveSaleReturnHold: (payload) => webSaveSaleReturnHold(payload),
  listSaleReturnHolds: (licenseId, pagination) =>
    webListSaleReturnHolds(licenseId, pagination),
  getSaleReturnHold: (id) => webGetSaleReturnHold(id),
  deleteSaleReturnHold: (id) => webDeleteSaleReturnHold(id),
};
