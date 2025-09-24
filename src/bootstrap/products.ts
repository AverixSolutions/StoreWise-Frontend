// src/bootstrap/products.ts
import api from "@/lib/axios";

type BootstrapProductsResponse = {
  serverTime: string;
  products: Array<{
    id: string;
    licenseId: string;
    code: string;
    codeNumber: number;
    barcode: string | null;
    name: string;
    brand: string | null;
    category: string | null;
    unit: "KG" | "NOS" | "LTR" | "MTR";
    tax: "NT" | "P5" | "P12" | "P18" | "P28";
    hsn: string | null;
    costPrice: string;
    salePrice: string | null;
    stock: number;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
  }>;
};

export async function bootstrapProducts() {
  const res = await api.get<BootstrapProductsResponse>(
    "/sync/product/bootstrap"
  );

  await (window as any).electronAPI.bulkUpsertProducts(
    res.data.products.map((p) => ({
      ...p,
      barcode: p.barcode ?? null,
      costPrice: Number(p.costPrice),
      salePrice: p.salePrice != null ? Number(p.salePrice) : null,
      syncedAt: res.data.serverTime,
    }))
  );

  await (window as any).electronAPI.setSyncState("products", {
    lastPulledAt: res.data.serverTime,
  });
}
