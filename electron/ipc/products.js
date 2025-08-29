// electron/ipc/products.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

function registerProductHandlers() {
  ipcMain.handle("get-next-code", (event, licenseId) => {
    const seq = db
      .prepare("SELECT lastCodeNumber FROM code_sequence WHERE licenseId = ?")
      .get(licenseId);

    const nextCodeNumber = seq ? seq.lastCodeNumber + 1 : 1;
    return String(nextCodeNumber).padStart(5, "0");
  });

  ipcMain.handle("create-product", (event, product) => {
    const newId = product.id || uuidv4();
    db.prepare(
      `
      INSERT INTO products 
        (id, licenseId, code, codeNumber, name, brand, category, unit, tax, hsn, costPrice, salePrice, stock) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      newId,
      product.licenseId,
      product.code,
      product.codeNumber,
      product.name,
      product.brand,
      product.category,
      product.unit,
      product.tax,
      product.hsn,
      product.costPrice,
      product.salePrice,
      product.stock
    );

    db.prepare(
      `
      INSERT INTO code_sequence (licenseId, lastCodeNumber)
      VALUES (?, ?)
      ON CONFLICT(licenseId) DO UPDATE SET lastCodeNumber = excluded.lastCodeNumber
    `
    ).run(product.licenseId, product.codeNumber);

    return { success: true };
  });

  ipcMain.handle("get-products", (event, licenseId) => {
    const products = db
      .prepare(
        `SELECT id, code, name, brand, category, unit, tax, hsn, costPrice, salePrice, stock, createdAt 
         FROM products 
         WHERE licenseId = ? AND deletedAt IS NULL
         ORDER BY codeNumber ASC`
      )
      .all(licenseId);

    return products;
  });

  ipcMain.handle("update-product", (event, productId, product) => {
    const result = db
      .prepare(
        `
      UPDATE products 
      SET name = ?, brand = ?, category = ?, unit = ?, tax = ?, hsn = ?, 
          costPrice = ?, salePrice = ?, stock = ?, updatedAt = datetime('now'),
          isSynced = 0,
          syncedAt = NULL
      WHERE id = ?
    `
      )
      .run(
        product.name,
        product.brand,
        product.category,
        product.unit,
        product.tax,
        product.hsn,
        product.costPrice,
        product.salePrice,
        product.stock,
        productId
      );

    if (result.changes === 0) {
      throw new Error("Product not found or no changes made");
    }

    return { success: true };
  });

  ipcMain.handle("delete-product", (event, productId) => {
    const result = db
      .prepare(
        `
      UPDATE products
      SET deletedAt = datetime('now'), updatedAt = datetime('now'), isSynced = 0, syncedAt = NULL WHERE id = ?
      `
      )
      .run(productId);

    if (result.changes === 0) {
      throw new Error("Product not found");
    }

    return { success: true };
  });

  // Get product by ID
  ipcMain.handle("get-product", (event, productId) => {
    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(productId);

    return product;
  });

  ipcMain.handle("get-dirty-products", (event, licenseId, limit = 200) => {
    return db
      .prepare(
        `
    SELECT *
    FROM products
    WHERE licenseId = ?
      AND (
        syncedAt IS NULL
        OR updatedAt > syncedAt
        OR (deletedAt IS NOT NULL AND (syncedAt IS NULL OR deletedAt > syncedAt))
      )
    ORDER BY updatedAt ASC, id ASC
    LIMIT ?
  `
      )
      .all(licenseId, limit);
  });

  ipcMain.handle("mark-products-synced", (event, ids, serverSyncedAt) => {
    const ts = serverSyncedAt || new Date().toISOString();
    const trx = db.transaction((ids) => {
      const stmt = db.prepare(`
      UPDATE products
      SET isSynced = 1,
          syncedAt = ?
      WHERE id = ?
    `);
      ids.forEach((id) => stmt.run(ts, id));
    });
    trx(ids);
    return { success: true, syncedAt: ts };
  });
}

module.exports = { registerProductHandlers };
