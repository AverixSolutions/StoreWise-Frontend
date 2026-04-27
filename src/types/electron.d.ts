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

      createPurchase: (
        purchase: any,
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
      ) => Promise<{ purchases: any[]; total: number }>;

      markPurchasesSynced: (
        ids: string[],
        serverSyncedAt?: string,
      ) => Promise<{ success: boolean; syncedAt: string }>;

      getShopSettings: (licenseId: string) => Promise<any>;
      saveShopSettings: (payload: any) => Promise<any>;

      getSupplierCount: (
        licenseId: string,
        params?: { q?: string | null },
      ) => Promise<{ count: number }>;

      getAccountCount: (licenseId: string) => Promise<{ count: number }>;

      getCustomerCount: (
        licenseId: string,
        params?: { q?: string | null },
      ) => Promise<{ count: number }>;

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
      wipeLocalData: () => Promise<any>;
    };
  }
}
