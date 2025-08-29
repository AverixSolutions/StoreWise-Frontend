// electron/db.js
const { app } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(app.getPath("userData"), "storewise.db");
const db = new Database(dbPath);

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
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    UNIQUE(licenseId, code),
    UNIQUE(licenseId, codeNumber)
  )
`
).run();

addColumnIfMissing("products", "deletedAt", "TEXT");

// Product Index
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_products_dirty 
  ON products(licenseId, updatedAt, syncedAt, deletedAt)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_products_isSynced 
  ON products(isSynced)`
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
    createdAt TEXT DEFAULT (datetime('now')),
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT
  )
`
).run();

addColumnIfMissing("purchases", "deletedAt", "TEXT");

// Purchase Index
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
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    isSynced INTEGER DEFAULT 0,
    syncedAt TEXT,
    FOREIGN KEY (purchaseId) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (productId) REFERENCES products(id)
  )
`
).run();

addColumnIfMissing("purchase_items", "deletedAt", "TEXT");

// Purchase Items Index
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchase_items_synced ON purchase_items(isSynced)`
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

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS sync_state (
    scope TEXT PRIMARY KEY,          
    lastPulledAt TEXT,               
    lastPushedAt TEXT               
  )
`
).run();

module.exports = db;
