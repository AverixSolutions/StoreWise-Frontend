// electron/db.js
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const appDataRoot = path.join(app.getPath("appData"), "KYNFLOW");
const dataDir = path.join(appDataRoot, "data");
const backupDir = path.join(appDataRoot, "backups");
const dbPath = path.join(dataDir, "kynflow.db");

ensureDir(appDataRoot);
ensureDir(dataDir);
ensureDir(backupDir);

console.log("KYNFLOW appDataRoot:", appDataRoot);
console.log("KYNFLOW DB Path:", dbPath);
console.log("KYNFLOW Backup Dir:", backupDir);

const db = new Database(dbPath);

db.pragma("busy_timeout = 5000");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function tableExists(table) {
  const row = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`,
    )
    .get(table);
  return !!row;
}

function addColumnIfMissing(table, column, type) {
  if (!tableExists(table)) return;

  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
}

// Product Table
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    code TEXT NOT NULL,
    codeNumber INTEGER NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    unit TEXT NOT NULL CHECK (unit IN ('KG', 'NOS', 'LTR', 'MTR')),
    tax TEXT NOT NULL CHECK (tax IN ('NT', 'P5', 'P12', 'P18', 'P28')),
    hsn TEXT,
    costPrice REAL NOT NULL,
    salePrice REAL,
    stock INTEGER DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT,
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    UNIQUE(licenseId, code),
    UNIQUE(licenseId, codeNumber)
  )
`,
).run();

addColumnIfMissing("products", "deletedAt", "TEXT");
addColumnIfMissing("products", "barcode", "TEXT");
addColumnIfMissing("products", "subcategory", "TEXT");
addColumnIfMissing("products", "productName", "TEXT");
addColumnIfMissing("products", "model", "TEXT");
addColumnIfMissing("products", "size", "TEXT");
addColumnIfMissing("products", "shortCode", "TEXT");
addColumnIfMissing("products", "imagePath", "TEXT");
addColumnIfMissing("products", "imageFileName", "TEXT");

db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_products_short_code_live
  ON products(licenseId, shortCode COLLATE NOCASE)
  WHERE shortCode IS NOT NULL
    AND shortCode <> ''
    AND COALESCE(deletedAt,'') = ''
`,
).run();

// Product Index
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_products_dirty 
  ON products(licenseId, updatedAt, syncedAt, deletedAt)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_products_isSynced 
  ON products(isSynced)`,
).run();

// --- Categories (master hierarchy table) ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    name TEXT NOT NULL,
    parentId TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    deletedAt TEXT,
    FOREIGN KEY (parentId) REFERENCES categories(id)
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_categories_license
   ON categories(licenseId, deletedAt)`,
).run();

// --- Brands (master table) ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    name TEXT NOT NULL,
    createdAt TEXT,
    updatedAt TEXT,
    deletedAt TEXT
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_brands_license
   ON brands(licenseId, deletedAt)`,
).run();

db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_unique_live
   ON brands(licenseId, name COLLATE NOCASE)
   WHERE deletedAt IS NULL OR deletedAt = ''`,
).run();

// ── Add sync columns to categories + brands ──────────────────────────────────
addColumnIfMissing("categories", "isSynced", "INTEGER DEFAULT 0");
addColumnIfMissing("categories", "syncedAt", "TEXT");
addColumnIfMissing("brands", "isSynced", "INTEGER DEFAULT 0");
addColumnIfMissing("brands", "syncedAt", "TEXT");

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_categories_dirty
  ON categories(licenseId, updatedAt, syncedAt, deletedAt)
`,
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_brands_dirty
  ON brands(licenseId, updatedAt, syncedAt, deletedAt)
`,
).run();

// --- Batches (lots) ---------------------------------------------------------
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS product_batches (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    productId TEXT NOT NULL,
    -- preferred keys for deduping decisions:
    barcode TEXT,              -- batch barcode (nullable)
    mrp REAL,                  -- MRP snapshot for this batch (nullable)
    salePrice REAL,            -- sale price snapshot for this batch (nullable)
    costPrice REAL,            -- cost snapshot (avg or last cost for this batch)
    batchNo TEXT,              -- vendor/print batch number (nullable)
    mfgDate TEXT,
    expiryDate TEXT,
    receivedAt TEXT,           -- when this batch was first received
    stock INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT,
    deletedAt TEXT,
    FOREIGN KEY (productId) REFERENCES products(id)
  )
`,
).run();

addColumnIfMissing("product_batches", "purchaseBatchNo", "TEXT");
addColumnIfMissing("product_batches", "purchaseId", "TEXT");
addColumnIfMissing(
  "product_batches",
  "isSystemGeneratedBarcode",
  "INTEGER DEFAULT 0",
);

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_batches_identity 
   ON product_batches(productId, batchNo, expiryDate, mfgDate, mrp, salePrice)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_batches_prod ON product_batches(productId, deletedAt)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_batches_barcode
   ON product_batches(licenseId, barcode)`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_batches_purchase_batch
   ON product_batches(licenseId, purchaseBatchNo, productId, deletedAt)`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_batches_purchase_id
   ON product_batches(purchaseId, productId, deletedAt)`,
).run();

try {
  db.prepare(`DROP INDEX IF EXISTS idx_batches_barcode_unique`).run();
} catch (_) {}

db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_barcode_unique_live
   ON product_batches(licenseId, barcode)
   WHERE barcode IS NOT NULL
     AND barcode <> ''
     AND COALESCE(deletedAt,'')=''`,
).run();

// Purchase Table
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    userId TEXT,
    licenseId TEXT NOT NULL,
    purchaseDate TEXT DEFAULT (datetime('now')),
    totalAmount REAL NOT NULL,
    discount REAL DEFAULT 0,
    createdAt TEXT,
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT
  )
`,
).run();

addColumnIfMissing("purchases", "slNo", "INTEGER");
addColumnIfMissing("purchases", "deletedAt", "TEXT");
addColumnIfMissing("purchases", "entryTime", "TEXT");
addColumnIfMissing("purchases", "supplierName", "TEXT");
addColumnIfMissing("purchases", "department", "TEXT");
addColumnIfMissing("purchases", "billNo", "TEXT");
addColumnIfMissing("purchases", "debitAccount", "TEXT");
addColumnIfMissing("purchases", "natureOfEntry", "TEXT");
addColumnIfMissing("purchases", "purchaseType", "TEXT");
addColumnIfMissing("purchases", "updatedAt", "TEXT");
addColumnIfMissing("purchases", "purchaseBatchNo", "TEXT");

// Purchase Index
db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_slno
   ON purchases(licenseId, slNo)`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchases_license_date ON purchases(licenseId, purchaseDate)`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchases_synced ON purchases(isSynced)`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchases_dirty 
  ON purchases(licenseId, updatedAt, syncedAt, deletedAt)`,
).run();

// --- Purchase Returns Table ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_returns (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    slNo INTEGER,
    userId TEXT,
    licenseId TEXT NOT NULL,
    supplierId TEXT,
    supplierName TEXT,
    billNo TEXT,
    department TEXT,
    debitAccount TEXT,
    natureOfEntry TEXT,
    returnDate TEXT DEFAULT (datetime('now')),
    entryTime TEXT,
    totalAmount REAL NOT NULL,
    discount REAL DEFAULT 0,
    purchaseType TEXT,       -- CASH or CREDIT (usually CREDIT for returns too)
    createdAt TEXT,
    updatedAt TEXT,
    isSynced INTEGER DEFAULT 0, 
    syncedAt TEXT,
    deletedAt TEXT
  )
`,
).run();

