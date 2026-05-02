// src/sync/registry.ts
import type { SyncAdapter } from "./SyncEngine";
import { createProductsAdapter } from "./adapters/products";
import { createSuppliersAdapter } from "./adapters/suppliers";

// Add new adapters here as you build more modules.
// Phase 3: createPurchasesAdapter, createSalesAdapter, etc.
export function buildAdapters(isDesktop: boolean): SyncAdapter[] {
  return [createProductsAdapter(isDesktop), createSuppliersAdapter(isDesktop)];
}
