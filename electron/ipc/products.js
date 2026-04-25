// electron/ipc/products.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain, app } = require("electron");
const path = require("path");
const fs = require("fs");
const db = require("../db");

// === BATCH HELPERS & UTILS ===
function nowISO() {
  return new Date().toISOString();
}

function sum(a) {
  return a.reduce((s, n) => s + (Number(n) || 0), 0);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeShortCode(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();

  if (!raw) return null;

  // Allows APL, APPLE01, RICE-5KG, MILK_1L
  const cleaned = raw.replace(/[^A-Z0-9-_]/g, "");

  return cleaned || null;
}

function assertShortCodeAvailable({
  licenseId,
  shortCode,
  excludeProductId = null,
}) {
  if (!shortCode) return;

  const existing = db
    .prepare(
      `
      SELECT id
      FROM products
      WHERE licenseId = ?
        AND shortCode COLLATE NOCASE = ?
        AND COALESCE(deletedAt,'') = ''
        ${excludeProductId ? "AND id <> ?" : ""}
      LIMIT 1
    `,
    )
    .get(
      ...(excludeProductId
        ? [licenseId, shortCode, excludeProductId]
        : [licenseId, shortCode]),
    );

  if (existing) {
    throw new Error(
      `Short code "${shortCode}" is already used by another product`,
    );
  }
}

function getImageExtension({ mimeType, fileName }) {
  const nameExt = path.extname(String(fileName || "")).toLowerCase();

  if ([".jpg", ".jpeg", ".png", ".webp"].includes(nameExt)) {
    return nameExt === ".jpeg" ? ".jpg" : nameExt;
  }

  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return ".jpg";

  return ".jpg";
}

function saveProductImage({ productId, image }) {
  if (!image?.base64) return null;

  const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ]);

  const mimeType = image.mimeType || image.type || "image/jpeg";

  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error("Only JPG, PNG, and WEBP product images are allowed");
  }

  const imageDir = path.join(
    app.getPath("appData"),
    "KYNFLOW",
    "product-images",
  );
  ensureDir(imageDir);

  const ext = getImageExtension({
    mimeType,
    fileName: image.fileName || image.name,
  });

  const fileName = `${productId}-${Date.now()}${ext}`;
  const filePath = path.join(imageDir, fileName);

  fs.writeFileSync(filePath, Buffer.from(image.base64, "base64"));

  return {
    imagePath: filePath,
    imageFileName: fileName,
  };
}

