// electron/db.js
const { app } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(app.getPath("userData"), "storewise.db");
const db = new Database(dbPath);
console.log(dbPath);

// Product Table
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
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

// Purchase Index
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchases_license_date ON purchases(licenseId, purchaseDate)`
).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchases_synced ON purchases(isSynced)`
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

// Purchase Items Index
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_purchase_items_synced ON purchase_items(isSynced)`
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

module.exports = db;
