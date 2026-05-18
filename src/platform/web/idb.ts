// src/platform/web/idb.ts
const DB_NAME = "kynflow-web";
const DB_VERSION = 15; // bumped from 14

export const STORES = {
  SHOP_SETTINGS: "shop_settings",
  SYNC_QUEUE: "sync_queue",
  PRODUCTS: "products",
  PRODUCT_BATCHES: "product_batches",
  CODE_SEQUENCE: "code_sequence",
  BARCODE_SEQUENCE: "barcode_sequence",
  CATEGORIES: "categories",
  BRANDS: "brands",
  UNITS: "units",
  TAX_CATEGORIES: "tax_categories",
  SUPPLIERS: "suppliers",
  CUSTOMERS: "customers",
  // ── v9: purchase stores ──────────────────────────────────────────────────
  PURCHASES: "purchases",
  PURCHASE_ITEMS: "purchase_items",
  PURCHASE_HOLDS: "purchase_holds",
  // ── v10: sales stores ────────────────────────────────────────────────────
  SALES: "sales",
  SALE_ITEMS: "sale_items",
  SALE_HOLDS: "sale_holds",
  // ── v11: transaction types ───────────────────────────────────────────────
  TRANSACTION_TYPES: "transaction_types",
  // ── v13: quotations ──────────────────────────────────────────────────────
  QUOTATIONS: "quotations",
  QUOTATION_ITEMS: "quotation_items",
  OFFERS: "offers",
  OFFER_TARGET_PRODUCTS: "offer_target_products",
  // ── v15: purchase returns ────────────────────────────────────────────────
  PURCHASE_RETURNS: "purchase_returns",
  PURCHASE_RETURN_ITEMS: "purchase_return_items",
  PURCHASE_RETURN_HOLDS: "purchase_return_holds",
} as const;

