// electron/ipc/products.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

// === BATCH HELPERS & UTILS ===
function nowISO() {
  return new Date().toISOString();
}

function sum(a) {
  return a.reduce((s, n) => s + (Number(n) || 0), 0);
}

// what defines one "batch identity" in your app (tune as you like)
const BATCH_ID_COLS = [
  "barcode",
  "mrp",
  "salePrice",
  "batchNo",
  "mfgDate",
  "expiryDate",
];

function buildBatchIdentityWhere(alias, payload) {
  const where = [
    `${alias}.productId=@productId`,
    `${alias}.licenseId=@licenseId`,
    `COALESCE(${alias}.deletedAt,'')=''`,
  ];
  const params = {
    productId: payload.productId,
    licenseId: payload.licenseId,
  };

  for (const c of BATCH_ID_COLS) {
    if (payload[c] === null || payload[c] === undefined) {
      where.push(`${alias}.${c} IS NULL`);
    } else {
      where.push(`${alias}.${c}=@${c}`);
      params[c] = payload[c];
    }
  }
  return { where, params };
}

function findOrCreateBatch(payload) {
  const { where, params } = buildBatchIdentityWhere("b", payload);
  const existing = db
    .prepare(
      `SELECT * FROM product_batches b WHERE ${where.join(" AND ")} LIMIT 1`
    )
    .get(params);

  if (existing) return existing;

  const id = uuidv4();
  const ts = nowISO();
  db.prepare(
    `
    INSERT INTO product_batches(
      id, licenseId, productId, barcode, mrp, salePrice, costPrice,
      batchNo, mfgDate, expiryDate, receivedAt, stock, createdAt, updatedAt
    ) VALUES (@id, @licenseId, @productId, @barcode, @mrp, @salePrice, @costPrice,
              @batchNo, @mfgDate, @expiryDate, @receivedAt, @stock, @ts, @ts)
  `
  ).run({
    id,
    licenseId: payload.licenseId,
    productId: payload.productId,
    barcode: payload.barcode ?? null,
    mrp: payload.mrp ?? null,
    salePrice: payload.salePrice ?? null,
    costPrice: payload.costPrice ?? null,
    batchNo: payload.batchNo ?? null,
    mfgDate: payload.mfgDate ?? null,
    expiryDate: payload.expiryDate ?? null,
    receivedAt: payload.receivedAt ?? ts,
    stock: Number(payload.stock || 0),
    ts,
  });

  return db.prepare(`SELECT * FROM product_batches WHERE id=?`).get(id);
}

function rebuildProductStock(productId) {
  const r = db
    .prepare(
      `
      SELECT COALESCE(SUM(stock),0) AS qty
      FROM product_batches
      WHERE productId=? AND COALESCE(deletedAt,'')=''
    `
    )
    .get(productId);

  const qty = Number(r?.qty || 0);
  const ts = nowISO();

  db.prepare(
    `
    UPDATE products
    SET stock=?, updatedAt=?, isSynced=0, syncedAt=NULL
    WHERE id=?
  `
  ).run(qty, ts, productId);

  return qty;
}

