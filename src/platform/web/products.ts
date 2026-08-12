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
import { canUseBarcode } from "@/lib/session/runtimeSession";

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
  purchaseBatchNo?: string | null;
  purchaseId?: string | null;
  purchaseBillNo?: string | null;
  supplierName?: string | null;
  purchaseDate?: string | null;
  lotNumber?: number | null;
  rateSummary?: string | null;
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

async function enrichStockLots(rows: WebBatch[]): Promise<WebBatch[]> {
  if (!rows.length) return rows;

  try {
    const purchaseIds = Array.from(
      new Set(rows.map((row) => row.purchaseId).filter(Boolean) as string[]),
    );
    const [purchases, purchaseItems, batchRates, rateTypes] = await Promise.all([
      Promise.all(
        purchaseIds.map((id) =>
          idbGetByKey<Record<string, any>>(STORES.PURCHASES, id),
        ),
      ),
      idbGetAll<Record<string, any>>(STORES.PURCHASE_ITEMS),
      idbGetAll<Record<string, any>>(STORES.PRODUCT_BATCH_RATES),
      idbGetAll<Record<string, any>>(STORES.RATE_TYPES),
    ]);

    const purchaseById = new Map(
      purchases.filter(Boolean).map((purchase) => [purchase!.id, purchase!]),
    );
    const lineByBatchId = new Map<string, number>();
    purchaseItems.forEach((item) => {
      if (!item.batchId || item.deletedAt) return;
      const lineNo = Number(item.lineNo || 0);
      const current = lineByBatchId.get(item.batchId);
      if (!current || (lineNo > 0 && lineNo < current)) {
        lineByBatchId.set(item.batchId, lineNo);
      }
    });
    const rateTypeById = new Map(
      rateTypes
        .filter((rate) => !rate.deletedAt)
        .map((rate) => [rate.id, rate]),
    );
    const ratesByBatchId = new Map<string, Record<string, any>[]>();
    batchRates.forEach((rate) => {
      if (!rate.batchId || rate.deletedAt) return;
      const list = ratesByBatchId.get(rate.batchId) || [];
      list.push(rate);
      ratesByBatchId.set(rate.batchId, list);
    });

    return rows.map((row) => {
      const purchase = row.purchaseId
        ? purchaseById.get(row.purchaseId)
        : undefined;
      const rateSummary = (ratesByBatchId.get(row.id) || [])
        .sort((left, right) => {
          const a = rateTypeById.get(left.rateTypeId);
          const b = rateTypeById.get(right.rateTypeId);
          return (
            Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0) ||
            String(a?.name || "").localeCompare(String(b?.name || ""))
          );
        })
        .map((rate) => {
          const type = rateTypeById.get(rate.rateTypeId);
          return `${type?.name || type?.code || "Rate"}: ${Number(rate.amount || 0).toFixed(2)}`;
        })
        .join(" | ");

      return {
        ...row,
        purchaseBatchNo:
          row.purchaseBatchNo ?? purchase?.purchaseBatchNo ?? null,
        purchaseBillNo: purchase?.billNo ?? null,
        supplierName: purchase?.supplierName ?? null,
        purchaseDate: purchase?.purchaseDate ?? null,
        lotNumber: lineByBatchId.get(row.id) ?? null,
        rateSummary: rateSummary || null,
      };
    });
  } catch {
    return rows;
  }
}

// ── Sequence helpers ────────────────────────────────────────────────────────

async function getNextCodeNumber(licenseId: string): Promise<number> {
  const seq = await idbGetByKey<CodeSeqRecord>(STORES.CODE_SEQUENCE, licenseId);
  const seqLast = seq?.lastCodeNumber ?? 0;

  const allProducts = await idbGetAllByIndex<WebProduct>(
    STORES.PRODUCTS,
    "licenseId",
    licenseId,
  );

  const maxProductCodeNumber = allProducts.reduce((max, product) => {
    const num =
      typeof product.codeNumber === "number" &&
      Number.isFinite(product.codeNumber)
        ? product.codeNumber
        : parseInt(String(product.code ?? "0"), 10) || 0;
    return Math.max(max, num);
  }, 0);

  return Math.max(seqLast, maxProductCodeNumber) + 1;
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
  const batches = await idbGetAllByIndex<WebBatch>(
    STORES.PRODUCT_BATCHES,
    "licenseId",
    licenseId,
  );
  const liveMax = batches.reduce((maximum, batch) => {
    const barcode = String(batch.barcode || "").trim();
    return !batch.deletedAt && /^\d{5}$/.test(barcode)
      ? Math.max(maximum, Number(barcode))
      : maximum;
  }, 0);
  const products = await idbGetAllByIndex<WebProduct>(
    STORES.PRODUCTS,
    "licenseId",
    licenseId,
  );
  const productCodeMax = products.reduce(
    (maximum, product) =>
      product.deletedAt
        ? maximum
        : Math.max(maximum, Number(product.codeNumber || 0)),
    0,
  );
  return Math.max(seq?.lastBarcodeNumber ?? 0, liveMax, productCodeMax) + 1;
}

