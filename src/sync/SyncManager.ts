// src/sync/SyncManager.ts
/**
 * SyncManager — singleton orchestrator.
 * - Runs on a 30s timer, backing off to 5min on repeated errors.
 * - Triggers immediately on window "online" event.
 * - Exposes status to SyncProvider via subscribe().
 * - initAndSync() for post-login bootstrap.
 * - flushBeforeLogout() for pre-logout push.
 */

import { runSync, SyncAdapter, SyncResult } from "./SyncEngine";
import { buildAdapters } from "./registry";
import {
  getActiveLicenseId,
  getActiveToken,
} from "@/lib/session/runtimeSession";

export type SyncStatus = {
  running: boolean;
  bootstrapping: boolean; // true during first-ever sync after login
  lastSyncAt: string | null;
  lastError: string | null;
  stats: Record<string, { pushed: number; pulled: number }>;
};

type StatusListener = (status: SyncStatus) => void;

const INITIAL_INTERVAL = 30_000;
const MAX_INTERVAL = 300_000;
const BACKOFF_FACTOR = 1.5;

class SyncManagerClass {
  private adapters: SyncAdapter[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private interval = INITIAL_INTERVAL;
  private status: SyncStatus = {
    running: false,
    bootstrapping: false,
    lastSyncAt: null,
    lastError: null,
    stats: {},
  };
  private listeners = new Set<StatusListener>();
  private initialized = false;
  private isDesktop = false;

  init(isDesktop: boolean) {
    if (this.initialized) return;
    this.initialized = true;
    this.isDesktop = isDesktop;
    this.adapters = buildAdapters(isDesktop);
    this.scheduleNext();

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.interval = INITIAL_INTERVAL;
        this.syncNow();
      });
    }
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.initialized = false;
    this.listeners.clear();
  }

  subscribe(fn: StatusListener) {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  /**
   * Called right after login for the bootstrap pull.
   * Sets bootstrapping=true so the UI can show a loading overlay.
   * Safe to call before SyncProvider mounts.
   */
  async initAndSync(isDesktop: boolean): Promise<void> {
    this.init(isDesktop);
    this.updateStatus({ bootstrapping: true });
    await this.syncNow();
    this.updateStatus({ bootstrapping: false });
  }

  /**
   * Push all dirty local records to the server, then return.
   * Used before logout so no data is lost.
   * Skips the pull phase to keep it fast.
   */
  async flushBeforeLogout(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const licenseId = getActiveLicenseId();
    const token = getActiveToken();
    if (!licenseId || !token) return;

    // Re-use each adapter's getDirtyRecords + markSynced directly
    // without touching pull state.
    for (const adapter of this.adapters) {
      try {
        const dirty = await adapter.getDirtyRecords(licenseId);
        if (dirty.length === 0) continue;

        const API_BASE =
          process.env.NEXT_PUBLIC_KYNFLOW_API_BASE ||
          process.env.NEXT_PUBLIC_API_URL ||
          "";

        const BATCH = 200;
        for (let i = 0; i < dirty.length; i += BATCH) {
          const batch = dirty.slice(i, i + BATCH);
          const res = await fetch(
            `${API_BASE}/api/sync/${adapter.entity}/push`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ licenseId, records: batch }),
            },
          );

          if (res.ok) {
            const data = await res.json();
            const accepted: { id: string; serverUpdatedAt: string }[] = (
              data.results || []
            ).filter((r: any) => r.accepted);

            if (accepted.length > 0) {
              await adapter.markSynced(
                accepted.map((r) => r.id),
                accepted[0].serverUpdatedAt,
              );
            }
          }
        }
      } catch {
        // best-effort flush — don't block logout on sync failure
      }
    }
  }

  async syncNow(): Promise<void> {
    if (this.status.running) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const licenseId = getActiveLicenseId();
    const token = getActiveToken();
    if (!licenseId || !token) return;

    this.updateStatus({ running: true, lastError: null });

    const results: SyncResult[] = [];

    for (const adapter of this.adapters) {
      try {
        const result = await runSync(licenseId, adapter, token);
        results.push(result);
      } catch (err: any) {
        results.push({
          entity: adapter.entity,
          pushed: 0,
          pulled: 0,
          errors: [err.message || String(err)],
        });
      }
    }

    const hasErrors = results.some((r) => r.errors.length > 0);
    const firstError = results.flatMap((r) => r.errors)[0] ?? null;

    const stats: Record<string, { pushed: number; pulled: number }> = {};
    for (const r of results) {
      stats[r.entity] = { pushed: r.pushed, pulled: r.pulled };
    }

    this.interval = hasErrors
      ? Math.min(this.interval * BACKOFF_FACTOR, MAX_INTERVAL)
      : INITIAL_INTERVAL;

    this.updateStatus({
      running: false,
      lastSyncAt: new Date().toISOString(),
      lastError: firstError,
      stats,
    });

    this.scheduleNext();
  }

  private scheduleNext() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncNow(), this.interval);
  }

  private updateStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.listeners) fn(this.status);
  }
}

export const SyncManager = new SyncManagerClass();