export type SyncJob = {
  id: string;
  entityType: "shop_settings" | "products" | "product_batches";
  entityKey: string;
  operation: "UPSERT" | "DELETE";
  payload: any;
  createdAt: string;
  lastTriedAt: string | null;
  status: "PENDING" | "FAILED";
  error: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

      // v1 stores
      if (!db.objectStoreNames.contains(STORES.SHOP_SETTINGS)) {
        db.createObjectStore(STORES.SHOP_SETTINGS, { keyPath: "licenseId" });
      }
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: "id",
        });
        syncStore.createIndex("entityType", "entityType", { unique: false });
        syncStore.createIndex("entityKey", "entityKey", { unique: false });
        syncStore.createIndex("status", "status", { unique: false });
      }

      // v2 stores
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const productStore = db.createObjectStore(STORES.PRODUCTS, {
            keyPath: "id",
          });
          productStore.createIndex("licenseId", "licenseId", { unique: false });
          productStore.createIndex("licenseId_code", ["licenseId", "code"], {
            unique: true,
          });
          productStore.createIndex(
            "licenseId_codeNumber",
            ["licenseId", "codeNumber"],
            { unique: false },
          );
          productStore.createIndex(
            "licenseId_deletedAt",
            ["licenseId", "deletedAt"],
            { unique: false },
          );
        }
        if (!db.objectStoreNames.contains(STORES.PRODUCT_BATCHES)) {
          const batchStore = db.createObjectStore(STORES.PRODUCT_BATCHES, {
            keyPath: "id",
          });
          batchStore.createIndex("productId", "productId", { unique: false });
          batchStore.createIndex("licenseId", "licenseId", { unique: false });
          batchStore.createIndex(
            "licenseId_barcode",
            ["licenseId", "barcode"],
            { unique: false },
          );
        }
        if (!db.objectStoreNames.contains(STORES.CODE_SEQUENCE)) {
          db.createObjectStore(STORES.CODE_SEQUENCE, { keyPath: "licenseId" });
        }
        if (!db.objectStoreNames.contains(STORES.BARCODE_SEQUENCE)) {
          db.createObjectStore(STORES.BARCODE_SEQUENCE, {
            keyPath: "licenseId",
          });
        }
      }

      // v3 stores
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          const catStore = db.createObjectStore(STORES.CATEGORIES, {
            keyPath: "id",
          });
          catStore.createIndex("licenseId", "licenseId", { unique: false });
          catStore.createIndex(
            "licenseId_parentId",
            ["licenseId", "parentId"],
            { unique: false },
          );
        }
      }

      // v4 stores
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(STORES.BRANDS)) {
          const brandStore = db.createObjectStore(STORES.BRANDS, {
            keyPath: "id",
          });
          brandStore.createIndex("licenseId", "licenseId", { unique: false });
        }
      }

      // v5 index
      if (oldVersion < 5) {
        if (db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const productStore = request.transaction!.objectStore(
            STORES.PRODUCTS,
          );
          if (!productStore.indexNames.contains("licenseId_shortCode")) {
            productStore.createIndex(
              "licenseId_shortCode",
              ["licenseId", "shortCode"],
              { unique: false },
            );
          }
        }
      }

      // v6 stores
      if (oldVersion < 6) {
        if (!db.objectStoreNames.contains(STORES.UNITS)) {
          const unitStore = db.createObjectStore(STORES.UNITS, {
            keyPath: "id",
          });
          unitStore.createIndex("licenseId", "licenseId", { unique: false });
        }
      }

      // v7 stores
      if (oldVersion < 7) {
        if (!db.objectStoreNames.contains(STORES.TAX_CATEGORIES)) {
          const taxStore = db.createObjectStore(STORES.TAX_CATEGORIES, {
            keyPath: "id",
          });
          taxStore.createIndex("licenseId", "licenseId", { unique: false });
          taxStore.createIndex("licenseId_code", ["licenseId", "code"], {
            unique: false,
          });
        }
      }

      // v8 stores — suppliers cache
      if (oldVersion < 8) {
        if (!db.objectStoreNames.contains(STORES.SUPPLIERS)) {
          const suppStore = db.createObjectStore(STORES.SUPPLIERS, {
            keyPath: "id",
          });
          suppStore.createIndex("licenseId", "licenseId", { unique: false });
        }
      }

      // v9 stores — purchases, purchase_items, purchase_holds
      if (oldVersion < 9) {
        // Purchases (headers)
        if (!db.objectStoreNames.contains(STORES.PURCHASES)) {
          const purchaseStore = db.createObjectStore(STORES.PURCHASES, {
            keyPath: "id",
          });
          purchaseStore.createIndex("licenseId", "licenseId", {
            unique: false,
          });
          purchaseStore.createIndex(
            "licenseId_purchaseDate",
            ["licenseId", "purchaseDate"],
            { unique: false },
          );
          purchaseStore.createIndex(
            "licenseId_supplierId",
            ["licenseId", "supplierId"],
            { unique: false },
          );
        }

        // Purchase items
        if (!db.objectStoreNames.contains(STORES.PURCHASE_ITEMS)) {
          const itemStore = db.createObjectStore(STORES.PURCHASE_ITEMS, {
            keyPath: "id",
          });
          itemStore.createIndex("purchaseId", "purchaseId", { unique: false });
        }

        // Purchase holds
        if (!db.objectStoreNames.contains(STORES.PURCHASE_HOLDS)) {
          const holdStore = db.createObjectStore(STORES.PURCHASE_HOLDS, {
            keyPath: "id",
          });
          holdStore.createIndex("licenseId", "licenseId", { unique: false });
        }
      }

      // v10 stores — sales, sale_items, sale_holds
      if (oldVersion < 10) {
        if (!db.objectStoreNames.contains(STORES.SALES)) {
          const saleStore = db.createObjectStore(STORES.SALES, {
            keyPath: "id",
          });
          saleStore.createIndex("licenseId", "licenseId", { unique: false });
          saleStore.createIndex(
            "licenseId_saleDate",
            ["licenseId", "saleDate"],
            { unique: false },
          );
          saleStore.createIndex(
            "licenseId_customerId",
            ["licenseId", "customerId"],
            { unique: false },
          );
        }
        if (!db.objectStoreNames.contains(STORES.SALE_ITEMS)) {
          const itemStore = db.createObjectStore(STORES.SALE_ITEMS, {
            keyPath: "id",
          });
          itemStore.createIndex("saleId", "saleId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.SALE_HOLDS)) {
          const holdStore = db.createObjectStore(STORES.SALE_HOLDS, {
            keyPath: "id",
          });
          holdStore.createIndex("licenseId", "licenseId", { unique: false });
        }
      }

      // v11 stores — transaction_types
      if (oldVersion < 11) {
        if (!db.objectStoreNames.contains(STORES.TRANSACTION_TYPES)) {
          const txTypeStore = db.createObjectStore(STORES.TRANSACTION_TYPES, {
            keyPath: "id",
          });
          txTypeStore.createIndex("licenseId", "licenseId", { unique: false });
          txTypeStore.createIndex("category", "category", { unique: false });
        }
      }

      // v12 stores — customers cache
      if (oldVersion < 12) {
        if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
          const custStore = db.createObjectStore(STORES.CUSTOMERS, {
            keyPath: "id",
          });
          custStore.createIndex("licenseId", "licenseId", { unique: false });
        }
      }

      // v13 stores — quotations
      if (oldVersion < 13) {
        if (!db.objectStoreNames.contains(STORES.QUOTATIONS)) {
          const qtStore = db.createObjectStore(STORES.QUOTATIONS, {
            keyPath: "id",
          });
          qtStore.createIndex("licenseId", "licenseId", { unique: false });
          qtStore.createIndex(
            "licenseId_quotationDate",
            ["licenseId", "quotationDate"],
            { unique: false },
          );
          qtStore.createIndex("licenseId_status", ["licenseId", "status"], {
            unique: false,
          });
        }
        if (!db.objectStoreNames.contains(STORES.QUOTATION_ITEMS)) {
          const itemStore = db.createObjectStore(STORES.QUOTATION_ITEMS, {
            keyPath: "id",
          });
          itemStore.createIndex("quotationId", "quotationId", {
            unique: false,
          });
        }
      }

      // v14 stores - offer master
      if (oldVersion < 14) {
        if (!db.objectStoreNames.contains(STORES.OFFERS)) {
          const offerStore = db.createObjectStore(STORES.OFFERS, {
            keyPath: "id",
          });
          offerStore.createIndex("licenseId", "licenseId", { unique: false });
          offerStore.createIndex("licenseId_type", ["licenseId", "type"], {
            unique: false,
          });
          offerStore.createIndex(
            "licenseId_active",
            ["licenseId", "isActive"],
            {
              unique: false,
            },
          );
        }
        if (!db.objectStoreNames.contains(STORES.OFFER_TARGET_PRODUCTS)) {
          const targetStore = db.createObjectStore(
            STORES.OFFER_TARGET_PRODUCTS,
            { keyPath: "id" },
          );
          targetStore.createIndex("licenseId", "licenseId", { unique: false });
          targetStore.createIndex("offerId", "offerId", { unique: false });
          targetStore.createIndex(
            "offerId_productId_role",
            ["offerId", "productId", "targetRole"],
            { unique: false },
          );
        }
      }

      // v15 stores — purchase returns, purchase_return_items, purchase_return_holds
      if (oldVersion < 15) {
        // Purchase returns (headers)
        if (!db.objectStoreNames.contains(STORES.PURCHASE_RETURNS)) {
          const returnStore = db.createObjectStore(STORES.PURCHASE_RETURNS, {
            keyPath: "id",
          });
          returnStore.createIndex("licenseId", "licenseId", { unique: false });
          returnStore.createIndex(
            "licenseId_returnDate",
            ["licenseId", "returnDate"],
            { unique: false },
          );
          returnStore.createIndex(
            "licenseId_supplierId",
            ["licenseId", "supplierId"],
            { unique: false },
          );
          returnStore.createIndex(
            "licenseId_deletedAt",
            ["licenseId", "deletedAt"],
            { unique: false },
          );
        }

        // Purchase return items
        if (!db.objectStoreNames.contains(STORES.PURCHASE_RETURN_ITEMS)) {
          const itemStore = db.createObjectStore(STORES.PURCHASE_RETURN_ITEMS, {
            keyPath: "id",
          });
          itemStore.createIndex("licenseId", "licenseId", { unique: false });
          itemStore.createIndex("purchaseReturnId", "purchaseReturnId", {
            unique: false,
          });
          itemStore.createIndex(
            "licenseId_purchaseReturnId",
            ["licenseId", "purchaseReturnId"],
            { unique: false },
          );
        }

        // Purchase return holds
        if (!db.objectStoreNames.contains(STORES.PURCHASE_RETURN_HOLDS)) {
          const holdStore = db.createObjectStore(STORES.PURCHASE_RETURN_HOLDS, {
            keyPath: "id",
          });
          holdStore.createIndex("licenseId", "licenseId", { unique: false });
          holdStore.createIndex(
            "licenseId_createdAt",
            ["licenseId", "createdAt"],
            { unique: false },
          );
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  executor: (
    store: IDBObjectStore,
    resolve: (value: T) => void,
    reject: (reason?: any) => void,
  ) => void,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    executor(store, resolve, reject);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      reject(
        tx.error || new Error(`IndexedDB transaction failed: ${storeName}`),
      );
      db.close();
    };
    tx.onabort = () => {
      reject(
        tx.error || new Error(`IndexedDB transaction aborted: ${storeName}`),
      );
      db.close();
    };
  });
}

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function idbGetByKey<T>(
  storeName: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  return withStore<T | undefined>(
    storeName,
    "readonly",
    (store, resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () =>
        reject(request.error || new Error(`Failed to read from ${storeName}`));
    },
  );
}

export async function idbPut<T>(storeName: string, value: T): Promise<T> {
  return withStore<T>(storeName, "readwrite", (store, resolve, reject) => {
    const request = store.put(value as any);
    request.onsuccess = () => resolve(value);
    request.onerror = () =>
      reject(request.error || new Error(`Failed to write to ${storeName}`));
  });
}

export async function idbDelete(
  storeName: string,
  key: IDBValidKey,
): Promise<void> {
  return withStore<void>(storeName, "readwrite", (store, resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error || new Error(`Failed to delete from ${storeName}`));
  });
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  return withStore<T[]>(storeName, "readonly", (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result || []) as T[]);
    request.onerror = () =>
      reject(
        request.error || new Error(`Failed to read all from ${storeName}`),
      );
  });
}

export async function idbGetAllByIndex<T>(
  storeName: string,
  indexName: string,
  key: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  return withStore<T[]>(storeName, "readonly", (store, resolve, reject) => {
    const index = store.index(indexName);
    const request = index.getAll(key);
    request.onsuccess = () => resolve((request.result || []) as T[]);
    request.onerror = () =>
      reject(request.error || new Error(`Failed to read index ${indexName}`));
  });
}
