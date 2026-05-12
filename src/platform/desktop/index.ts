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
  UnitListResult,
  UnitSavePayload,
  UnitMutationResult,
} from "../types";
import { canUseBarcode } from "@/lib/session/runtimeSession";

import {
  desktopCreatePurchase,
  desktopUpdatePurchase,
  desktopDeletePurchase,
  desktopListPurchases,
  desktopGetPurchaseFull,
  desktopPeekNextPurchaseSlNo,
  desktopSavePurchaseHold,
  desktopListPurchaseHolds,
  desktopGetPurchaseHold,
  desktopDeletePurchaseHold,
  desktopPeekNextHoldNo,
  desktopListSuppliers,
  desktopBulkUpdateProductPrices,
} from "./purchases";

import {
  desktopCreateSale,
  desktopUpdateSale,
  desktopDeleteSale,
  desktopListSales,
  desktopGetSaleFull,
  desktopPeekNextSaleSlNo,
  desktopSaveSaleHold,
  desktopListSaleHolds,
  desktopGetSaleHold,
  desktopDeleteSaleHold,
} from "./sales";

import {
  desktopListCustomers,
  desktopGetCustomer,
  desktopSaveCustomer,
  desktopDeleteCustomer,
  desktopPeekNextCustomerCode,
  desktopGetCustomerCount,
  desktopGetCustomerDistincts,
} from "./customers";

import {
  desktopCreatePurchaseReturn,
  desktopUpdatePurchaseReturn,
  desktopDeletePurchaseReturn,
  desktopListPurchaseReturns,
  desktopGetPurchaseReturnFull,
  desktopPeekNextPurchaseReturnSlNo,
  desktopSavePurchaseReturnHold,
  desktopListPurchaseReturnHolds,
  desktopGetPurchaseReturnHold,
  desktopDeletePurchaseReturnHold,
} from "./purchaseReturns";

import {
  desktopCreateQuotation,
  desktopUpdateQuotation,
  desktopDeleteQuotation,
  desktopListQuotations,
  desktopGetQuotationFull,
  desktopPeekNextQuotationSlNo,
  desktopConvertQuotationToSale,
} from "./quotations";

import {
  desktopCreateSaleReturn,
  desktopUpdateSaleReturn,
  desktopDeleteSaleReturn,
  desktopListSaleReturns,
  desktopGetSaleReturnFull,
  desktopPeekNextSaleReturnSlNo,
  desktopSaveSaleReturnHold,
  desktopListSaleReturnHolds,
  desktopGetSaleReturnHold,
  desktopDeleteSaleReturnHold,
} from "./saleReturns";

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