function bumpBatchAndProductStock({ batchId, productId, deltaQty }) {
  const ts = nowISO();

  db.prepare(
    `
    UPDATE product_batches
    SET stock = COALESCE(stock,0) + @delta, updatedAt=@ts
    WHERE id=@batchId
  `
  ).run({ delta: Number(deltaQty || 0), ts, batchId });

  rebuildProductStock(productId);
}

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
      0,
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
          `
      SELECT
        p.id, p.code, p.name, p.brand, p.category, p.unit, p.tax, p.hsn,
        p.costPrice, p.salePrice,
        COALESCE(SUM(CASE WHEN COALESCE(b.deletedAt,'')='' THEN b.stock ELSE 0 END), 0) AS stock,
        p.barcode, p.createdAt
      FROM products p
      LEFT JOIN product_batches b ON b.productId = p.id
      WHERE p.licenseId = ? AND COALESCE(p.deletedAt,'') = ''
      GROUP BY p.id
      ORDER BY p.codeNumber ASC
      LIMIT ? OFFSET ?
      `
        )
        .all(licenseId, pageSize, offset);

      const total = db
        .prepare(
          `SELECT COUNT(*) AS count FROM products WHERE licenseId = ? AND COALESCE(deletedAt,'') = ''`
        )
        .get(licenseId).count;

      return { products, total };
    }
  );
  ipcMain.handle(
    "get-filtered-products",
    (event, licenseId, filters, { page = 1, pageSize = 10 } = {}) => {
      const params = [licenseId];
      const where = [`p.licenseId = ?`, `COALESCE(p.deletedAt,'') = ''`];

      if (filters?.name) {
        where.push(`p.name LIKE ?`);
        params.push(`%${filters.name}%`);
      }
      if (filters?.category) {
        where.push(`p.category = ?`);
        params.push(filters.category);
      }

      const offset = (page - 1) * pageSize;

      const rows = db
        .prepare(
          `
      SELECT
        p.id, p.code, p.name, p.brand, p.category, p.unit, p.tax, p.hsn,
        p.costPrice, p.salePrice,
        COALESCE(SUM(CASE WHEN COALESCE(b.deletedAt,'')='' THEN b.stock ELSE 0 END), 0) AS stock,
        p.barcode, p.createdAt
      FROM products p
      LEFT JOIN product_batches b ON b.productId = p.id
      WHERE ${where.join(" AND ")}
      GROUP BY p.id
      ORDER BY p.codeNumber ASC
      LIMIT ? OFFSET ?
      `
        )
        .all(...params, pageSize, offset);

      const total = db
        .prepare(
          `SELECT COUNT(*) AS count FROM products p WHERE ${where.join(
            " AND "
          )}`
        )
        .get(...params).count;

      return { products: rows, total };
    }
  );

  ipcMain.handle("update-product", (event, productId, product) => {
    const now = new Date().toISOString();

    const result = db
      .prepare(
        `
      UPDATE products 
      SET name = ?, brand = ?, category = ?, unit = ?, tax = ?, hsn = ?, 
          costPrice = ?, salePrice = ?, updatedAt = ?, barcode = ?,
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

  // UPGRADED: get-product-by-barcode with batch support
  ipcMain.handle("get-product-by-barcode", (event, licenseId, barcode) => {
    if (!barcode) return null;

    // 1) Try batch barcode first
    const row = db
      .prepare(
        `
      SELECT p.*, 
             b.id AS batchId, b.mrp AS batchMrp, b.salePrice AS batchSalePrice,
             b.costPrice AS batchCostPrice, b.batchNo, b.mfgDate, b.expiryDate, b.stock AS batchStock
      FROM product_batches b
      JOIN products p ON p.id = b.productId
      WHERE b.licenseId=? AND COALESCE(b.deletedAt,'')='' AND b.barcode=?
        AND p.licenseId=? AND COALESCE(p.deletedAt,'')=''
      LIMIT 1
    `
      )
      .get(licenseId, barcode, licenseId);

    if (row) return row;

    // 2) Fallback to product-level barcode
    return db
      .prepare(
        `
      SELECT * FROM products 
      WHERE licenseId=? AND barcode=? AND deletedAt IS NULL
      LIMIT 1
    `
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

  // ===== BATCH UI/APIs =====
  ipcMain.handle(
    "product.batch:list",
    (e, { productId, includeDeleted = false }) => {
      if (!productId) return { success: false, error: "productId required" };

      const rows = db
        .prepare(
          `
      SELECT id, barcode, mrp, salePrice, costPrice, batchNo, mfgDate, expiryDate,
             receivedAt, stock, createdAt, updatedAt, deletedAt
      FROM product_batches
      WHERE productId=? ${includeDeleted ? "" : "AND COALESCE(deletedAt,'')=''"}
      ORDER BY date(expiryDate) IS NULL, expiryDate, datetime(receivedAt)
    `
        )
        .all(productId);

      const totalStock = sum(
        rows.filter((r) => !r.deletedAt).map((r) => r.stock || 0)
      );
      return { success: true, rows, totalStock };
    }
  );

  ipcMain.handle("product.batch:save", (e, payload) => {
    // expects { licenseId, productId, barcode?, mrp?, salePrice?, costPrice?, batchNo?, mfgDate?, expiryDate?, receivedAt?, deltaQty? }
    if (!payload?.licenseId || !payload?.productId) {
      return { success: false, error: "licenseId & productId required" };
    }

    const batch = findOrCreateBatch({
      licenseId: payload.licenseId,
      productId: payload.productId,
      barcode: payload.barcode ?? null,
      mrp: payload.mrp ?? null,
      salePrice: payload.salePrice ?? null,
      costPrice: payload.costPrice ?? null,
      batchNo: payload.batchNo ?? null,
      mfgDate: payload.mfgDate ?? null,
      expiryDate: payload.expiryDate ?? null,
      receivedAt: payload.receivedAt ?? nowISO(),
      stock: 0,
    });

    // update optional mutable fields
    db.prepare(
      `
      UPDATE product_batches
      SET costPrice=COALESCE(@costPrice, costPrice),
          receivedAt=COALESCE(@receivedAt, receivedAt),
          updatedAt=@ts
      WHERE id=@id
    `
    ).run({
      id: batch.id,
      costPrice: payload.costPrice ?? null,
      receivedAt: payload.receivedAt ?? null,
      ts: nowISO(),
    });

    if (payload.deltaQty) {
      bumpBatchAndProductStock({
        batchId: batch.id,
        productId: payload.productId,
        deltaQty: Number(payload.deltaQty),
      });
    }

    const fresh = db
      .prepare(`SELECT * FROM product_batches WHERE id=?`)
      .get(batch.id);
    return { success: true, batch: fresh };
  });

  ipcMain.handle("product.batch:delete", (e, { batchId }) => {
    if (!batchId) return { success: false, error: "batchId required" };

    const ts = nowISO();
    const b = db
      .prepare(`SELECT productId FROM product_batches WHERE id=?`)
      .get(batchId);
    if (!b) return { success: false, error: "NOT_FOUND" };

    db.prepare(
      `UPDATE product_batches SET deletedAt=?, updatedAt=? WHERE id=?`
    ).run(ts, ts, batchId);

    rebuildProductStock(b.productId);
    return { success: true, deletedAt: ts };
  });

  ipcMain.handle("product:rebuild-stock", (e, productId) => {
    if (!productId) return { success: false, error: "productId required" };
    const qty = rebuildProductStock(productId);
    return { success: true, stock: qty };
  });

  // ===== INTERNAL (for purchases/sales modules) =====
  ipcMain.handle("product.__internal.findOrCreateBatch", (e, payload) => {
    const b = findOrCreateBatch(payload);
    return { success: true, batch: b };
  });

  ipcMain.handle(
    "product.__internal.bumpBatchAndProductStock",
    (e, payload) => {
      bumpBatchAndProductStock(payload);
      return { success: true };
    }
  );

  // ===== OPTIONAL: Rich product fetch with batches =====
  ipcMain.handle("product:getWithBatches", (e, productId) => {
    const p = db.prepare(`SELECT * FROM products WHERE id=?`).get(productId);
    if (!p) return { success: false, error: "NOT_FOUND" };

    const batches = db
      .prepare(
        `
      SELECT id, barcode, mrp, salePrice, costPrice, batchNo, mfgDate, expiryDate, 
             receivedAt, stock, createdAt, updatedAt
      FROM product_batches
      WHERE productId=? AND COALESCE(deletedAt,'')=''
      ORDER BY date(expiryDate) IS NULL, expiryDate, datetime(receivedAt)
    `
      )
      .all(productId);

    const totalFromBatches = sum(batches.map((b) => b.stock || 0));
    return { success: true, product: p, batches, totalFromBatches };
  });
}

module.exports = { registerProductHandlers };
