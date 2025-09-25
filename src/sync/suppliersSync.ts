// src/sync/suppliersSync.ts
import { createSuppliersManager } from "./registry";

let mgr: any = null;

export function startSuppliersSync() {
  if (!mgr) mgr = createSuppliersManager();
  mgr.start();
}

export function stopSuppliersSync() {
  if (mgr) mgr.stop();
}
