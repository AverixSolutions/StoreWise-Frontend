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
    const now = new Date().toISOString();
    db.prepare(
      `
      INSERT INTO products 
        (id, licenseId, code, codeNumber, name, brand, category, unit, tax, hsn, costPrice, salePrice, stock, barcode, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      product.stock,
      product.barcode || null,
      now,
      now
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

  ipcMain.handle(
    "get-products",
    (event, licenseId, { page = 1, pageSize = 10 } = {}) => {
      const offset = (page - 1) * pageSize;

      const products = db
        .prepare(
          `SELECT id, code, name, brand, category, unit, tax, hsn, costPrice, salePrice, stock, barcode, createdAt 
     FROM products 
     WHERE licenseId = ? AND deletedAt IS NULL
     ORDER BY codeNumber ASC
     LIMIT ? OFFSET ?`
        )
        .all(licenseId, pageSize, offset);

      const total = db
        .prepare(
          `SELECT COUNT(*) as count FROM products WHERE licenseId = ? AND deletedAt IS NULL`
        )
        .get(licenseId).count;

      return { products, total };
    }
  );

  ipcMain.handle(
    "get-filtered-products",
    (event, licenseId, filters, { page = 1, pageSize = 10 } = {}) => {
      let query = `
    SELECT id, code, name, brand, category, unit, tax, hsn, costPrice, salePrice, stock, barcode, createdAt
    FROM products 
    WHERE licenseId = ? AND deletedAt IS NULL
  `;
      let countQuery = `SELECT COUNT(*) as count FROM products WHERE licenseId = ? AND deletedAt IS NULL`;

      const params = [licenseId];
      const countParams = [licenseId];

      if (filters.name) {
        query += " AND name LIKE ?";
        countQuery += " AND name LIKE ?";
        params.push(`%${filters.name}%`);
        countParams.push(`%${filters.name}%`);
      }

      if (filters.category) {
        query += " AND category = ?";
        countQuery += " AND category = ?";
        params.push(filters.category);
        countParams.push(filters.category);
      }

      const offset = (page - 1) * pageSize;
      query += " ORDER BY codeNumber ASC LIMIT ? OFFSET ?";
      params.push(pageSize, offset);

      const products = db.prepare(query).all(...params);
      const total = db.prepare(countQuery).get(...countParams).count;

      return { products, total };
    }
  );

  ipcMain.handle("update-product", (event, productId, product) => {
    const now = new Date().toISOString();

    const result = db
      .prepare(
        `
      UPDATE products 
      SET name = ?, brand = ?, category = ?, unit = ?, tax = ?, hsn = ?, 
          costPrice = ?, salePrice = ?, stock = ?, updatedAt = ?, barcode = ?,
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
        now,
        product.barcode || null,
        productId
      );

    if (result.changes === 0) {
      throw new Error("Product not found or no changes made");
    }

    return { success: true };
  });

  ipcMain.handle("delete-product", (event, productId) => {
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `
      UPDATE products
      SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL WHERE id = ?
      `
      )
      .run(now, now, productId);

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

  ipcMain.handle("get-product-by-barcode", (event, licenseId, barcode) => {
    if (!barcode) return null;
    return db
      .prepare(
        "SELECT * FROM products WHERE licenseId = ? AND barcode = ? AND deletedAt IS NULL"
      )
      .get(licenseId, barcode);
  });

  ipcMain.handle("get-product-by-code", (event, licenseId, code) => {
    if (!code) return null;
    return db
      .prepare(
        "SELECT * FROM products WHERE licenseId = ? AND code = ? AND deletedAt IS NULL"
      )
      .get(licenseId, code);
  });

  ipcMain.handle("bulk-update-product-prices", (event, updates) => {
    if (!Array.isArray(updates) || updates.length === 0)
      return { success: true, updated: 0 };

    const now = new Date().toISOString();

    const updateSale = db.prepare(`
    UPDATE products
    SET salePrice = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
    WHERE id = ?
  `);
    const updateCostSale = db.prepare(`
    UPDATE products
    SET costPrice = ?, salePrice = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
    WHERE id = ?
  `);

    const updateSaleUnit = db.prepare(`
    UPDATE products
    SET salePrice = ?, unit = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
    WHERE id = ?
  `);
    const updateCostSaleUnit = db.prepare(`
    UPDATE products
    SET costPrice = ?, salePrice = ?, unit = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
    WHERE id = ?
  `);
    const updateUnitOnly = db.prepare(`
    UPDATE products
    SET unit = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
    WHERE id = ?
  `);

    const trx = db.transaction((items) => {
      items.forEach((u) => {
        const hasCost = typeof u.costPrice === "number";
        const hasSale = typeof u.salePrice === "number";
        const hasUnit =
          typeof u.unit === "string" &&
          ["NOS", "KG", "LTR", "MTR"].includes(u.unit);

        if (hasCost && hasSale && hasUnit) {
          updateCostSaleUnit.run(
            u.costPrice,
            u.salePrice,
            u.unit,
            now,
            u.productId
          );
        } else if (hasCost && hasSale) {
          updateCostSale.run(u.costPrice, u.salePrice, now, u.productId);
        } else if (hasSale && hasUnit) {
          updateSaleUnit.run(u.salePrice, u.unit, now, u.productId);
        } else if (hasSale) {
          updateSale.run(u.salePrice, now, u.productId);
        } else if (hasUnit) {
          updateUnitOnly.run(u.unit, now, u.productId);
        }
      });
    });
    trx(updates);

    return { success: true, updated: updates.length };
  });
}

module.exports = { registerProductHandlers };
