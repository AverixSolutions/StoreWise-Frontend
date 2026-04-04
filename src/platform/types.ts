// src/platform/types.ts
export type Pagination = {
  page?: number;
  pageSize?: number;
};

export type ProductFilters = {
  name?: string | null;
  category?: string | null;
};

export type ProductInput = {
  licenseId: string;
  code: string;
  codeNumber: number;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  tax: string;
  hsn?: string | null;
  costPrice: number;
  salePrice: number | null;
  stock?: number;
  barcode?: string | null;
};

export type BatchSavePayload = {
  id?: string;
  licenseId?: string;
  productId: string;
  barcode?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  costPrice?: number | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  stock?: number;
  receivedAt?: string | null;
};

export type ShopSettingsPayload = {
  licenseId: string;
  shopName: string;
  logoDataUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  mobile?: string | null;
  email?: string | null;
  gstin?: string | null;
  footerNote?: string | null;
  authorizedSignatory?: string | null;
};

export type ShopSettingsRecord = ShopSettingsPayload & {
  createdAt?: string;
  updatedAt?: string;
  syncStatus?: "LOCAL_ONLY" | "PENDING" | "SYNCED" | "SYNC_FAILED";
  lastSyncedAt?: string | null;
};

export type GetShopSettingsResult = {
  success: boolean;
  settings?: ShopSettingsRecord;
  source?: "desktop" | "web-local";
  error?: string;
};

export type SaveShopSettingsResult = {
  success: boolean;
  settings?: ShopSettingsRecord;
  synced?: boolean;
  localOnly?: boolean;
  warning?: string;
  error?: string;
};

export type RuntimeInfo = {
  runtime: "desktop" | "web";
  online: boolean;
};

export type MasterCounts = {
  supplierCount: number;
  customerCount: number;
  accountCount: number;
};

export type DashboardOverviewResult =
  | { success: true; overview: any }
  | { success: false; unsupported?: boolean; error?: string };

// ADD THESE
export type MutationResult = {
  success: boolean;
  error?: string;
};

export type CreateProductResult = MutationResult & {
  productId?: string;
};

export type BarcodeMutationResult = MutationResult & {
  batch?: any;
  barcode?: string;
  code?: string;
};

export type PlatformAPI = {
  getNextCode: (licenseId: string) => Promise<string>;

  getProducts: (licenseId: string, pagination?: Pagination) => Promise<any>;

  getFilteredProducts: (
    licenseId: string,
    filters: ProductFilters,
    pagination?: Pagination,
  ) => Promise<any>;

  getProduct: (productId: string) => Promise<any | null>;

  getProductByBarcode: (
    licenseId: string,
    barcode: string,
  ) => Promise<any | null>;

  // FIX THESE THREE
  createProduct: (product: ProductInput) => Promise<CreateProductResult>;

  updateProduct: (
    productId: string,
    product: ProductInput,
  ) => Promise<MutationResult>;

  deleteProduct: (productId: string) => Promise<MutationResult>;

  listBatchesForProduct: (
    productId: string,
    includeDeleted?: boolean,
  ) => Promise<any>;

  saveBatch: (payload: BatchSavePayload) => Promise<any>;

  getShopSettings: (licenseId: string) => Promise<GetShopSettingsResult>;

  saveShopSettings: (
    payload: ShopSettingsPayload,
  ) => Promise<SaveShopSettingsResult>;

  syncShopSettings?: (
    licenseId: string,
  ) => Promise<SaveShopSettingsResult | any>;

  getRuntimeInfo: () => RuntimeInfo;

  getMasterCounts: (licenseId: string) => Promise<MasterCounts>;

  getDashboardOverview?: (
    licenseId: string,
    days?: number,
  ) => Promise<DashboardOverviewResult>;

  // Barcode / Batch extras
  peekNextBarcode?: (
    licenseId: string,
  ) => Promise<{ success: boolean; barcode: string; number: number }>;

  reserveBarcodes?: (
    licenseId: string,
    count: number,
  ) => Promise<{ success: boolean; barcodes: string[] }>;

  listBarcodesForProduct?: (
    licenseId: string,
    productId: string,
  ) => Promise<{ success: boolean; rows: any[] }>;

  createBarcodeForProduct?: (payload: any) => Promise<BarcodeMutationResult>;

  deleteBarcode?: (
    licenseId: string,
    batchId: string,
  ) => Promise<MutationResult>;

  deleteBatch?: (batchId: string) => Promise<MutationResult>;

  rebuildProductStock?: (
    productId: string,
  ) => Promise<{ success: boolean; stock: number }>;
};
