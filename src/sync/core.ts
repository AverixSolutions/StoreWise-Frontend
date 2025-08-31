// src/sync/core.ts
import api from "@/lib/axios";

export type SyncOptions<T> = {
  scope: string;
  pageSize?: number;
  getDirty: (licenseId: string, pageSize: number) => Promise<any[]>;
  markSynced: (ids: string[], syncedAt: string) => Promise<void>;
  bulkUpsert: (items: any[]) => Promise<void>;
  pushEndpoint: string;
  mapItem: (row: any) => T;
};

let timers: Record<string, ReturnType<typeof setTimeout>> = {};
let runningScopes: Set<string> = new Set();

export function toIsoFromSqliteUtc(s?: string | null) {
  if (!s) return new Date().toISOString();
  let formatted = s.replace(" ", "T");
  if (!formatted.endsWith("Z")) formatted += "Z";
  return new Date(formatted).toISOString();
}

function withJitter(ms: number) {
  const jitter = Math.floor(Math.random() * (ms * 0.2)); // ±20%
  return ms - ms * 0.1 + jitter;
}

let loops: Record<string, () => Promise<void>> = {};

export function startSync<T>(opts: SyncOptions<T>) {
  if (runningScopes.has(opts.scope)) return;
  runningScopes.add(opts.scope);

  let curInterval = 30_000;
  const minInterval = 10_000;
  const maxInterval = 5 * 60_000;

  async function loop() {
    try {
      if (!navigator.onLine) {
        curInterval = Math.min(curInterval * 2, maxInterval);
        schedule();
        return;
      }

      const licenseId = localStorage.getItem("licenseId");
      if (!licenseId) return;

      const dirty = await opts.getDirty(licenseId, opts.pageSize || 200);
      if (dirty.length === 0) {
        curInterval = Math.min(curInterval * 2, maxInterval);
        schedule();
        return;
      }

      const items = dirty.map(opts.mapItem);
      const res = await api.post<{ serverSyncedAt: string }>(
        opts.pushEndpoint,
        { items }
      );

      const ids = dirty.map((d) => d.id);
      await opts.markSynced(ids, res.data.serverSyncedAt);

      curInterval = Math.max(curInterval / 2, minInterval);
    } catch (err) {
      console.error(`${opts.scope} sync error:`, err);
      curInterval = Math.min(curInterval * 2, maxInterval);
    } finally {
      schedule();
    }
  }

  function schedule() {
    clearTimeout(timers[opts.scope]);
    timers[opts.scope] = setTimeout(loop, withJitter(curInterval));
  }

  loops[opts.scope] = loop;
  schedule();
}

export function triggerSync(scope: string) {
  if (loops[scope]) {
    clearTimeout(timers[scope]);
    loops[scope]();
  }
}

export function stopSync(scope: string) {
  runningScopes.delete(scope);
  if (timers[scope]) {
    clearTimeout(timers[scope]);
    delete timers[scope];
  }
}
