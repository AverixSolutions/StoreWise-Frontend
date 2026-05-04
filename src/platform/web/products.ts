// src/platform/web/products.ts
import type {
  ProductInput,
  BatchSavePayload,
  Pagination,
  ProductFilters,
  ProductSummary,
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
  shortCode?: string | null;
  imagePath?: string | null;
  imageFileName?: string | null;
  stock: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isSynced: number;
  syncedAt: string | null;
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

// ── Short code helpers ─────────────────────────────────────────────────────

function normalizeShortCode(value: unknown): string | null {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return null;

  const cleaned = raw.replace(/[^A-Z0-9-_]/g, "");
  return cleaned || null;
}

async function assertShortCodeAvailable(params: {
  licenseId: string;
  shortCode?: string | null;
  excludeProductId?: string | null;
}) {
  const shortCode = normalizeShortCode(params.shortCode);
  if (!shortCode) return;

  const all = await idbGetAllByIndex<WebProduct>(
    STORES.PRODUCTS,
    "licenseId",
    params.licenseId,
  );

  const conflict = all.find(
    (product) =>
      !product.deletedAt &&
      product.id !== params.excludeProductId &&
      normalizeShortCode(product.shortCode) === shortCode,
  );

  if (conflict) {
    throw new Error(
      `Short code "${shortCode}" is already used by another product`,
    );
  }
}

function productImageToDataUrl(product: WebProduct | null): string | null {
  if (!product?.image?.base64 || !product.image.mimeType) return null;
  return `data:${product.image.mimeType};base64,${product.image.base64}`;
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

    const shortCode = normalizeShortCode(product.shortCode);

    await assertShortCodeAvailable({
      licenseId: product.licenseId,
      shortCode,
    });

    const record: WebProduct = {
      ...product,
      id,
      shortCode,
      imagePath: product.imagePath ?? null,
      imageFileName: product.image?.fileName ?? null,
      stock: 0,
      barcode: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      isSynced: 0,
      syncedAt: null,
    };
    await idbPut(STORES.PRODUCTS, record);
    await bumpCodeSequence(product.licenseId, product.codeNumber);
    _triggerProductSync();
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

    const shortCode =
      product.shortCode === undefined
        ? existing.shortCode
        : normalizeShortCode(product.shortCode);

    await assertShortCodeAvailable({
      licenseId: existing.licenseId,
      shortCode,
      excludeProductId: productId,
    });

    await idbPut(STORES.PRODUCTS, {
      ...existing,
      ...product,
      id: productId,
      shortCode,
      imagePath:
        product.imagePath !== undefined
          ? product.imagePath
          : existing.imagePath,
      imageFileName:
        product.image === undefined
          ? existing.imageFileName
          : (product.image?.fileName ?? null),
      updatedAt: new Date().toISOString(),
      isSynced: 0,
      syncedAt: null,
    });
    _triggerProductSync();
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
      isSynced: 0,
      syncedAt: null,
    });
    _triggerProductSync();
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

async function attachBatchCounts(products: WebProduct[]) {
  const allBatches = await idbGetAll<WebBatch>(STORES.PRODUCT_BATCHES);

  return products.map((product) => ({
    ...product,
    batchCount: allBatches.filter(
      (batch) => batch.productId === product.id && !batch.deletedAt,
    ).length,
  }));
}

export async function webGetProducts(
  licenseId: string,
  pagination?: Pagination,
): Promise<{
  products: (WebProduct & { batchCount: number })[];
  total: number;
}> {
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

  const paged = live.slice(offset, offset + pageSize);
  const productsWithBatchCount = await attachBatchCounts(paged);

  return {
    products: productsWithBatchCount,
    total: live.length,
  };
}