db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_returns_slno
  ON purchase_returns(licenseId, slNo)
`,
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_purchase_returns_license_date
  ON purchase_returns(licenseId, returnDate)
`,
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier
  ON purchase_returns(licenseId, supplierId)
`,
).run();

// --- Purchase Return Items Table ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_return_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    returnId TEXT NOT NULL,
    productId TEXT NOT NULL,
    barcode TEXT,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('KG','NOS','LTR','MTR')),
    rate REAL NOT NULL,
    mrp REAL,
    taxPercent TEXT NOT NULL CHECK (taxPercent IN ('NT','P5','P12','P18','P28')),
    taxAmount REAL NOT NULL,
    discount REAL DEFAULT 0,
    discountType TEXT,     -- 'ABS' | 'PCT'
    salePrice REAL,
    profit REAL,
    totalCost REAL NOT NULL,
    billedValue REAL,
    batchNo TEXT,
    mfgDate TEXT,
    expiryDate TEXT,
    lineNo INTEGER,
    createdAt TEXT,
    updatedAt TEXT,
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    deletedAt TEXT,
    FOREIGN KEY (returnId) REFERENCES purchase_returns(id) ON DELETE CASCADE
  )
`,
).run();

addColumnIfMissing("purchase_return_items", "effectiveUnitValue", "REAL");
addColumnIfMissing("purchase_return_items", "appliedQuantity", "INTEGER");
addColumnIfMissing("purchase_return_items", "overReturnQuantity", "INTEGER");
addColumnIfMissing("purchase_return_items", "overReturnReason", "TEXT");

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return
  ON purchase_return_items(returnId, lineNo)
`,
).run();

// --- Return sequence per license ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_return_sequence (
    licenseId TEXT PRIMARY KEY,
    lastSlNo INTEGER DEFAULT 0
  )
`,
).run();

// Purchase Items Table
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    purchaseId TEXT NOT NULL,
    productId TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('KG', 'NOS', 'LTR', 'MTR')),
    rate REAL NOT NULL,
    taxPercent TEXT NOT NULL CHECK (taxPercent IN ('NT', 'P5', 'P12', 'P18', 'P28')),
    taxAmount REAL NOT NULL,
    discount REAL DEFAULT 0,
    salePrice REAL,
    profit REAL,
    totalCost REAL NOT NULL,
    createdAt TEXT,
    updatedAt TEXT,
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    FOREIGN KEY (purchaseId) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (productId) REFERENCES products(id)
  )
`,
).run();

addColumnIfMissing("purchase_items", "deletedAt", "TEXT");
addColumnIfMissing("purchase_items", "barcode", "TEXT");
addColumnIfMissing("purchase_items", "mrp", "REAL");
addColumnIfMissing("purchase_items", "billedValue", "REAL");
addColumnIfMissing("purchase_items", "batchNo", "TEXT");
addColumnIfMissing("purchase_items", "mfgDate", "TEXT");
addColumnIfMissing("purchase_items", "expiryDate", "TEXT");
addColumnIfMissing("purchase_items", "discountType", "TEXT");
addColumnIfMissing("purchase_items", "lineNo", "INTEGER");
addColumnIfMissing("purchase_items", "isFree", "INTEGER DEFAULT 0");
addColumnIfMissing("purchase_items", "effectiveUnitValue", "REAL");
addColumnIfMissing("purchase_items", "purchaseBatchNo", "TEXT");

// Purchase Items Index
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchase_items_synced ON purchase_items(isSynced)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchaseId, lineNo)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchase_items_dirty 
  ON purchase_items(purchaseId, updatedAt, syncedAt, deletedAt)`,
).run();

// Code increment tracker for License
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS code_sequence (
    licenseId TEXT PRIMARY KEY,
    lastCodeNumber INTEGER DEFAULT 0
  )
`,
).run();

// slno increment tracker for License
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_sequence (
    licenseId TEXT PRIMARY KEY,
    lastSlNo INTEGER DEFAULT 0
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS sync_state (
    scope TEXT PRIMARY KEY,          
    lastPulledAt TEXT,               
    lastPushedAt TEXT               
  )
`,
).run();

// --- Suppliers ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    department TEXT,
    addressLine1 TEXT,
    addressLine2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    openingBalance REAL DEFAULT 0,  -- positive = we owe them
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    deletedAt TEXT
  )
`,
).run();

addColumnIfMissing("suppliers", "code", "TEXT");
addColumnIfMissing("suppliers", "codeNumber", "INTEGER");
addColumnIfMissing("suppliers", "category", "TEXT");
addColumnIfMissing("suppliers", "native", "TEXT");
addColumnIfMissing("suppliers", "language", "TEXT");
addColumnIfMissing("suppliers", "aadhaar", "TEXT");
addColumnIfMissing("suppliers", "pan", "TEXT");
addColumnIfMissing("suppliers", "license1", "TEXT");
addColumnIfMissing("suppliers", "license2", "TEXT");
addColumnIfMissing("suppliers", "settlementDays", "INTEGER");
addColumnIfMissing("suppliers", "creditLimit", "REAL");

db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_code
  ON suppliers(licenseId, code)
`,
).run();
db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_code_no
  ON suppliers(licenseId, codeNumber)
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS supplier_sequence (
    licenseId TEXT PRIMARY KEY,
    lastCodeNumber INTEGER DEFAULT 0
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_suppliers_license ON suppliers(licenseId, name)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_suppliers_synced ON suppliers(isSynced)`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_suppliers_dirty 
   ON suppliers(licenseId, updatedAt, syncedAt, deletedAt)`,
).run();

// --- Purchase Holds (drafts) ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_holds (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    userId TEXT,
    holdNo INTEGER NOT NULL,
    title TEXT,
    headerJson TEXT NOT NULL,  -- JSON.stringify(header)
    rowsJson   TEXT NOT NULL,  -- JSON.stringify(rows)
    createdAt TEXT,
    updatedAt TEXT,
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    deletedAt TEXT
  )
`,
).run();

db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_holds_no
  ON purchase_holds(licenseId, holdNo)
`,
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_purchase_holds_license
  ON purchase_holds(licenseId, createdAt)
`,
).run();

// Per-license sequence for holds
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_hold_sequence (
    licenseId TEXT PRIMARY KEY,
    lastHoldNo INTEGER DEFAULT 0
  )
`,
).run();

// --- Purchase Return Holds (drafts) ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_return_holds (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    userId TEXT,
    holdNo INTEGER NOT NULL,
    title TEXT,
    headerJson TEXT NOT NULL,  -- JSON.stringify(header)
    rowsJson   TEXT NOT NULL,  -- JSON.stringify(rows)
    createdAt TEXT,
    updatedAt TEXT,
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    deletedAt TEXT
  )
`,
).run();

db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_return_holds_no
  ON purchase_return_holds(licenseId, holdNo)
`,
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_purchase_return_holds_license
  ON purchase_return_holds(licenseId, createdAt)
`,
).run();

// Per-license sequence for return holds
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_return_hold_sequence (
    licenseId TEXT PRIMARY KEY,
    lastHoldNo INTEGER DEFAULT 0
  )
`,
).run();

