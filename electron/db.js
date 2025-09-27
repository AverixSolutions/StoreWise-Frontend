// electron/db.js
const { app } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(app.getPath("userData"), "storewise.db");
const db = new Database(dbPath);

db.pragma("busy_timeout = 5000");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function addColumnIfMissing(table, column, type) {
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
`
).run();

addColumnIfMissing("products", "deletedAt", "TEXT");
addColumnIfMissing("products", "barcode", "TEXT");

// Product Index
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_products_dirty 
  ON products(licenseId, updatedAt, syncedAt, deletedAt)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_products_isSynced 
  ON products(isSynced)`
).run();
db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
   ON products(licenseId, barcode)`
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
`
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

// Purchase Index
db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_slno
   ON purchases(licenseId, slNo)`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchases_license_date ON purchases(licenseId, purchaseDate)`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchases_synced ON purchases(isSynced)`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchases_dirty 
  ON purchases(licenseId, createdAt, syncedAt, deletedAt)`
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
`
).run();

db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_returns_slno
  ON purchase_returns(licenseId, slNo)
`
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_purchase_returns_license_date
  ON purchase_returns(licenseId, returnDate)
`
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier
  ON purchase_returns(licenseId, supplierId)
`
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
`
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return
  ON purchase_return_items(returnId, lineNo)
`
).run();

// --- Return sequence per license ---
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_return_sequence (
    licenseId TEXT PRIMARY KEY,
    lastSlNo INTEGER DEFAULT 0
  )
`
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
`
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

// Purchase Items Index
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchase_items_synced ON purchase_items(isSynced)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchaseId, lineNo)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchase_items_dirty 
  ON purchase_items(purchaseId, updatedAt, syncedAt, deletedAt)`
).run();

// Code increment tracker for License
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS code_sequence (
    licenseId TEXT PRIMARY KEY,
    lastCodeNumber INTEGER DEFAULT 0
  )
`
).run();

// slno increment tracker for License
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_sequence (
    licenseId TEXT PRIMARY KEY,
    lastSlNo INTEGER DEFAULT 0
  )
`
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS sync_state (
    scope TEXT PRIMARY KEY,          
    lastPulledAt TEXT,               
    lastPushedAt TEXT               
  )
`
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
`
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
`
).run();
db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_code_no
  ON suppliers(licenseId, codeNumber)
`
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS supplier_sequence (
    licenseId TEXT PRIMARY KEY,
    lastCodeNumber INTEGER DEFAULT 0
  )
`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_suppliers_license ON suppliers(licenseId, name)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_suppliers_synced ON suppliers(isSynced)`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_suppliers_dirty 
   ON suppliers(licenseId, updatedAt, syncedAt, deletedAt)`
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
`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_supl_tx_supplier ON supplier_transactions(licenseId, supplierId, date)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_supl_tx_synced ON supplier_transactions(isSynced)`
).run();

// --- Purchases: link supplier ---
addColumnIfMissing("purchases", "supplierId", "TEXT");
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(licenseId, supplierId)`
).run();

module.exports = db;
