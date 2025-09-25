// src/sync/productsSync.ts
import { createProductsManager } from "./registry";

let mgr: any = null;

export function startProductsSync() {
  if (!mgr) mgr = createProductsManager();
  mgr.start();
}

export function stopProductsSync() {
  if (mgr) mgr.stop();
}