// --- Supplier Ledger ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS supplier_transactions (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    supplierId TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('OPENING','PURCHASE','RETURN','PAYMENT','ADJUSTMENT')),
    refId TEXT,            -- e.g., purchaseId or paymentId
    refNo TEXT,            -- human-readable bill no / receipt no
    date TEXT NOT NULL,
    amount REAL NOT NULL,  -- positive number
    sign INTEGER NOT NULL CHECK(sign IN (1,-1)), -- +1 increases payable (we owe more); -1 decreases
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    deletedAt TEXT,
    FOREIGN KEY (supplierId) REFERENCES suppliers(id)
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_supl_tx_supplier ON supplier_transactions(licenseId, supplierId, date)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_supl_tx_synced ON supplier_transactions(isSynced)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_supl_tx_ref ON supplier_transactions(licenseId, kind, refId)`,
).run();

addColumnIfMissing("supplier_transactions", "chequeNo", "TEXT");
addColumnIfMissing("supplier_transactions", "chequeIssueDate", "TEXT");
addColumnIfMissing("supplier_transactions", "chequeClearanceDate", "TEXT");
addColumnIfMissing("supplier_transactions", "paymentStatus", "TEXT");

// --- Purchases: link supplier ---
addColumnIfMissing("purchases", "supplierId", "TEXT");
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(licenseId, supplierId)`,
).run();

// --- Cash Ledger ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS cash_transactions (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('OPENING','PURCHASE','SALE','PAYMENT','RECEIPT','ADJUSTMENT')),
    refId TEXT,            -- e.g., purchaseId or receiptId
    refNo TEXT,            -- human-readable bill/receipt no
    date TEXT NOT NULL,
    amount REAL NOT NULL,  -- positive number
    sign INTEGER NOT NULL CHECK(sign IN (1,-1)), -- -1 = cash out, +1 = cash in
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    deletedAt TEXT
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_cash_tx_license_date ON cash_transactions(licenseId, date)`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_cash_tx_synced ON cash_transactions(isSynced)`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_cash_tx_ref ON cash_transactions(licenseId, kind, refId)`,
).run();

// --- Supplier Bill Settlements (bill-wise) ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS supplier_bill_settlements (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    supplierId TEXT NOT NULL,
    paymentTxId TEXT NOT NULL,     -- points to supplier_transactions.id (kind='PAYMENT')
    purchaseId TEXT NOT NULL,      -- points to purchases.id
    amount REAL NOT NULL CHECK(amount >= 0),
    createdAt TEXT,
    FOREIGN KEY (paymentTxId) REFERENCES supplier_transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (purchaseId)  REFERENCES purchases(id) ON DELETE CASCADE
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_supl_settle_supplier ON supplier_bill_settlements(licenseId, supplierId)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_supl_settle_purchase ON supplier_bill_settlements(licenseId, purchaseId)`,
).run();

// Customer Bill Settlements (bill-wise receipts)
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS customer_bill_settlements (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    customerId TEXT NOT NULL,
    receiptTxId TEXT NOT NULL,
    saleId TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount >= 0),
    createdAt TEXT,
    FOREIGN KEY (receiptTxId) REFERENCES customer_transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_cust_settle_customer ON customer_bill_settlements(licenseId, customerId)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_cust_settle_sale ON customer_bill_settlements(licenseId, saleId)`,
).run();

// Cheque fields on customer_transactions
addColumnIfMissing("customer_transactions", "paymentStatus", "TEXT");
addColumnIfMissing("customer_transactions", "chequeNo", "TEXT");
addColumnIfMissing("customer_transactions", "chequeIssueDate", "TEXT");
addColumnIfMissing("customer_transactions", "chequeClearanceDate", "TEXT");

// --- SALES TABLES ----------------------------------------------------------

// Sales (header)
db.prepare(
  `
    CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    slNo INTEGER,
    userId TEXT,
    licenseId TEXT NOT NULL,
    customerId TEXT,
    customerName TEXT,
    billNo TEXT,
    department TEXT,
    debitAccount TEXT,
    natureOfEntry TEXT,
    saleDate TEXT DEFAULT (datetime('now')),
    entryTime TEXT,
    totalAmount REAL NOT NULL,
    discount REAL DEFAULT 0,
    saleType TEXT, -- CASH or CREDIT
    createdAt TEXT,
    updatedAt TEXT,
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    deletedAt TEXT
    )
`,
).run();

// Unique slno per license
db.prepare(
  `
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_slno
ON sales(licenseId, slNo)
`,
).run();

// Helpful indexes
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sales_license_date ON sales(licenseId, saleDate)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(licenseId, customerId)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales(isSynced)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sales_dirty ON sales(licenseId, createdAt, syncedAt, deletedAt)`,
).run();

// Sale items
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  saleId TEXT NOT NULL,
  productId TEXT NOT NULL,
  barcode TEXT,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('KG','NOS','LTR','MTR')),
  rate REAL NOT NULL,
  mrp REAL,
  taxPercent TEXT NOT NULL CHECK (taxPercent IN ('NT','P5','P12','P18','P28')),
  taxAmount REAL NOT NULL,
  discount REAL DEFAULT 0,
  discountType TEXT, -- 'ABS' | 'PCT'
  salePrice REAL,
  profit REAL,
  totalCost REAL NOT NULL, -- cost+tax before discount
  billedValue REAL, -- after item discount
  batchNo TEXT,
  mfgDate TEXT,
  expiryDate TEXT,
  lineNo INTEGER,
  createdAt TEXT,
  updatedAt TEXT,
  isSynced INTEGER DEFAULT 0,
  syncedAt TEXT,
  deletedAt TEXT,
  effectiveUnitValue REAL,
  isFree INTEGER DEFAULT 0,
  FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id)
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(saleId, lineNo)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_items_synced ON sale_items(isSynced)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_items_dirty ON sale_items(saleId, updatedAt, syncedAt, deletedAt)`,
).run();

// Per-license sequence for sales
db.prepare(
  `
CREATE TABLE IF NOT EXISTS sale_sequence (
licenseId TEXT PRIMARY KEY,
lastSlNo INTEGER DEFAULT 0
)
`,
).run();

// --- Sales Holds (drafts)
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS sale_holds (
  id TEXT PRIMARY KEY,
  licenseId TEXT NOT NULL,
  userId TEXT,
  holdNo INTEGER NOT NULL,
  title TEXT,
  headerJson TEXT NOT NULL,
  rowsJson TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  isSynced INTEGER DEFAULT 0,
  syncedAt TEXT,
  deletedAt TEXT
)
`,
).run();

db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_holds_no ON sale_holds(licenseId, holdNo)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_holds_license ON sale_holds(licenseId, createdAt)`,
).run();

db.prepare(
  `
CREATE TABLE IF NOT EXISTS sale_hold_sequence (
licenseId TEXT PRIMARY KEY,
lastHoldNo INTEGER DEFAULT 0
)
`,
).run();

// --- Sales Returns ---------------------------------------------------------
// Header
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS sale_returns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slNo INTEGER,
  userId TEXT,
  licenseId TEXT NOT NULL,
  customerId TEXT,
  customerName TEXT,
  billNo TEXT,
  department TEXT,
  debitAccount TEXT,
  natureOfEntry TEXT,
  returnDate TEXT DEFAULT (datetime('now')),
  entryTime TEXT,
  totalAmount REAL NOT NULL,
  discount REAL DEFAULT 0,
  saleType TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  isSynced INTEGER DEFAULT 0,
  syncedAt TEXT,
  deletedAt TEXT
  )
`,
).run();

