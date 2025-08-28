// electron/ipc/products.js
const { ipcMain } = require("electron");
const db = require("../db");

function registerProductHandlers() {
  // Get next code
  ipcMain.handle("get-next-code", (event, licenseId) => {
    const seq = db
      .prepare("SELECT lastCodeNumber FROM code_sequence WHERE licenseId = ?")
      .get(licenseId);

    const nextCodeNumber = seq ? seq.lastCodeNumber + 1 : 1;
    return String(nextCodeNumber).padStart(5, "0");
  });

  // Create product
  ipcMain.handle("create-product", (event, product) => {
    db.prepare(
      `
      INSERT INTO products 
        (licenseId, code, codeNumber, name, brand, category, unit, tax, hsn, costPrice, salePrice, stock) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
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

  // Get all products
  ipcMain.handle("get-products", (event, licenseId) => {
    const products = db
      .prepare(
        `SELECT id, code, name, brand, category, unit, tax, hsn, costPrice, salePrice, stock, createdAt 
         FROM products 
         WHERE licenseId = ? 
         ORDER BY codeNumber ASC`
      )
      .all(licenseId);

    return products;
  });

  // Update product
  ipcMain.handle("update-product", (event, productId, product) => {
    const result = db
      .prepare(
        `
      UPDATE products 
      SET name = ?, brand = ?, category = ?, unit = ?, tax = ?, hsn = ?, 
          costPrice = ?, salePrice = ?, stock = ?, updatedAt = datetime('now')
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

  // Delete product
  ipcMain.handle("delete-product", (event, productId) => {
    const result = db
      .prepare("DELETE FROM products WHERE id = ?")
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
}

module.exports = { registerProductHandlers };
