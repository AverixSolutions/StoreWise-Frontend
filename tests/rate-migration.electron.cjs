const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, ipcMain } = require("electron");

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kynflow-rate-test-"));
const testDbPath = path.join(testRoot, "migration.db");
process.env.KYNFLOW_DB_PATH = testDbPath;

function loadDb() {
  const modulePath = require.resolve("../electron/db");
  delete require.cache[modulePath];
  return require(modulePath);
}

function hasColumn(db, table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((entry) => entry.name === column);
}

app.whenReady().then(async () => {
  try {
    let db = loadDb();

    for (const table of [
      "rate_types",
      "product_rates",
      "product_batch_rates",
    ]) {
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?`,
          )
          .get(table).count,
        1,
        `${table} should exist after a fresh migration`,
      );
    }
    assert.equal(hasColumn(db, "purchase_items", "sellingRatesJson"), true);
    assert.equal(hasColumn(db, "sale_items", "rateTypeId"), true);
    assert.equal(hasColumn(db, "quotation_items", "rateSource"), true);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO products (
         id, licenseId, code, codeNumber, name, unit, tax, costPrice,
         salePrice, stock, createdAt, updatedAt, isSynced
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(
      "legacy-product",
      "legacy-license",
      "00001",
      1,
      "Legacy Product",
      "NOS",
      "NT",
      50,
      75,
      2,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO product_batches (
         id, licenseId, productId, salePrice, costPrice, stock, createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "legacy-batch",
      "legacy-license",
      "legacy-product",
      80,
      50,
      2,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO sales (
         id, slNo, licenseId, billNo, saleDate, totalAmount, discount,
         saleType, createdAt, updatedAt, isSynced
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(
      "legacy-sale",
      99,
      "legacy-license",
      "LEGACY-1",
      now,
      75,
      0,
      "CASH",
      now,
      now,
    );
    db.prepare(
      `INSERT INTO sale_items (
         id, saleId, productId, quantity, unit, rate, taxPercent, taxAmount,
         totalCost, billedValue, lineNo, createdAt, updatedAt, isSynced
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(
      "legacy-sale-item",
      "legacy-sale",
      "legacy-product",
      1,
      "NOS",
      75,
      "NT",
      0,
      75,
      75,
      1,
      now,
      now,
    );

    db.prepare(
      `DELETE FROM _migrations WHERE name='multi_rate_master_v1'`,
    ).run();
    db.close();
    db = loadDb();

    const retail = db
      .prepare(
        `SELECT * FROM rate_types
         WHERE licenseId='legacy-license' AND code='RETAIL' AND deletedAt IS NULL`,
      )
      .get();
    assert.ok(retail, "upgrade migration should seed Retail");
    assert.equal(retail.isDefault, 1);
    assert.equal(
      db
        .prepare(
          `SELECT amount FROM product_rates
           WHERE productId='legacy-product' AND rateTypeId=? AND deletedAt IS NULL`,
        )
        .get(retail.id).amount,
      75,
    );
    assert.equal(
      db
        .prepare(
          `SELECT amount FROM product_batch_rates
           WHERE batchId='legacy-batch' AND rateTypeId=? AND deletedAt IS NULL`,
        )
        .get(retail.id).amount,
      80,
    );
    assert.deepEqual(
      db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM products WHERE licenseId='legacy-license') AS products,
             (SELECT COUNT(*) FROM product_batches WHERE licenseId='legacy-license') AS batches,
             (SELECT COUNT(*) FROM sales WHERE licenseId='legacy-license') AS sales,
             (SELECT totalAmount FROM sales WHERE id='legacy-sale') AS total,
             (SELECT rate FROM sale_items WHERE id='legacy-sale-item') AS rate,
             (SELECT rateSource FROM sale_items WHERE id='legacy-sale-item') AS source`,
        )
        .get(),
      {
        products: 1,
        batches: 1,
        sales: 1,
        total: 75,
        rate: 75,
        source: "LEGACY",
      },
    );
    const countsBeforeRestart = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM rate_types WHERE licenseId='legacy-license') AS rateTypes,
           (SELECT COUNT(*) FROM product_rates WHERE productId='legacy-product') AS productRates,
           (SELECT COUNT(*) FROM product_batch_rates WHERE batchId='legacy-batch') AS batchRates`,
      )
      .get();
    db.close();
    db = loadDb();
    assert.deepEqual(
      db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM rate_types WHERE licenseId='legacy-license') AS rateTypes,
             (SELECT COUNT(*) FROM product_rates WHERE productId='legacy-product') AS productRates,
             (SELECT COUNT(*) FROM product_batch_rates WHERE batchId='legacy-batch') AS batchRates`,
        )
        .get(),
      countsBeforeRestart,
      "restarting initialization must not create duplicate rate rows",
    );

    assert.throws(() => {
      db.prepare(
        `INSERT INTO rate_types (
           id, licenseId, code, name, isDefault, isActive, sortOrder,
           createdAt, updatedAt, isSynced
         ) VALUES (?, ?, ?, ?, 1, 1, 1, ?, ?, 0)`,
      ).run("second-default", "legacy-license", "SECOND", "Second", now, now);
    }, /UNIQUE constraint failed/);

    const { registerRateHandlers } = require("../electron/ipc/rates");
    registerRateHandlers();
    const invoke = async (channel, ...args) => {
      const handler = ipcMain._invokeHandlers?.get(channel);
      assert.equal(
        typeof handler,
        "function",
        `${channel} should be registered`,
      );
      return handler({}, ...args);
    };

    const originalDefaultId = retail.id;
    const bulkCreated = await invoke("rate-type:create-bulk", {
      licenseId: "legacy-license",
      rows: [
        {
          name: "Bulk Alpha",
          code: "BULK_ALPHA",
          sortOrder: 40,
          isActive: true,
          isDefault: false,
        },
        {
          name: "Bulk Beta",
          code: "BULK_BETA",
          sortOrder: 30,
          isActive: true,
          isDefault: false,
        },
      ],
    });
    assert.equal(bulkCreated.success, true, bulkCreated.error);
    assert.deepEqual(
      bulkCreated.rows.map((row) => row.code),
      ["BULK_BETA", "BULK_ALPHA"],
      "SQLite bulk results should be returned in final sort order",
    );
    assert.equal(
      db
        .prepare(`SELECT id FROM rate_types WHERE licenseId=? AND isDefault=1`)
        .get("legacy-license").id,
      originalDefaultId,
      "no supplied SQLite default must preserve the existing default",
    );
    assert.equal(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM rate_types WHERE code IN ('BULK_ALPHA','BULK_BETA') AND isSynced=0`,
        )
        .get().count,
      2,
      "SQLite bulk-created rows must be dirty for normal Rate Type sync",
    );

    const switchedBulk = await invoke("rate-type:create-bulk", {
      licenseId: "legacy-license",
      rows: [
        {
          name: "Bulk Default",
          code: "BULK_DEFAULT",
          sortOrder: 50,
          isActive: true,
          isDefault: true,
        },
      ],
    });
    assert.equal(switchedBulk.success, true, switchedBulk.error);
    assert.equal(
      db
        .prepare(
          `SELECT code FROM rate_types WHERE licenseId=? AND isDefault=1`,
        )
        .get("legacy-license").code,
      "BULK_DEFAULT",
      "one supplied SQLite default must switch atomically",
    );
    assert.equal(
      (
        await invoke("rate-type:set-default", {
          licenseId: "legacy-license",
          id: originalDefaultId,
        })
      ).success,
      true,
    );

    db.prepare(
      `
      CREATE TEMP TRIGGER force_rate_bulk_failure
      BEFORE INSERT ON rate_types
      WHEN NEW.code='FAIL_BULK'
      BEGIN SELECT RAISE(ABORT, 'forced bulk failure'); END
    `,
    ).run();
    const failedBulk = await invoke("rate-type:create-bulk", {
      licenseId: "legacy-license",
      rows: [
        {
          name: "Before Failure",
          code: "BEFORE_FAILURE",
          sortOrder: 60,
          isActive: true,
          isDefault: false,
        },
        {
          name: "Forced Failure",
          code: "FAIL_BULK",
          sortOrder: 70,
          isActive: true,
          isDefault: false,
        },
      ],
    });
    assert.equal(failedBulk.success, false);
    assert.equal(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM rate_types WHERE code IN ('BEFORE_FAILURE','FAIL_BULK')`,
        )
        .get().count,
      0,
      "a SQLite failure must roll back every inserted row",
    );
    db.prepare(`DROP TRIGGER force_rate_bulk_failure`).run();

    const crossedLicense = await invoke("rate-type:create-bulk", {
      licenseId: "legacy-license",
      rows: [
        {
          licenseId: "another-license",
          name: "Crossed License",
          code: "CROSSED_LICENSE",
          sortOrder: 80,
          isActive: true,
          isDefault: false,
        },
      ],
    });
    assert.equal(crossedLicense.success, false);
    assert.match(crossedLicense.error, /cannot cross license boundaries/i);
    assert.equal(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM rate_types WHERE code='CROSSED_LICENSE'`,
        )
        .get().count,
      0,
    );

    const invalidRuntimeBulk = await invoke("rate-type:create-bulk", {
      licenseId: "legacy-license",
      rows: [
        {
          name: "Invalid Runtime Row",
          code: "INVALID_RUNTIME_ROW",
          sortOrder: null,
          isActive: true,
          isDefault: false,
        },
      ],
    });
    assert.equal(invalidRuntimeBulk.success, false);
    assert.match(
      invalidRuntimeBulk.error,
      /order must be a non-negative whole number/i,
    );
    assert.equal(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM rate_types WHERE code='INVALID_RUNTIME_ROW'`,
        )
        .get().count,
      0,
      "runtime bulk validation must reject coercible invalid sort orders",
    );

    const bulkDefaults = await invoke("rate-type:bulk-upsert", [
      {
        id: "sync-a-retail",
        licenseId: "sync-license-a",
        code: "RETAIL",
        name: "Retail",
        isDefault: true,
        isActive: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sync-a-wholesale",
        licenseId: "sync-license-a",
        code: "WHOLESALE",
        name: "Wholesale",
        isDefault: true,
        isActive: true,
        sortOrder: 10,
        createdAt: now,
        updatedAt: new Date(Date.parse(now) + 1_000).toISOString(),
      },
      {
        id: "sync-b-retail",
        licenseId: "sync-license-b",
        code: "RETAIL",
        name: "Retail",
        isDefault: true,
        isActive: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sync-b-dealer",
        licenseId: "sync-license-b",
        code: "DEALER",
        name: "Dealer",
        isDefault: true,
        isActive: true,
        sortOrder: 10,
        createdAt: now,
        updatedAt: new Date(Date.parse(now) + 2_000).toISOString(),
      },
    ]);
    assert.equal(bulkDefaults.success, true, bulkDefaults.error);
    assert.deepEqual(
      db
        .prepare(
          `
          SELECT licenseId, COUNT(*) AS count
          FROM rate_types
          WHERE licenseId IN ('sync-license-a', 'sync-license-b')
            AND isDefault=1 AND isActive=1 AND deletedAt IS NULL
          GROUP BY licenseId
          ORDER BY licenseId
        `,
        )
        .all(),
      [
        { licenseId: "sync-license-a", count: 1 },
        { licenseId: "sync-license-b", count: 1 },
      ],
      "bulk reconciliation must choose exactly one default per license",
    );

    const wholesale = await invoke("rate-type:save", {
      licenseId: "legacy-license",
      code: " wholesale ",
      name: "Wholesale",
      isActive: true,
      sortOrder: 10,
    });
    assert.equal(wholesale.success, true);
    const productSave = await invoke("product-rate:save", {
      licenseId: "legacy-license",
      productId: "legacy-product",
      rates: [
        { rateTypeId: retail.id, amount: 75 },
        { rateTypeId: wholesale.id, amount: 70 },
      ],
    });
    assert.equal(productSave.success, true);
    assert.equal(
      (
        await invoke("rate-type:set-default", {
          licenseId: "legacy-license",
          id: wholesale.id,
        })
      ).success,
      true,
    );
    assert.equal(
      db
        .prepare(`SELECT salePrice FROM products WHERE id='legacy-product'`)
        .get().salePrice,
      70,
    );
    assert.equal(
      db
        .prepare(
          `SELECT salePrice FROM product_batches WHERE id='legacy-batch'`,
        )
        .get().salePrice,
      70,
      "batch mirror should fall back to the product default",
    );
    assert.equal(
      (
        await invoke("product-batch-rate:save", {
          licenseId: "legacy-license",
          productId: "legacy-product",
          batchId: "legacy-batch",
          rates: [{ rateTypeId: wholesale.id, amount: 68 }],
        })
      ).success,
      true,
    );
    assert.equal(
      db
        .prepare(
          `SELECT salePrice FROM product_batches WHERE id='legacy-batch'`,
        )
        .get().salePrice,
      68,
    );
    assert.equal(
      (
        await invoke("product-batch-rate:save", {
          licenseId: "legacy-license",
          productId: "legacy-product",
          batchId: "legacy-batch",
          rates: [{ rateTypeId: wholesale.id, amount: null }],
        })
      ).success,
      true,
    );
    assert.equal(
      db
        .prepare(
          `SELECT salePrice FROM product_batches WHERE id='legacy-batch'`,
        )
        .get().salePrice,
      70,
    );

    require("../electron/ipc/purchases").registerPurchaseHandlers();
    require("../electron/ipc/sales").registerSaleHandlers();
    require("../electron/ipc/quotations").registerQuotationHandlers();

    const sellingRatesJson = JSON.stringify([
      {
        rateTypeId: retail.id,
        code: "RETAIL",
        name: "Retail",
        amount: 77,
      },
      {
        rateTypeId: wholesale.id,
        code: "WHOLESALE",
        name: "Wholesale",
        amount: 72,
      },
    ]);
    const purchase = await invoke(
      "create-purchase",
      {
        licenseId: "legacy-license",
        userId: "test-user",
        billNo: "PUR-TEST-1",
        purchaseType: "CASH",
        purchaseDate: now,
        entryTime: now,
      },
      [
        {
          productId: "legacy-product",
          quantity: 3,
          unit: "NOS",
          rate: 50,
          mrp: 100,
          taxPercent: "NT",
          discount: 0,
          discountType: "ABS",
          salePrice: 72,
          lineNo: 1,
          sellingRatesJson,
        },
      ],
    );
    assert.equal(purchase.success, true);
    const purchasedItem = db
      .prepare(`SELECT * FROM purchase_items WHERE purchaseId=?`)
      .get(purchase.purchaseId);
    assert.equal(purchasedItem.sellingRatesJson, sellingRatesJson);
    assert.equal(
      db
        .prepare(
          `SELECT amount FROM product_rates
           WHERE productId='legacy-product' AND rateTypeId=? AND deletedAt IS NULL`,
        )
        .get(wholesale.id).amount,
      72,
    );
    assert.equal(
      (
        await invoke("purchase:update", {
          id: purchase.purchaseId,
          header: {
            billNo: "PUR-TEST-1",
            purchaseType: "CASH",
            purchaseDate: now,
            entryTime: now,
            discount: 0,
          },
          items: [
            {
              productId: "legacy-product",
              batchId: purchasedItem.batchId,
              barcode: purchasedItem.barcode,
              quantity: 3,
              unit: "NOS",
              rate: 50,
              mrp: 100,
              taxPercent: "NT",
              taxAmount: 0,
              discount: 0,
              discountType: "ABS",
              salePrice: 72,
              profit: 22,
              totalCost: 150,
              billedValue: 150,
              effectiveUnitValue: 50,
              lineNo: 1,
              sellingRatesJson,
            },
          ],
        })
      ).success,
      true,
    );
    const currentPurchasedItem = db
      .prepare(
        `SELECT * FROM purchase_items
         WHERE purchaseId=? AND deletedAt IS NULL
         ORDER BY createdAt DESC LIMIT 1`,
      )
      .get(purchase.purchaseId);

    const sale = await invoke(
      "create-sale",
      {
        licenseId: "legacy-license",
        userId: "test-user",
        saleType: "CASH",
        saleDate: now,
        entryTime: now,
      },
      [
        {
          productId: "legacy-product",
          batchId: currentPurchasedItem.batchId,
          quantity: 1,
          unit: "NOS",
          rate: 72,
          salePrice: 72,
          taxPercent: "NT",
          discount: 0,
          discountType: "ABS",
          lineNo: 1,
          rateTypeId: wholesale.id,
          rateTypeCode: "WHOLESALE",
          rateTypeName: "Wholesale",
          rateSource: "MASTER",
        },
      ],
    );
    assert.equal(sale.success, true);
    const savedSaleItem = db
      .prepare(`SELECT * FROM sale_items WHERE saleId=?`)
      .get(sale.saleId);
    assert.equal(savedSaleItem.rateTypeId, wholesale.id);
    assert.equal(savedSaleItem.rateTypeName, "Wholesale");
    assert.equal(savedSaleItem.rate, 72);
    const updatedSale = await invoke("sale:update", {
      id: sale.saleId,
      header: {
        licenseId: "legacy-license",
        saleType: "CASH",
        saleDate: now,
        entryTime: now,
        discount: 0,
      },
      items: [
        {
          productId: "legacy-product",
          batchId: currentPurchasedItem.batchId,
          quantity: 1,
          unit: "NOS",
          rate: 72,
          salePrice: 72,
          taxPercent: "NT",
          taxAmount: 0,
          discount: 0,
          discountType: "ABS",
          profit: 0,
          totalCost: 72,
          billedValue: 72,
          effectiveUnitValue: 72,
          lineNo: 1,
          rateTypeId: wholesale.id,
          rateTypeCode: "WHOLESALE",
          rateTypeName: "Wholesale",
          rateSource: "MASTER",
        },
      ],
    });
    assert.equal(updatedSale.success, true, updatedSale.error);

    const customSale = await invoke(
      "create-sale",
      {
        licenseId: "legacy-license",
        userId: "test-user",
        saleType: "CASH",
        saleDate: now,
        entryTime: now,
      },
      [
        {
          productId: "legacy-product",
          batchId: currentPurchasedItem.batchId,
          quantity: 1,
          unit: "NOS",
          rate: 60,
          salePrice: 60,
          taxPercent: "NT",
          discount: 0,
          discountType: "ABS",
          lineNo: 1,
          rateTypeName: "Custom",
          rateSource: "CUSTOM",
        },
      ],
    );
    assert.equal(customSale.success, true);
    assert.equal(
      db
        .prepare(
          `SELECT amount FROM product_rates
           WHERE productId='legacy-product' AND rateTypeId=? AND deletedAt IS NULL`,
        )
        .get(wholesale.id).amount,
      72,
      "a custom sale must not change master values",
    );
    require("../electron/ipc/saleReturns").registerSaleReturnHandlers();
    require("../electron/ipc/purchaseReturns").registerPurchaseReturnHandlers();
    const saleReturn = await invoke("sale-return:create", {
      header: {
        licenseId: "legacy-license",
        userId: "test-user",
        saleType: "CASH",
        returnDate: now,
        entryTime: now,
        discount: 0,
      },
      items: [
        {
          productId: "legacy-product",
          batchId: currentPurchasedItem.batchId,
          quantity: 1,
          unit: "NOS",
          rate: 72,
          salePrice: 72,
          taxPercent: "NT",
          taxAmount: 0,
          discount: 0,
          discountType: "ABS",
          profit: 0,
          totalCost: 72,
          billedValue: 72,
          effectiveUnitValue: 72,
          lineNo: 1,
          rateTypeId: wholesale.id,
          rateTypeCode: "WHOLESALE",
          rateTypeName: "Wholesale",
          rateSource: "MASTER",
        },
      ],
    });
    assert.equal(saleReturn.success, true, saleReturn.error);
    const savedReturnItem = db
      .prepare(`SELECT * FROM sale_return_items WHERE returnId=?`)
      .get(saleReturn.returnId);
    assert.equal(savedReturnItem.rate, 72);
    assert.equal(savedReturnItem.rateTypeName, "Wholesale");

    db.prepare(
      `UPDATE purchases
       SET supplierId=?, supplierName=?
       WHERE id=?`,
    ).run(
      "legacy-return-supplier",
      "Legacy Return Supplier",
      purchase.purchaseId,
    );
    const purchaseReturn = await invoke("purchase-return:create", {
      header: {
        licenseId: "legacy-license",
        userId: "test-user",
        purchaseId: purchase.purchaseId,
        supplierId: "legacy-return-supplier",
        supplierName: "Legacy Return Supplier",
        purchaseType: "CASH",
        returnDate: now,
        entryTime: now,
        discount: 0,
      },
      items: [
        {
          purchaseItemId: currentPurchasedItem.id,
          productId: "legacy-product",
          batchId: currentPurchasedItem.batchId,
          quantity: 1,
          unit: "NOS",
          rate: 50,
          salePrice: 72,
          taxPercent: "NT",
          taxAmount: 0,
          discount: 0,
          discountType: "ABS",
          profit: 22,
          totalCost: 50,
          billedValue: 50,
          effectiveUnitValue: 50,
          lineNo: 1,
          sellingRatesJson,
        },
      ],
    });
    assert.equal(purchaseReturn.success, true, purchaseReturn.error);
    const savedPurchaseReturn = db
      .prepare(`SELECT purchaseId FROM purchase_returns WHERE id=?`)
      .get(purchaseReturn.returnId);
    assert.equal(
      savedPurchaseReturn.purchaseId,
      purchase.purchaseId,
      "purchase returns must preserve their source Purchase",
    );

    const savedPurchaseReturnItem = db
      .prepare(
        `SELECT purchaseItemId, sellingRatesJson
         FROM purchase_return_items
         WHERE returnId=?`,
      )
      .get(purchaseReturn.returnId);
    assert.equal(
      savedPurchaseReturnItem.purchaseItemId,
      currentPurchasedItem.id,
      "purchase return items must preserve their source Purchase item",
    );
    assert.equal(savedPurchaseReturnItem.sellingRatesJson, sellingRatesJson);
    assert.equal(
      db
        .prepare(
          `SELECT amount FROM product_rates
           WHERE productId='legacy-product' AND rateTypeId=? AND deletedAt IS NULL`,
        )
        .get(wholesale.id).amount,
      72,
      "purchase returns must not overwrite rate masters",
    );

    const dealer = await invoke("rate-type:save", {
      licenseId: "legacy-license",
      code: "DEALER",
      name: "Dealer",
      isActive: true,
      sortOrder: 20,
    });
    assert.equal(dealer.success, true);
    assert.equal(
      (
        await invoke("product-rate:save", {
          licenseId: "legacy-license",
          productId: "legacy-product",
          rates: [{ rateTypeId: dealer.id, amount: 65 }],
        })
      ).success,
      true,
    );
    require("../electron/ipc/products").registerProductHandlers();
    const createdProduct = await invoke("create-product", {
      licenseId: "legacy-license",
      code: "00002",
      codeNumber: 2,
      name: "Three Rate Product",
      brand: null,
      category: null,
      unit: "NOS",
      tax: "NT",
      costPrice: 40,
      salePrice: 90,
      rates: [
        { rateTypeId: retail.id, amount: 90 },
        { rateTypeId: wholesale.id, amount: 80 },
        { rateTypeId: dealer.id, amount: 75 },
      ],
    });
    assert.equal(createdProduct.success, true);
    assert.deepEqual(
      db
        .prepare(
          `SELECT amount FROM product_rates
           WHERE productId=? AND deletedAt IS NULL ORDER BY amount`,
        )
        .all(createdProduct.productId)
        .map((row) => row.amount),
      [75, 80, 90],
    );
    assert.equal(
      (
        await invoke("update-product", createdProduct.productId, {
          shortCode: null,
          name: "Three Rate Product Edited",
          brand: null,
          category: null,
          unit: "NOS",
          tax: "NT",
          costPrice: 42,
          salePrice: 82,
          rates: [
            { rateTypeId: retail.id, amount: 92 },
            { rateTypeId: wholesale.id, amount: 82 },
            { rateTypeId: dealer.id, amount: null },
          ],
        })
      ).success,
      true,
    );
    assert.deepEqual(
      db
        .prepare(
          `SELECT amount FROM product_rates
           WHERE productId=? AND deletedAt IS NULL ORDER BY amount`,
        )
        .all(createdProduct.productId)
        .map((row) => row.amount),
      [82, 92],
    );
    const quotation = await invoke(
      "quotation:create",
      {
        licenseId: "legacy-license",
        userId: "test-user",
        quotationDate: now,
        entryTime: now,
        status: "DRAFT",
      },
      [
        {
          productId: "legacy-product",
          quantity: 1,
          unit: "NOS",
          rate: 65,
          salePrice: 65,
          taxPercent: "NT",
          discount: 0,
          discountType: "ABS",
          lineNo: 1,
          rateTypeId: dealer.id,
          rateTypeCode: "DEALER",
          rateTypeName: "Dealer",
          rateSource: "MASTER",
        },
      ],
    );
    assert.equal(quotation.success, true);
    const savedQuotationItem = db
      .prepare(`SELECT * FROM quotation_items WHERE quotationId=?`)
      .get(quotation.quotationId);
    assert.equal(savedQuotationItem.rate, 65);
    assert.equal(savedQuotationItem.rateTypeName, "Dealer");
    assert.equal(
      (
        await invoke("quotation:update", {
          id: quotation.quotationId,
          header: {
            quotationDate: now,
            entryTime: now,
            discount: 0,
            status: "DRAFT",
          },
          items: [
            {
              productId: "legacy-product",
              quantity: 1,
              unit: "NOS",
              rate: 65,
              salePrice: 65,
              taxPercent: "NT",
              taxAmount: 0,
              discount: 0,
              discountType: "ABS",
              totalCost: 65,
              billedValue: 65,
              effectiveUnitValue: 65,
              lineNo: 1,
              rateTypeId: dealer.id,
              rateTypeCode: "DEALER",
              rateTypeName: "Dealer",
              rateSource: "MASTER",
            },
          ],
        })
      ).success,
      true,
    );
    assert.equal(
      (
        await invoke(
          "quotation:mark-converted",
          quotation.quotationId,
          sale.saleId,
        )
      ).success,
      true,
    );
    assert.equal(
      (
        await invoke("rate-type:set-default", {
          licenseId: "legacy-license",
          id: retail.id,
        })
      ).success,
      true,
    );
    assert.equal(
      db
        .prepare(`SELECT salePrice FROM products WHERE id='legacy-product'`)
        .get().salePrice,
      77,
    );
    assert.equal(
      db
        .prepare(`SELECT salePrice FROM product_batches WHERE id=?`)
        .get(currentPurchasedItem.batchId).salePrice,
      77,
    );
    const retailSale = await invoke(
      "create-sale",
      {
        licenseId: "legacy-license",
        userId: "test-user",
        saleType: "CASH",
        saleDate: now,
        entryTime: now,
      },
      [
        {
          productId: "legacy-product",
          batchId: currentPurchasedItem.batchId,
          quantity: 1,
          unit: "NOS",
          rate: 77,
          salePrice: 77,
          taxPercent: "NT",
          discount: 0,
          discountType: "ABS",
          lineNo: 1,
          rateTypeId: retail.id,
          rateTypeCode: "RETAIL",
          rateTypeName: "Retail",
          rateSource: "MASTER",
        },
      ],
    );
    assert.equal(retailSale.success, true, retailSale.error);
    assert.deepEqual(
      db
        .prepare(`SELECT rate, rateTypeName FROM sale_items WHERE saleId=?`)
        .get(retailSale.saleId),
      { rate: 77, rateTypeName: "Retail" },
    );
    assert.equal(
      (
        await invoke("rate-type:toggle", {
          licenseId: "legacy-license",
          id: dealer.id,
          isActive: false,
        })
      ).success,
      true,
    );
    assert.deepEqual(
      db
        .prepare(
          `SELECT rate, rateTypeName FROM quotation_items WHERE quotationId=?`,
        )
        .get(quotation.quotationId),
      { rate: 65, rateTypeName: "Dealer" },
      "deactivating a rate must not reinterpret quotation history",
    );
    assert.deepEqual(
      db
        .prepare(`SELECT rate, rateTypeName FROM sale_items WHERE saleId=?`)
        .get(sale.saleId),
      { rate: 72, rateTypeName: "Wholesale" },
      "default changes must not rewrite historical sales",
    );

    db.close();
    fs.rmSync(testRoot, { recursive: true, force: true });
    console.log("Rate migration and transaction-pricing checks passed.");
    app.exit(0);
  } catch (error) {
    console.error(error);
    try {
      fs.rmSync(testRoot, { recursive: true, force: true });
    } catch {}
    app.exit(1);
  }
});