db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_returns_slno ON sale_returns(licenseId, slNo)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_returns_license_date ON sale_returns(licenseId, returnDate)`,
).run();

// Items
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS sale_return_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  returnId TEXT NOT NULL,
  productId TEXT NOT NULL,
  barcode TEXT,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('KG','NOS','LTR','MTR')),
  rate REAL NOT NULL,
  mrp REAL,
  taxPercent TEXT NOT NULL CHECK (taxPercent IN ('NT','P5','P12','P18','P28')),
  taxAmount REAL NOT NULL,
  discount REAL DEFAULT 0,
  discountType TEXT,
  salePrice REAL,
  profit REAL,
  totalCost REAL NOT NULL,
  billedValue REAL,
  batchNo TEXT,
  mfgDate TEXT,
  expiryDate TEXT,
  lineNo INTEGER,
  createdAt TEXT,
  updatedAt TEXT,
  isSynced INTEGER DEFAULT 0,
  syncedAt TEXT,
  deletedAt TEXT,
  effectiveUnitValue REAL,
  appliedQuantity INTEGER,
  overReturnQuantity INTEGER,
  overReturnReason TEXT,
  FOREIGN KEY (returnId) REFERENCES sale_returns(id) ON DELETE CASCADE
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON sale_return_items(returnId, lineNo)`,
).run();

addColumnIfMissing("purchase_items", "batchId", "TEXT");
addColumnIfMissing("sale_items", "batchId", "TEXT");
addColumnIfMissing("purchase_return_items", "batchId", "TEXT");
addColumnIfMissing("sale_return_items", "batchId", "TEXT");

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_pi_batch ON purchase_items(batchId)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_si_batch ON sale_items(batchId)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_pri_batch ON purchase_return_items(batchId)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sri_batch ON sale_return_items(batchId)`,
).run();

// Per-license sequence for returns
db.prepare(
  `
CREATE TABLE IF NOT EXISTS sale_return_sequence (
  licenseId TEXT PRIMARY KEY,
  lastSlNo INTEGER DEFAULT 0
)
`,
).run();

// --- Customers (parallel to suppliers) ------------------------------------
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  licenseId TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  category TEXT,
  addressLine1 TEXT,
  addressLine2 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  openingBalance REAL DEFAULT 0, -- positive = customer owes us
  notes TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  isSynced INTEGER DEFAULT 0,
  syncedAt TEXT,
  deletedAt TEXT
  )
`,
).run();

addColumnIfMissing("customers", "code", "TEXT");
addColumnIfMissing("customers", "codeNumber", "INTEGER");

db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_code ON customers(licenseId, code)`,
).run();
db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_code_no ON customers(licenseId, codeNumber)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_customers_license ON customers(licenseId, name)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_customers_synced ON customers(isSynced)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_customers_dirty ON customers(licenseId, updatedAt, syncedAt, deletedAt)`,
).run();

// Customer code sequence
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS customer_sequence (
  licenseId TEXT PRIMARY KEY,
  lastCodeNumber INTEGER DEFAULT 0
  )
`,
).run();

// Customer ledger (parallel to supplier_transactions)
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS customer_transactions (
  id TEXT PRIMARY KEY,
  licenseId TEXT NOT NULL,
  customerId TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('OPENING','SALE','RETURN','RECEIPT','ADJUSTMENT')),
  refId TEXT,
  refNo TEXT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  sign INTEGER NOT NULL CHECK(sign IN (1,-1)),
  notes TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  isSynced INTEGER DEFAULT 0,
  syncedAt TEXT,
  deletedAt TEXT,
  FOREIGN KEY (customerId) REFERENCES customers(id)
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_cust_tx_customer ON customer_transactions(licenseId, customerId, date)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_cust_tx_synced ON customer_transactions(isSynced)`,
).run();

// ====== ACCOUNTING MASTER TABLES ======

// Account Groups (schedules/sub-schedules)
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS account_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    parentId TEXT,
    nature TEXT NOT NULL CHECK (nature IN ('ASSET','LIABILITY','INCOME','EXPENSE')),
    isSystem INTEGER DEFAULT 1,
    FOREIGN KEY (parentId) REFERENCES account_groups(id)
  )
`,
).run();

addColumnIfMissing("account_groups", "code", "TEXT");
addColumnIfMissing("account_groups", "section", "TEXT"); // 'ASSET'|'LIABILITY'|'PL'|'TRADING'
addColumnIfMissing("account_groups", "sortOrder", "INTEGER");
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_ag_section_sort ON account_groups(section, sortOrder)`,
).run();

// Accounts
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,                    -- optional short code (unique per license)
    groupId TEXT NOT NULL,        -- points to a sub-schedule group
    isSystem INTEGER DEFAULT 0,
    taxType TEXT,                 -- 'INPUT'|'OUTPUT'|NULL (for GST ledgers; optional)
    gstComponent TEXT,            -- 'CGST'|'SGST'|'IGST'|NULL (optional)
    rate REAL,                    -- 2.5|5|12|18|28|NULL (optional)
    createdAt TEXT,
    updatedAt TEXT,
    deletedAt TEXT,
    UNIQUE (licenseId, name),
    FOREIGN KEY (groupId) REFERENCES account_groups(id)
  )
`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_accounts_license ON accounts(licenseId, name)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_accounts_group ON accounts(groupId)`,
).run();
db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_license_code ON accounts(licenseId, code)`,
).run();

// General Journal
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    date TEXT NOT NULL,
    refType TEXT,   -- 'PURCHASE','SALE','PR','SR','PAYMENT','RECEIPT','ADJUSTMENT'
    refId TEXT,
    narration TEXT,
    createdAt TEXT,
    postedBy TEXT
  )
`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_journal_entries_license_date ON journal_entries(licenseId, date)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_journal_entries_ref ON journal_entries(licenseId, refType, refId)`,
).run();

// General Journal
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS journal_lines (
    id TEXT PRIMARY KEY,
    entryId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    debit REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0,
    lineNo INTEGER,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (entryId) REFERENCES journal_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (accountId) REFERENCES accounts(id),
    CHECK ( (debit = 0 AND credit > 0) OR (credit = 0 AND debit > 0) )
  )
`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entryId, lineNo)`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(accountId)`,
).run();

// posting rules
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS posting_rules (
    id TEXT PRIMARY KEY,
    event TEXT NOT NULL,          -- 'PURCHASE','SALE','PURCHASE_RETURN','SALE_RETURN'
    taxMode TEXT,                 -- 'INTRA'|'INTER'|NULL
    lineRole TEXT NOT NULL,       -- 'STOCK/COS','REVENUE','CASH/BANK','DEBTOR','CREDITOR','INPUT_TAX','OUTPUT_TAX','ROUNDING'
    accountSelector TEXT NOT NULL -- free-form selector (future use)
  )
`,
).run();

// Opening balances & meta
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS account_opening_balances (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    fyStart TEXT NOT NULL,                 -- e.g., '2025-04-01'
    amount REAL NOT NULL DEFAULT 0,
    side TEXT NOT NULL CHECK (side IN ('DR','CR')),
    asOfDate TEXT NOT NULL,
    createdAt TEXT,
    updatedAt TEXT,
    UNIQUE(accountId, fyStart),
    FOREIGN KEY (accountId) REFERENCES accounts(id)
  )
`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_aob_account ON account_opening_balances(accountId, fyStart)`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS account_meta (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (accountId) REFERENCES accounts(id)
  )
`,
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_am_account ON account_meta(accountId, key)`,
).run();
// --- TAX MASTER ------------------------------------------------------------

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS tax_categories (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    code TEXT NOT NULL,           -- short code: NT, P5, P12, P18, P28, V1 etc
    name TEXT NOT NULL,           -- display name
    rate REAL NOT NULL,           -- total rate (e.g. 0, 5, 12, 18, 28)
    isInterstate INTEGER DEFAULT 0, -- 0 intra, 1 inter (like *12-I rows in your screenshot)
    cessRate REAL,                -- optional
    calcMethod TEXT DEFAULT 'FIXED', -- 'FIXED' | future variants
    createdAt TEXT, updatedAt TEXT,
    UNIQUE(licenseId, code)
  )
`,
).run();

