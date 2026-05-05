// src/sync/registry.ts
import type { SyncAdapter } from "./SyncEngine";
import { createProductsAdapter } from "./adapters/products";
import { createSuppliersAdapter } from "./adapters/suppliers";
import { createCategoriesAdapter } from "./adapters/categories";
import { createBrandsAdapter } from "./adapters/brands";
import { createShopSettingsAdapter } from "./adapters/shopSettings";
import { createTaxCategoriesAdapter } from "./adapters/taxCategories";
import { createUnitsAdapter } from "./adapters/units";
import {
  createPurchasesAdapter,
  createPurchaseItemsAdapter,
  createPurchaseHoldsAdapter,
} from "./adapters/purchases";
import {
  createSalesAdapter,
  createSaleItemsAdapter,
  createSaleHoldsAdapter,
} from "./adapters/sales";

export function buildAdapters(isDesktop: boolean): SyncAdapter[] {
  return [
    createShopSettingsAdapter(isDesktop),
    createTaxCategoriesAdapter(isDesktop),
    createCategoriesAdapter(isDesktop),
    createBrandsAdapter(isDesktop),
    createUnitsAdapter(isDesktop),
    createProductsAdapter(isDesktop),
    createSuppliersAdapter(isDesktop),
    createPurchasesAdapter(isDesktop),
    createPurchaseItemsAdapter(isDesktop),
    createPurchaseHoldsAdapter(isDesktop),
    createSalesAdapter(isDesktop),
    createSaleItemsAdapter(isDesktop),
    createSaleHoldsAdapter(isDesktop),
  ];
}
