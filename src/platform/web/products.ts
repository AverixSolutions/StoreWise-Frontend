// src/platform/web/products.ts
import type {
  ProductInput,
  BatchSavePayload,
  Pagination,
  ProductFilters,
} from "../types";
import {
  STORES,
  idbGetByKey,
  idbPut,
  idbDelete,
  idbGetAll,
  idbGetAllByIndex,
  newId,
} from "./idb";

// ── Internal record shapes ──────────────────────────────────────────────────

type WebProduct = ProductInput & {
  id: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type WebBatch = {
  id: string;
  licenseId: string;
  productId: string;
  barcode: string | null;
  mrp: number | null;
  salePrice: number | null;
  costPrice: number | null;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  receivedAt: string | null;
  stock: number;
  isSystemGeneratedBarcode: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type CodeSeqRecord = { licenseId: string; lastCodeNumber: number };
type BarcodeSeqRecord = { licenseId: string; lastBarcodeNumber: number };

// ── Sequence helpers ────────────────────────────────────────────────────────

async function getNextCodeNumber(licenseId: string): Promise<number> {
  const seq = await idbGetByKey<CodeSeqRecord>(STORES.CODE_SEQUENCE, licenseId);
  return (seq?.lastCodeNumber ?? 0) + 1;
}

async function bumpCodeSequence(licenseId: string, codeNumber: number) {
  const seq = await idbGetByKey<CodeSeqRecord>(STORES.CODE_SEQUENCE, licenseId);
  if (!seq || codeNumber > seq.lastCodeNumber) {
    await idbPut(STORES.CODE_SEQUENCE, {
      licenseId,
      lastCodeNumber: codeNumber,
    });
  }
}

async function peekNextBarcodeNumber(licenseId: string): Promise<number> {
  const seq = await idbGetByKey<BarcodeSeqRecord>(
    STORES.BARCODE_SEQUENCE,
    licenseId,
  );
  return (seq?.lastBarcodeNumber ?? 0) + 1;
}

async function reserveBarcodeNumbers(
  licenseId: string,
  count: number,
): Promise<string[]> {
  const seq = await idbGetByKey<BarcodeSeqRecord>(
    STORES.BARCODE_SEQUENCE,
    licenseId,
  );
  const current = seq?.lastBarcodeNumber ?? 0;
  const next = current + count;
  await idbPut(STORES.BARCODE_SEQUENCE, {
    licenseId,
    lastBarcodeNumber: next,
  });
  const result: string[] = [];
  for (let i = current + 1; i <= next; i++) {
    result.push(String(i).padStart(5, "0"));
  }
  return result;
}

// ── Stock rebuild ──────────────────────────────────────────────────────────

async function rebuildProductStock(productId: string): Promise<number> {
  const batches = await idbGetAllByIndex<WebBatch>(
    STORES.PRODUCT_BATCHES,
    "productId",
    productId,
  );
  const stock = batches
    .filter((b) => !b.deletedAt)
    .reduce((sum, b) => sum + (b.stock || 0), 0);

  const product = await idbGetByKey<WebProduct>(STORES.PRODUCTS, productId);
  if (product) {
    await idbPut(STORES.PRODUCTS, {
      ...product,
      stock,
      updatedAt: new Date().toISOString(),
    });
  }
  return stock;
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function webGetNextCode(licenseId: string): Promise<string> {
  const num = await getNextCodeNumber(licenseId);
  return String(num).padStart(5, "0");
}

export async function webCreateProduct(
  product: ProductInput,
): Promise<{ success: boolean; productId?: string; error?: string }> {
  try {
    const id = newId();
    const now = new Date().toISOString();
    const record: WebProduct = {
      ...product,
      id,
      stock: 0,
      barcode: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await idbPut(STORES.PRODUCTS, record);
    await bumpCodeSequence(product.licenseId, product.codeNumber);
    return { success: true, productId: id };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webUpdateProduct(
  productId: string,
  product: ProductInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await idbGetByKey<WebProduct>(STORES.PRODUCTS, productId);
    if (!existing) return { success: false, error: "Product not found" };
    await idbPut(STORES.PRODUCTS, {
      ...existing,
      ...product,
      id: productId,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeleteProduct(
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await idbGetByKey<WebProduct>(STORES.PRODUCTS, productId);
    if (!existing) return { success: false, error: "Product not found" };
    const now = new Date().toISOString();
    await idbPut(STORES.PRODUCTS, {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    });
    // soft delete batches too
    const batches = await idbGetAllByIndex<WebBatch>(
      STORES.PRODUCT_BATCHES,
      "productId",
      productId,
    );
    for (const b of batches.filter((b) => !b.deletedAt)) {
      await idbPut(STORES.PRODUCT_BATCHES, {
        ...b,
        deletedAt: now,
        updatedAt: now,
      });
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webGetProduct(
  productId: string,
): Promise<WebProduct | null> {
  const p = await idbGetByKey<WebProduct>(STORES.PRODUCTS, productId);
  return p?.deletedAt ? null : (p ?? null);
}

export async function webGetProducts(
  licenseId: string,
  pagination?: Pagination,
): Promise<{ products: WebProduct[]; total: number }> {
  const all = await idbGetAllByIndex<WebProduct>(
    STORES.PRODUCTS,
    "licenseId",
    licenseId,
  );
  const live = all
    .filter((p) => !p.deletedAt)
    .sort((a, b) => a.codeNumber - b.codeNumber);

  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;
  const offset = (page - 1) * pageSize;

  return {
    products: live.slice(offset, offset + pageSize),
    total: live.length,
  };
}

export async function webGetFilteredProducts(
  licenseId: string,
  filters: ProductFilters,
  pagination?: Pagination,
): Promise<{ products: WebProduct[]; total: number }> {
  const all = await idbGetAllByIndex<WebProduct>(
    STORES.PRODUCTS,
    "licenseId",
    licenseId,
  );
  let live = all.filter((p) => !p.deletedAt);

  if (filters.name) {
    const q = filters.name.toLowerCase();
    live = live.filter((p) => p.name.toLowerCase().includes(q));
  }
  if (filters.category) {
    live = live.filter((p) => p.category === filters.category);
  }

  live.sort((a, b) => a.codeNumber - b.codeNumber);

  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;
  const offset = (page - 1) * pageSize;

  return {
    products: live.slice(offset, offset + pageSize),
    total: live.length,
  };
}

export async function webGetProductByBarcode(
  licenseId: string,
  barcode: string,
): Promise<(WebProduct & Partial<WebBatch>) | null> {
  const batches = await idbGetAllByIndex<WebBatch>(
    STORES.PRODUCT_BATCHES,
    "licenseId_barcode",
    [licenseId, barcode],
  );
  const batch = batches.find((b) => !b.deletedAt);
  if (!batch) return null;

  const product = await idbGetByKey<WebProduct>(
    STORES.PRODUCTS,
    batch.productId,
  );
  if (!product || product.deletedAt) return null;

  return {
    ...product,
    batchId: batch.id,
    batchMrp: batch.mrp,
    batchSalePrice: batch.salePrice,
    batchCostPrice: batch.costPrice,
    batchNo: batch.batchNo,
    mfgDate: batch.mfgDate,
    expiryDate: batch.expiryDate,
    batchStock: batch.stock,
  } as any;
}

// ── Barcode/Batch APIs ─────────────────────────────────────────────────────

export async function webPeekNextBarcode(
  licenseId: string,
): Promise<{ success: boolean; barcode: string; number: number }> {
  const num = await peekNextBarcodeNumber(licenseId);
  return { success: true, barcode: String(num).padStart(5, "0"), number: num };
}

export async function webReserveBarcodes(
  licenseId: string,
  count: number,
): Promise<{ success: boolean; barcodes: string[] }> {
  const barcodes = await reserveBarcodeNumbers(licenseId, count);
  return { success: true, barcodes };
}

export async function webListBarcodesForProduct(
  licenseId: string,
  productId: string,
): Promise<{ success: boolean; rows: WebBatch[] }> {
  const batches = await idbGetAllByIndex<WebBatch>(
    STORES.PRODUCT_BATCHES,
    "productId",
    productId,
  );
  const live = batches
    .filter((b) => !b.deletedAt && b.licenseId === licenseId)
    .sort((a, b) => {
      if (a.stock > 0 && b.stock <= 0) return -1;
      if (b.stock > 0 && a.stock <= 0) return 1;
      return (b.receivedAt ?? "").localeCompare(a.receivedAt ?? "");
    });
  return { success: true, rows: live };
}

export async function webCreateBarcodeForProduct(payload: {
  licenseId: string;
  productId: string;
  barcode?: string;
  useGenerated?: boolean;
  mrp?: number | null;
  salePrice?: number | null;
  costPrice?: number | null;
}): Promise<{
  success: boolean;
  batch?: WebBatch;
  barcode?: string;
  error?: string;
  code?: string;
}> {
  try {
    let barcode = payload.barcode?.trim() || null;
    let isSystemGenerated = 0;

    if (!barcode && payload.useGenerated) {
      const reserved = await reserveBarcodeNumbers(payload.licenseId, 1);
      barcode = reserved[0];
      isSystemGenerated = 1;
    }

    if (!barcode) {
      return {
        success: false,
        error: "Barcode is required",
        code: "MISSING_BARCODE",
      };
    }

    // Check uniqueness across license
    const allBatches = await idbGetAllByIndex<WebBatch>(
      STORES.PRODUCT_BATCHES,
      "licenseId",
      payload.licenseId,
    );
    const conflict = allBatches.find(
      (b) => !b.deletedAt && b.barcode === barcode,
    );
    if (conflict) {
      if (conflict.productId !== payload.productId) {
        return {
          success: false,
          error: `Barcode ${barcode} is already used by another product`,
          code: "BARCODE_IN_USE",
        };
      }
      return { success: true, batch: conflict, barcode, reused: true } as any;
    }

    const now = new Date().toISOString();
    const batch: WebBatch = {
      id: newId(),
      licenseId: payload.licenseId,
      productId: payload.productId,
      barcode,
      mrp: payload.mrp ?? null,
      salePrice: payload.salePrice ?? null,
      costPrice: payload.costPrice ?? null,
      batchNo: null,
      mfgDate: null,
      expiryDate: null,
      receivedAt: now,
      stock: 0,
      isSystemGeneratedBarcode: isSystemGenerated,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await idbPut(STORES.PRODUCT_BATCHES, batch);
    return { success: true, batch, barcode };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeleteBarcode(
  licenseId: string,
  batchId: string,
): Promise<{ success: boolean; error?: string }> {
  const batch = await idbGetByKey<WebBatch>(STORES.PRODUCT_BATCHES, batchId);
  if (!batch || batch.deletedAt) return { success: false, error: "NOT_FOUND" };
  if (batch.licenseId !== licenseId)
    return { success: false, error: "LICENSE_MISMATCH" };
  if ((batch.stock || 0) > 0)
    return { success: false, error: "BARCODE_HAS_STOCK" };

  const now = new Date().toISOString();
  await idbPut(STORES.PRODUCT_BATCHES, {
    ...batch,
    deletedAt: now,
    updatedAt: now,
  });
  return { success: true };
}

export async function webDeleteBatch(
  batchId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const batch = await idbGetByKey<WebBatch>(STORES.PRODUCT_BATCHES, batchId);
    if (!batch || batch.deletedAt)
      return { success: false, error: "NOT_FOUND" };

    const now = new Date().toISOString();
    await idbPut(STORES.PRODUCT_BATCHES, {
      ...batch,
      deletedAt: now,
      updatedAt: now,
    });
    await rebuildProductStock(batch.productId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webListBatchesForProduct(
  productId: string,
  includeDeleted = false,
): Promise<{ success: boolean; rows: WebBatch[]; totalStock: number }> {
  const batches = await idbGetAllByIndex<WebBatch>(
    STORES.PRODUCT_BATCHES,
    "productId",
    productId,
  );
  const rows = includeDeleted ? batches : batches.filter((b) => !b.deletedAt);
  const totalStock = rows
    .filter((b) => !b.deletedAt)
    .reduce((sum, b) => sum + (b.stock || 0), 0);
  return { success: true, rows, totalStock };
}

export async function webSaveBatch(
  payload: BatchSavePayload,
): Promise<{ success: boolean; batch?: WebBatch; error?: string }> {
  try {
    if (!payload.licenseId || !payload.productId) {
      return { success: false, error: "licenseId & productId required" };
    }

    // Find existing batch by identity fields
    const all = await idbGetAllByIndex<WebBatch>(
      STORES.PRODUCT_BATCHES,
      "productId",
      payload.productId,
    );
    const existing = all.find(
      (b) =>
        !b.deletedAt &&
        b.barcode === (payload.barcode ?? null) &&
        b.mrp === (payload.mrp ?? null) &&
        b.salePrice === (payload.salePrice ?? null) &&
        b.batchNo === (payload.batchNo ?? null) &&
        b.mfgDate === (payload.mfgDate ?? null) &&
        b.expiryDate === (payload.expiryDate ?? null),
    );

    const now = new Date().toISOString();

    if (existing) {
      const deltaQty = Number(payload.stock ?? 0);
      const updated: WebBatch = {
        ...existing,
        costPrice: payload.costPrice ?? existing.costPrice,
        receivedAt: payload.receivedAt ?? existing.receivedAt,
        stock: existing.stock + deltaQty,
        updatedAt: now,
      };
      await idbPut(STORES.PRODUCT_BATCHES, updated);
      await rebuildProductStock(payload.productId);
      return { success: true, batch: updated };
    }

    const batch: WebBatch = {
      id: payload.id || newId(),
      licenseId: payload.licenseId!,
      productId: payload.productId,
      barcode: payload.barcode ?? null,
      mrp: payload.mrp ?? null,
      salePrice: payload.salePrice ?? null,
      costPrice: payload.costPrice ?? null,
      batchNo: payload.batchNo ?? null,
      mfgDate: payload.mfgDate ?? null,
      expiryDate: payload.expiryDate ?? null,
      receivedAt: payload.receivedAt ?? now,
      stock: Number(payload.stock ?? 0),
      isSystemGeneratedBarcode: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await idbPut(STORES.PRODUCT_BATCHES, batch);
    await rebuildProductStock(payload.productId);
    return { success: true, batch };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webRebuildProductStock(
  productId: string,
): Promise<{ success: boolean; stock: number }> {
  const stock = await rebuildProductStock(productId);
  return { success: true, stock };
}
