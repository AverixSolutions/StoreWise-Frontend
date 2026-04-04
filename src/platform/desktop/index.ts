// src/platform/desktop/index.ts
import type {
  PlatformAPI,
  Pagination,
  ProductFilters,
  ProductInput,
  BatchSavePayload,
  ShopSettingsPayload,
} from "../types";

function requireElectronAPI() {
  if (typeof window === "undefined" || !window.electronAPI) {
    throw new Error("Electron API is not available in this runtime");
  }
  return window.electronAPI;
}

export const desktopPlatform: PlatformAPI = {
  getRuntimeInfo: () => ({
    runtime: "desktop",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
  }),

  getMasterCounts: async (licenseId: string) => {
    const api = requireElectronAPI();
    const [
      { count: supplierCount },
      { count: accountCount },
      { count: customerCount },
    ] = await Promise.all([
      api.getSupplierCount(licenseId, { q: "" }),
      api.getAccountCount(licenseId),
      api.getCustomerCount(licenseId, { q: "" }),
    ]);
    return {
      supplierCount: Number(supplierCount || 0),
      accountCount: Number(accountCount || 0),
      customerCount: Number(customerCount || 0),
    };
  },

  getDashboardOverview: async (licenseId: string, days = 7) => {
    const api = requireElectronAPI() as any;
    if (!api.getDashboardOverview) {
      return { success: false, unsupported: true };
    }
    const overview = await api.getDashboardOverview(licenseId, days);
    return { success: true, overview };
  },

  getNextCode: (licenseId: string) => {
    return requireElectronAPI().getNextCode(licenseId);
  },

  getProducts: (licenseId: string, pagination?: Pagination) => {
    return requireElectronAPI().getProducts(licenseId, pagination);
  },

  getFilteredProducts: (
    licenseId: string,
    filters: ProductFilters,
    pagination?: Pagination,
  ) => {
    return requireElectronAPI().getFilteredProducts(
      licenseId,
      filters,
      pagination,
    );
  },

  getProduct: (productId: string) => {
    return requireElectronAPI().getProduct(productId);
  },

  getProductByBarcode: (licenseId: string, barcode: string) => {
    return requireElectronAPI().getProductByBarcode(licenseId, barcode);
  },

  createProduct: (product: ProductInput) => {
    return requireElectronAPI().createProduct(product);
  },

  updateProduct: (productId: string, product: ProductInput) => {
    return requireElectronAPI().updateProduct(productId, product);
  },

  deleteProduct: (productId: string) => {
    return requireElectronAPI().deleteProduct(productId);
  },

  listBatchesForProduct: (productId: string, includeDeleted = false) => {
    return requireElectronAPI().listBatchesForProduct(
      productId,
      includeDeleted,
    );
  },

  saveBatch: (payload: BatchSavePayload) => {
    return requireElectronAPI().saveBatch(payload);
  },

  peekNextBarcode: (licenseId: string) => {
    return requireElectronAPI().peekNextBarcode(licenseId);
  },

  reserveBarcodes: (licenseId: string, count: number) => {
    return requireElectronAPI().reserveBarcodes(licenseId, count);
  },

  listBarcodesForProduct: (licenseId: string, productId: string) => {
    return requireElectronAPI().listBarcodesForProduct(licenseId, productId);
  },

  createBarcodeForProduct: (payload: any) => {
    return requireElectronAPI().createBarcodeForProduct(payload);
  },

  deleteBarcode: (licenseId: string, batchId: string) => {
    return requireElectronAPI().deleteBarcode(licenseId, batchId);
  },
  deleteBatch: (batchId: string) => {
    return requireElectronAPI().deleteBatch(batchId);
  },

  rebuildProductStock: (productId: string) => {
    return requireElectronAPI().rebuildProductStock(productId);
  },

  getShopSettings: (licenseId: string) => {
    return requireElectronAPI().getShopSettings(licenseId);
  },

  saveShopSettings: (payload: ShopSettingsPayload) => {
    return requireElectronAPI().saveShopSettings(payload);
  },
};
