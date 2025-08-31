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
      } | null>;

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
