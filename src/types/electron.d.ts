// src/types/electron.d.ts
export {};

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

      getDirtyProducts: (licenseId: string, limit?: number) => Promise<any[]>;

      markProductsSynced: (
        ids: string[],
        serverSyncedAt?: string,
      ) => Promise<{ success: boolean; syncedAt: string }>;

      bulkUpsertProducts: (items: any[]) => Promise<any>;
      getSyncState: (scope: string) => Promise<any>;
      setSyncState: (scope: string, changes: any) => Promise<any>;
      wipeLocalData: () => Promise<any>;

      // Barcode / batch methods (added with new barcode system)
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
        batchId: string,
      ) => Promise<{ success: boolean; error?: string }>;
    };
  }
}
