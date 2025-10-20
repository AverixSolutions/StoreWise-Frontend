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
addColumnIfMissing("purchases", "updatedAt", "TEXT");

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

addColumnIfMissing("purchase_return_items", "effectiveUnitValue", "REAL");
addColumnIfMissing("purchase_return_items", "appliedQuantity", "INTEGER");
addColumnIfMissing("purchase_return_items", "overReturnQuantity", "INTEGER");
addColumnIfMissing("purchase_return_items", "overReturnReason", "TEXT");

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
addColumnIfMissing("purchase_items", "isFree", "INTEGER DEFAULT 0");
addColumnIfMissing("purchase_items", "effectiveUnitValue", "REAL");

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
`
).run();

db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_holds_no
  ON purchase_holds(licenseId, holdNo)
`
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_purchase_holds_license
  ON purchase_holds(licenseId, createdAt)
`
).run();

// Per-license sequence for holds
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_hold_sequence (
    licenseId TEXT PRIMARY KEY,
    lastHoldNo INTEGER DEFAULT 0
  )
`
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
`
).run();

db.prepare(
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_return_holds_no
  ON purchase_return_holds(licenseId, holdNo)
`
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_purchase_return_holds_license
  ON purchase_return_holds(licenseId, createdAt)
`
).run();

// Per-license sequence for return holds
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS purchase_return_hold_sequence (
    licenseId TEXT PRIMARY KEY,
    lastHoldNo INTEGER DEFAULT 0
  )
`
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
`
).run();

// Unique slno per license
db.prepare(
  `
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_slno
ON sales(licenseId, slNo)
`
).run();

// Helpful indexes
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sales_license_date ON sales(licenseId, saleDate)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(licenseId, customerId)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales(isSynced)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sales_dirty ON sales(licenseId, createdAt, syncedAt, deletedAt)`
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
`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(saleId, lineNo)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_items_synced ON sale_items(isSynced)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_items_dirty ON sale_items(saleId, updatedAt, syncedAt, deletedAt)`
).run();

// Per-license sequence for sales
db.prepare(
  `
CREATE TABLE IF NOT EXISTS sale_sequence (
licenseId TEXT PRIMARY KEY,
lastSlNo INTEGER DEFAULT 0
)
`
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
`
).run();

db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_holds_no ON sale_holds(licenseId, holdNo)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_holds_license ON sale_holds(licenseId, createdAt)`
).run();

db.prepare(
  `
CREATE TABLE IF NOT EXISTS sale_hold_sequence (
licenseId TEXT PRIMARY KEY,
lastHoldNo INTEGER DEFAULT 0
)
`
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
`
).run();

db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_returns_slno ON sale_returns(licenseId, slNo)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_returns_license_date ON sale_returns(licenseId, returnDate)`
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
`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON sale_return_items(returnId, lineNo)`
).run();

// Per-license sequence for returns
db.prepare(
  `
CREATE TABLE IF NOT EXISTS sale_return_sequence (
  licenseId TEXT PRIMARY KEY,
  lastSlNo INTEGER DEFAULT 0
)
`
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
`
).run();

addColumnIfMissing("customers", "code", "TEXT");
addColumnIfMissing("customers", "codeNumber", "INTEGER");

db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_code ON customers(licenseId, code)`
).run();
db.prepare(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_code_no ON customers(licenseId, codeNumber)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_customers_license ON customers(licenseId, name)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_customers_synced ON customers(isSynced)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_customers_dirty ON customers(licenseId, updatedAt, syncedAt, deletedAt)`
).run();

// Customer code sequence
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS customer_sequence (
  licenseId TEXT PRIMARY KEY,
  lastCodeNumber INTEGER DEFAULT 0
  )
`
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
`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_cust_tx_customer ON customer_transactions(licenseId, customerId, date)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_cust_tx_synced ON customer_transactions(isSynced)`
).run();

module.exports = db;