export async function webGetFilteredProducts(
  licenseId: string,
  filters: ProductFilters,
  pagination?: Pagination,
): Promise<{
  products: (WebProduct & { batchCount: number })[];
  total: number;
}> {
  const all = await idbGetAllByIndex<WebProduct>(
    STORES.PRODUCTS,
    "licenseId",
    licenseId,
  );

  let live = all.filter((p) => !p.deletedAt);

  if (filters.name) {
    const q = filters.name.toLowerCase();
    live = live.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.shortCode ?? "").toLowerCase().includes(q),
    );
  }

  if (filters.category) {
    live = live.filter((p) => p.category === filters.category);
  }

  if (filters.brand) {
    live = live.filter((p) => p.brand === filters.brand);
  }

  if (filters.subcategory) {
    live = live.filter((p) => (p as any).subcategory === filters.subcategory);
  }

  if (filters.tax) {
    live = live.filter((p) => p.tax === filters.tax);
  }

  live.sort((a, b) => a.codeNumber - b.codeNumber);

  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;
  const offset = (page - 1) * pageSize;

  const paged = live.slice(offset, offset + pageSize);
  const productsWithBatchCount = await attachBatchCounts(paged);

  return {
    products: productsWithBatchCount,
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

export async function webGetProductByCode(
  licenseId: string,
  code: string,
): Promise<ProductSummary | null> {
  const all = await idbGetAllByIndex<WebProduct>(
    STORES.PRODUCTS,
    "licenseId",
    licenseId,
  );

  const product = all.find(
    (p) => !p.deletedAt && String(p.code) === String(code),
  );

  return product ?? null;
}

export async function webGetProductByShortCode(
  licenseId: string,
  shortCode: string,
): Promise<ProductSummary | null> {
  const normalized = normalizeShortCode(shortCode);
  if (!normalized) return null;

  const all = await idbGetAllByIndex<WebProduct>(
    STORES.PRODUCTS,
    "licenseId",
    licenseId,
  );

  const product = all.find(
    (p) => !p.deletedAt && normalizeShortCode(p.shortCode) === normalized,
  );

  return product ?? null;
}

export async function webGetProductImageDataUrl(
  productId: string,
): Promise<string | null> {
  const product = await webGetProduct(productId);
  if (!product) return null;
  // If R2 URL is stored, return it directly
  if (product.imagePath) return product.imagePath;
  // Fallback to base64 (legacy)
  return productImageToDataUrl(product);
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
): Promise<{ success: boolean; rows: WebBatch[]; error?: string }> {
  try {
    const batches = await idbGetAllByIndex<WebBatch>(
      STORES.PRODUCT_BATCHES,
      "productId",
      productId,
    );

    const rows = batches
      .filter(
        (b) =>
          !b.deletedAt &&
          b.licenseId === licenseId &&
          !!String(b.barcode ?? "").trim(),
      )
      .sort((a, b) => {
        if ((a.stock || 0) > 0 && (b.stock || 0) <= 0) return -1;
        if ((b.stock || 0) > 0 && (a.stock || 0) <= 0) return 1;
        return (b.receivedAt ?? "").localeCompare(a.receivedAt ?? "");
      });

    return { success: true, rows };
  } catch (err: any) {
    return {
      success: false,
      rows: [],
      error: String(err?.message || err),
    };
  }
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

    const deltaQty = Number(payload.stock ?? 0);
    if (!Number.isFinite(deltaQty)) {
      return { success: false, error: "Invalid stock value" };
    }

    const normalizedBarcode = payload.barcode?.trim() || null;
    const normalizedBatchNo = payload.batchNo?.trim() || null;
    const normalizedMfgDate = payload.mfgDate?.trim() || null;
    const normalizedExpiryDate = payload.expiryDate?.trim() || null;
    const now = new Date().toISOString();

    const productBatches = await idbGetAllByIndex<WebBatch>(
      STORES.PRODUCT_BATCHES,
      "productId",
      payload.productId,
    );

    const existing = productBatches.find(
      (b) =>
        !b.deletedAt &&
        b.barcode === normalizedBarcode &&
        b.mrp === (payload.mrp ?? null) &&
        b.salePrice === (payload.salePrice ?? null) &&
        b.batchNo === normalizedBatchNo &&
        b.mfgDate === normalizedMfgDate &&
        b.expiryDate === normalizedExpiryDate,
    );

    if (normalizedBarcode) {
      const licenseBatches = await idbGetAllByIndex<WebBatch>(
        STORES.PRODUCT_BATCHES,
        "licenseId",
        payload.licenseId,
      );

      const barcodeConflict = licenseBatches.find(
        (b) =>
          !b.deletedAt &&
          b.barcode === normalizedBarcode &&
          b.id !== existing?.id,
      );

      if (barcodeConflict) {
        return {
          success: false,
          error: `Barcode ${normalizedBarcode} is already used by another batch`,
        };
      }
    }

    if (existing) {
      const nextStock = Number(existing.stock || 0) + deltaQty;
      if (nextStock < 0) {
        return {
          success: false,
          error: "Cannot reduce batch stock below 0",
        };
      }

      const updated: WebBatch = {
        ...existing,
        barcode: normalizedBarcode,
        mrp: payload.mrp ?? existing.mrp,
        salePrice: payload.salePrice ?? existing.salePrice,
        costPrice: payload.costPrice ?? existing.costPrice,
        batchNo: normalizedBatchNo,
        mfgDate: normalizedMfgDate,
        expiryDate: normalizedExpiryDate,
        receivedAt: payload.receivedAt ?? existing.receivedAt ?? now,
        stock: nextStock,
        updatedAt: now,
      };

      await idbPut(STORES.PRODUCT_BATCHES, updated);
      await rebuildProductStock(payload.productId);

      return { success: true, batch: updated };
    }

    if (deltaQty < 0) {
      return {
        success: false,
        error: "Cannot create a new batch with negative stock",
      };
    }

    const batch: WebBatch = {
      id: payload.id || newId(),
      licenseId: payload.licenseId,
      productId: payload.productId,
      barcode: normalizedBarcode,
      mrp: payload.mrp ?? null,
      salePrice: payload.salePrice ?? null,
      costPrice: payload.costPrice ?? null,
      batchNo: normalizedBatchNo,
      mfgDate: normalizedMfgDate,
      expiryDate: normalizedExpiryDate,
      receivedAt: payload.receivedAt ?? now,
      stock: deltaQty,
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

export async function webUpdateBatch(payload: {
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
}): Promise<{ success: boolean; batch?: WebBatch; error?: string }> {
  try {
    const existing = await idbGetByKey<WebBatch>(
      STORES.PRODUCT_BATCHES,
      payload.id,
    );
    if (!existing || existing.deletedAt) {
      return { success: false, error: "NOT_FOUND" };
    }

    const normalizedBarcode =
      payload.barcode === undefined
        ? existing.barcode
        : payload.barcode?.trim() || null;
    const normalizedBatchNo =
      payload.batchNo === undefined
        ? existing.batchNo
        : payload.batchNo?.trim() || null;
    const normalizedMfgDate =
      payload.mfgDate === undefined
        ? existing.mfgDate
        : payload.mfgDate?.trim() || null;
    const normalizedExpiryDate =
      payload.expiryDate === undefined
        ? existing.expiryDate
        : payload.expiryDate?.trim() || null;

    if (normalizedBarcode) {
      const licenseBatches = await idbGetAllByIndex<WebBatch>(
        STORES.PRODUCT_BATCHES,
        "licenseId",
        existing.licenseId,
      );

      const barcodeConflict = licenseBatches.find(
        (b) =>
          !b.deletedAt &&
          b.barcode === normalizedBarcode &&
          b.id !== existing.id,
      );

      if (barcodeConflict) {
        return {
          success: false,
          error: `Barcode ${normalizedBarcode} is already used by another batch`,
        };
      }
    }

    const updated: WebBatch = {
      ...existing,
      barcode: normalizedBarcode,
      mrp: payload.mrp === undefined ? existing.mrp : payload.mrp,
      salePrice:
        payload.salePrice === undefined
          ? existing.salePrice
          : payload.salePrice,
      costPrice:
        payload.costPrice === undefined
          ? existing.costPrice
          : payload.costPrice,
      batchNo: normalizedBatchNo,
      mfgDate: normalizedMfgDate,
      expiryDate: normalizedExpiryDate,
      receivedAt:
        payload.receivedAt === undefined
          ? existing.receivedAt
          : payload.receivedAt || null,
      updatedAt: new Date().toISOString(),
    };

    await idbPut(STORES.PRODUCT_BATCHES, updated);
    return { success: true, batch: updated };
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

function _triggerProductSync() {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pushEntity("product").catch(() => {});
    })
    .catch(() => {});
}
