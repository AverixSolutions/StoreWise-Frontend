// src/platform/web/index.ts
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

  saveBrand: (payload: BrandSavePayload): Promise<BrandMutationResult> =>
    webSaveBrand(payload),

  deleteBrand: (id: string): Promise<MutationResult> => webDeleteBrand(id),

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
};
