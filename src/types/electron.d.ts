// src/types/electron.d.ts
export {};

type LabelPrintEngine = "BARTENDER" | "ZPL" | "HTML";

type LabelPrintRow = {
  productId: string;
  batchId?: string;
  barcode: string;
  itemName?: string;
  salePrice?: number | null;
  mrp?: number | null;
  batchNo?: string | null;
  copies?: number;
};

type LabelPrintRequest = {
  licenseId: string;
  printerId?: string;
  templateId?: string;
  engine?: LabelPrintEngine;
  rows: LabelPrintRow[];
};

type ProductImagePayload = {
  base64: string;
  mimeType: "image/jpeg" | "image/jpg" | "image/png" | "image/webp";
  fileName?: string;
};

type ProductRecord = {
  id: string;
  licenseId?: string;
  code: string;
  codeNumber?: number;
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
  unit: string;
  tax: string;
  hsn?: string | null;
  costPrice: number;
  salePrice?: number | null;
  stock: number;
  barcode?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  batchCount?: number;
};

type ProductWritePayload = {
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
  unit: string;
  tax: string;
  hsn?: string | null;
  costPrice: number;
  salePrice: number | null;
  stock?: number;
  barcode?: string | null;
  image?: ProductImagePayload | null;
};

type PurchaseRecord = {
  id: string;
  slNo: number;
  billNo: string | null;
  licenseId: string;
  supplierId: string | null;
  supplierName: string | null;
  typeId: string | null;
  [key: string]: any; // allow additional fields without breaking existing usage
};

type SaleRecord = {
  id: string;
  slNo: number;
  billNo: string | null;
  licenseId: string;
  customerId: string | null;
  customerName: string | null;
  typeId: string | null;
  [key: string]: any; // allow additional fields without breaking existing usage
};

