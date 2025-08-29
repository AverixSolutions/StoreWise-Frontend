// src/sync/productsSync.ts
import api from "@/lib/axios";
type Unit = "KG" | "NOS" | "LTR" | "MTR";
type Tax = "NT" | "P5" | "P12" | "P18" | "P28";

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let inFlight = false;

let baseInterval = 30_000; // 30s
let minInterval = 10_000; // 10s
let maxInterval = 5 * 60_000; // 5m
let curInterval = baseInterval;

function withJitter(ms: number) {
  const jitter = Math.floor(Math.random() * (ms * 0.2)); // ±20%
  return ms - ms * 0.1 + jitter;
}

function toIsoFromSqliteUtc(s?: string | null) {
  if (!s) return new Date().toISOString();
  return new Date(s.replace(" ", "T") + "Z").toISOString();
}

function scheduleNext(pageSize: number) {
  if (!running) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => loop(pageSize), withJitter(curInterval));
}

async function loop(pageSize: number) {
  if (!running || inFlight) return scheduleNext(pageSize);
  inFlight = true;

  try {
    if (!navigator.onLine) {
      curInterval = Math.min(Math.floor(curInterval * 1.5), maxInterval);
      return;
    }

    const licenseId = localStorage.getItem("licenseId");
    const token = localStorage.getItem("token");
    if (!licenseId || !token) {
      curInterval = Math.min(Math.floor(curInterval * 1.5), maxInterval);
      return;
    }

    const dirty: any[] = await (window as any).electronAPI.getDirtyProducts(
      licenseId,
      pageSize
    );

    if (dirty.length === 0) {
      curInterval = Math.min(Math.floor(curInterval * 1.25), maxInterval);
      return;
    }

    const items = dirty.map((p) => ({
      id: p.id,
      licenseId: p.licenseId,
      code: p.code,
      codeNumber: Number(p.codeNumber),
      name: p.name,
      brand: p.brand ?? null,
      category: p.category ?? null,
      unit: p.unit as Unit,
      tax: p.tax as Tax,
      hsn: p.hsn ?? null,
      costPrice: String(p.costPrice),
      salePrice: p.salePrice != null ? String(p.salePrice) : null,
      stock: Number(p.stock),
      createdAt: toIsoFromSqliteUtc(p.createdAt),
      updatedAt: toIsoFromSqliteUtc(p.updatedAt),
      deletedAt: p.deletedAt ? toIsoFromSqliteUtc(p.deletedAt) : null,
    }));

    const res = await api.post<{ serverSyncedAt: string }>(
      "/sync/product/push",
      { items }
    );

    const ids = dirty.map((d) => d.id);
    await (window as any).electronAPI.markProductsSynced(
      ids,
      res.data.serverSyncedAt
    );
    await (window as any).electronAPI.setSyncState("products", {
      lastPushedAt: res.data.serverSyncedAt,
    });

    curInterval = Math.max(Math.floor(curInterval / 2), minInterval);
  } catch (err) {
    console.error("push sync error:", err);

    curInterval = Math.min(curInterval * 2, maxInterval);
  } finally {
    inFlight = false;
    scheduleNext(pageSize);
  }
}

let lastPageSize = 200;

export function startProductsSync(intervalMs = 30_000, pageSize = 200) {
  if (running) return;
  running = true;
  lastPageSize = pageSize;

  baseInterval = intervalMs;
  curInterval = baseInterval;

  const initialDelay = Math.floor(Math.random() * 5000);
  timer = setTimeout(() => loop(pageSize), initialDelay);
}

export function triggerSyncNow() {
  if (!running) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  curInterval = Math.max(minInterval, 1000);

  setTimeout(() => loop(lastPageSize), 0);
}

export function stopProductsSync() {
  running = false;
  inFlight = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

export async function pushDirtyProductsOnce(pageSize = 500) {
  try {
    if (!navigator.onLine) return;

    const licenseId = localStorage.getItem("licenseId");
    const token = localStorage.getItem("token");
    if (!licenseId || !token) return;

    const dirty: any[] = await (window as any).electronAPI.getDirtyProducts(
      licenseId,
      pageSize
    );
    if (dirty.length === 0) return;

    const toIsoFromSqliteUtc = (s?: string | null) =>
      s
        ? new Date(s.replace(" ", "T") + "Z").toISOString()
        : new Date().toISOString();

    const items = dirty.map((p) => ({
      id: p.id,
      licenseId: p.licenseId,
      code: p.code,
      codeNumber: Number(p.codeNumber),
      name: p.name,
      brand: p.brand ?? null,
      category: p.category ?? null,
      unit: p.unit as Unit,
      tax: p.tax as Tax,
      hsn: p.hsn ?? null,
      costPrice: String(p.costPrice),
      salePrice: p.salePrice != null ? String(p.salePrice) : null,
      stock: Number(p.stock),
      createdAt: toIsoFromSqliteUtc(p.createdAt),
      updatedAt: toIsoFromSqliteUtc(p.updatedAt),
      deletedAt: p.deletedAt ? toIsoFromSqliteUtc(p.deletedAt) : null,
    }));

    const res = await api.post<{ serverSyncedAt: string }>(
      "/sync/product/push",
      { items }
    );

    const ids = dirty.map((d) => d.id);
    await (window as any).electronAPI.markProductsSynced(
      ids,
      res.data.serverSyncedAt
    );
    await (window as any).electronAPI.setSyncState("products", {
      lastPushedAt: res.data.serverSyncedAt,
    });
  } catch (e) {
    console.error("pushDirtyProductsOnce error:", e);
  }
}
