// src/platform/web/dashboard.ts

import { STORES, idbGetAllByIndex, idbGetAll } from "./idb";
import type { DashboardOverviewResult } from "../types";

function toDay(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export async function webGetDashboardOverview(
  licenseId: string,
  days = 7,
): Promise<DashboardOverviewResult> {
  try {
    // ── Fetch all stores in parallel ─────────────────────────────────────────
    const [products, batches, purchases, sales, suppliers, customers] =
      await Promise.all([
        idbGetAllByIndex<any>(STORES.PRODUCTS, "licenseId", licenseId),
        idbGetAllByIndex<any>(STORES.PRODUCT_BATCHES, "licenseId", licenseId),
        idbGetAllByIndex<any>(STORES.PURCHASES, "licenseId", licenseId),
        idbGetAllByIndex<any>(STORES.SALES, "licenseId", licenseId),
        idbGetAllByIndex<any>(STORES.SUPPLIERS, "licenseId", licenseId),
        idbGetAllByIndex<any>(STORES.CUSTOMERS, "licenseId", licenseId),
      ]);

    const now = new Date();
    const todayStr = toDay(now);
    const cutoff30 = daysAgo(30);

    // ── Products ──────────────────────────────────────────────────────────────
    const liveProducts = products.filter((p: any) => !p.deletedAt);
    const liveBatches = batches.filter((b: any) => !b.deletedAt);

    const itemCount = liveProducts.length;
    const liveBatchCount = liveBatches.length;

    let stockQty = 0;
    let inventoryCostValue = 0;
    let inventorySaleValue = 0;
    let zeroStockCount = 0;
    let lowStockCount = 0;

    const LOW_STOCK_THRESHOLD = 5;

    for (const p of liveProducts) {
      const stock = Number(p.stock ?? 0);
      stockQty += stock;
      inventoryCostValue += stock * Number(p.costPrice ?? 0);
      inventorySaleValue += stock * Number(p.salePrice ?? p.costPrice ?? 0);
      if (stock === 0) zeroStockCount++;
      else if (stock <= LOW_STOCK_THRESHOLD) lowStockCount++;
    }

    const lowStockItems = liveProducts
      .filter((p: any) => Number(p.stock ?? 0) <= LOW_STOCK_THRESHOLD)
      .sort((a: any, b: any) => Number(a.stock ?? 0) - Number(b.stock ?? 0))
      .slice(0, 10)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        stock: Number(p.stock ?? 0),
      }));

    // ── Sales ─────────────────────────────────────────────────────────────────
    const liveSales = sales.filter((s: any) => !s.deletedAt);

    let todaySalesCount = 0;
    let todaySalesAmount = 0;
    let sales30Count = 0;
    let sales30Amount = 0;

    for (const s of liveSales) {
      const day = toDay(s.saleDate);
      const amount = Number(s.totalAmount ?? 0);
      if (day === todayStr) {
        todaySalesCount++;
        todaySalesAmount += amount;
      }
      if (new Date(s.saleDate) >= cutoff30) {
        sales30Count++;
        sales30Amount += amount;
      }
    }

    // ── Purchases ─────────────────────────────────────────────────────────────
    const livePurchases = purchases.filter((p: any) => !p.deletedAt);

    let todayPurchaseCount = 0;
    let todayPurchaseAmount = 0;
    let purchases30Count = 0;
    let purchases30Amount = 0;

    for (const p of livePurchases) {
      const day = toDay(p.purchaseDate);
      const amount = Number(p.totalAmount ?? 0);
      if (day === todayStr) {
        todayPurchaseCount++;
        todayPurchaseAmount += amount;
      }
      if (new Date(p.purchaseDate) >= cutoff30) {
        purchases30Count++;
        purchases30Amount += amount;
      }
    }

    // ── Suppliers & Customers ─────────────────────────────────────────────────
    const supplierCount = suppliers.filter((s: any) => !s.deletedAt).length;
    const customerCount = customers.filter((c: any) => !c.deletedAt).length;

    // PAYABLES/RECEIVABLES: ledger transactions not in IDB → show 0 honestly
    const receivableAmount = 0;
    const payableAmount = 0;

    // ── Series (last N days) ──────────────────────────────────────────────────
    const seriesMap = new Map<string, { sales: number; purchases: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      seriesMap.set(toDay(d), { sales: 0, purchases: 0 });
    }
    for (const s of liveSales) {
      const day = toDay(s.saleDate);
      if (seriesMap.has(day)) {
        seriesMap.get(day)!.sales += Number(s.totalAmount ?? 0);
      }
    }
    for (const p of livePurchases) {
      const day = toDay(p.purchaseDate);
      if (seriesMap.has(day)) {
        seriesMap.get(day)!.purchases += Number(p.totalAmount ?? 0);
      }
    }
    const series = Array.from(seriesMap.entries()).map(([day, v]) => ({
      day,
      sales: v.sales,
      purchases: v.purchases,
    }));

    // ── Top Products ──────────────────────────────────────────────────────────
    const validSaleIds = new Set(liveSales.map((s: any) => s.id));
    const productNameMap = new Map(
      liveProducts.map((p: any) => [p.id, p.name]),
    );

    let topProducts: Array<{
      productId: string;
      name: string;
      soldQty: number;
      revenue: number;
    }> = [];

    try {
      const allSaleItems = await idbGetAll<any>(STORES.SALE_ITEMS);
      const licSaleItems = allSaleItems.filter(
        (si: any) => validSaleIds.has(si.saleId) && !si.deletedAt,
      );

      const productSalesMap = new Map<
        string,
        { soldQty: number; revenue: number }
      >();
      for (const si of licSaleItems) {
        const pid = si.productId;
        if (!pid) continue;
        const prev = productSalesMap.get(pid) ?? { soldQty: 0, revenue: 0 };
        productSalesMap.set(pid, {
          soldQty: prev.soldQty + Number(si.quantity ?? 0),
          revenue: prev.revenue + Number(si.billedValue ?? si.totalCost ?? 0),
        });
      }

      topProducts = Array.from(productSalesMap.entries())
        .map(([productId, stats]) => ({
          productId,
          name: productNameMap.get(productId) ?? "Unknown Product",
          soldQty: stats.soldQty,
          revenue: stats.revenue,
        }))
        .sort((a, b) => b.soldQty - a.soldQty)
        .slice(0, 5);
    } catch {
      // sale_items fetch failed — leave topProducts empty
    }

    // ── Recent Activity ───────────────────────────────────────────────────────
    const recentSales = [...liveSales]
      .sort(
        (a: any, b: any) =>
          new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime(),
      )
      .slice(0, 4)
      .map((s: any) => ({
        id: s.id,
        slNo: s.slNo,
        name: s.customerName || s.billNo || "Walk-in",
        amount: Number(s.totalAmount ?? 0),
        date: s.saleDate,
        type: "SALE" as const,
      }));

    const recentPurchases = [...livePurchases]
      .sort(
        (a: any, b: any) =>
          new Date(b.purchaseDate).getTime() -
          new Date(a.purchaseDate).getTime(),
      )
      .slice(0, 4)
      .map((p: any) => ({
        id: p.id,
        slNo: p.slNo,
        name: p.supplierName || p.billNo || "Purchase",
        amount: Number(p.totalAmount ?? 0),
        date: p.purchaseDate,
        type: "PURCHASE" as const,
      }));

    const recentActivity = [...recentSales, ...recentPurchases]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    // ── Shop name ─────────────────────────────────────────────────────────────
    let shopName = "KYNFLOW";
    try {
      const { getWebShopSettings } = await import("./shopSettings");
      const settings = await getWebShopSettings(licenseId);
      if (settings.success && settings.settings?.shopName) {
        shopName = settings.settings.shopName;
      }
    } catch {
      // not fatal
    }

    return {
      success: true,
      overview: {
        shopName,
        kpis: {
          itemCount,
          liveBatchCount,
          stockQty,
          inventoryCostValue,
          inventorySaleValue,
          todaySalesCount,
          todaySalesAmount,
          todayPurchaseCount,
          todayPurchaseAmount,
          sales30Count,
          sales30Amount,
          purchases30Count,
          purchases30Amount,
          customerCount,
          supplierCount,
          receivableAmount,
          payableAmount,
          zeroStockCount,
          lowStockCount,
        },
        series,
        topProducts,
        lowStockItems,
        recentActivity,
        lastUpdatedAt: now.toISOString(),
      },
    };
  } catch (err: any) {
    console.error("[webGetDashboardOverview]", err);
    return { success: false, error: String(err?.message ?? err) };
  }
}