// ── Tax category sync columns ─────────────────────────────────────────────────
addColumnIfMissing("tax_categories", "isSynced", "INTEGER DEFAULT 0");
addColumnIfMissing("tax_categories", "syncedAt", "TEXT");
addColumnIfMissing("tax_categories", "deletedAt", "TEXT");

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_tax_categories_dirty
  ON tax_categories(licenseId, updatedAt, syncedAt, deletedAt)
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS tax_category_components (
    id TEXT PRIMARY KEY,
    categoryId TEXT NOT NULL,
    component TEXT NOT NULL CHECK(component IN('CGST','SGST','IGST','CESS')),
    rate REAL NOT NULL,           -- component rate, e.g. 9 for CGST 9%
    createdAt TEXT, updatedAt TEXT,
    FOREIGN KEY (categoryId) REFERENCES tax_categories(id) ON DELETE CASCADE
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS tax_category_defaults (
    id TEXT PRIMARY KEY,
    categoryId TEXT NOT NULL,
    -- default heads (optional): can be NULL if you want engine to auto-pick
    salesAccountId TEXT,
    purchaseAccountId TEXT,
    salesReturnAccountId TEXT,
    purchaseReturnAccountId TEXT,
    -- explicit OUTPUT/INPUT tax heads for each component:
    outputCgstAccountId TEXT,
    outputSgstAccountId TEXT,
    outputIgstAccountId TEXT,
    inputCgstAccountId  TEXT,
    inputSgstAccountId  TEXT,
    inputIgstAccountId  TEXT,
    cessAccountId       TEXT,
    singleTaxAccountId  TEXT, -- if you keep a single combined tax ledger model
    createdAt TEXT, updatedAt TEXT,
    UNIQUE(categoryId),
    FOREIGN KEY (categoryId) REFERENCES tax_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (salesAccountId) REFERENCES accounts(id),
    FOREIGN KEY (purchaseAccountId) REFERENCES accounts(id),
    FOREIGN KEY (salesReturnAccountId) REFERENCES accounts(id),
    FOREIGN KEY (purchaseReturnAccountId) REFERENCES accounts(id),
    FOREIGN KEY (outputCgstAccountId) REFERENCES accounts(id),
    FOREIGN KEY (outputSgstAccountId) REFERENCES accounts(id),
    FOREIGN KEY (outputIgstAccountId) REFERENCES accounts(id),
    FOREIGN KEY (inputCgstAccountId)  REFERENCES accounts(id),
    FOREIGN KEY (inputSgstAccountId)  REFERENCES accounts(id),
    FOREIGN KEY (inputIgstAccountId)  REFERENCES accounts(id),
    FOREIGN KEY (cessAccountId)       REFERENCES accounts(id),
    FOREIGN KEY (singleTaxAccountId)  REFERENCES accounts(id)
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS tax_code_map (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    productTaxCode TEXT NOT NULL, -- 'NT','P5','P12','P18','P28'
    categoryId TEXT NOT NULL,
    UNIQUE(licenseId, productTaxCode),
    FOREIGN KEY (categoryId) REFERENCES tax_categories(id)
  )
`,
).run();

try {
  db.prepare(
    `
    UPDATE tax_category_defaults
    SET salesReturnAccountId    = COALESCE(salesReturnAccountId,    salesAccountId),
        purchaseReturnAccountId = COALESCE(purchaseReturnAccountId, purchaseAccountId)
  `,
  ).run();
} catch (_) {}

// --- One-time migration: seed default batches from products.stock / products.barcode
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    ranAt TEXT
  )
`,
).run();

const alreadyRan = db
  .prepare(
    `SELECT 1 FROM _migrations WHERE name='seed_default_batches_v1' LIMIT 1`,
  )
  .get();

if (!alreadyRan) {
  const ts = new Date().toISOString();
  const uuidv4 = require("uuid").v4;

  const products = db
    .prepare(
      `
    SELECT id, licenseId, barcode, salePrice, costPrice, stock
    FROM products
    WHERE COALESCE(deletedAt,'')=''
  `,
    )
    .all();

  const insBatch = db.prepare(`
    INSERT INTO product_batches(
      id, licenseId, productId, barcode, mrp, salePrice, costPrice,
      batchNo, mfgDate, expiryDate, receivedAt, stock, createdAt, updatedAt
    ) VALUES (@id, @licenseId, @productId, @barcode, NULL, @salePrice, @costPrice,
              NULL, NULL, NULL, @receivedAt, @stock, @ts, @ts)
  `);

  const updProductSet = db.prepare(`
   UPDATE products
   SET stock = @stock, updatedAt = @ts
   WHERE id = @id
 `);

  const hasAnyBatch = db.prepare(`
    SELECT 1 FROM product_batches
    WHERE productId = ? AND COALESCE(deletedAt,'')='' LIMIT 1
  `);

  const trx = db.transaction(() => {
    for (const p of products) {
      const qty = Number(p.stock || 0);
      const needsSeed = !hasAnyBatch.get(p.id) && (qty > 0 || p.barcode);

      if (needsSeed) {
        insBatch.run({
          id: uuidv4(),
          licenseId: p.licenseId,
          productId: p.id,
          // move legacy product barcode to the initial batch; keep NULL if none
          barcode: p.barcode ?? null,
          salePrice: p.salePrice ?? null,
          costPrice: p.costPrice ?? null,
          receivedAt: ts,
          stock: qty,
          ts,
        });
      }

      // During transition, keep products.stock aligned with seeded batch stock.
      // Long term, products.stock should be treated as a derived cache from batches.
      updProductSet.run({ id: p.id, ts, stock: qty });
    }

    db.prepare(
      `INSERT INTO _migrations(name, ranAt) VALUES('seed_default_batches_v1', @ts)`,
    ).run({ ts });
  });

  trx();
}

// --- Global Barcode Sequence ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS barcode_sequence (
    licenseId TEXT PRIMARY KEY,
    lastBarcodeNumber INTEGER DEFAULT 0
  )
