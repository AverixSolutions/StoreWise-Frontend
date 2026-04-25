// src/platform/desktop/index.ts
import type {
  PlatformAPI,
  Pagination,
  ProductFilters,
  ProductInput,
  BatchSavePayload,
  ShopSettingsPayload,
  ProductSummary,
  ProductListResult,
  ProductLookupResult,
  BatchListResult,
  BarcodeListResult,
  UnitCode,
  TaxCode,
  BatchUpdatePayload,
  BatchMutationResult,
  CategoryListResult,
  CategorySavePayload,
  CategoryMutationResult,
  BrandListResult,
  BrandSavePayload,
  BrandMutationResult,
} from "../types";

function requireElectronAPI() {
  if (typeof window === "undefined" || !window.electronAPI) {
    throw new Error("Electron API is not available in this runtime");
  }
  return window.electronAPI;
}

const VALID_UNITS: UnitCode[] = ["KG", "NOS", "LTR", "MTR"];
const VALID_TAXES: TaxCode[] = ["NT", "P5", "P12", "P18", "P28"];

function toUnitCode(value: unknown): UnitCode {
  return VALID_UNITS.includes(value as UnitCode) ? (value as UnitCode) : "NOS";
}

function toTaxCode(value: unknown): TaxCode {
  return VALID_TAXES.includes(value as TaxCode) ? (value as TaxCode) : "P5";
}

