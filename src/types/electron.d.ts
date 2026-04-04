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

      createProduct: (product: {
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
      }) => Promise<{ success: boolean; productId?: string }>;

      getProducts: (
        licenseId: string,
        pagination?: { page?: number; pageSize?: number },
      ) => Promise<{
        products: Array<{
          id: string;
          code: string;
          name: string;
          brand?: string;
          category?: string;
          unit: string;
          tax: string;
          hsn?: string;
          costPrice: number;
          salePrice?: number;
          stock: number;
          barcode?: string;
          createdAt?: string;
        }>;
        total: number;
      }>;

      getFilteredProducts: (
        licenseId: string,
        filters: { name?: string | null; category?: string | null },
        pagination?: { page?: number; pageSize?: number },
      ) => Promise<{
        products: Array<{
          id: string;
          code: string;
          name: string;
          brand?: string;
          category?: string;
          unit: string;
          tax: string;
          hsn?: string;
          costPrice: number;
          salePrice?: number;
          stock: number;
          barcode?: string;
          createdAt?: string;
        }>;
        total: number;
      }>;

      updateProduct: (
        productId: string,
        product: {
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
        },
      ) => Promise<{ success: boolean }>;

      deleteProduct: (productId: string) => Promise<{ success: boolean }>;

      getProduct: (productId: string) => Promise<{
        id: string;
        code: string;
        name: string;
        brand?: string;
        category?: string;
        unit: string;
        tax: string;
        hsn?: string;
        costPrice: number;
        salePrice?: number;
        stock: number;
        createdAt?: string;
        barcode?: string;
      } | null>;

      getProductByBarcode: (
        licenseId: string,
        barcode: string,
      ) => Promise<{
        id: string;
        code: string;
        name: string;
        brand?: string;
        category?: string;
        unit: string;
        tax: string;
        hsn?: string;
        costPrice: number;
        salePrice?: number;
        stock: number;
        barcode?: string;
      } | null>;

      getProductByCode: (
        licenseId: string,
        code: string,
      ) => Promise<{
        id: string;
        code: string;
        name: string;
        brand?: string;
        category?: string;
        unit: string;
        tax: string;
        hsn?: string;
        costPrice: number;
        salePrice?: number;
        stock: number;
        barcode?: string;
      } | null>;

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
      getSyncState: (scope: string) => Promise<any>;
      setSyncState: (scope: string, changes: any) => Promise<any>;
      wipeLocalData: () => Promise<any>;
    };
  }
}