`,
).run();

const legacyProductBarcodeCleanupRan = db
  .prepare(
    `SELECT 1 FROM _migrations WHERE name='cleanup_legacy_product_barcodes_v3' LIMIT 1`,
  )
  .get();

if (!legacyProductBarcodeCleanupRan) {
  try {
    const ts = new Date().toISOString();
    const uuidv4 = require("uuid").v4;

    const rows = db
      .prepare(
        `
        SELECT id, licenseId, barcode, salePrice, costPrice
        FROM products
        WHERE COALESCE(deletedAt,'')=''
          AND barcode IS NOT NULL
          AND barcode <> ''
      `,
      )
      .all();

    const hasLiveBatchWithSameBarcode = db.prepare(`
      SELECT 1
      FROM product_batches
      WHERE licenseId=?
        AND productId=?
        AND barcode=?
        AND COALESCE(deletedAt,'')=''
      LIMIT 1
    `);

    const insertZeroStockBatch = db.prepare(`
      INSERT INTO product_batches(
        id, licenseId, productId, barcode, mrp, salePrice, costPrice,
        batchNo, mfgDate, expiryDate, receivedAt, stock, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, ?, 0, ?, ?)
    `);

    const clearProductBarcode = db.prepare(`
      UPDATE products
      SET barcode=NULL, updatedAt=?, isSynced=0, syncedAt=NULL
      WHERE id=?
    `);

    db.transaction(() => {
      for (const p of rows) {
        const exists = hasLiveBatchWithSameBarcode.get(
          p.licenseId,
          p.id,
          p.barcode,
        );

        if (!exists) {
          insertZeroStockBatch.run(
            uuidv4(),
            p.licenseId,
            p.id,
            p.barcode,
            p.salePrice ?? null,
            p.costPrice ?? null,
            ts,
            ts,
            ts,
          );
        }

        clearProductBarcode.run(ts, p.id);
      }

      db.prepare(
        `INSERT INTO _migrations(name, ranAt) VALUES('cleanup_legacy_product_barcodes_v3', ?)`,
      ).run(ts);
    })();

    console.log("[db] cleanup_legacy_product_barcodes_v3 completed");
  } catch (e) {
    console.error("[db] cleanup_legacy_product_barcodes_v3 failed:", e);
  }
}

const markLegacyGeneratedBarcodesRan = db
  .prepare(
    `SELECT 1 FROM _migrations WHERE name='mark_legacy_generated_barcodes_v1' LIMIT 1`,
  )
  .get();

if (!markLegacyGeneratedBarcodesRan) {
  try {
    const ts = new Date().toISOString();

    db.prepare(
      `
      UPDATE product_batches
      SET isSystemGeneratedBarcode = 1
      WHERE (isSystemGeneratedBarcode IS NULL OR isSystemGeneratedBarcode = 0)
        AND barcode IS NOT NULL
        AND length(barcode) = 5
        AND barcode GLOB '[0-9][0-9][0-9][0-9][0-9]'
        AND COALESCE(deletedAt,'') = ''
    `,
    ).run();

    db.prepare(
      `INSERT INTO _migrations(name, ranAt) VALUES('mark_legacy_generated_barcodes_v1', ?)`,
    ).run(ts);

    console.log("[db] mark_legacy_generated_barcodes_v1 completed");
  } catch (e) {
    console.error("[db] mark_legacy_generated_barcodes_v1 failed:", e);
  }
}

const recalcBarcodeSequenceRan = db
  .prepare(
    `SELECT 1 FROM _migrations WHERE name='recalc_barcode_sequence_v3' LIMIT 1`,
  )
  .get();

if (!recalcBarcodeSequenceRan) {
  try {
    const ts = new Date().toISOString();

    const licenses = db
      .prepare(
        `
        SELECT licenseId FROM product_batches
        UNION
        SELECT licenseId FROM barcode_sequence
        UNION
        SELECT licenseId FROM products
      `,
      )
      .all();

    const maxBatchStmt = db.prepare(`
      SELECT MAX(CAST(barcode AS INTEGER)) AS mx
      FROM product_batches
      WHERE licenseId=?
        AND barcode IS NOT NULL
        AND barcode <> ''
        AND barcode GLOB '[0-9]*'
        AND barcode NOT GLOB '*[^0-9]*'
        AND COALESCE(deletedAt,'')=''
    `);

    const upsertSeq = db.prepare(`
      INSERT INTO barcode_sequence (licenseId, lastBarcodeNumber)
      VALUES (?, ?)
      ON CONFLICT(licenseId) DO UPDATE SET
        lastBarcodeNumber = excluded.lastBarcodeNumber
    `);

    db.transaction(() => {
      for (const { licenseId } of licenses) {
        const maxFromBatches = Number(maxBatchStmt.get(licenseId)?.mx || 0);
        upsertSeq.run(licenseId, maxFromBatches);
      }

      db.prepare(
        `INSERT INTO _migrations(name, ranAt) VALUES('recalc_barcode_sequence_v3', ?)`,
      ).run(ts);
    })();

    console.log("[db] recalc_barcode_sequence_v3 completed");
  } catch (e) {
    console.error("[db] recalc_barcode_sequence_v3 failed:", e);
  }
}

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS shop_settings (
    licenseId TEXT PRIMARY KEY,
    shopName TEXT NOT NULL,
    logoDataUrl TEXT,
    addressLine1 TEXT,
    addressLine2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    mobile TEXT,
    email TEXT,
    gstin TEXT,
    footerNote TEXT,
    authorizedSignatory TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )
`,
).run();

