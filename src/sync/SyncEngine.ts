// src/sync/SyncEngine.ts
/**
 * Generic client-side sync engine.
 * Push and Pull are now separate functions.
 * Pull dispatches 'kynflow:sync:updated' CustomEvent after new records arrive.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_KYNFLOW_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

export type DirtyRecord = {
  id: string;
  updatedAt: string;
  deletedAt?: string | null;
  [key: string]: any;
};

export type SyncStateRecord = {
  lastPulledAt: string | null;
  lastPushedAt: string | null;
};

export type SyncAdapter = {
  entity: string;
  getDirtyRecords: (licenseId: string) => Promise<DirtyRecord[]>;
  markSynced: (ids: string[], serverUpdatedAt: string) => Promise<void>;
  upsertFromServer: (records: DirtyRecord[]) => Promise<void>;
  getSyncState: () => Promise<SyncStateRecord>;
  setSyncState: (state: Partial<SyncStateRecord>) => Promise<void>;
};

export type SyncResult = {
  entity: string;
  pushed: number;
  pulled: number;
  errors: string[];
};

const PUSH_BATCH_SIZE = 200;

// Prevent concurrent pulls for the same entity+license
const _inFlight = new Set<string>();

async function apiFetch(
  path: string,
  options: RequestInit,
  token: string,
): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${path}: ${body}`);
  }

  return res.json();
}

// ── Push only — called immediately on every mutation ─────────────────────────

export async function runPush(
  licenseId: string,
  adapter: SyncAdapter,
  token: string,
): Promise<SyncResult> {
  const result: SyncResult = {
    entity: adapter.entity,
    pushed: 0,
    pulled: 0,
    errors: [],
  };

  try {
    const dirty = await adapter.getDirtyRecords(licenseId);

    // Nothing dirty — exit immediately, Neon never wakes up
    if (dirty.length === 0) return result;

    for (let i = 0; i < dirty.length; i += PUSH_BATCH_SIZE) {
      const batch = dirty.slice(i, i + PUSH_BATCH_SIZE);

      const data = await apiFetch(
        `/api/sync/${adapter.entity}/push`,
        {
          method: "POST",
          body: JSON.stringify({ licenseId, records: batch }),
        },
        token,
      );

      const accepted: { id: string; serverUpdatedAt: string }[] = (
        data.results || []
      ).filter((r: any) => r.accepted);

      if (accepted.length > 0) {
        await adapter.markSynced(
          accepted.map((r) => r.id),
          accepted[0].serverUpdatedAt,
        );
        result.pushed += accepted.length;
      }

      await adapter.setSyncState({ lastPushedAt: data.pushedAt });
    }
  } catch (err: any) {
    result.errors.push(`push:${adapter.entity}: ${err.message || String(err)}`);
  }

  return result;
}

// ── Pull only — called on interval timer ─────────────────────────────────────

export async function runPull(
  licenseId: string,
  adapter: SyncAdapter,
  token: string,
): Promise<SyncResult> {
  const result: SyncResult = {
    entity: adapter.entity,
    pushed: 0,
    pulled: 0,
    errors: [],
  };

  const pullKey = `${adapter.entity}:${licenseId}`;

  // Skip if a pull is already in flight for this entity+license
  if (_inFlight.has(pullKey)) return result;
  _inFlight.add(pullKey);

  try {
    const state = await adapter.getSyncState();
    let since = state.lastPulledAt;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({ licenseId });
      if (since) params.set("since", since);

      const data = await apiFetch(
        `/api/sync/${adapter.entity}/pull?${params.toString()}`,
        { method: "GET" },
        token,
      );

      if (data.records && data.records.length > 0) {
        await adapter.upsertFromServer(data.records);
        result.pulled += data.records.length;
      }

      await adapter.setSyncState({ lastPulledAt: data.pulledAt });
      since = data.pulledAt;
      hasMore = data.hasMore === true;
    }

    // Notify React that new remote data arrived — pages listen to this
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kynflow:sync:updated", {
          detail: { entity: adapter.entity, count: result.pulled },
        }),
      );
    }
  } catch (err: any) {
    result.errors.push(`pull:${adapter.entity}: ${err.message || String(err)}`);
  } finally {
    _inFlight.delete(pullKey);
  }

  return result;
}

// ── Full sync — push + pull combined, used on login bootstrap ─────────────────

export async function runSync(
  licenseId: string,
  adapter: SyncAdapter,
  token: string,
): Promise<SyncResult> {
  const pushResult = await runPush(licenseId, adapter, token);
  const pullResult = await runPull(licenseId, adapter, token);

  return {
    entity: adapter.entity,
    pushed: pushResult.pushed,
    pulled: pullResult.pulled,
    errors: [...pushResult.errors, ...pullResult.errors],
  };
}
