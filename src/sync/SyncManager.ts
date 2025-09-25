// src/sync/SyncManager.ts
import EventEmitter from "events";
import api from "@/lib/axios";

export type GetDirtyFn = (
  licenseId: string,
  pageSize: number,
  page?: number
) => Promise<any[]>;
export type MarkSyncedFn = (ids: string[], syncedAt: string) => Promise<void>;
export type BulkUpsertFn = (items: any[]) => Promise<void>;
export type MapItemFn<T> = (row: any) => T;

export type PushResponse = {
  serverSyncedAt: string;
  failed?: { id: string; error?: string }[];
};

export type SyncOptions<T> = {
  scope: string;
  pageSize?: number;
  getDirty: GetDirtyFn;
  markSynced: MarkSyncedFn;
  bulkUpsert?: BulkUpsertFn;
  pushEndpoint: string;
  mapItem: MapItemFn<T>;
  initialIntervalMs?: number;
  minIntervalMs?: number;
  maxIntervalMs?: number;
};

function withJitter(ms: number) {
  const jitter = Math.floor(Math.random() * (ms * 0.2)); // ±20%
  return Math.max(100, Math.round(ms - ms * 0.1 + jitter));
}

export class SyncManager<T> extends EventEmitter {
  private opts: Required<SyncOptions<T>>;
  private running = false;
  private timer?: ReturnType<typeof setTimeout>;
  private currentInterval: number;
  private backoffAttempts = 0;

  constructor(opts: SyncOptions<T>) {
    super();
    this.opts = {
      initialIntervalMs: 30_000,
      minIntervalMs: 10_000,
      maxIntervalMs: 5 * 60_000,
      pageSize: 200,
      ...opts,
    } as Required<SyncOptions<T>>;
    this.currentInterval = this.opts.initialIntervalMs;
  }

  start() {
    if (this.running) {
      this.emit("info", `${this.opts.scope} already running`);
      return;
    }
    this.running = true;
    this.emit("start", this.opts.scope);
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.emit("stop", this.opts.scope);
  }

  async triggerOnce() {
    await this.loop();
  }

  status() {
    return {
      scope: this.opts.scope,
      running: this.running,
      currentInterval: this.currentInterval,
      backoffAttempts: this.backoffAttempts,
    };
  }

  private schedule() {
    if (!this.running) return;
    const delay = withJitter(this.currentInterval);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.loop().catch((e) => this.emit("error", e)),
      delay
    );
    this.emit("scheduled", { scope: this.opts.scope, in: delay });
  }

  private async loop() {
    if (!this.running) return;
    this.emit("loop:start", this.opts.scope);

    try {
      if (!navigator.onLine) {
        this.emit("info", `${this.opts.scope} offline`);
        this.increaseBackoff();
        return;
      }

      const licenseId = localStorage.getItem("licenseId");
      if (!licenseId) {
        this.emit("warn", `${this.opts.scope} no licenseId`);
        this.increaseBackoff();
        return;
      }

      const dirty = await this.opts.getDirty(licenseId, this.opts.pageSize, 0);
      this.emit("info", { scope: this.opts.scope, dirtyCount: dirty.length });

      if (!dirty.length) {
        // no work -> increase interval
        this.currentInterval = Math.min(
          this.currentInterval * 2,
          this.opts.maxIntervalMs
        );
        this.emit("idle", {
          scope: this.opts.scope,
          nextInterval: this.currentInterval,
        });
        return;
      }

      const items = dirty.map(this.opts.mapItem);
      this.emit("pushing", { scope: this.opts.scope, count: items.length });

      const res = await api.post<PushResponse>(this.opts.pushEndpoint, {
        items,
      });
      this.emit("pushed", { scope: this.opts.scope, res: res.data });

      const ids = dirty.map((d: any) => d.id);
      const failedIds = new Set((res.data.failed || []).map((f) => f.id));
      const okIds = ids.filter((id: string) => !failedIds.has(id));

      if (okIds.length) {
        await this.opts.markSynced(okIds, res.data.serverSyncedAt);
        this.emit("markedSynced", {
          scope: this.opts.scope,
          count: okIds.length,
        });
      }

      if (res.data.failed && res.data.failed.length) {
        this.emit("server:failed", {
          scope: this.opts.scope,
          failed: res.data.failed,
        });
      }

      // success -> decrease interval toward min
      this.currentInterval = Math.max(
        Math.floor(this.currentInterval / 2),
        this.opts.minIntervalMs
      );
      this.backoffAttempts = 0;
    } catch (err) {
      this.emit("error", err);
      this.increaseBackoff();
    } finally {
      this.emit("loop:end", this.opts.scope);
      this.schedule();
    }
  }

  private increaseBackoff() {
    this.backoffAttempts++;
    this.currentInterval = Math.min(
      this.currentInterval * 2,
      this.opts.maxIntervalMs
    );
    this.emit("backoff", {
      scope: this.opts.scope,
      attempts: this.backoffAttempts,
      nextInterval: this.currentInterval,
    });
  }
}