function triggerDesktopSync(entity: string) {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pushEntity(entity).catch(() => {});
    })
    .catch(() => {});
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
    if (!canUseBarcode()) return null;

    const row = await requireElectronAPI().getProductByBarcode(
      licenseId,
      barcode,
    );
    if ((row as any)?.success === false) return null;
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

  createProduct: async (product: ProductInput) => {
    const result = await requireElectronAPI().createProduct(product);
    if (result?.success) triggerDesktopSync("product");
    return result;
  },

  updateProduct: async (productId: string, product: ProductInput) => {
    const result = await requireElectronAPI().updateProduct(productId, product);
    if (result?.success) triggerDesktopSync("product");
    return result;
  },

  deleteProduct: async (productId: string) => {
    const result = await requireElectronAPI().deleteProduct(productId);
    if (result?.success) triggerDesktopSync("product");
    return result;
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
    if (payload.barcode && !canUseBarcode()) {
      return Promise.resolve({
        success: false,
        error: "Barcode Support is disabled for this license.",
      });
    }
    return requireElectronAPI().saveBatch(payload);
  },

  updateBatch: (payload: BatchUpdatePayload): Promise<BatchMutationResult> => {
    if (payload.barcode && !canUseBarcode()) {
      return Promise.resolve({
        success: false,
        error: "Barcode Support is disabled for this license.",
      });
    }
    return requireElectronAPI().updateBatch(payload);
  },

  peekNextBarcode: (licenseId: string) => {
    if (!canUseBarcode()) {
      return Promise.resolve({
        success: false,
        barcode: "",
        number: 0,
        error: "Barcode Support is disabled for this license.",
      });
    }
    return requireElectronAPI().peekNextBarcode(licenseId);
  },

  reserveBarcodes: (licenseId: string, count: number) => {
    if (!canUseBarcode()) {
      return Promise.resolve({
        success: false,
        barcodes: [],
        error: "Barcode Support is disabled for this license.",
      });
    }
    return requireElectronAPI().reserveBarcodes(licenseId, count);
  },

  listBarcodesForProduct: async (
    licenseId: string,
    productId: string,
  ): Promise<BarcodeListResult> => {
    if (!canUseBarcode()) {
      return {
        success: false,
        rows: [],
        error: "Barcode Support is disabled for this license.",
      };
    }

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
    if (!canUseBarcode()) {
      return Promise.resolve({
        success: false,
        code: "BARCODE_DISABLED",
        error: "Barcode Support is disabled for this license.",
      });
    }
    return requireElectronAPI().createBarcodeForProduct(payload);
  },

  deleteBarcode: (licenseId: string, batchId: string) => {
    if (!canUseBarcode()) {
      return Promise.resolve({
        success: false,
        error: "Barcode Support is disabled for this license.",
      });
    }
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
    const result = await requireElectronAPI().saveCategory(payload);
    if (result?.success) triggerDesktopSync("category");
    return result;
  },

  deleteCategory: async (id: string) => {
    const result = await requireElectronAPI().deleteCategory(id);
    if (result?.success) triggerDesktopSync("category");
    return result;
  },

  listBrands: async (licenseId: string): Promise<BrandListResult> => {
    return requireElectronAPI().listBrands(licenseId);
  },

  saveBrand: async (
    payload: BrandSavePayload,
  ): Promise<BrandMutationResult> => {
    const result = await requireElectronAPI().saveBrand(payload);
    if (result?.success) triggerDesktopSync("brand");
    return result;
  },

  deleteBrand: async (id: string) => {
    const result = await requireElectronAPI().deleteBrand(id);
    if (result?.success) triggerDesktopSync("brand");
    return result;
  },

  listUnits: async (licenseId: string): Promise<UnitListResult> => {
    return requireElectronAPI().listUnits(licenseId);
  },

  saveUnit: async (payload: UnitSavePayload): Promise<UnitMutationResult> => {
    const result = await requireElectronAPI().saveUnit(payload);
    if (result?.success) triggerDesktopSync("unit");
    return result;
  },

  deleteUnit: async (id: string): Promise<UnitMutationResult> => {
    const result = await requireElectronAPI().deleteUnit(id);
    if (result?.success) triggerDesktopSync("unit");
    return result;
  },

  // ── Tax ───────────────────────────────────────────────────────────────────
  listTaxCategories: async (licenseId: string) => {
    const res = await requireElectronAPI().listTaxCategories(licenseId);
    return res ?? { success: false, rows: [] };
  },

  saveTaxCategory: async (payload: any) => {
    return requireElectronAPI().saveTaxCategory(payload);
  },

  deleteTaxCategory: async (id: string) => {
    return requireElectronAPI().deleteTaxCategory(id);
  },

  seedIndiaGST: async (licenseId: string) => {
    return requireElectronAPI().seedIndiaGST(licenseId);
  },

  listDefaultableAccounts: async (licenseId: string) => {
    const res = await requireElectronAPI().listDefaultableAccounts(licenseId);
    return res ?? { success: false, rows: [] };
  },

  getShopSettings: (licenseId: string) => {
    return requireElectronAPI().getShopSettings(licenseId);
  },

  saveShopSettings: async (payload: ShopSettingsPayload) => {
    const result = await requireElectronAPI().saveShopSettings(payload);
    if (result?.success) triggerDesktopSync("shopSettings");
    return result;
  },

  // ── Transaction Types ─────────────────────────────────────────────────────
  listTransactionTypes: async (licenseId, category) => {
    const res = await requireElectronAPI().listTransactionTypes(
      licenseId,
      category,
    );
    return res ?? { success: false, rows: [] };
  },

  listAllTransactionTypes: async (licenseId) => {
    const res = await requireElectronAPI().listAllTransactionTypes(licenseId);
    return res ?? { success: false, rows: [] };
  },

  saveTransactionType: async (payload) => {
    const result = await requireElectronAPI().saveTransactionType(payload);
    if (result?.success) triggerDesktopSync("transactionType");
    return result;
  },

  deleteTransactionType: async (id, licenseId) => {
    const result = await requireElectronAPI().deleteTransactionType(
      id,
      licenseId,
    );
    if (result?.success) triggerDesktopSync("transactionType");
    return result;
  },

  setDefaultTransactionType: async (id, licenseId, category) => {
    const result = await requireElectronAPI().setDefaultTransactionType(
      id,
      licenseId,
      category,
    );
    if (result?.success) triggerDesktopSync("transactionType");
    return result;
  },

  getDefaultTransactionType: async (licenseId, category) => {
    const res = await requireElectronAPI().getDefaultTransactionType(
      licenseId,
      category,
    );
    return res ?? { success: false, row: null };
  },

  // ── Purchases ─────────────────────────────────────────────────────────────
  createPurchase: (purchase, items) => desktopCreatePurchase(purchase, items),

  updatePurchase: (payload) => desktopUpdatePurchase(payload),

  deletePurchase: (id) => desktopDeletePurchase(id),

  listPurchases: (licenseId, filters) =>
    desktopListPurchases(licenseId, filters),

  getPurchaseFull: (id) => desktopGetPurchaseFull(id),

  peekNextPurchaseSlNo: (licenseId) => desktopPeekNextPurchaseSlNo(licenseId),

  savePurchaseHold: (payload) => desktopSavePurchaseHold(payload),

  listPurchaseHolds: (licenseId, pagination) =>
    desktopListPurchaseHolds(licenseId, pagination),

  getPurchaseHold: (id) => desktopGetPurchaseHold(id),

  deletePurchaseHold: (id) => desktopDeletePurchaseHold(id),

  peekNextHoldNo: (licenseId) => desktopPeekNextHoldNo(licenseId),

  listSuppliers: (licenseId, filters) =>
    desktopListSuppliers(licenseId, filters),

  bulkUpdateProductPrices: (updates) => desktopBulkUpdateProductPrices(updates),

  // ── Purchase Returns ──────────────────────────────────────────────────────
  createPurchaseReturn: desktopCreatePurchaseReturn,
  updatePurchaseReturn: desktopUpdatePurchaseReturn,
  deletePurchaseReturn: desktopDeletePurchaseReturn,
  listPurchaseReturns: desktopListPurchaseReturns,
  getPurchaseReturnFull: desktopGetPurchaseReturnFull,
  peekNextPurchaseReturnSlNo: desktopPeekNextPurchaseReturnSlNo,
  savePurchaseReturnHold: desktopSavePurchaseReturnHold,
  listPurchaseReturnHolds: desktopListPurchaseReturnHolds,
  getPurchaseReturnHold: desktopGetPurchaseReturnHold,
  deletePurchaseReturnHold: desktopDeletePurchaseReturnHold,

  // ── Sale Returns ──────────────────────────────────────────────────────────
  createSaleReturn: desktopCreateSaleReturn,
  updateSaleReturn: desktopUpdateSaleReturn,
  deleteSaleReturn: desktopDeleteSaleReturn,
  listSaleReturns: desktopListSaleReturns,
  getSaleReturnFull: desktopGetSaleReturnFull,
  peekNextSaleReturnSlNo: desktopPeekNextSaleReturnSlNo,
  saveSaleReturnHold: desktopSaveSaleReturnHold,
  listSaleReturnHolds: desktopListSaleReturnHolds,
  getSaleReturnHold: desktopGetSaleReturnHold,
  deleteSaleReturnHold: desktopDeleteSaleReturnHold,

  // ── Supplier Ledger & Payments ────────────────────────────────────────────
  getSupplierLedger: (params) => requireElectronAPI().getSupplierLedger(params),

  getSupplierOutstandingBills: (params) =>
    requireElectronAPI().getSupplierOutstandingBills(params),

  createSupplierPayment: async (payload) => {
    const result = await requireElectronAPI().createSupplierPayment(payload);
    if (result?.success) triggerDesktopSync("supplierTransaction");
    return result;
  },

  listPayments: (params) => requireElectronAPI().listPayments(params),

  markChequeReceived: async (licenseId, txId) => {
    const result = await requireElectronAPI().markChequeReceived({
      licenseId,
      txId,
    });
    if (result?.success) triggerDesktopSync("supplierTransaction");
    return result;
  },

  getCustomerLedger: (params) => requireElectronAPI().getCustomerLedger(params),
  getCustomerOutstandingSales: (params) =>
    requireElectronAPI().getCustomerOutstandingSales(params),
  createCustomerReceipt: async (payload) => {
    const result = await requireElectronAPI().createCustomerReceipt(payload);
    if (result?.success) triggerDesktopSync("customerTransaction");
    return result;
  },
  listReceipts: (params) => requireElectronAPI().listReceipts(params),
  markCustomerChequeReceived: async (licenseId, txId) => {
    const result = await requireElectronAPI().markCustomerChequeReceived({
      licenseId,
      txId,
    });
    if (result?.success) triggerDesktopSync("customerTransaction");
    return result;
  },

  // ── Sales ─────────────────────────────────────────────────────────────────
  createSale: (sale, items) => desktopCreateSale(sale, items),
  updateSale: (payload) => desktopUpdateSale(payload),
  deleteSale: (id) => desktopDeleteSale(id),
  listSales: (licenseId, filters) => desktopListSales(licenseId, filters),
  getSaleFull: (id) => desktopGetSaleFull(id),
  peekNextSaleSlNo: (licenseId) => desktopPeekNextSaleSlNo(licenseId),
  saveSaleHold: (payload) => desktopSaveSaleHold(payload),
  listSaleHolds: (licenseId, pagination) =>
    desktopListSaleHolds(licenseId, pagination),
  getSaleHold: (id) => desktopGetSaleHold(id),
  deleteSaleHold: (id) => desktopDeleteSaleHold(id),

  listCustomers: (licenseId, filters) =>
    desktopListCustomers(licenseId, filters),

  saveCustomer: async (payload: any) => {
    const result = await desktopSaveCustomer(payload);
    if (result?.success) triggerDesktopSync("customer");
    return result;
  },

  deleteCustomer: async (id: string, licenseId: string) => {
    const result = await desktopDeleteCustomer(id, licenseId);
    if (result?.success) triggerDesktopSync("customer");
    return result;
  },

  getCustomer: (id: string) => desktopGetCustomer(id),
  peekNextCustomerCode: (licenseId: string) =>
    desktopPeekNextCustomerCode(licenseId),
  getCustomerCount: (licenseId: string, params?: { q?: string }) =>
    desktopGetCustomerCount(licenseId, params),
  getCustomerDistincts: (licenseId: string) =>
    desktopGetCustomerDistincts(licenseId),

  // ── Quotations ────────────────────────────────────────────────────────────
  createQuotation: (header, items) => desktopCreateQuotation(header, items),
  updateQuotation: (payload) => desktopUpdateQuotation(payload),
  deleteQuotation: (id) => desktopDeleteQuotation(id),
  listQuotations: (licenseId, filters) => desktopListQuotations(licenseId, filters),
  getQuotationFull: (id) => desktopGetQuotationFull(id),
  peekNextQuotationSlNo: (licenseId) => desktopPeekNextQuotationSlNo(licenseId),
  convertQuotationToSale: (quotationId, overrides) =>
    desktopConvertQuotationToSale(quotationId, overrides),

  // ── Print ─────────────────────────────────────────────────────────────────
  getPrinters: async () => {
    const api = requireElectronAPI() as any;
    if (!api.getPrinters) return [];
    const result = await api.getPrinters();
    return (result || []).map((p: any) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault ?? false,
    }));
  },
};
