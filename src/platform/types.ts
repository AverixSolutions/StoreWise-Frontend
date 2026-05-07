// src/platform/types.ts

export type UnitCode = "KG" | "NOS" | "LTR" | "MTR";
export type TaxCode = "NT" | "P5" | "P12" | "P18" | "P28";

export type Pagination = {
  page?: number;
  pageSize?: number;
};

export type ProductFilters = {
  name?: string | null;
  category?: string | null;
  brand?: string | null;
  subcategory?: string | null;
  tax?: string | null;
};

export type ProductImagePayload = {
  base64: string;
  mimeType: "image/jpeg" | "image/jpg" | "image/png" | "image/webp";
  fileName?: string;
};

// WRITE MODEL
export type ProductInput = {
  licenseId: string;
  code: string;
  codeNumber: number;
  shortCode?: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory?: string | null;
  productName?: string | null;
  model?: string | null;
  size?: string | null;
  unit: UnitCode;
  tax: TaxCode;
  hsn?: string | null;
  costPrice: number;
  salePrice: number | null;
  stock?: number;
  barcode?: string | null;
  image?: ProductImagePayload | null;
  imagePath?: string | null;
};

// READ/LIST MODEL
export type ProductSummary = {
  id: string;
  code: string;
  shortCode?: string | null;
  imagePath?: string | null;
  imageFileName?: string | null;
  name: string;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
  productName?: string | null;
  model?: string | null;
  size?: string | null;
  barcode?: string | null;
  batchCount?: number;
  unit: UnitCode;
  tax: TaxCode;
  hsn?: string | null;
  costPrice: number;
  salePrice?: number | null;
  stock: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  licenseId?: string;
  codeNumber?: number;
};

export type ProductLookupResult = ProductSummary & {
  batchId?: string;
  batchMrp?: number | null;
  batchSalePrice?: number | null;
  batchCostPrice?: number | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  batchStock?: number;
};

export type ProductListResult = {
  products: ProductSummary[];
  total: number;
};

