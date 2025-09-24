// src/types/electron.d.ts
export {};

declare global {
  interface Window {
    electronAPI: {
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
      }) => Promise<{ success: boolean }>;

      // Updated to return paginated results
      getProducts: (
        licenseId: string,
        pagination?: { page?: number; pageSize?: number }
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
        pagination?: { page?: number; pageSize?: number }
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
        }
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

      createPurchase: (
        purchase: any,
        items: any[]
      ) => Promise<{
        success: boolean;
        purchaseId: string;
        slNo: number;
        totalAmount: number;
      }>;
      getPurchases: (
        licenseId: string,
        pagination?: { page?: number; pageSize?: number }
      ) => Promise<{ purchases: any[]; total: number }>;
      markPurchasesSynced: (
        ids: string[],
        serverSyncedAt?: string
      ) => Promise<{ success: boolean; syncedAt: string }>;

      // Sync-specific methods
      getDirtyProducts: (licenseId: string, limit?: number) => Promise<any[]>;
      markProductsSynced: (
        ids: string[],
        serverSyncedAt?: string
      ) => Promise<{ success: boolean; syncedAt: string }>;
      bulkUpsertProducts: (items: any[]) => Promise<any>;
      getSyncState: (scope: string) => Promise<any>;
      setSyncState: (scope: string, changes: any) => Promise<any>;
      wipeLocalData: () => Promise<any>;
    };
  }
}