declare global {
  interface Window {
    electronAPI: {
      printHtml: (
        html: string,
        options?: {
          preview?: boolean;
          pageSize?: string;
          deviceName?: string;
        },
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;

      listLabelPrinters: (licenseId: string) => Promise<{
        success: boolean;
        rows?: Array<{
          id: string;
          licenseId: string;
          name: string;
          engine: LabelPrintEngine;
          printerName: string;
          connectionType?: string | null;
          host?: string | null;
          port?: number | null;
          dpi?: number | null;
          isDefault?: number;
          createdAt?: string | null;
          updatedAt?: string | null;
          deletedAt?: string | null;
        }>;
        error?: string;
      }>;

      listLabelTemplates: (licenseId: string) => Promise<{
        success: boolean;
        rows?: Array<{
          id: string;
          licenseId: string;
          name: string;
          engine: Exclude<LabelPrintEngine, "HTML">;
          templatePath: string;
          widthMm?: number | null;
          heightMm?: number | null;
          defaultPrinterId?: string | null;
          createdAt?: string | null;
          updatedAt?: string | null;
          deletedAt?: string | null;
        }>;
        error?: string;
      }>;

      printLabels: (payload: LabelPrintRequest) => Promise<{
        success: boolean;
        error?: string;
      }>;

      getNextCode: (licenseId: string) => Promise<string>;

      createProduct: (
        product: ProductWritePayload,
      ) => Promise<{ success: boolean; productId?: string }>;

      getProducts: (
        licenseId: string,
        pagination?: { page?: number; pageSize?: number },
      ) => Promise<{
        products: ProductRecord[];
        total: number;
      }>;

      getFilteredProducts: (
        licenseId: string,
        filters: {
          name?: string | null;
          category?: string | null;
          brand?: string | null;
        },
        pagination?: { page?: number; pageSize?: number },
      ) => Promise<{
        products: ProductRecord[];
        total: number;
      }>;

      updateProduct: (
        productId: string,
        product: ProductWritePayload,
      ) => Promise<{ success: boolean }>;

      deleteProduct: (productId: string) => Promise<{ success: boolean }>;

      getProduct: (productId: string) => Promise<ProductRecord | null>;

      getProductByBarcode: (
        licenseId: string,
        barcode: string,
      ) => Promise<ProductRecord | null>;

      getProductByCode: (
        licenseId: string,
        code: string,
      ) => Promise<ProductRecord | null>;

      getProductByShortCode: (
        licenseId: string,
        shortCode: string,
      ) => Promise<ProductRecord | null>;

      getProductImageDataUrl: (productId: string) => Promise<string | null>;

      listBarcodesForProduct: (
        licenseId: string,
        productId: string,
      ) => Promise<{
        success: boolean;
        rows: Array<{
          id: string;
          barcode?: string | null;
          mrp?: number | null;
          salePrice?: number | null;
          costPrice?: number | null;
          batchNo?: string | null;
          mfgDate?: string | null;
          expiryDate?: string | null;
          receivedAt?: string | null;
          stock: number;
        }>;
      }>;

      listBatchesForProduct: (
        productId: string,
        includeDeleted?: boolean,
      ) => Promise<any>;

      saveBatch: (payload: any) => Promise<any>;

      updateBatch: (payload: {
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
      }) => Promise<any>;

      deleteBatch: (batchId: string) => Promise<any>;

      rebuildProductStock: (productId: string) => Promise<any>;

      getProductWithBatches: (productId: string) => Promise<any>;

      peekNextBarcode: (
        licenseId: string,
      ) => Promise<{ success: boolean; barcode: string; number: number }>;

      reserveBarcodes: (
        licenseId: string,
        count: number,
      ) => Promise<{ success: boolean; barcodes: string[] }>;

      createBarcodeForProduct: (payload: {
        licenseId: string;
        productId: string;
        barcode?: string | null;
        useGenerated?: boolean;
        mrp?: number | null;
        salePrice?: number | null;
        costPrice?: number | null;
      }) => Promise<{
        success: boolean;
        batch?: any;
        reused?: boolean;
        barcode?: string;
        error?: string;
        code?: string;
      }>;

      deleteBarcode: (
        licenseId: string,
        batchId: string,
      ) => Promise<{ success: boolean; error?: string }>;

      // ─── Purchases ──────────────────────────────────────────────────────────

      createPurchase: (
        purchase: any, // header may include typeId?: string | null
        items: any[],
      ) => Promise<{
        success: boolean;
        purchaseId: string;
        slNo: number;
        totalAmount: number;
      }>;

      getPurchases: (
        licenseId: string,
        pagination?: { page?: number; pageSize?: number },
      ) => Promise<{
        purchases: Array<PurchaseRecord>;
        total: number;
      }>;

      getPurchaseFull: (id: string) => Promise<{
        success: boolean;
        purchase: PurchaseRecord;
        items: any[];
      }>;

      markPurchasesSynced: (
        ids: string[],
        serverSyncedAt?: string,
      ) => Promise<{ success: boolean; syncedAt: string }>;

      bulkUpsertPurchases?: (
        records: Array<PurchaseRecord & { typeId?: string | null }>,
      ) => Promise<{ success: boolean; upserted: number }>;

      // ─── Sales ──────────────────────────────────────────────────────────────

      createSale: (
        header: any, // may include typeId?: string | null
        items: any[],
      ) => Promise<{
        success: boolean;
        saleId: string;
        slNo: number;
        totalAmount: number;
      }>;

      listSales: (
        licenseId: string,
        filters?: any,
      ) => Promise<{
        success: boolean;
        total: number;
        page: number;
        pageSize: number;
        rows: Array<SaleRecord>;
      }>;

      getSaleFull: (id: string) => Promise<{
        success: boolean;
        sale: SaleRecord;
        items: any[];
      }>;

      updateSale: (
        payload: any, // payload.header may contain typeId
      ) => Promise<{ success: boolean }>;

      markSalesSynced?: (
        ids: string[],
        serverSyncedAt?: string,
      ) => Promise<{ success: boolean; syncedAt: string }>;

      bulkUpsertSales?: (
        records: Array<SaleRecord & { typeId?: string | null }>,
      ) => Promise<{ success: boolean; upserted: number }>;

      // ────────────────────────────────────────────────────────────────────────

      // ─── Purchase Returns ──────────────────────────────────────────────────────
      createPurchaseReturn: (payload: {
        header: any;
        items: any[];
      }) => Promise<{
        success: boolean;
        returnId?: string;
        slNo?: number;
        totalAmount?: number;
      }>;

      updatePurchaseReturn: (payload: {
        id: string;
        header: any;
        items: any[];
      }) => Promise<{
        success: boolean;
        returnId?: string;
        totalAmount?: number;
      }>;

      deletePurchaseReturn: (
        id: string,
      ) => Promise<{ success: boolean; deletedAt?: string }>;

      listPurchaseReturns: (
        licenseId: string,
        filters?: {
          q?: string;
          supplierId?: string | null;
          dateFrom?: string;
          dateTo?: string;
          page?: number;
          pageSize?: number;
        },
      ) => Promise<{ returns: any[]; total: number }>;

      getPurchaseReturnFull: (id: string) => Promise<{
        success: boolean;
        purchaseReturn: any;
        items: any[];
      }>;

      getNextPurchaseReturnSlNo: (
        licenseId: string,
      ) => Promise<{ nextSlNo: number }>;

      savePurchaseReturnHold: (payload: {
        id?: string;
        licenseId: string;
        userId?: string;
        title?: string | null;
        header: any;
        rows: any[];
      }) => Promise<{ success: boolean; id?: string; holdNo?: number }>;

      listPurchaseReturnHolds: (
        licenseId: string,
        pagination?: { page?: number; pageSize?: number },
      ) => Promise<{ holds: any[]; total: number }>;

      getPurchaseReturnHold: (
        id: string,
      ) => Promise<{ success: boolean; hold: any }>;

      deletePurchaseReturnHold: (id: string) => Promise<{ success: boolean }>;

      // === Supplier Ledger & Payments (Cheque support) ===
      getSupplierLedger: (params: {
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

      getSupplierOutstandingBills: (params: {
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

      createSupplierPayment: (payload: {
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
      }) => Promise<{
        success: boolean;
        id?: string;
        allocated?: number;
        unallocated?: number;
        paymentStatus?: string;
        error?: string;
      }>;

      listPayments: (params: {
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

      markChequeReceived: (params: {
        licenseId: string;
        txId: string;
      }) => Promise<{
        success: boolean;
        error?: string;
      }>;

      // === Customer Ledger & Receipts (Cheque support) ===
      getCustomerLedger: (params: {
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

      getCustomerOutstandingSales: (params: {
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

      createCustomerReceipt: (payload: {
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
      }) => Promise<{
        success: boolean;
        id?: string;
        allocated?: number;
        unallocated?: number;
        paymentStatus?: string;
        error?: string;
      }>;

      listReceipts: (params: {
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

      markCustomerChequeReceived: (params: {
        licenseId: string;
        txId: string;
      }) => Promise<{
        success: boolean;
        error?: string;
      }>;

      getShopSettings: (licenseId: string) => Promise<{
        success: boolean;
        settings?: {
          licenseId: string;
          shopName: string;
          logoDataUrl?: string | null; // desktop only — base64 in SQLite
          logoUrl?: string | null; // web only — R2 public URL
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
          createdAt?: string;
          updatedAt?: string;
          syncStatus?: "LOCAL_ONLY" | "PENDING" | "SYNCED" | "SYNC_FAILED";
          lastSyncedAt?: string | null;
          isSynced?: number;
          syncedAt?: string | null;
        };
        source?: "desktop" | "web-local";
        error?: string;
      }>;
      saveShopSettings: (payload: {
        licenseId: string;
        shopName: string;
        logoDataUrl?: string | null; // desktop only
        logoUrl?: string | null; // web only
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
      }) => Promise<{ success: boolean; error?: string }>;

      // Transaction Types
      listTransactionTypes: (
        licenseId: string,
        category: string,
      ) => Promise<{ success: boolean; rows: any[] }>;

      listAllTransactionTypes: (
        licenseId: string,
      ) => Promise<{ success: boolean; rows: any[] }>;

      saveTransactionType: (
        payload: any,
      ) => Promise<{ success: boolean; id?: string; error?: string }>;

      deleteTransactionType: (
        id: string,
        licenseId: string,
      ) => Promise<{ success: boolean; error?: string }>;

      setDefaultTransactionType: (
        id: string,
        licenseId: string,
        category: string,
      ) => Promise<{ success: boolean; error?: string }>;

      getDefaultTransactionType: (
        licenseId: string,
        category: string,
      ) => Promise<{ success: boolean; row: any | null }>;

      // Transaction Type sync
      getDirtyTransactionTypes: (
        licenseId: string,
        limit: number,
      ) => Promise<any[]>;

      markTransactionTypesSynced: (
        ids: string[],
        ts: string,
      ) => Promise<{ success: boolean }>;

      bulkUpsertTransactionTypes: (
        records: any[],
      ) => Promise<{ success: boolean }>;

      getSupplierCount: (
        licenseId: string,
        params?: { q?: string | null },
      ) => Promise<{ count: number }>;

      getAccountCount: (licenseId: string) => Promise<{ count: number }>;

      getCustomerCount: (
        licenseId: string,
        params?: { q?: string | null },
      ) => Promise<{ count: number }>;

      // ─── Customers ──────────────────────────────────────────────────────────
      listCustomers: (
        licenseId: string,
        filters?: {
          q?: string;
          page?: number;
          pageSize?: number;
        },
      ) => Promise<{
        success: boolean;
        customers: any[];
        total: number;
        page: number;
        pageSize: number;
      }>;

      getCustomer: (id: string) => Promise<any | null>;

      saveCustomer: (payload: {
        id?: string;
        licenseId: string;
        name: string;
        phone?: string | null;
        email?: string | null;
        gstin?: string | null;
        category?: string | null;
        addressLine1?: string | null;
        addressLine2?: string | null;
        city?: string | null;
        state?: string | null;
        pincode?: string | null;
        openingBalance?: number;
        notes?: string | null;
      }) => Promise<{ success: boolean; id?: string; error?: string }>;

      deleteCustomer: (
        id: string,
        licenseId: string,
      ) => Promise<{ success: boolean; error?: string }>;

      peekNextCustomerCode: (
        licenseId: string,
      ) => Promise<{ nextCodeNumber: number; suggestedCode: string }>;

      getCustomerDistincts: (licenseId: string) => Promise<{
        names: string[];
        categories: string[];
        cities: string[];
        states: string[];
        languages?: string[];
        departments?: string[];
      }>;

      getDirtyProducts: (licenseId: string, limit?: number) => Promise<any[]>;
      markProductsSynced: (
        ids: string[],
        serverSyncedAt?: string,
      ) => Promise<{ success: boolean; syncedAt: string }>;
      bulkUpsertProducts: (items: any[]) => Promise<any>;

      listCategories: (licenseId: string) => Promise<{
        success: boolean;
        rows: Array<{
          id: string;
          licenseId: string;
          name: string;
          parentId: string | null;
          createdAt?: string;
          updatedAt?: string;
          deletedAt?: string | null;
        }>;
        error?: string;
      }>;

      saveCategory: (payload: {
        id?: string;
        licenseId: string;
        name: string;
        parentId?: string | null;
      }) => Promise<{
        success: boolean;
        id?: string;
        error?: string;
      }>;

      deleteCategory: (payload: string) => Promise<{
        success: boolean;
        error?: string;
      }>;

      listBrands: (licenseId: string) => Promise<{
        success: boolean;
        rows: Array<{
          id: string;
          licenseId: string;
          name: string;
          createdAt?: string;
          updatedAt?: string;
          deletedAt?: string | null;
        }>;
        error?: string;
      }>;

      saveBrand: (payload: {
        id?: string;
        licenseId: string;
        name: string;
      }) => Promise<{
        success: boolean;
        id?: string;
        error?: string;
      }>;

      deleteBrand: (id: string) => Promise<{
        success: boolean;
        error?: string;
      }>;

      listUnits: (licenseId: string) => Promise<{
        success: boolean;
        rows: Array<{
          id: string;
          licenseId: string;
          code: string;
          label: string;
          isDefault: number;
          sortOrder: number;
          createdAt?: string;
          updatedAt?: string;
        }>;
        error?: string;
      }>;

      saveUnit: (payload: {
        id?: string;
        licenseId: string;
        code: string;
        label: string;
      }) => Promise<{ success: boolean; id?: string; error?: string }>;

      deleteUnit: (id: string) => Promise<{ success: boolean; error?: string }>;

      listTaxCategories: (
        licenseId: string,
      ) => Promise<{ success: boolean; rows: any[] }>;
      saveTaxCategory: (
        payload: any,
      ) => Promise<{ success: boolean; id?: string; error?: string }>;
      deleteTaxCategory: (id: string) => Promise<{ success: boolean }>;
      seedIndiaGST: (
        licenseId: string,
      ) => Promise<{ success: boolean; error?: string }>;
      listDefaultableAccounts: (
        licenseId: string,
      ) => Promise<{ success: boolean; rows: any[] }>;

      getSyncState: (scope: string) => Promise<any>;
      setSyncState: (scope: string, changes: any) => Promise<any>;

      getDirtyCustomers: (
        licenseId: string,
        limit?: number,
      ) => Promise<{ success: boolean; records: any[] }>;

      markCustomersSynced: (
        ids: string[],
        serverSyncedAt?: string,
      ) => Promise<{ success: boolean }>;

      bulkUpsertCustomers: (
        records: any[],
      ) => Promise<{ success: boolean; upserted: number }>;

      // ─── Customer Transaction Sync ──────────────────────────────────────────
      getDirtyCustomerTransactions: (
        licenseId: string,
        limit?: number,
      ) => Promise<{ success: boolean; records: any[] }>;

      markCustomerTransactionsSynced: (
        ids: string[],
        serverSyncedAt?: string,
      ) => Promise<{ success: boolean }>;

      bulkUpsertCustomerTransactions: (
        records: any[],
      ) => Promise<{ success: boolean; upserted: number }>;

      // Purchase return sync
      getDirtyPurchaseReturns: (
        licenseId: string,
        limit?: number,
      ) => Promise<{ success: boolean; records: any[] }>;
      getDirtyPurchaseReturnItems: (
        licenseId: string,
        limit?: number,
      ) => Promise<{ success: boolean; records: any[] }>;
      markPurchaseReturnItemsSynced: (
        ids: string[],
        serverSyncedAt?: string,
      ) => Promise<{ success: boolean }>;
      bulkUpsertPurchaseReturns: (
        records: any[],
      ) => Promise<{ success: boolean; upserted: number }>;
      bulkUpsertPurchaseReturnItems: (
        records: any[],
      ) => Promise<{ success: boolean; upserted: number }>;

      // Purchase return hold sync
      getDirtyPurchaseReturnHolds: (
        licenseId: string,
        limit?: number,
      ) => Promise<{ success: boolean; records: any[] }>;
      markPurchaseReturnHoldsSynced: (
        ids: string[],
        serverSyncedAt?: string,
      ) => Promise<{ success: boolean }>;
      bulkUpsertPurchaseReturnHolds: (
        records: any[],
      ) => Promise<{ success: boolean; upserted: number }>;

      wipeLocalData: () => Promise<any>;
    };
  }
}
