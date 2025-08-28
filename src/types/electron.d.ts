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
      getProducts: (licenseId: string) => Promise<
        Array<{
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
        }>
      >;
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
    };
  }
}
