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
  createPurchaseReturnsAdapter,
  createPurchaseReturnItemsAdapter,
  createPurchaseReturnHoldsAdapter,
} from "./adapters/purchaseReturns";
import {
  createSalesAdapter,
  createSaleItemsAdapter,
  createSaleHoldsAdapter,
} from "./adapters/sales";
import {
  createSaleReturnsAdapter,
  createSaleReturnItemsAdapter,
} from "./adapters/saleReturns";
import { createTransactionTypesAdapter } from "./adapters/transactionTypes";
import {
  createOfferTargetProductsAdapter,
  createOffersAdapter,
} from "./adapters/offers";

import { createSupplierTransactionsAdapter } from "./adapters/supplierTransactions";
import { createCustomerTransactionsAdapter } from "./adapters/customerTransactions";
import { createCashTransactionsAdapter } from "./adapters/cashTransactions";

import { createCustomersAdapter } from "./adapters/customers";
import {
  createQuotationsAdapter,
  createQuotationItemsAdapter,
} from "./adapters/quotations";

export function buildAdapters(isDesktop: boolean): SyncAdapter[] {
  return [
    createShopSettingsAdapter(isDesktop),
    createTaxCategoriesAdapter(isDesktop),
    createCategoriesAdapter(isDesktop),
    createBrandsAdapter(isDesktop),
    createUnitsAdapter(isDesktop),
    createTransactionTypesAdapter(isDesktop),
    createProductsAdapter(isDesktop),
    createOffersAdapter(isDesktop),
    createOfferTargetProductsAdapter(isDesktop),
    createSuppliersAdapter(isDesktop),
    createCustomersAdapter(isDesktop),
    createPurchasesAdapter(isDesktop),
    createPurchaseItemsAdapter(isDesktop),
    createPurchaseHoldsAdapter(isDesktop),
    createPurchaseReturnsAdapter(isDesktop),
    createPurchaseReturnItemsAdapter(isDesktop),
    createPurchaseReturnHoldsAdapter(isDesktop),
    createSalesAdapter(isDesktop),
    createSaleItemsAdapter(isDesktop),
    createSaleHoldsAdapter(isDesktop),
    createSaleReturnsAdapter(isDesktop),
    createSaleReturnItemsAdapter(isDesktop),
    createQuotationsAdapter(isDesktop),
    createQuotationItemsAdapter(isDesktop),
    createSupplierTransactionsAdapter(isDesktop),
    createCustomerTransactionsAdapter(isDesktop),
    createCashTransactionsAdapter(isDesktop),
  ];
}
