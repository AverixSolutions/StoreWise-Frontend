// src/sync/SyncManager.ts
/**
 * SyncManager — singleton orchestrator.
 *
 * PUSH: event-driven — fires immediately on every mutation via pushEntity()
 * PULL: interval-driven — 15s when tab visible, 2min when hidden
 *
 * This means:
 * - Your own changes reach the server in <1s (not 30s)
 * - Other devices' changes appear within 15s
 * - Neon stays suspended when no one is active (saves compute hours)
 */

import {
  runPush,
  runPull,
  runSync,
  SyncAdapter,
  SyncResult,
} from "./SyncEngine";
import { buildAdapters } from "./registry";
import {
  getActiveLicenseId,
  getActiveToken,
} from "@/lib/session/runtimeSession";

export type SyncStatus = {
  running: boolean;
  bootstrapping: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  stats: Record<string, { pushed: number; pulled: number }>;
};

type StatusListener = (status: SyncStatus) => void;

// Pull intervals — only affects how often we check for OTHER devices' changes
const PULL_INTERVAL_VISIBLE = 15_000; // 15s when tab is active  (was 60s)
const PULL_INTERVAL_HIDDEN = 120_000; // 2min when tab is hidden  (was 5min)
const MAX_PULL_INTERVAL = 600_000; // 10min max on repeated errors
const BACKOFF_FACTOR = 1.5;

class SyncManagerClass {
  private adapters: SyncAdapter[] = [];
  private pullTimer: ReturnType<typeof setTimeout> | null = null;
  private pullInterval = PULL_INTERVAL_VISIBLE;

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

  // Prevent duplicate concurrent pushes for the same entity
  private pushInFlight = new Set<string>();

  // Coalesce burst saves — if a push arrives while one is running, queue one rerun
  private pushQueued = new Set<string>();

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init(isDesktop: boolean) {
    if (this.initialized) return;
    this.initialized = true;
    this.isDesktop = isDesktop;
    this.adapters = buildAdapters(isDesktop);

    this._schedulePull();
    this._registerGlobalListeners();
  }

  destroy() {
    if (this.pullTimer) clearTimeout(this.pullTimer);
    this.pullTimer = null;
    this.initialized = false;
    this.listeners.clear();
  }

  subscribe(fn: StatusListener) {
    this.listeners.add(fn);
    fn(this.status); // immediately emit current status to new subscriber
    return () => this.listeners.delete(fn);
  }

  // ── Called right after login — bootstrap pull ───────────────────────────────

  async initAndSync(isDesktop: boolean): Promise<void> {
    this.init(isDesktop);
    this.updateStatus({ bootstrapping: true });
    await this.syncNow(); // full push + pull on login
    this.updateStatus({ bootstrapping: false });
  }

  // ── Called on every mutation (product add/edit/delete, brand save, etc) ─────
  // Only pushes the specific entity that changed — fast and targeted
  // Pass entity name matching your adapter: "product" | "category" | "brand" | "supplier"

  async pushEntity(entityName: string): Promise<void> {
    // If already pushing this entity, don't drop the request.
    // Queue one rerun so burst saves (bulk import) still flush fully.
    if (this.pushInFlight.has(entityName)) {
      this.pushQueued.add(entityName);
      return;
    }

    const licenseId = getActiveLicenseId();
    const token = getActiveToken();
    if (!licenseId || !token) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const adapter = this.adapters.find((a) => a.entity === entityName);
    if (!adapter) return;

    this.pushInFlight.add(entityName);
    this.updateStatus({ running: true });

    try {
      do {
        // consume queued flag for this run
        this.pushQueued.delete(entityName);

        const result = await runPush(licenseId, adapter, token);

        const prevStats = this.status.stats[entityName] ?? {
          pushed: 0,
          pulled: 0,
        };

        // ── CHANGED: removed running: false here — we're still potentially
        // looping, so keep running: true for the whole pushEntity() run.
        // running: false is set once in the finally block below.
        this.updateStatus({
          lastSyncAt: new Date().toISOString(),
          lastError: result.errors[0] ?? null,
          stats: {
            ...this.status.stats,
            [entityName]: {
              pushed: prevStats.pushed + result.pushed,
              pulled: prevStats.pulled,
            },
          },
        });

        // If more writes came in while this push was running,
        // loop again immediately and flush them too.
      } while (this.pushQueued.has(entityName));
    } catch (err: any) {
      this.updateStatus({
        lastError: err.message ?? String(err),
      });
    } finally {
      // ── CHANGED: running: false now lives exclusively here, so no other
      // sync action can mistakenly treat this entity as idle mid-loop.
      this.pushInFlight.delete(entityName);
      this.updateStatus({ running: false });
      this._schedulePull();
    }
  }

