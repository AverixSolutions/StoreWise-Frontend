// src/platform/web/idb.ts
const DB_NAME = "kynflow-web";
const DB_VERSION = 8; // bumped from 7

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

      // v8 stores — suppliers cache for web sync
      if (oldVersion < 8) {
        if (!db.objectStoreNames.contains(STORES.SUPPLIERS)) {
          const suppStore = db.createObjectStore(STORES.SUPPLIERS, {
            keyPath: "id",
          });
          suppStore.createIndex("licenseId", "licenseId", { unique: false });
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