async function reserveBarcodeNumbers(
  licenseId: string,
  count: number,
): Promise<string[]> {
  const current = (await peekNextBarcodeNumber(licenseId)) - 1;
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

    // ── Guard: reject if code already exists (e.g. synced from desktop) ──
    const existingProducts = await idbGetAllByIndex<WebProduct>(
      STORES.PRODUCTS,
      "licenseId",
      product.licenseId,
    );
    const duplicateCode = existingProducts.find(
      (p) => !p.deletedAt && String(p.code) === String(product.code),
    );
    if (duplicateCode) {
      return {
        success: false,
        error: `Product code ${product.code} already exists`,
      };
    }
    // ─────────────────────────────────────────────────────────────────────

    const productRecord = { ...product };
    delete productRecord.rates;
    const record: WebProduct = {
      ...productRecord,
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

    const productRecord = { ...product };
    delete productRecord.rates;
    await idbPut(STORES.PRODUCTS, {
      ...existing,
      ...productRecord,
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

  const isStockLot = (batch: WebBatch) =>
    Boolean(
      batch.purchaseId ||
      Number(batch.stock || 0) !== 0 ||
      batch.batchNo ||
      batch.mfgDate ||
      batch.expiryDate ||
      batch.purchaseBatchNo,
    );

  return products.map((product) => ({
    ...product,
    batchCount: allBatches.filter(
      (batch) =>
        batch.productId === product.id && !batch.deletedAt && isStockLot(batch),
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
  if (!canUseBarcode()) return null;

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
    purchaseBatchNo: batch.purchaseBatchNo ?? null,
    purchaseId: batch.purchaseId ?? null,
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
  if (!canUseBarcode()) {
    return {
      success: false,
      barcode: "",
      number: 0,
      error: "Barcode Support is disabled for this license.",
    } as any;
  }

  const num = await peekNextBarcodeNumber(licenseId);
  return { success: true, barcode: String(num).padStart(5, "0"), number: num };
}

export async function webReserveBarcodes(
  licenseId: string,
  count: number,
): Promise<{ success: boolean; barcodes: string[] }> {
  if (!canUseBarcode()) {
    return {
      success: false,
      barcodes: [],
      error: "Barcode Support is disabled for this license.",
    } as any;
  }

  const barcodes = await reserveBarcodeNumbers(licenseId, count);
  return { success: true, barcodes };
}

export async function webListBarcodesForProduct(
  licenseId: string,
  productId: string,
): Promise<{ success: boolean; rows: WebBatch[]; error?: string }> {
  try {
    if (!canUseBarcode()) {
      return {
        success: false,
        rows: [],
        error: "Barcode Support is disabled for this license.",
      };
    }

    const batches = await idbGetAllByIndex<WebBatch>(
      STORES.PRODUCT_BATCHES,
      "productId",
      productId,
    );

    const sorted = batches
      .filter(
        (b) =>
          !b.deletedAt &&
          b.licenseId === licenseId &&
          !!String(b.barcode ?? "").trim(),
      )
      .sort((a, b) => {
        if (!a.purchaseId && b.purchaseId) return -1;
        if (!b.purchaseId && a.purchaseId) return 1;
        if ((a.stock || 0) > 0 && (b.stock || 0) <= 0) return -1;
        if ((b.stock || 0) > 0 && (a.stock || 0) <= 0) return 1;
        return (b.receivedAt ?? "").localeCompare(a.receivedAt ?? "");
      });
    const rows = Array.from(
      sorted
        .reduce((byBarcode, batch) => {
          const barcode = String(batch.barcode || "").trim();
          if (barcode && !byBarcode.has(barcode)) {
            byBarcode.set(barcode, batch);
          }
          return byBarcode;
        }, new Map<string, WebBatch>())
        .values(),
    );

    return { success: true, rows: await enrichStockLots(rows) };
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
    if (!canUseBarcode()) {
      return {
        success: false,
        error: "Barcode Support is disabled for this license.",
        code: "BARCODE_DISABLED",
      };
    }

    let barcode = payload.barcode?.trim() || null;
    let isSystemGenerated = payload.useGenerated ? 1 : 0;

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
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(barcode)) {
      return {
        success: false,
        error: "Invalid barcode format",
        code: "INVALID_BARCODE",
      };
    }

    const allProducts = await idbGetAllByIndex<WebProduct>(
      STORES.PRODUCTS,
      "licenseId",
      payload.licenseId,
    );
    const itemCodeConflict = allProducts.find(
      (product) =>
        !product.deletedAt &&
        product.id !== payload.productId &&
        String(product.code) === barcode,
    );
    if (itemCodeConflict) {
      return {
        success: false,
        error: `Barcode ${barcode} is reserved as another item's code`,
        code: "BARCODE_IN_USE",
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
    _triggerProductBatchSync();
    return { success: true, batch, barcode };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeleteBarcode(
  licenseId: string,
  batchId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!canUseBarcode()) {
    return {
      success: false,
      error: "Barcode Support is disabled for this license.",
    };
  }

  const batch = await idbGetByKey<WebBatch>(STORES.PRODUCT_BATCHES, batchId);
  if (!batch || batch.deletedAt) return { success: false, error: "NOT_FOUND" };
  if (batch.licenseId !== licenseId)
    return { success: false, error: "LICENSE_MISMATCH" };
  const sameBarcode = (
    await idbGetAllByIndex<WebBatch>(
      STORES.PRODUCT_BATCHES,
      "productId",
      batch.productId,
    )
  ).filter(
    (row) =>
      !row.deletedAt &&
      String(row.barcode || "").trim() === String(batch.barcode || "").trim(),
  );
  if (sameBarcode.reduce((sum, row) => sum + Number(row.stock || 0), 0) > 0)
    return { success: false, error: "BARCODE_HAS_STOCK" };
  if (batch.purchaseId)
    return { success: false, error: "BARCODE_HAS_HISTORY" };

  const now = new Date().toISOString();
  await idbPut(STORES.PRODUCT_BATCHES, {
    ...batch,
    deletedAt: now,
    updatedAt: now,
  });
  _triggerProductBatchSync();
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
  const isStockLot = (batch: WebBatch) =>
    Boolean(
      batch.purchaseId ||
      Number(batch.stock || 0) !== 0 ||
      batch.batchNo ||
      batch.mfgDate ||
      batch.expiryDate ||
      batch.purchaseBatchNo,
    );
  const stockLots = batches.filter(isStockLot);
  const rows = includeDeleted
    ? stockLots
    : stockLots.filter((b) => !b.deletedAt);
  const totalStock = rows
    .filter((b) => !b.deletedAt)
    .reduce((sum, b) => sum + (b.stock || 0), 0);
  return {
    success: true,
    rows: await enrichStockLots(rows),
    totalStock,
  };
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
    if (normalizedBarcode && !canUseBarcode()) {
      return {
        success: false,
        error: "Barcode Support is disabled for this license.",
      };
    }

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
          b.productId !== payload.productId &&
          b.id !== existing?.id,
      );

      if (barcodeConflict) {
        return {
          success: false,
          error: `Barcode ${normalizedBarcode} is already used by another product`,
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
    if (
      payload.barcode !== undefined &&
      normalizedBarcode &&
      !canUseBarcode()
    ) {
      return {
        success: false,
        error: "Barcode Support is disabled for this license.",
      };
    }

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
          b.productId !== existing.productId &&
          b.id !== existing.id,
      );

      if (barcodeConflict) {
        return {
          success: false,
          error: `Barcode ${normalizedBarcode} is already used by another product`,
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

function _triggerProductBatchSync() {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pushEntity("productBatch").catch(() => {});
    })
    .catch(() => {});
}