  // ── Best-effort foreground pull — call anytime you want fresh data ──────────
  // Optionally scoped to a single entity; pulls all adapters if omitted.

  async pullNow(entityName?: string): Promise<void> {
    const licenseId = getActiveLicenseId();
    const token = getActiveToken();
    if (!licenseId || !token) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const targets = entityName
      ? this.adapters.filter((a) => a.entity === entityName)
      : this.adapters;

    for (const adapter of targets) {
      try {
        await runPull(licenseId, adapter, token);
      } catch {
        // silent — this is a best-effort foreground pull
      }
    }
  }

  // ── Full sync — push all dirty + pull all — used on login and manual trigger ─

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

    this.pullInterval = hasErrors
      ? Math.min(this.pullInterval * BACKOFF_FACTOR, MAX_PULL_INTERVAL)
      : this._targetPullInterval();

    this.updateStatus({
      running: false,
      lastSyncAt: new Date().toISOString(),
      lastError: firstError,
      stats,
    });

    this._schedulePull();
  }

  // ── Pull only — fires on the interval timer ─────────────────────────────────
  // Does NOT push — mutations call pushEntity() for that

  private async _pullAll(): Promise<void> {
    if (this.status.running) {
      // Don't stack another full interval — check again shortly after current op likely finishes
      this.pullTimer = setTimeout(() => this._pullAll(), 2_000);
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this._schedulePull();
      return;
    }

    const licenseId = getActiveLicenseId();
    const token = getActiveToken();
    if (!licenseId || !token) {
      this._schedulePull();
      return;
    }

    this.updateStatus({ running: true });

    let hasErrors = false;
    const statsUpdate: Record<string, { pushed: number; pulled: number }> = {
      ...this.status.stats,
    };

    for (const adapter of this.adapters) {
      try {
        const result = await runPull(licenseId, adapter, token);

        if (result.errors.length > 0) hasErrors = true;

        const prev = statsUpdate[adapter.entity] ?? { pushed: 0, pulled: 0 };
        statsUpdate[adapter.entity] = {
          pushed: prev.pushed,
          pulled: prev.pulled + result.pulled,
        };
      } catch {
        hasErrors = true;
      }
    }

    this.pullInterval = hasErrors
      ? Math.min(this.pullInterval * BACKOFF_FACTOR, MAX_PULL_INTERVAL)
      : this._targetPullInterval();

    this.updateStatus({
      running: false,
      lastSyncAt: new Date().toISOString(),
      stats: statsUpdate,
    });

    this._schedulePull();
  }

  // ── Pre-logout flush — push everything dirty before wiping local state ───────

  async flushBeforeLogout(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const licenseId = getActiveLicenseId();
    const token = getActiveToken();
    if (!licenseId || !token) return;

    const API_BASE =
      process.env.NEXT_PUBLIC_KYNFLOW_API_BASE ||
      process.env.NEXT_PUBLIC_API_URL ||
      "";

    for (const adapter of this.adapters) {
      try {
        const dirty = await adapter.getDirtyRecords(licenseId);
        if (dirty.length === 0) continue;

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
        // best-effort — never block logout
      }
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _schedulePull() {
    if (this.pullTimer) clearTimeout(this.pullTimer);
    const interval = this._targetPullInterval(); // recalculate every time
    this.pullTimer = setTimeout(() => this._pullAll(), interval);
  }

  private _targetPullInterval(): number {
    if (typeof document === "undefined") return PULL_INTERVAL_VISIBLE;
    return document.visibilityState === "visible"
      ? PULL_INTERVAL_VISIBLE
      : PULL_INTERVAL_HIDDEN;
  }

  private _registerGlobalListeners() {
    if (typeof window === "undefined") return;

    // Tab becomes visible → reset to fast interval and pull immediately
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.pullInterval = PULL_INTERVAL_VISIBLE;
        if (this.pullTimer) clearTimeout(this.pullTimer);
        this._pullAll();
      } else {
        // Tab hidden → slow down to save Neon compute
        this.pullInterval = PULL_INTERVAL_HIDDEN;
        this._schedulePull();
      }
    });

    // User switched back to this browser window from another app
    window.addEventListener("focus", () => {
      if (this.pullTimer) clearTimeout(this.pullTimer);
      this._pullAll();
    });

    // Back online → flush dirty queue first, then pull
    window.addEventListener("online", () => {
      this.pullInterval = PULL_INTERVAL_VISIBLE;
      this.syncNow();
    });
  }

  private updateStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.listeners) fn(this.status);
  }
}

export const SyncManager = new SyncManagerClass();