function mapProductSummary(row: any): ProductSummary {
  return {
    id: row.id,
    code: row.code,
    shortCode: row.shortCode ?? null,
    imagePath: row.imagePath ?? null,
    imageFileName: row.imageFileName ?? null,
    name: row.name,
    brand: row.brand ?? null,
    category: row.category ?? null,
    subcategory: row.subcategory ?? null,
    productName: row.productName ?? null,
    model: row.model ?? null,
    size: row.size ?? null,
    barcode: row.barcode ?? null,
    batchCount: Number(row.batchCount ?? 0),
    unit: toUnitCode(row.unit),
    tax: toTaxCode(row.tax),
    hsn: row.hsn ?? null,
    costPrice: Number(row.costPrice ?? 0),
    salePrice: row.salePrice ?? null,
    stock: Number(row.stock ?? 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    licenseId: row.licenseId,
    codeNumber: row.codeNumber,
  };
}

function mapProductLookup(row: any): ProductLookupResult {
  return {
    ...mapProductSummary(row),
    batchId: row.batchId,
    batchMrp: row.batchMrp ?? null,
    batchSalePrice: row.batchSalePrice ?? null,
    batchCostPrice: row.batchCostPrice ?? null,
    batchNo: row.batchNo ?? null,
    mfgDate: row.mfgDate ?? null,
    expiryDate: row.expiryDate ?? null,
    batchStock: row.batchStock ?? undefined,
  };
}

function mapBatchRow(row: any) {
  return {
    id: row.id,
    licenseId: row.licenseId,
    productId: row.productId,
    barcode: row.barcode ?? null,
    mrp: row.mrp ?? null,
    salePrice: row.salePrice ?? null,
    costPrice: row.costPrice ?? null,
    batchNo: row.batchNo ?? null,
    mfgDate: row.mfgDate ?? null,
    expiryDate: row.expiryDate ?? null,
    receivedAt: row.receivedAt ?? null,
    stock: Number(row.stock ?? 0),
    isSystemGeneratedBarcode: row.isSystemGeneratedBarcode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
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

  getProducts: async (
    licenseId: string,
    pagination?: Pagination,
  ): Promise<ProductListResult> => {
    const result = await requireElectronAPI().getProducts(
      licenseId,
      pagination,
    );
    return {
      products: (result?.products || []).map(mapProductSummary),
      total: Number(result?.total || 0),
    };
  },

  getFilteredProducts: async (
    licenseId: string,
    filters: ProductFilters,
    pagination?: Pagination,
  ): Promise<ProductListResult> => {
    const result = await requireElectronAPI().getFilteredProducts(
      licenseId,
      filters,
      pagination,
    );
    return {
      products: (result?.products || []).map(mapProductSummary),
      total: Number(result?.total || 0),
    };
  },

  getProduct: async (productId: string): Promise<ProductSummary | null> => {
    const row = await requireElectronAPI().getProduct(productId);
    return row ? mapProductSummary(row) : null;
  },

  getProductImageDataUrl: async (productId: string): Promise<string | null> => {
    const api = requireElectronAPI() as any;

    if (!api.getProductImageDataUrl) {
      return null;
    }

    return api.getProductImageDataUrl(productId);
  },

  getProductByBarcode: async (
    licenseId: string,
    barcode: string,
  ): Promise<ProductLookupResult | null> => {
    const row = await requireElectronAPI().getProductByBarcode(
      licenseId,
      barcode,
    );
    return row ? mapProductLookup(row) : null;
  },

  getProductByCode: async (
    licenseId: string,
    code: string,
  ): Promise<ProductSummary | null> => {
    const api = requireElectronAPI() as any;

    if (!api.getProductByCode) {
      return null;
    }

    const row = await api.getProductByCode(licenseId, code);
    return row ? mapProductSummary(row) : null;
  },

  getProductByShortCode: async (
    licenseId: string,
    shortCode: string,
  ): Promise<ProductSummary | null> => {
    const api = requireElectronAPI() as any;

    if (!api.getProductByShortCode) {
      return null;
    }

    const row = await api.getProductByShortCode(licenseId, shortCode);
    return row ? mapProductSummary(row) : null;
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

  listBatchesForProduct: async (
    productId: string,
    includeDeleted = false,
  ): Promise<BatchListResult> => {
    const result = await requireElectronAPI().listBatchesForProduct(
      productId,
      includeDeleted,
    );
    return {
      success: !!result?.success,
      rows: (result?.rows || []).map(mapBatchRow),
      totalStock: Number(result?.totalStock || 0),
      error: result?.error,
    };
  },

  saveBatch: (payload: BatchSavePayload) => {
    return requireElectronAPI().saveBatch(payload);
  },

  updateBatch: (payload: BatchUpdatePayload): Promise<BatchMutationResult> => {
    return requireElectronAPI().updateBatch(payload);
  },

  peekNextBarcode: (licenseId: string) => {
    return requireElectronAPI().peekNextBarcode(licenseId);
  },

  reserveBarcodes: (licenseId: string, count: number) => {
    return requireElectronAPI().reserveBarcodes(licenseId, count);
  },

  listBarcodesForProduct: async (
    licenseId: string,
    productId: string,
  ): Promise<BarcodeListResult> => {
    const result = await requireElectronAPI().listBarcodesForProduct(
      licenseId,
      productId,
    );
    return {
      success: !!result?.success,
      rows: (result?.rows || []).map(mapBatchRow),
    };
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

  listCategories: async (licenseId: string): Promise<CategoryListResult> => {
    return requireElectronAPI().listCategories(licenseId);
  },

  saveCategory: async (
    payload: CategorySavePayload,
  ): Promise<CategoryMutationResult> => {
    return requireElectronAPI().saveCategory(payload);
  },

  deleteCategory: async (id: string) => {
    return requireElectronAPI().deleteCategory(id);
  },

  listBrands: async (licenseId: string): Promise<BrandListResult> => {
    return requireElectronAPI().listBrands(licenseId);
  },

  saveBrand: async (
    payload: BrandSavePayload,
  ): Promise<BrandMutationResult> => {
    return requireElectronAPI().saveBrand(payload);
  },

  deleteBrand: async (id: string) => {
    return requireElectronAPI().deleteBrand(id);
  },

  getShopSettings: (licenseId: string) => {
    return requireElectronAPI().getShopSettings(licenseId);
  },

  saveShopSettings: (payload: ShopSettingsPayload) => {
    return requireElectronAPI().saveShopSettings(payload);
  },
};