// what defines one "batch identity" in your app
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
      `SELECT * FROM product_batches b WHERE ${where.join(" AND ")} LIMIT 1`,
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
  `,
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
    `,
    )
    .get(productId);

  const qty = Number(r?.qty || 0);
  const ts = nowISO();

  db.prepare(
    `
    UPDATE products
    SET stock=?, updatedAt=?, isSynced=0, syncedAt=NULL
    WHERE id=?
  `,
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
  `,
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

    const shortCode = normalizeShortCode(product.shortCode);

    assertShortCodeAvailable({
      licenseId: product.licenseId,
      shortCode,
    });

    const savedImage = saveProductImage({
      productId: newId,
      image: product.image,
    });

    db.prepare(
      `
    INSERT INTO products 
      (
        id, licenseId, code, codeNumber, shortCode,
        name, brand, category, subcategory,
        productName, model, size,
        unit, tax, hsn, costPrice, salePrice, stock, barcode,
        imagePath, imageFileName,
        createdAt, updatedAt
      ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    ).run(
      newId,
      product.licenseId,
      product.code,
      product.codeNumber,
      shortCode,
      product.name,
      product.brand ?? null,
      product.category ?? null,
      product.subcategory ?? null,
      product.productName ?? null,
      product.model ?? null,
      product.size ?? null,
      product.unit,
      product.tax,
      product.hsn ?? null,
      product.costPrice,
      product.salePrice ?? null,
      0,
      null,
      savedImage?.imagePath ?? null,
      savedImage?.imageFileName ?? null,
      now,
      now,
    );

    db.prepare(
      `
    INSERT INTO code_sequence (licenseId, lastCodeNumber)
    VALUES (?, ?)
    ON CONFLICT(licenseId) DO UPDATE SET lastCodeNumber = excluded.lastCodeNumber
  `,
    ).run(product.licenseId, product.codeNumber);

    return { success: true, productId: newId };
  });

  ipcMain.handle(
    "get-products",
    (event, licenseId, { page = 1, pageSize = 10 } = {}) => {
      const offset = (page - 1) * pageSize;

      const products = db
        .prepare(
          `
  SELECT
  p.id, p.code, p.shortCode, p.imagePath, p.imageFileName,
  p.name, p.brand, p.category, p.subcategory,
  p.productName, p.model, p.size, p.unit, p.tax, p.hsn,
  p.costPrice, p.salePrice,
  COALESCE(SUM(CASE WHEN COALESCE(b.deletedAt,'')='' THEN b.stock ELSE 0 END), 0) AS stock,
  (
    SELECT COUNT(*)
    FROM product_batches pb
    WHERE pb.productId = p.id
      AND COALESCE(pb.deletedAt,'') = ''
  ) AS batchCount,
  p.barcode, p.createdAt
FROM products p
LEFT JOIN product_batches b ON b.productId = p.id
WHERE p.licenseId = ? AND COALESCE(p.deletedAt,'') = ''
GROUP BY p.id
ORDER BY p.codeNumber ASC
LIMIT ? OFFSET ?
    `,
        )
        .all(licenseId, pageSize, offset);

      const total = db
        .prepare(
          `SELECT COUNT(*) AS count FROM products WHERE licenseId = ? AND COALESCE(deletedAt,'') = ''`,
        )
        .get(licenseId).count;

      return { products, total };
    },
  );

  ipcMain.handle("product:get-image-data-url", (event, productId) => {
    if (!productId) return null;

    const product = db
      .prepare(
        `
      SELECT imagePath, imageFileName
      FROM products
      WHERE id = ?
        AND COALESCE(deletedAt,'') = ''
      LIMIT 1
    `,
      )
      .get(productId);

    if (!product?.imagePath) return null;

    if (!fs.existsSync(product.imagePath)) return null;

    const ext = path.extname(product.imagePath).toLowerCase();

    const mimeType =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";

    const base64 = fs.readFileSync(product.imagePath).toString("base64");

    return `data:${mimeType};base64,${base64}`;
  });

  ipcMain.handle(
    "get-filtered-products",
    (event, licenseId, filters, { page = 1, pageSize = 10 } = {}) => {
      const params = [licenseId];
      const where = [`p.licenseId = ?`, `COALESCE(p.deletedAt,'') = ''`];

      if (filters?.name) {
        where.push(`(p.name LIKE ? OR COALESCE(p.shortCode,'') LIKE ?)`);
        params.push(`%${filters.name}%`, `%${filters.name}%`);
      }

      if (filters?.category) {
        where.push(`p.category = ?`);
        params.push(filters.category);
      }

      if (filters?.brand) {
        where.push(`p.brand = ?`);
        params.push(filters.brand);
      }

      if (filters?.subcategory) {
        where.push(`p.subcategory = ?`);
        params.push(filters.subcategory);
      }

      if (filters?.tax) {
        where.push(`p.tax = ?`);
        params.push(filters.tax);
      }
      const offset = (page - 1) * pageSize;

      const rows = db
        .prepare(
          `
SELECT
  p.id, p.code, p.shortCode, p.imagePath, p.imageFileName,
  p.name, p.brand, p.category, p.subcategory,
  p.productName, p.model, p.size, p.unit, p.tax, p.hsn,
  p.costPrice, p.salePrice,
  COALESCE(SUM(CASE WHEN COALESCE(b.deletedAt,'')='' THEN b.stock ELSE 0 END), 0) AS stock,
  (
    SELECT COUNT(*)
    FROM product_batches pb
    WHERE pb.productId = p.id
      AND COALESCE(pb.deletedAt,'') = ''
  ) AS batchCount,
  p.barcode, p.createdAt
FROM products p
LEFT JOIN product_batches b ON b.productId = p.id
WHERE ${where.join(" AND ")}
GROUP BY p.id
ORDER BY p.codeNumber ASC
LIMIT ? OFFSET ?
    `,
        )
        .all(...params, pageSize, offset);

      const total = db
        .prepare(
          `SELECT COUNT(*) AS count FROM products p WHERE ${where.join(" AND ")}`,
        )
        .get(...params).count;

      return { products: rows, total };
    },
  );

  ipcMain.handle("update-product", (event, productId, product) => {
    const now = new Date().toISOString();

    const existing = db
      .prepare(
        `SELECT licenseId, shortCode, imagePath FROM products WHERE id = ? LIMIT 1`,
      )
      .get(productId);

    if (!existing) {
      throw new Error("Product not found");
    }

    const shortCode =
      product.shortCode === undefined
        ? existing.shortCode
        : normalizeShortCode(product.shortCode);

    assertShortCodeAvailable({
      licenseId: existing.licenseId,
      shortCode,
      excludeProductId: productId,
    });

    const savedImage = saveProductImage({
      productId,
      image: product.image,
    });

    const result = db
      .prepare(
        `
  UPDATE products 
  SET name = ?, brand = ?, category = ?, subcategory = ?,
      productName = ?, model = ?, size = ?,
      shortCode = ?,
      unit = ?, tax = ?, hsn = ?, 
      costPrice = ?, salePrice = ?,
      imagePath = COALESCE(?, imagePath),
      imageFileName = COALESCE(?, imageFileName),
      updatedAt = ?,
      isSynced = 0, syncedAt = NULL
  WHERE id = ?
`,
      )
      .run(
        product.name,
        product.brand ?? null,
        product.category ?? null,
        product.subcategory ?? null,
        product.productName ?? null,
        product.model ?? null,
        product.size ?? null,
        shortCode,
        product.unit,
        product.tax,
        product.hsn ?? null,
        product.costPrice,
        product.salePrice ?? null,
        savedImage?.imagePath ?? null,
        savedImage?.imageFileName ?? null,
        now,
        productId,
      );

    if (result.changes === 0) {
      throw new Error("Product not found or no changes made");
    }

    return { success: true };
  });

  ipcMain.handle("delete-product", (event, productId) => {
    const now = new Date().toISOString();

    const trx = db.transaction(() => {
      const productResult = db
        .prepare(
          `
        UPDATE products
        SET deletedAt = ?, updatedAt = ?, isSynced = 0, syncedAt = NULL
        WHERE id = ?
        `,
        )
        .run(now, now, productId);

      if (productResult.changes === 0) {
        throw new Error("Product not found");
      }

      db.prepare(
        `
      UPDATE product_batches
      SET deletedAt = ?, updatedAt = ?
      WHERE productId = ? AND COALESCE(deletedAt,'') = ''
      `,
      ).run(now, now, productId);
    });

    trx();

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
  `,
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

    // 1) real batch barcode first
    const row = db
      .prepare(
        `
      SELECT p.*, 
             b.id AS batchId,
             b.mrp AS batchMrp,
             b.salePrice AS batchSalePrice,
             b.costPrice AS batchCostPrice,
             b.batchNo,
             b.mfgDate,
             b.expiryDate,
             b.stock AS batchStock
      FROM product_batches b
      JOIN products p ON p.id = b.productId
      WHERE b.licenseId=?
        AND COALESCE(b.deletedAt,'')=''
        AND b.barcode=?
        AND p.licenseId=?
        AND COALESCE(p.deletedAt,'')=''
      LIMIT 1
    `,
      )
      .get(licenseId, barcode, licenseId);

    if (row) return row;

    // 2) legacy compatibility only
    return db
      .prepare(
        `
      SELECT *
      FROM products
      WHERE licenseId=?
        AND barcode=?
        AND COALESCE(deletedAt,'')=''
        AND barcode IS NOT NULL
        AND barcode <> ''
      LIMIT 1
    `,
      )
      .get(licenseId, barcode);
  });

  ipcMain.handle("get-product-by-code", (event, licenseId, code) => {
    if (!code) return null;
    return db
      .prepare(
        "SELECT * FROM products WHERE licenseId = ? AND code = ? AND deletedAt IS NULL",
      )
      .get(licenseId, code);
  });

  ipcMain.handle("get-product-by-short-code", (event, licenseId, shortCode) => {
    const normalized = normalizeShortCode(shortCode);
    if (!normalized) return null;

    return db
      .prepare(
        `
      SELECT *
      FROM products
      WHERE licenseId = ?
        AND shortCode COLLATE NOCASE = ?
        AND COALESCE(deletedAt,'') = ''
      LIMIT 1
    `,
      )
      .get(licenseId, normalized);
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
            u.productId,
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
    `,
        )
        .all(productId);

      const totalStock = sum(
        rows.filter((r) => !r.deletedAt).map((r) => r.stock || 0),
      );
      return { success: true, rows, totalStock };
    },
  );

  ipcMain.handle("product.batch:save", (e, payload) => {
    if (!payload?.licenseId || !payload?.productId) {
      return { success: false, error: "licenseId & productId required" };
    }

    const deltaQty = Number(payload?.deltaQty ?? payload?.stock ?? 0);

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

    db.prepare(
      `
      UPDATE product_batches
      SET costPrice=COALESCE(@costPrice, costPrice),
          receivedAt=COALESCE(@receivedAt, receivedAt),
          updatedAt=@ts
      WHERE id=@id
    `,
    ).run({
      id: batch.id,
      costPrice: payload.costPrice ?? null,
      receivedAt: payload.receivedAt ?? null,
      ts: nowISO(),
    });

    if (deltaQty !== 0) {
      bumpBatchAndProductStock({
        batchId: batch.id,
        productId: payload.productId,
        deltaQty,
      });
    }

    const fresh = db
      .prepare(`SELECT * FROM product_batches WHERE id=?`)
      .get(batch.id);

    return { success: true, batch: fresh };
  });

  ipcMain.handle("product.batch:update", (e, payload) => {
    if (!payload?.id) {
      return { success: false, error: "batchId required" };
    }

    const existing = db
      .prepare(
        `
      SELECT *
      FROM product_batches
      WHERE id = ? AND COALESCE(deletedAt,'') = ''
      LIMIT 1
      `,
      )
      .get(payload.id);

    if (!existing) {
      return { success: false, error: "NOT_FOUND" };
    }

    const barcode =
      payload.barcode === undefined
        ? existing.barcode
        : payload.barcode || null;
    const mrp = payload.mrp === undefined ? existing.mrp : payload.mrp;
    const salePrice =
      payload.salePrice === undefined ? existing.salePrice : payload.salePrice;
    const costPrice =
      payload.costPrice === undefined ? existing.costPrice : payload.costPrice;
    const batchNo =
      payload.batchNo === undefined
        ? existing.batchNo
        : payload.batchNo || null;
    const mfgDate =
      payload.mfgDate === undefined
        ? existing.mfgDate
        : payload.mfgDate || null;
    const expiryDate =
      payload.expiryDate === undefined
        ? existing.expiryDate
        : payload.expiryDate || null;
    const receivedAt =
      payload.receivedAt === undefined
        ? existing.receivedAt
        : payload.receivedAt || null;

    if (barcode) {
      const conflict = db
        .prepare(
          `
        SELECT id
        FROM product_batches
        WHERE licenseId = ?
          AND COALESCE(deletedAt,'') = ''
          AND barcode = ?
          AND id <> ?
        LIMIT 1
        `,
        )
        .get(existing.licenseId, barcode, existing.id);

      if (conflict) {
        return {
          success: false,
          error: `Barcode ${barcode} is already used by another batch`,
        };
      }
    }

    const ts = nowISO();

    db.prepare(
      `
    UPDATE product_batches
    SET barcode = @barcode,
        mrp = @mrp,
        salePrice = @salePrice,
        costPrice = @costPrice,
        batchNo = @batchNo,
        mfgDate = @mfgDate,
        expiryDate = @expiryDate,
        receivedAt = @receivedAt,
        updatedAt = @updatedAt
    WHERE id = @id
    `,
    ).run({
      id: existing.id,
      barcode,
      mrp,
      salePrice,
      costPrice,
      batchNo,
      mfgDate,
      expiryDate,
      receivedAt,
      updatedAt: ts,
    });

    const batch = db
      .prepare(`SELECT * FROM product_batches WHERE id = ?`)
      .get(existing.id);

    return { success: true, batch };
  });

  ipcMain.handle("product.batch:delete", (e, { batchId }) => {
    if (!batchId) return { success: false, error: "batchId required" };

    const ts = nowISO();
    const b = db
      .prepare(`SELECT productId FROM product_batches WHERE id=?`)
      .get(batchId);
    if (!b) return { success: false, error: "NOT_FOUND" };

    db.prepare(
      `UPDATE product_batches SET deletedAt=?, updatedAt=? WHERE id=?`,
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
    },
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
    `,
      )
      .all(productId);

    const totalFromBatches = sum(batches.map((b) => b.stock || 0));
    return { success: true, product: p, batches, totalFromBatches };
  });
}

module.exports = { registerProductHandlers };
