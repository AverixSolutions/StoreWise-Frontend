// electron/ipc/dashboard.js
const { ipcMain } = require("electron");
const db = require("../db");

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toLocalIsoDate(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function numberify(value) {
  return Number(value || 0);
}

function registerDashboardHandlers() {
  try {
    ipcMain.removeHandler("dashboard:getOverview");
  } catch (_) {}

  ipcMain.handle(
    "dashboard:getOverview",
    async (_event, { licenseId, days = 7 } = {}) => {
      if (!licenseId) {
        throw new Error("licenseId is required");
      }

      const safeDays = Math.max(7, Math.min(Number(days || 7), 30));
      const today = new Date();
      const todayIso = toLocalIsoDate(today);
      const rangeStartIso = toLocalIsoDate(addDays(today, -(safeDays - 1)));
      const last30StartIso = toLocalIsoDate(addDays(today, -29));

      const shopRow =
        db
          .prepare(
            `
          SELECT shopName
          FROM shop_settings
          WHERE licenseId = ?
          LIMIT 1
        `,
          )
          .get(licenseId) || {};

      const itemStats =
        db
          .prepare(
            `
          SELECT
            COUNT(*) AS itemCount,
            COALESCE(SUM(CASE WHEN COALESCE(stock, 0) = 0 THEN 1 ELSE 0 END), 0) AS zeroStockCount,
            COALESCE(SUM(CASE WHEN COALESCE(stock, 0) BETWEEN 1 AND 5 THEN 1 ELSE 0 END), 0) AS lowStockCount
          FROM products
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
        `,
          )
          .get(licenseId) || {};

      const batchStats =
        db
          .prepare(
            `
          SELECT
            COUNT(*) AS liveBatchCount,
            COALESCE(SUM(CASE WHEN COALESCE(stock, 0) > 0 THEN stock ELSE 0 END), 0) AS stockQty,
            COALESCE(SUM(CASE WHEN COALESCE(stock, 0) > 0 THEN stock * COALESCE(costPrice, 0) ELSE 0 END), 0) AS inventoryCostValue,
            COALESCE(SUM(CASE WHEN COALESCE(stock, 0) > 0 THEN stock * COALESCE(salePrice, mrp, 0) ELSE 0 END), 0) AS inventorySaleValue
          FROM product_batches
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
        `,
          )
          .get(licenseId) || {};

      const todaySales =
        db
          .prepare(
            `
          SELECT
            COUNT(*) AS count,
            COALESCE(SUM(totalAmount), 0) AS amount
          FROM sales
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
            AND substr(COALESCE(saleDate, createdAt), 1, 10) = ?
        `,
          )
          .get(licenseId, todayIso) || {};

      const todayPurchases =
        db
          .prepare(
            `
          SELECT
            COUNT(*) AS count,
            COALESCE(SUM(totalAmount), 0) AS amount
          FROM purchases
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
            AND substr(COALESCE(purchaseDate, createdAt), 1, 10) = ?
        `,
          )
          .get(licenseId, todayIso) || {};

      const last30Sales =
        db
          .prepare(
            `
          SELECT
            COUNT(*) AS count,
            COALESCE(SUM(totalAmount), 0) AS amount
          FROM sales
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
            AND substr(COALESCE(saleDate, createdAt), 1, 10) >= ?
        `,
          )
          .get(licenseId, last30StartIso) || {};

      const last30Purchases =
        db
          .prepare(
            `
          SELECT
            COUNT(*) AS count,
            COALESCE(SUM(totalAmount), 0) AS amount
          FROM purchases
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
            AND substr(COALESCE(purchaseDate, createdAt), 1, 10) >= ?
        `,
          )
          .get(licenseId, last30StartIso) || {};

      const customerCount =
        db
          .prepare(
            `
          SELECT COUNT(*) AS count
          FROM customers
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
        `,
          )
          .get(licenseId) || {};

      const supplierCount =
        db
          .prepare(
            `
          SELECT COUNT(*) AS count
          FROM suppliers
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
        `,
          )
          .get(licenseId) || {};

      const receivableBalance =
        db
          .prepare(
            `
          SELECT COALESCE(SUM(amount * sign), 0) AS balance
          FROM customer_transactions
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
        `,
          )
          .get(licenseId) || {};

      const payableBalance =
        db
          .prepare(
            `
          SELECT COALESCE(SUM(amount * sign), 0) AS balance
          FROM supplier_transactions
          WHERE licenseId = ?
            AND COALESCE(deletedAt, '') = ''
        `,
          )
          .get(licenseId) || {};

      const salesSeriesRows = db
        .prepare(
          `
        SELECT
          substr(COALESCE(saleDate, createdAt), 1, 10) AS day,
          COALESCE(SUM(totalAmount), 0) AS total
        FROM sales
        WHERE licenseId = ?
          AND COALESCE(deletedAt, '') = ''
          AND substr(COALESCE(saleDate, createdAt), 1, 10) >= ?
        GROUP BY day
        ORDER BY day ASC
      `,
        )
        .all(licenseId, rangeStartIso);

      const purchaseSeriesRows = db
        .prepare(
          `
        SELECT
          substr(COALESCE(purchaseDate, createdAt), 1, 10) AS day,
          COALESCE(SUM(totalAmount), 0) AS total
        FROM purchases
        WHERE licenseId = ?
          AND COALESCE(deletedAt, '') = ''
          AND substr(COALESCE(purchaseDate, createdAt), 1, 10) >= ?
        GROUP BY day
        ORDER BY day ASC
      `,
        )
        .all(licenseId, rangeStartIso);

      const salesMap = new Map(
        salesSeriesRows.map((row) => [row.day, numberify(row.total)]),
      );
      const purchasesMap = new Map(
        purchaseSeriesRows.map((row) => [row.day, numberify(row.total)]),
      );

      const series = Array.from({ length: safeDays }).map((_, index) => {
        const day = toLocalIsoDate(addDays(today, -(safeDays - 1 - index)));
        return {
          day,
          sales: salesMap.get(day) || 0,
          purchases: purchasesMap.get(day) || 0,
        };
      });

      const topProducts = db
        .prepare(
          `
        SELECT
          si.productId AS productId,
          COALESCE(p.name, 'Unknown item') AS name,
          COALESCE(SUM(si.quantity), 0) AS soldQty,
          COALESCE(
            SUM(
              COALESCE(si.billedValue, si.totalCost, (COALESCE(si.quantity, 0) * COALESCE(si.rate, 0)))
            ),
            0
          ) AS revenue
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.saleId
        LEFT JOIN products p ON p.id = si.productId
        WHERE s.licenseId = ?
          AND COALESCE(s.deletedAt, '') = ''
          AND COALESCE(si.deletedAt, '') = ''
          AND substr(COALESCE(s.saleDate, s.createdAt), 1, 10) >= ?
        GROUP BY si.productId, p.name
        ORDER BY soldQty DESC, revenue DESC
        LIMIT 6
      `,
        )
        .all(licenseId, last30StartIso)
        .map((row) => ({
          productId: row.productId,
          name: row.name,
          soldQty: numberify(row.soldQty),
          revenue: numberify(row.revenue),
        }));

      const lowStockItems = db
        .prepare(
          `
        SELECT
          id,
          name,
          COALESCE(stock, 0) AS stock
        FROM products
        WHERE licenseId = ?
          AND COALESCE(deletedAt, '') = ''
          AND COALESCE(stock, 0) <= 5
        ORDER BY COALESCE(stock, 0) ASC, name ASC
        LIMIT 6
      `,
        )
        .all(licenseId)
        .map((row) => ({
          id: row.id,
          name: row.name,
          stock: numberify(row.stock),
        }));

      const recentSales = db
        .prepare(
          `
        SELECT
          id,
          slNo,
          customerName,
          totalAmount,
          saleDate,
          createdAt
        FROM sales
        WHERE licenseId = ?
          AND COALESCE(deletedAt, '') = ''
        ORDER BY COALESCE(updatedAt, createdAt, saleDate) DESC
        LIMIT 5
      `,
        )
        .all(licenseId)
        .map((row) => ({
          id: row.id,
          slNo: row.slNo,
          name: row.customerName || "Walk-in customer",
          amount: numberify(row.totalAmount),
          date: row.saleDate || row.createdAt || "",
          type: "SALE",
        }));

      const recentPurchases = db
        .prepare(
          `
        SELECT
          id,
          slNo,
          supplierName,
          totalAmount,
          purchaseDate,
          createdAt
        FROM purchases
        WHERE licenseId = ?
          AND COALESCE(deletedAt, '') = ''
        ORDER BY COALESCE(updatedAt, createdAt, purchaseDate) DESC
        LIMIT 5
      `,
        )
        .all(licenseId)
        .map((row) => ({
          id: row.id,
          slNo: row.slNo,
          name: row.supplierName || "Supplier",
          amount: numberify(row.totalAmount),
          date: row.purchaseDate || row.createdAt || "",
          type: "PURCHASE",
        }));

      const recentActivity = [...recentSales, ...recentPurchases]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 6);

      return {
        shopName: shopRow.shopName || "",
        kpis: {
          itemCount: numberify(itemStats.itemCount),
          liveBatchCount: numberify(batchStats.liveBatchCount),
          stockQty: numberify(batchStats.stockQty),
          inventoryCostValue: numberify(batchStats.inventoryCostValue),
          inventorySaleValue: numberify(batchStats.inventorySaleValue),
          todaySalesCount: numberify(todaySales.count),
          todaySalesAmount: numberify(todaySales.amount),
          todayPurchaseCount: numberify(todayPurchases.count),
          todayPurchaseAmount: numberify(todayPurchases.amount),
          sales30Count: numberify(last30Sales.count),
          sales30Amount: numberify(last30Sales.amount),
          purchases30Count: numberify(last30Purchases.count),
          purchases30Amount: numberify(last30Purchases.amount),
          customerCount: numberify(customerCount.count),
          supplierCount: numberify(supplierCount.count),
          receivableAmount: Math.max(numberify(receivableBalance.balance), 0),
          payableAmount: Math.max(numberify(payableBalance.balance), 0),
          zeroStockCount: numberify(itemStats.zeroStockCount),
          lowStockCount: numberify(itemStats.lowStockCount),
        },
        series,
        topProducts,
        lowStockItems,
        recentActivity,
        lastUpdatedAt: new Date().toISOString(),
      };
    },
  );
}

module.exports = { registerDashboardHandlers };