// ── Shop settings sync columns ────────────────────────────────────────────────
addColumnIfMissing("shop_settings", "isSynced", "INTEGER DEFAULT 0");
addColumnIfMissing("shop_settings", "syncedAt", "TEXT");
addColumnIfMissing("shop_settings", "logoUrl", "TEXT");

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS label_printers (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    name TEXT NOT NULL,
    engine TEXT NOT NULL,          -- BARTENDER | ZPL | HTML
    printerName TEXT NOT NULL,
    connectionType TEXT,           -- WINDOWS | NETWORK
    host TEXT,
    port INTEGER,
    dpi INTEGER,
    isDefault INTEGER DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT,
    deletedAt TEXT
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS label_templates (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    name TEXT NOT NULL,
    engine TEXT NOT NULL,          -- BARTENDER | ZPL
    templatePath TEXT NOT NULL,
    widthMm REAL,
    heightMm REAL,
    defaultPrinterId TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    deletedAt TEXT
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS label_template_mappings (
    id TEXT PRIMARY KEY,
    templateId TEXT NOT NULL,
    appField TEXT NOT NULL,        -- barcode, itemName, salePrice, mrp
    externalField TEXT NOT NULL,   -- BarcodeValue, ItemName, Price
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (templateId) REFERENCES label_templates(id) ON DELETE CASCADE
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS label_print_jobs (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    templateId TEXT,
    printerId TEXT,
    engine TEXT NOT NULL,
    status TEXT NOT NULL,          -- PENDING | SUCCESS | FAILED
    payloadJson TEXT NOT NULL,
    errorText TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )
`,
).run();

// ── Units master table ──────────────────────────────────────────────────────
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    licenseId TEXT NOT NULL,
    code TEXT NOT NULL,
    label TEXT NOT NULL,
    isDefault INTEGER DEFAULT 0,
    sortOrder INTEGER DEFAULT 999,
    createdAt TEXT,
    updatedAt TEXT,
    deletedAt TEXT,
    UNIQUE(licenseId, code)
  )
`,
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_units_license
  ON units(licenseId, deletedAt)
`,
).run();

addColumnIfMissing("units", "isSynced", "INTEGER DEFAULT 0");
addColumnIfMissing("units", "syncedAt", "TEXT");

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_units_dirty
  ON units(licenseId, updatedAt, syncedAt, deletedAt)
`,
).run();

// ── Transaction Types Master ─────────────────────────────────────────────────
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS transaction_types (
    id       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    licenseId TEXT NOT NULL,
    name      TEXT NOT NULL,
    code      TEXT,
    category  TEXT NOT NULL CHECK (category IN ('sale','purchase','saleReturn','purchaseReturn')),
    isDefault INTEGER DEFAULT 0,
    sortOrder INTEGER DEFAULT 999,
    createdAt TEXT,
    updatedAt TEXT,
    deletedAt TEXT,
    UNIQUE(licenseId, category, name)
  )
`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_txn_types_license
   ON transaction_types(licenseId, category, isDefault)`,
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_txn_types_dirty
   ON transaction_types(licenseId, updatedAt, deletedAt)`,
).run();

db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_types_code_live
  ON transaction_types(licenseId, category, code)
  WHERE code IS NOT NULL
    AND code <> ''
    AND COALESCE(deletedAt,'') = ''
`,
).run();

addColumnIfMissing("transaction_types", "isSynced", "INTEGER DEFAULT 0");
addColumnIfMissing("transaction_types", "syncedAt", "TEXT");

// ── Add typeId to all four transaction headers ───────────────────────────────
addColumnIfMissing("sales", "typeId", "TEXT");
addColumnIfMissing("purchases", "typeId", "TEXT");
addColumnIfMissing("sale_returns", "typeId", "TEXT");
addColumnIfMissing("purchase_returns", "typeId", "TEXT");

// ── Seed default transaction types per existing license ──────────────────────
const seedTxnTypesRan = db
  .prepare(`SELECT 1 FROM _migrations WHERE name='seed_txn_types_v1' LIMIT 1`)
  .get();

if (!seedTxnTypesRan) {
  try {
    const ts = new Date().toISOString();
    const { v4: uuidv4 } = require("uuid");

    // Collect every licenseId we know about across all major tables
    const licenses = db
      .prepare(
        `
      SELECT licenseId FROM sales
      UNION SELECT licenseId FROM purchases
      UNION SELECT licenseId FROM sale_returns
      UNION SELECT licenseId FROM purchase_returns
      UNION SELECT licenseId FROM products
    `,
      )
      .all()
      .map((r) => r.licenseId);

    const defaults = [
      { category: "purchase", name: "Purchase", code: "PUR" },
      { category: "sale", name: "Sales", code: "SAL" },
      { category: "purchaseReturn", name: "Purchase Return", code: "PRN" },
      { category: "saleReturn", name: "Sale Return", code: "SRN" },
    ];

    const insert = db.prepare(`
      INSERT OR IGNORE INTO transaction_types
        (id, licenseId, name, code, category, isDefault, sortOrder, createdAt, updatedAt, isSynced)
      VALUES
        (?, ?, ?, ?, ?, 1, 1, ?, ?, 0)
    `);

    db.transaction(() => {
      for (const licenseId of licenses) {
        for (const d of defaults) {
          insert.run(uuidv4(), licenseId, d.name, d.code, d.category, ts, ts);
        }
      }
      db.prepare(
        `INSERT INTO _migrations(name, ranAt) VALUES('seed_txn_types_v1', ?)`,
      ).run(ts);
    })();

    console.log("[db] seed_txn_types_v1 completed");
  } catch (e) {
    console.error("[db] seed_txn_types_v1 failed:", e);
  }
}

// ── Migration: remove hard-coded unit CHECK constraints ─────────────────────
// SQLite can't ALTER CHECK constraints — we must recreate the affected tables.
const removeUnitCheckRan = db
  .prepare(
    `SELECT 1 FROM _migrations WHERE name='remove_unit_check_v1' LIMIT 1`,
  )
  .get();

if (!removeUnitCheckRan) {
  const ts = new Date().toISOString();

  db.pragma("foreign_keys = OFF");

  try {
    db.transaction(() => {
      // ── products ──────────────────────────────────────────────────────────
      db.prepare(
        `
        CREATE TABLE products_new (
          id TEXT PRIMARY KEY,
          licenseId TEXT NOT NULL,
          code TEXT NOT NULL,
          codeNumber INTEGER NOT NULL,
          name TEXT NOT NULL,
          brand TEXT,
          category TEXT,
          subcategory TEXT,
          productName TEXT,
          model TEXT,
          size TEXT,
          shortCode TEXT,
          unit TEXT NOT NULL,
          tax TEXT NOT NULL CHECK (tax IN ('NT','P5','P12','P18','P28')),
          hsn TEXT,
          costPrice REAL NOT NULL,
          salePrice REAL,
          stock INTEGER DEFAULT 0,
          barcode TEXT,
          imagePath TEXT,
          imageFileName TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          deletedAt TEXT,
          isSynced INTEGER DEFAULT 0,
          syncedAt TEXT,
          UNIQUE(licenseId, code),
          UNIQUE(licenseId, codeNumber)
        )
      `,
      ).run();
      db.prepare(
        `
        INSERT INTO products_new
        SELECT id,licenseId,code,codeNumber,name,brand,category,
               subcategory,productName,model,size,shortCode,
               unit,tax,hsn,costPrice,salePrice,stock,barcode,
               imagePath,imageFileName,createdAt,updatedAt,deletedAt,isSynced,syncedAt
        FROM products
      `,
      ).run();
      db.prepare(`DROP TABLE products`).run();
      db.prepare(`ALTER TABLE products_new RENAME TO products`).run();

      // ── purchase_items ────────────────────────────────────────────────────
      db.prepare(
        `
        CREATE TABLE purchase_items_new (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          purchaseId TEXT NOT NULL,
          productId TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit TEXT NOT NULL,
          rate REAL NOT NULL,
          taxPercent TEXT NOT NULL CHECK (taxPercent IN ('NT','P5','P12','P18','P28')),
          taxAmount REAL NOT NULL,
          discount REAL DEFAULT 0,
          discountType TEXT,
          salePrice REAL,
          profit REAL,
          totalCost REAL NOT NULL,
          billedValue REAL,
          mrp REAL,
          barcode TEXT,
          batchNo TEXT,
          batchId TEXT,
          mfgDate TEXT,
          expiryDate TEXT,
          lineNo INTEGER,
          isFree INTEGER DEFAULT 0,
          effectiveUnitValue REAL,
          purchaseBatchNo TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          deletedAt TEXT,
          isSynced INTEGER DEFAULT 0,
          syncedAt TEXT,
          FOREIGN KEY (purchaseId) REFERENCES purchases(id) ON DELETE CASCADE,
          FOREIGN KEY (productId) REFERENCES products(id)
        )
      `,
      ).run();
      db.prepare(
        `
        INSERT INTO purchase_items_new
        SELECT id,purchaseId,productId,quantity,unit,rate,taxPercent,taxAmount,
               discount,discountType,salePrice,profit,totalCost,billedValue,mrp,
               barcode,batchNo,batchId,mfgDate,expiryDate,lineNo,isFree,
               effectiveUnitValue,purchaseBatchNo,createdAt,updatedAt,deletedAt,isSynced,syncedAt
        FROM purchase_items
      `,
      ).run();
      db.prepare(`DROP TABLE purchase_items`).run();
      db.prepare(
        `ALTER TABLE purchase_items_new RENAME TO purchase_items`,
      ).run();

      // ── sale_items ────────────────────────────────────────────────────────
      db.prepare(
        `
        CREATE TABLE sale_items_new (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          saleId TEXT NOT NULL,
          productId TEXT NOT NULL,
          barcode TEXT,
          quantity INTEGER NOT NULL,
          unit TEXT NOT NULL,
          rate REAL NOT NULL,
          mrp REAL,
          taxPercent TEXT NOT NULL CHECK (taxPercent IN ('NT','P5','P12','P18','P28')),
          taxAmount REAL NOT NULL,
          discount REAL DEFAULT 0,
          discountType TEXT,
          salePrice REAL,
          profit REAL,
          totalCost REAL NOT NULL,
          billedValue REAL,
          batchNo TEXT,
          batchId TEXT,
          mfgDate TEXT,
          expiryDate TEXT,
          lineNo INTEGER,
          effectiveUnitValue REAL,
          isFree INTEGER DEFAULT 0,
          createdAt TEXT,
          updatedAt TEXT,
          deletedAt TEXT,
          isSynced INTEGER DEFAULT 0,
          syncedAt TEXT,
          FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (productId) REFERENCES products(id)
        )
      `,
      ).run();
      db.prepare(
        `
        INSERT INTO sale_items_new
        SELECT id,saleId,productId,barcode,quantity,unit,rate,mrp,taxPercent,taxAmount,
               discount,discountType,salePrice,profit,totalCost,billedValue,batchNo,
               batchId,mfgDate,expiryDate,lineNo,effectiveUnitValue,isFree,
               createdAt,updatedAt,deletedAt,isSynced,syncedAt
        FROM sale_items
      `,
      ).run();
      db.prepare(`DROP TABLE sale_items`).run();
      db.prepare(`ALTER TABLE sale_items_new RENAME TO sale_items`).run();

      // ── purchase_return_items ─────────────────────────────────────────────
      db.prepare(
        `
        CREATE TABLE purchase_return_items_new (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          returnId TEXT NOT NULL,
          productId TEXT NOT NULL,
          barcode TEXT,
          quantity INTEGER NOT NULL,
          unit TEXT NOT NULL,
          rate REAL NOT NULL,
          mrp REAL,
          taxPercent TEXT NOT NULL CHECK (taxPercent IN ('NT','P5','P12','P18','P28')),
          taxAmount REAL NOT NULL,
          discount REAL DEFAULT 0,
          discountType TEXT,
          salePrice REAL,
          profit REAL,
          totalCost REAL NOT NULL,
          billedValue REAL,
          batchNo TEXT,
          batchId TEXT,
          mfgDate TEXT,
          expiryDate TEXT,
          lineNo INTEGER,
          effectiveUnitValue REAL,
          appliedQuantity INTEGER,
          overReturnQuantity INTEGER,
          overReturnReason TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          deletedAt TEXT,
          isSynced INTEGER DEFAULT 0,
          syncedAt TEXT,
          FOREIGN KEY (returnId) REFERENCES purchase_returns(id) ON DELETE CASCADE
        )
      `,
      ).run();
      db.prepare(
        `
        INSERT INTO purchase_return_items_new
        SELECT id,returnId,productId,barcode,quantity,unit,rate,mrp,taxPercent,taxAmount,
               discount,discountType,salePrice,profit,totalCost,billedValue,batchNo,
               batchId,mfgDate,expiryDate,lineNo,effectiveUnitValue,appliedQuantity,
               overReturnQuantity,overReturnReason,createdAt,updatedAt,deletedAt,isSynced,syncedAt
        FROM purchase_return_items
      `,
      ).run();
      db.prepare(`DROP TABLE purchase_return_items`).run();
      db.prepare(
        `ALTER TABLE purchase_return_items_new RENAME TO purchase_return_items`,
      ).run();

      // ── sale_return_items ─────────────────────────────────────────────────
      db.prepare(
        `
        CREATE TABLE sale_return_items_new (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          returnId TEXT NOT NULL,
          productId TEXT NOT NULL,
          barcode TEXT,
          quantity INTEGER NOT NULL,
          unit TEXT NOT NULL,
          rate REAL NOT NULL,
          mrp REAL,
          taxPercent TEXT NOT NULL CHECK (taxPercent IN ('NT','P5','P12','P18','P28')),
          taxAmount REAL NOT NULL,
          discount REAL DEFAULT 0,
          discountType TEXT,
          salePrice REAL,
          profit REAL,
          totalCost REAL NOT NULL,
          billedValue REAL,
          batchNo TEXT,
          batchId TEXT,
          mfgDate TEXT,
          expiryDate TEXT,
          lineNo INTEGER,
          effectiveUnitValue REAL,
          appliedQuantity INTEGER,
          overReturnQuantity INTEGER,
          overReturnReason TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          deletedAt TEXT,
          isSynced INTEGER DEFAULT 0,
          syncedAt TEXT,
          FOREIGN KEY (returnId) REFERENCES sale_returns(id) ON DELETE CASCADE
        )
      `,
      ).run();
      db.prepare(
        `
        INSERT INTO sale_return_items_new
        SELECT id,returnId,productId,barcode,quantity,unit,rate,mrp,taxPercent,taxAmount,
               discount,discountType,salePrice,profit,totalCost,billedValue,batchNo,
               batchId,mfgDate,expiryDate,lineNo,effectiveUnitValue,appliedQuantity,
               overReturnQuantity,overReturnReason,createdAt,updatedAt,deletedAt,isSynced,syncedAt
        FROM sale_return_items
      `,
      ).run();
      db.prepare(`DROP TABLE sale_return_items`).run();
      db.prepare(
        `ALTER TABLE sale_return_items_new RENAME TO sale_return_items`,
      ).run();

      // ── Recreate all dropped indexes ──────────────────────────────────────
      // products
      db.prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_products_short_code_live ON products(licenseId, shortCode COLLATE NOCASE) WHERE shortCode IS NOT NULL AND shortCode <> '' AND COALESCE(deletedAt,'') = ''`,
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_products_dirty ON products(licenseId, updatedAt, syncedAt, deletedAt)`,
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_products_isSynced ON products(isSynced)`,
      ).run();
      // purchase_items
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_purchase_items_synced ON purchase_items(isSynced)`,
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchaseId, lineNo)`,
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_purchase_items_dirty ON purchase_items(purchaseId, updatedAt, syncedAt, deletedAt)`,
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_pi_batch ON purchase_items(batchId)`,
      ).run();
      // sale_items
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(saleId, lineNo)`,
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_sale_items_synced ON sale_items(isSynced)`,
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_sale_items_dirty ON sale_items(saleId, updatedAt, syncedAt, deletedAt)`,
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_si_batch ON sale_items(batchId)`,
      ).run();
      // purchase_return_items
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items(returnId, lineNo)`,
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_pri_batch ON purchase_return_items(batchId)`,
      ).run();
      // sale_return_items
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON sale_return_items(returnId, lineNo)`,
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_sri_batch ON sale_return_items(batchId)`,
      ).run();

      db.prepare(
        `INSERT INTO _migrations(name, ranAt) VALUES('remove_unit_check_v1', ?)`,
      ).run(ts);
    })();
  } catch (e) {
    console.error("[db] remove_unit_check_v1 failed:", e);
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

// 1. Ensure the migrations table exists first!
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    ranAt TEXT
  )
`,
).run();

// 2. Fix purchases dirty index — was on createdAt, needs updatedAt for sync
const fixPurchasesDirtyIndexRan = db
  .prepare(
    `SELECT 1 FROM _migrations WHERE name='fix_purchases_dirty_index_v1' LIMIT 1`,
  )
  .get();

if (!fixPurchasesDirtyIndexRan) {
  try {
    // Drop the old wrong index
    db.prepare(`DROP INDEX IF EXISTS idx_purchases_dirty`).run();

    // Create the correct one
    db.prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_purchases_dirty
      ON purchases(licenseId, updatedAt, syncedAt, deletedAt)
    `,
    ).run();

    // Record that this migration ran
    db.prepare(
      `
      INSERT INTO _migrations(name, ranAt) VALUES('fix_purchases_dirty_index_v1', ?)
    `,
    ).run(new Date().toISOString());

    console.log("[db] fix_purchases_dirty_index_v1 completed");
  } catch (e) {
    console.error("[db] fix_purchases_dirty_index_v1 failed:", e);
  }
}

module.exports = db;