export type BatchRow = {
  id: string;
  licenseId?: string;
  productId?: string;
  barcode?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  costPrice?: number | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  receivedAt?: string | null;
  stock: number;
  isSystemGeneratedBarcode?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type BatchSavePayload = {
  id?: string;
  licenseId: string;
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

export type BatchUpdatePayload = {
  id: string;
  licenseId: string;
  productId: string;
  barcode?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  costPrice?: number | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  receivedAt?: string | null;
};

export type MutationResult = {
  success: boolean;
  error?: string;
};

export type CreateProductResult = MutationResult & {
  productId?: string;
};

export type BatchMutationResult = MutationResult & {
  batch?: BatchRow;
  stock?: number;
};

export type BatchListResult = MutationResult & {
  rows: BatchRow[];
  totalStock: number;
};

export type BarcodePeekResult = MutationResult & {
  barcode?: string;
  number?: number;
};

export type BarcodeReserveResult = MutationResult & {
  barcodes?: string[];
};

export type BarcodeListResult = MutationResult & {
  rows: BatchRow[];
};

export type BarcodeCreatePayload = {
  licenseId: string;
  productId: string;
  barcode?: string;
  useGenerated?: boolean;
  mrp?: number | null;
  salePrice?: number | null;
  costPrice?: number | null;
};

export type BarcodeMutationResult = MutationResult & {
  batch?: BatchRow;
  barcode?: string;
  code?: string;
  reused?: boolean;
};

export type ShopSettingsPayload = {
  licenseId: string;
  shopName: string;
  logoDataUrl?: string | null;
  logoUrl?: string | null;
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

export type DashboardOverview = {
  shopName: string;
  kpis: {
    itemCount: number;
    liveBatchCount: number;
    stockQty: number;
    inventoryCostValue: number;
    inventorySaleValue: number;
    todaySalesCount: number;
    todaySalesAmount: number;
    todayPurchaseCount: number;
    todayPurchaseAmount: number;
    sales30Count: number;
    sales30Amount: number;
    purchases30Count: number;
    purchases30Amount: number;
    customerCount: number;
    supplierCount: number;
    receivableAmount: number;
    payableAmount: number;
    zeroStockCount: number;
    lowStockCount: number;
  };
  series: Array<{ day: string; sales: number; purchases: number }>;
  topProducts: Array<{
    productId: string;
    name: string;
    soldQty: number;
    revenue: number;
  }>;
  lowStockItems: Array<{ id: string; name: string; stock: number }>;
  recentActivity: Array<{
    id: string;
    slNo?: number;
    name: string;
    amount: number;
    date: string;
    type: "SALE" | "PURCHASE";
  }>;
  lastUpdatedAt: string;
};

export type DashboardOverviewResult =
  | { success: true; overview: DashboardOverview }
  | { success: false; unsupported?: boolean; error?: string };

// ── Category types ──────────────────────────────────────────────────────────

export type CategoryRecord = {
  id: string;
  licenseId: string;
  name: string;
  parentId: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type CategoryListResult = {
  success: boolean;
  rows: CategoryRecord[];
  error?: string;
};

export type CategorySavePayload = {
  id?: string;
  licenseId: string;
  name: string;
  parentId?: string | null;
};

export type CategoryMutationResult = MutationResult & { id?: string };

// ── Brand types ─────────────────────────────────────────────────────────────

export type BrandRecord = {
  id: string;
  licenseId: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type BrandListResult = {
  success: boolean;
  rows: BrandRecord[];
  error?: string;
};

export type BrandSavePayload = {
  id?: string;
  licenseId: string;
  name: string;
};

export type BrandMutationResult = MutationResult & { id?: string };

// ────────────────────────────────────────────────────────────────────────────

// ── Unit types ───────────────────────────────────────────────────────────────

export type UnitRecord = {
  id: string;
  licenseId: string;
  code: string;
  label: string;
  isDefault: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type UnitListResult = {
  success: boolean;
  rows: UnitRecord[];
  error?: string;
};

export type UnitSavePayload = {
  id?: string;
  licenseId: string;
  code: string;
  label: string;
};

export type UnitMutationResult = MutationResult & { id?: string };

// ── Tax types ────────────────────────────────────────────────────────────────

export type TaxComponentRecord = {
  id?: string;
  categoryId?: string;
  component: "CGST" | "SGST" | "IGST" | "CESS";
  rate: number;
  createdAt?: string;
  updatedAt?: string;
};

export type TaxDefaultsRecord = {
  salesAccountId?: string | null;
  purchaseAccountId?: string | null;
  salesReturnAccountId?: string | null;
  purchaseReturnAccountId?: string | null;
  outputCgstAccountId?: string | null;
  outputSgstAccountId?: string | null;
  outputIgstAccountId?: string | null;
  inputCgstAccountId?: string | null;
  inputSgstAccountId?: string | null;
  inputIgstAccountId?: string | null;
  cessAccountId?: string | null;
  singleTaxAccountId?: string | null;
};

export type TaxCategoryRecord = {
  id: string;
  licenseId: string;
  code: string;
  name: string;
  rate: number;
  isInterstate: number; // 0 | 1
  cessRate?: number | null;
  calcMethod?: string;
  components: TaxComponentRecord[];
  defaults?: TaxDefaultsRecord | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  isSynced?: number;
  syncedAt?: string | null;
};

export type TaxCategoryListResult = {
  success: boolean;
  rows: TaxCategoryRecord[];
  error?: string;
};

export type TaxCategorySavePayload = {
  id?: string;
  licenseId: string;
  code: string;
  name: string;
  rate: number;
  isInterstate: boolean;
  cessRate?: number | null;
  calcMethod?: string;
  components: TaxComponentRecord[];
  defaults?: TaxDefaultsRecord | null;
};

export type AccountOption = {
  id: string;
  name: string;
  code?: string | null;
  groupId?: string;
  taxType?: "INPUT" | "OUTPUT" | null;
  gstComponent?: "CGST" | "SGST" | "IGST" | "CESS" | null;
  rate?: number | null;
};

export type AccountListResult = {
  success: boolean;
  rows: AccountOption[];
  error?: string;
};

// ── Transaction Type types ────────────────────────────────────────────────────

export type TransactionTypeRecord = {
  id: string;
  licenseId: string;
  name: string;
  code: string | null;
  category: "sale" | "purchase" | "saleReturn" | "purchaseReturn";
  isDefault: number; // 0 | 1
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  isSynced?: number;
  syncedAt?: string | null;
};

export type TransactionTypeListResult = {
  success: boolean;
  rows: TransactionTypeRecord[];
  error?: string;
};

export type TransactionTypeSavePayload = {
  id?: string;
  licenseId: string;
  name: string;
  code?: string | null;
  category: "sale" | "purchase" | "saleReturn" | "purchaseReturn";
  isDefault?: boolean;
  sortOrder?: number;
};

export type TransactionTypeMutationResult = MutationResult & { id?: string };

// ── Purchase types ────────────────────────────────────────────────────────────

export type PurchaseItemInput = {
  productId: string;
  barcode?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number | null;
  taxPercent: string;
  taxAmount?: number;
  discount?: number;
  discountType?: "ABS" | "PCT";
  salePrice?: number | null;
  profit?: number | null;
  totalCost?: number;
  billedValue?: number;
  effectiveUnitValue?: number;
  batchNo?: string | null;
  purchaseBatchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number;
  isFree?: boolean;
  batchId?: string | null;
  profitPercent?: number;
};

export type PurchaseCreatePayload = {
  billNo?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  purchaseDate: string;
  entryTime?: string;
  discount?: number;
  licenseId: string;
  userId?: string;
  purchaseType: "CASH" | "CREDIT";
  typeId?: string | null;
};

export type PurchaseUpdatePayload = {
  id: string;
  header: {
    billNo?: string | null;
    supplierId?: string | null;
    supplierName?: string | null;
    department?: string | null;
    debitAccount?: string | null;
    natureOfEntry?: string | null;
    purchaseDate: string;
    entryTime?: string;
    discount?: number;
    licenseId: string;
    purchaseType: "CASH" | "CREDIT";
    supplier?: { id: string; name: string } | null;
    typeId?: string | null;
  };
  items: PurchaseItemInput[];
};

export type CreatePurchaseResult = {
  success: boolean;
  purchaseId?: string;
  slNo?: number;
  totalAmount?: number;
  error?: string;
};

export type PurchaseListFilters = {
  q?: string;
  supplierId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
};

export type PurchaseRow = {
  id: string;
  slNo?: number;
  billNo?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  purchaseDate: string;
  entryTime?: string;
  totalAmount: number;
  discount?: number;
  purchaseType?: string;
  isSynced?: number;
  deletedAt?: string | null;
  syncedAt?: string | null;
  typeId?: string | null;
};

export type PurchaseListResult = {
  success: boolean;
  total: number;
  page: number;
  pageSize: number;
  rows: PurchaseRow[];
  error?: string;
};

export type PurchaseItemRow = {
  id: string;
  purchaseId: string;
  productId: string;
  productName?: string | null;
  productCode?: string | null;
  barcode?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number | null;
  taxPercent: string;
  taxAmount: number;
  discount?: number;
  discountType?: string;
  salePrice?: number | null;
  profit?: number | null;
  totalCost: number;
  billedValue?: number;
  effectiveUnitValue?: number;
  batchNo?: string | null;
  purchaseBatchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number;
  isFree?: number;
  batchId?: string | null;
};

export type PurchaseFullResult = {
  success: boolean;
  purchase?: PurchaseRow & {
    purchaseBatchNo?: string | null;
    licenseId?: string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  items?: PurchaseItemRow[];
  error?: string;
};

// ── Purchase Hold types ───────────────────────────────────────────────────────

export type PurchaseHoldSavePayload = {
  id?: string;
  licenseId: string;
  userId?: string;
  title?: string | null;
  header: Record<string, any>;
  rows: any[];
};

export type PurchaseHoldSaveResult = {
  success: boolean;
  id?: string;
  holdNo?: number | null;
  updated?: boolean;
  error?: string;
};

export type PurchaseHoldListRow = {
  id: string;
  holdNo: number;
  title?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PurchaseHoldsListResult = {
  holds: PurchaseHoldListRow[];
  total: number;
};

export type PurchaseHoldGetResult = {
  success: boolean;
  hold?: {
    id: string;
    holdNo: number;
    title?: string | null;
    header: Record<string, any>;
    rows: any[];
    createdAt?: string;
    updatedAt?: string;
  };
  error?: string;
};

// ── Supplier types ────────────────────────────────────────────────────────────

export type SupplierRecord = {
  id: string;
  licenseId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  code?: string | null;
  codeNumber?: number;
  category?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  openingBalance?: number;
  notes?: string | null;
  settlementDays?: number | null;
  creditLimit?: number | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type SupplierListFilters = {
  q?: string;
  page?: number;
  pageSize?: number;
};

export type SupplierListResult = {
  suppliers: SupplierRecord[];
  total: number;
};

// ── Misc purchase helpers ─────────────────────────────────────────────────────

export type BulkPriceUpdate = {
  productId: string;
  salePrice?: number;
  costPrice?: number;
  unit?: string;
};

export type SlNoResult = {
  nextSlNo: number;
};

export type HoldNoResult = {
  nextHoldNo: number;
};

// ── Purchase Return types ─────────────────────────────────────────────────────

export type PurchaseReturnItemInput = {
  productId: string;
  barcode?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number | null;
  taxPercent: string;
  discount?: number;
  discountType?: "ABS" | "PCT";
  salePrice?: number | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number;
  batchId?: string | null;
  profitPercent?: number;
};

export type PurchaseReturnCreatePayload = {
  licenseId: string;
  userId?: string;
  billNo?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  returnDate: string;
  entryTime?: string;
  discount?: number;
  purchaseType: "CASH" | "CREDIT";
};

export type PurchaseReturnUpdatePayload = {
  id: string;
  header: PurchaseReturnCreatePayload;
  items: PurchaseReturnItemInput[];
};

export type CreatePurchaseReturnResult = {
  success: boolean;
  returnId?: string;
  slNo?: number;
  totalAmount?: number;
  error?: string;
};

export type PurchaseReturnListFilters = {
  q?: string;
  supplierId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
};

export type PurchaseReturnRow = {
  id: string;
  slNo?: number;
  billNo?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  returnDate: string;
  totalAmount: number;
  discount?: number;
  purchaseType?: string;
  deletedAt?: string | null;
};

export type PurchaseReturnListResult = {
  returns: PurchaseReturnRow[];
  total: number;
};

export type PurchaseReturnFullResult = {
  success: boolean;
  purchaseReturn?: PurchaseReturnRow & { licenseId?: string };
  items?: any[];
  error?: string;
};

export type PurchaseReturnHoldSavePayload = {
  id?: string;
  licenseId: string;
  userId?: string;
  title?: string | null;
  header: Record<string, any>;
  rows: any[];
};

export type PurchaseReturnHoldSaveResult = {
  success: boolean;
  id?: string;
  holdNo?: number | null;
  error?: string;
};

export type PurchaseReturnHoldsListResult = {
  holds: Array<{
    id: string;
    holdNo: number;
    title?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  total: number;
};

export type PurchaseReturnHoldGetResult = {
  success: boolean;
  hold?: {
    id: string;
    holdNo: number;
    title?: string | null;
    header: Record<string, any>;
    rows: any[];
  };
  error?: string;
};

// ── Sale Return types ─────────────────────────────────────────────────────────

export type SaleReturnItemInput = {
  productId: string;
  barcode?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number | null;
  taxPercent: string;
  discount?: number;
  discountType?: "ABS" | "PCT";
  salePrice?: number | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number;
  batchId?: string | null;
  profitPercent?: number;
};

export type SaleReturnCreatePayload = {
  licenseId: string;
  userId?: string;
  billNo?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  returnDate: string;
  entryTime?: string;
  discount?: number;
  saleType: "CASH" | "CREDIT";
};

export type SaleReturnUpdatePayload = {
  id: string;
  header: SaleReturnCreatePayload;
  items: SaleReturnItemInput[];
};

export type CreateSaleReturnResult = {
  success: boolean;
  returnId?: string;
  slNo?: number;
  totalAmount?: number;
  error?: string;
};

export type SaleReturnListFilters = {
  q?: string;
  customerId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
};

export type SaleReturnRow = {
  id: string;
  slNo?: number;
  billNo?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  returnDate: string;
  totalAmount: number;
  discount?: number;
  saleType?: "CASH" | "CREDIT";
  deletedAt?: string | null;
  // additional fields present in the getFull response
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  entryTime?: string | null;
};

export type SaleReturnListResult = {
  returns: SaleReturnRow[];
  total: number;
};

export type SaleReturnFullResult = {
  success: boolean;
  saleReturn?: SaleReturnRow & { licenseId?: string };
  items?: any[];
  error?: string;
};

export type SaleReturnHoldSavePayload = {
  id?: string;
  licenseId: string;
  userId?: string;
  title?: string | null;
  header: Record<string, any>;
  rows: any[];
};

export type SaleReturnHoldSaveResult = {
  success: boolean;
  id?: string;
  holdNo?: number | null;
  error?: string;
};

export type SaleReturnHoldsListResult = {
  holds: Array<{
    id: string;
    holdNo: number;
    title?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  total: number;
};

export type SaleReturnHoldGetResult = {
  success: boolean;
  hold?: {
    id: string;
    holdNo: number;
    title?: string | null;
    header: Record<string, any>;
    rows: any[];
  };
  error?: string;
};

// ── Sale types ────────────────────────────────────────────────────────────────

export type SaleItemInput = {
  productId: string;
  barcode?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number | null;
  taxPercent: string;
  taxAmount?: number;
  discount?: number;
  discountType?: "ABS" | "PCT";
  salePrice?: number | null;
  profit?: number | null;
  totalCost?: number;
  billedValue?: number;
  batchNo?: string | null;
  purchaseBatchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number;
  isFree?: boolean;
  batchId?: string | null;
  profitPercent?: number;
};

export type SaleCreatePayload = {
  billNo?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  saleDate: string;
  entryTime?: string;
  discount?: number;
  licenseId: string;
  userId?: string;
  saleType: "CASH" | "CREDIT";
  typeId?: string | null;
};

export type SaleUpdatePayload = {
  id: string;
  header: {
    billNo?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    department?: string | null;
    debitAccount?: string | null;
    natureOfEntry?: string | null;
    saleDate: string;
    entryTime?: string;
    discount?: number;
    licenseId: string;
    saleType: "CASH" | "CREDIT";
    typeId?: string | null;
  };
  items: SaleItemInput[];
};

export type CreateSaleResult = {
  success: boolean;
  saleId?: string;
  slNo?: number;
  totalAmount?: number;
  error?: string;
};

export type SaleListFilters = {
  q?: string;
  customerId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
};

export type SaleRow = {
  id: string;
  slNo?: number;
  billNo?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  saleDate: string;
  entryTime?: string;
  totalAmount: number;
  discount?: number;
  saleType?: string;
  isSynced?: number;
  deletedAt?: string | null;
  syncedAt?: string | null;
  typeId?: string | null;
};

export type SaleListResult = {
  success: boolean;
  total: number;
  page: number;
  pageSize: number;
  rows: SaleRow[];
  error?: string;
};

export type SaleItemRow = {
  id: string;
  saleId: string;
  productId: string;
  productName?: string | null;
  productCode?: string | null;
  barcode?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number | null;
  taxPercent: string;
  taxAmount: number;
  discount?: number;
  discountType?: string;
  salePrice?: number | null;
  profit?: number | null;
  totalCost: number;
  billedValue?: number;
  batchNo?: string | null;
  purchaseBatchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number;
  isFree?: number;
  batchId?: string | null;
};

export type SaleFullResult = {
  success: boolean;
  sale?: SaleRow & {
    licenseId?: string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  items?: SaleItemRow[];
  error?: string;
};

// ── Sale Hold types ───────────────────────────────────────────────────────────

export type SaleHoldSavePayload = {
  id?: string;
  licenseId: string;
  userId?: string;
  title?: string | null;
  header: Record<string, any>;
  rows: any[];
};

export type SaleHoldSaveResult = {
  success: boolean;
  id?: string;
  holdNo?: number | null;
  updated?: boolean;
  error?: string;
};

export type SaleHoldListRow = {
  id: string;
  holdNo: number;
  title?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SaleHoldsListResult = {
  holds: SaleHoldListRow[];
  total: number;
};

export type SaleHoldGetResult = {
  success: boolean;
  hold?: {
    id: string;
    holdNo: number;
    title?: string | null;
    header: Record<string, any>;
    rows: any[];
    createdAt?: string;
    updatedAt?: string;
  };
  error?: string;
};

// ── Customer types ────────────────────────────────────────────────────────────

export type CustomerRecord = {
  id: string;
  licenseId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  code?: string | null;
  codeNumber?: number;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  openingBalance?: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type CustomerListFilters = {
  q?: string;
  page?: number;
  pageSize?: number;
};

export type CustomerListResult = {
  customers: CustomerRecord[];
  total: number;
};

export type PlatformAPI = {
  getNextCode: (licenseId: string) => Promise<string>;

  getProducts: (
    licenseId: string,
    pagination?: Pagination,
  ) => Promise<ProductListResult>;

  getFilteredProducts: (
    licenseId: string,
    filters: ProductFilters,
    pagination?: Pagination,
  ) => Promise<ProductListResult>;

  getProduct: (productId: string) => Promise<ProductSummary | null>;

  getProductImageDataUrl?: (productId: string) => Promise<string | null>;

  getProductByBarcode: (
    licenseId: string,
    barcode: string,
  ) => Promise<ProductLookupResult | null>;

  getProductByCode?: (
    licenseId: string,
    code: string,
  ) => Promise<ProductSummary | null>;

  getProductByShortCode?: (
    licenseId: string,
    shortCode: string,
  ) => Promise<ProductSummary | null>;

  createProduct: (product: ProductInput) => Promise<CreateProductResult>;

  updateProduct: (
    productId: string,
    product: ProductInput,
  ) => Promise<MutationResult>;

  deleteProduct: (productId: string) => Promise<MutationResult>;

  listBatchesForProduct: (
    productId: string,
    includeDeleted?: boolean,
  ) => Promise<BatchListResult>;

  saveBatch: (payload: BatchSavePayload) => Promise<BatchMutationResult>;

  updateBatch: (payload: BatchUpdatePayload) => Promise<BatchMutationResult>;

  getShopSettings: (licenseId: string) => Promise<GetShopSettingsResult>;

  saveShopSettings: (
    payload: ShopSettingsPayload,
  ) => Promise<SaveShopSettingsResult>;

  syncShopSettings?: (licenseId: string) => Promise<SaveShopSettingsResult>;

  getRuntimeInfo: () => RuntimeInfo;

  getMasterCounts: (licenseId: string) => Promise<MasterCounts>;

  getDashboardOverview?: (
    licenseId: string,
    days?: number,
  ) => Promise<DashboardOverviewResult>;

  peekNextBarcode?: (licenseId: string) => Promise<BarcodePeekResult>;

  reserveBarcodes?: (
    licenseId: string,
    count: number,
  ) => Promise<BarcodeReserveResult>;

  listBarcodesForProduct?: (
    licenseId: string,
    productId: string,
  ) => Promise<BarcodeListResult>;

  createBarcodeForProduct?: (
    payload: BarcodeCreatePayload,
  ) => Promise<BarcodeMutationResult>;

  deleteBarcode?: (
    licenseId: string,
    batchId: string,
  ) => Promise<MutationResult>;

  deleteBatch?: (batchId: string) => Promise<MutationResult>;

  rebuildProductStock?: (
    productId: string,
  ) => Promise<{ success: boolean; stock: number }>;

  // Categories
  listCategories: (licenseId: string) => Promise<CategoryListResult>;
  saveCategory: (
    payload: CategorySavePayload,
  ) => Promise<CategoryMutationResult>;
  deleteCategory: (id: string) => Promise<MutationResult>;

  // Brands
  listBrands: (licenseId: string) => Promise<BrandListResult>;
  saveBrand: (payload: BrandSavePayload) => Promise<BrandMutationResult>;
  deleteBrand: (id: string) => Promise<MutationResult>;

  // Units
  listUnits: (licenseId: string) => Promise<UnitListResult>;
  saveUnit: (payload: UnitSavePayload) => Promise<UnitMutationResult>;
  deleteUnit: (id: string) => Promise<MutationResult>;

  // Tax
  listTaxCategories: (licenseId: string) => Promise<TaxCategoryListResult>;
  saveTaxCategory: (
    payload: TaxCategorySavePayload,
  ) => Promise<MutationResult & { id?: string }>;
  deleteTaxCategory: (id: string) => Promise<MutationResult>;
  seedIndiaGST: (licenseId: string) => Promise<MutationResult>;
  listDefaultableAccounts: (licenseId: string) => Promise<AccountListResult>;

  // Transaction Types
  listTransactionTypes?: (
    licenseId: string,
    category: string,
  ) => Promise<TransactionTypeListResult>;

  listAllTransactionTypes?: (
    licenseId: string,
  ) => Promise<TransactionTypeListResult>;

  saveTransactionType?: (
    payload: TransactionTypeSavePayload,
  ) => Promise<TransactionTypeMutationResult>;

  deleteTransactionType?: (
    id: string,
    licenseId: string,
  ) => Promise<MutationResult>;

  setDefaultTransactionType?: (
    id: string,
    licenseId: string,
    category: string,
  ) => Promise<MutationResult>;

  getDefaultTransactionType?: (
    licenseId: string,
    category: string,
  ) => Promise<{ success: boolean; row: TransactionTypeRecord | null }>;

  // ── Purchases ───────────────────────────────────────────────────────────────
  createPurchase?: (
    purchase: PurchaseCreatePayload,
    items: PurchaseItemInput[],
  ) => Promise<CreatePurchaseResult>;

  updatePurchase?: (payload: PurchaseUpdatePayload) => Promise<MutationResult>;

  deletePurchase?: (
    id: string,
  ) => Promise<MutationResult & { deletedAt?: string }>;

  listPurchases?: (
    licenseId: string,
    filters?: PurchaseListFilters,
  ) => Promise<PurchaseListResult>;

  getPurchaseFull?: (id: string) => Promise<PurchaseFullResult>;

  peekNextPurchaseSlNo?: (licenseId: string) => Promise<SlNoResult>;

  savePurchaseHold?: (
    payload: PurchaseHoldSavePayload,
  ) => Promise<PurchaseHoldSaveResult>;

  listPurchaseHolds?: (
    licenseId: string,
    pagination?: Pagination,
  ) => Promise<PurchaseHoldsListResult>;

  getPurchaseHold?: (id: string) => Promise<PurchaseHoldGetResult>;

  deletePurchaseHold?: (id: string) => Promise<MutationResult>;

  peekNextHoldNo?: (licenseId: string) => Promise<HoldNoResult>;

  listSuppliers?: (
    licenseId: string,
    filters?: SupplierListFilters,
  ) => Promise<SupplierListResult>;

  getSupplier?: (id: string) => Promise<SupplierRecord | null>;

  deleteSupplier?: (id: string) => Promise<MutationResult>;

  // ── Purchase Returns ──────────────────────────────────────────────────────
  createPurchaseReturn?: (payload: {
    header: PurchaseReturnCreatePayload;
    items: PurchaseReturnItemInput[];
  }) => Promise<CreatePurchaseReturnResult>;
  updatePurchaseReturn?: (
    payload: PurchaseReturnUpdatePayload,
  ) => Promise<MutationResult & { returnId?: string; totalAmount?: number }>;
  deletePurchaseReturn?: (
    id: string,
  ) => Promise<MutationResult & { deletedAt?: string }>;
  listPurchaseReturns?: (
    licenseId: string,
    filters?: PurchaseReturnListFilters,
  ) => Promise<PurchaseReturnListResult>;
  getPurchaseReturnFull?: (id: string) => Promise<PurchaseReturnFullResult>;
  peekNextPurchaseReturnSlNo?: (licenseId: string) => Promise<SlNoResult>;
  savePurchaseReturnHold?: (
    payload: PurchaseReturnHoldSavePayload,
  ) => Promise<PurchaseReturnHoldSaveResult>;
  listPurchaseReturnHolds?: (
    licenseId: string,
    pagination?: Pagination,
  ) => Promise<PurchaseReturnHoldsListResult>;
  getPurchaseReturnHold?: (id: string) => Promise<PurchaseReturnHoldGetResult>;
  deletePurchaseReturnHold?: (id: string) => Promise<MutationResult>;

  // ── Sale Returns ──────────────────────────────────────────────────────────
  createSaleReturn?: (payload: {
    header: SaleReturnCreatePayload;
    items: SaleReturnItemInput[];
  }) => Promise<CreateSaleReturnResult>;
  updateSaleReturn?: (
    payload: SaleReturnUpdatePayload,
  ) => Promise<MutationResult & { returnId?: string; totalAmount?: number }>;
  deleteSaleReturn?: (
    id: string,
  ) => Promise<MutationResult & { deletedAt?: string }>;
  listSaleReturns?: (
    licenseId: string,
    filters?: SaleReturnListFilters,
  ) => Promise<SaleReturnListResult>;
  getSaleReturnFull?: (id: string) => Promise<SaleReturnFullResult>;
  peekNextSaleReturnSlNo?: (licenseId: string) => Promise<SlNoResult>;
  saveSaleReturnHold?: (
    payload: SaleReturnHoldSavePayload,
  ) => Promise<SaleReturnHoldSaveResult>;
  listSaleReturnHolds?: (
    licenseId: string,
    pagination?: Pagination,
  ) => Promise<SaleReturnHoldsListResult>;
  getSaleReturnHold?: (id: string) => Promise<SaleReturnHoldGetResult>;
  deleteSaleReturnHold?: (id: string) => Promise<MutationResult>;

  // ── Supplier Ledger & Payments ───────────────────────────────────────────
  getSupplierLedger?: (params: {
    licenseId: string;
    supplierId: string;
    dateFrom?: string | null;
    dateTo?: string | null;
    page?: number;
    pageSize?: number;
  }) => Promise<{
    success: boolean;
    rows: any[];
    total: number;
    openingBalance: number;
    balance: number;
    error?: string;
  }>;

  getSupplierOutstandingBills?: (params: {
    licenseId: string;
    supplierId: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) => Promise<{
    success: boolean;
    rows: any[];
    total: number;
    error?: string;
  }>;

  createSupplierPayment?: (payload: {
    licenseId: string;
    supplierId: string;
    amount: number;
    date: string;
    mode: "CASH" | "BANK" | "CHEQUE";
    notes?: string | null;
    chequeNo?: string | null;
    chequeIssueDate?: string | null;
    chequeClearanceDate?: string | null;
    allocations?: Array<{ purchaseId: string; amount: number }>;
  }) => Promise<MutationResult & { id?: string; paymentStatus?: string }>;

  listPayments?: (params: {
    licenseId: string;
    supplierId?: string | null;
    q?: string;
    dateFrom?: string | null;
    dateTo?: string | null;
    page?: number;
    pageSize?: number;
  }) => Promise<{
    success: boolean;
    rows: any[];
    total: number;
    error?: string;
  }>;

  markChequeReceived?: (
    licenseId: string,
    txId: string,
  ) => Promise<MutationResult>;

  getCustomerLedger?: (params: {
    licenseId: string;
    customerId: string;
    dateFrom?: string | null;
    dateTo?: string | null;
    page?: number;
    pageSize?: number;
  }) => Promise<{
    success: boolean;
    rows: any[];
    total: number;
    openingBalance: number;
    balance: number;
    error?: string;
  }>;

  getCustomerOutstandingSales?: (params: {
    licenseId: string;
    customerId: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) => Promise<{
    success: boolean;
    rows: any[];
    total: number;
    error?: string;
  }>;

  createCustomerReceipt?: (payload: {
    licenseId: string;
    customerId: string;
    amount: number;
    date: string;
    mode: "CASH" | "BANK" | "CHEQUE";
    notes?: string | null;
    chequeNo?: string | null;
    chequeIssueDate?: string | null;
    chequeClearanceDate?: string | null;
    allocations?: Array<{ saleId: string; amount: number }>;
  }) => Promise<MutationResult & { id?: string; paymentStatus?: string }>;

  listReceipts?: (params: {
    licenseId: string;
    customerId?: string | null;
    q?: string;
    dateFrom?: string | null;
    dateTo?: string | null;
    page?: number;
    pageSize?: number;
  }) => Promise<{
    success: boolean;
    rows: any[];
    total: number;
    error?: string;
  }>;

  markCustomerChequeReceived?: (
    licenseId: string,
    txId: string,
  ) => Promise<MutationResult>;

  bulkUpdateProductPrices?: (
    updates: BulkPriceUpdate[],
  ) => Promise<MutationResult>;

  // ── Sales ────────────────────────────────────────────────────────────────
  createSale?: (
    sale: SaleCreatePayload,
    items: SaleItemInput[],
  ) => Promise<CreateSaleResult>;

  updateSale?: (payload: SaleUpdatePayload) => Promise<MutationResult>;

  deleteSale?: (id: string) => Promise<MutationResult & { deletedAt?: string }>;

  listSales?: (
    licenseId: string,
    filters?: SaleListFilters,
  ) => Promise<SaleListResult>;

  getSaleFull?: (id: string) => Promise<SaleFullResult>;

  peekNextSaleSlNo?: (licenseId: string) => Promise<SlNoResult>;

  saveSaleHold?: (payload: SaleHoldSavePayload) => Promise<SaleHoldSaveResult>;

  listSaleHolds?: (
    licenseId: string,
    pagination?: Pagination,
  ) => Promise<SaleHoldsListResult>;

  getSaleHold?: (id: string) => Promise<SaleHoldGetResult>;

  deleteSaleHold?: (id: string) => Promise<MutationResult>;

  listCustomers?: (
    licenseId: string,
    filters?: CustomerListFilters,
  ) => Promise<CustomerListResult>;

  getCustomer?: (
    id: string,
  ) => Promise<{ success: boolean; customer?: any; error?: string }>;

  saveCustomer?: (
    payload: any,
  ) => Promise<
    MutationResult & { id?: string; code?: string; codeNumber?: number }
  >;

  deleteCustomer?: (id: string, licenseId: string) => Promise<MutationResult>;

  peekNextCustomerCode?: (
    licenseId: string,
  ) => Promise<{ nextCodeNumber: number; suggestedCode: string }>;

  getCustomerCount?: (
    licenseId: string,
    params?: { q?: string },
  ) => Promise<{ count: number }>;

  getCustomerDistincts?: (licenseId: string) => Promise<{
    names: string[];
    categories: string[];
    cities: string[];
    states: string[];
  }>;

  // ── Print ────────────────────────────────────────────────────────────────
  getPrinters?: () => Promise<
    Array<{ name: string; displayName: string; isDefault: boolean }>
  >;

  // ── Quotations ────────────────────────────────────────────────────────────
  createQuotation?: (
    header: QuotationCreatePayload,
    items: QuotationItemInput[],
  ) => Promise<CreateQuotationResult>;

  updateQuotation?: (payload: QuotationUpdatePayload) => Promise<MutationResult>;

  deleteQuotation?: (
    id: string,
  ) => Promise<MutationResult & { deletedAt?: string }>;

  listQuotations?: (
    licenseId: string,
    filters?: QuotationListFilters,
  ) => Promise<QuotationListResult>;

  getQuotationFull?: (id: string) => Promise<QuotationFullResult>;

  peekNextQuotationSlNo?: (
    licenseId: string,
  ) => Promise<{ nextSlNo: number; nextQuotationNo: string }>;

  convertQuotationToSale?: (
    quotationId: string,
    overrides?: { billNo?: string | null; saleType?: "CASH" | "CREDIT"; saleDate?: string },
  ) => Promise<ConvertQuotationResult>;
};

// ── Quotation types ───────────────────────────────────────────────────────────

export type QuotationStatus = "DRAFT" | "SENT" | "CONVERTED" | "EXPIRED";

export type QuotationItemInput = {
  productId: string;
  barcode?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number | null;
  taxPercent: string;
  taxAmount?: number;
  discount?: number;
  discountType?: "ABS" | "PCT";
  salePrice?: number | null;
  profit?: number | null;
  totalCost?: number;
  billedValue?: number;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number;
  isFree?: boolean;
  batchId?: string | null;
};

export type QuotationCreatePayload = {
  licenseId: string;
  userId?: string;
  customerId?: string | null;
  customerName?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  quotationDate: string;
  entryTime?: string;
  discount?: number;
  status?: QuotationStatus;
  notes?: string | null;
};

export type QuotationUpdatePayload = {
  id: string;
  header: QuotationCreatePayload;
  items: QuotationItemInput[];
};

export type CreateQuotationResult = {
  success: boolean;
  quotationId?: string;
  slNo?: number;
  quotationNo?: string;
  totalAmount?: number;
  error?: string;
};

export type ConvertQuotationResult = {
  success: boolean;
  saleId?: string;
  saleSlNo?: number;
  totalAmount?: number;
  error?: string;
};

export type QuotationListFilters = {
  q?: string;
  customerId?: string | null;
  status?: QuotationStatus | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
};

export type QuotationRow = {
  id: string;
  slNo?: number;
  quotationNo?: string;
  customerId?: string | null;
  customerName?: string | null;
  quotationDate: string;
  entryTime?: string;
  totalAmount: number;
  discount?: number;
  status: QuotationStatus;
  notes?: string | null;
  convertedSaleId?: string | null;
  itemCount?: number;
  isSynced?: number;
  deletedAt?: string | null;
};

export type QuotationItemRow = {
  id: string;
  quotationId: string;
  productId: string;
  productName?: string | null;
  productCode?: string | null;
  barcode?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number | null;
  taxPercent: string;
  taxAmount: number;
  discount?: number;
  discountType?: string;
  salePrice?: number | null;
  profit?: number | null;
  totalCost: number;
  billedValue?: number;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number;
  isFree?: number;
  batchId?: string | null;
};

export type QuotationListResult = {
  success: boolean;
  total: number;
  page: number;
  pageSize: number;
  rows: QuotationRow[];
  error?: string;
};

export type QuotationFullResult = {
  success: boolean;
  quotation?: QuotationRow & {
    licenseId?: string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  items?: QuotationItemRow[];
  error?: string;
};
