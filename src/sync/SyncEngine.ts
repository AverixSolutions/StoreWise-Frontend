// frontend/src/sync/SyncEngine.ts
/**
 * Generic client-side sync engine.
 * Handles push-dirty → server and pull-server-changes → local.
 * Stateless — all state lives in the adapter's getSyncState/setSyncState.
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

/**
 * Each entity implements this adapter.
 * SyncEngine calls these — it doesn't care about SQLite or IDB.
 */
export type SyncAdapter = {
  /** Must match backend route: "product" | "supplier" | etc. */
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

export async function runSync(
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

  // ── PUSH dirty records ────────────────────────────────────────────────────
  try {
    const dirty = await adapter.getDirtyRecords(licenseId);

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
        const serverTs = accepted[0].serverUpdatedAt;
        await adapter.markSynced(
          accepted.map((r) => r.id),
          serverTs,
        );
        result.pushed += accepted.length;
      }

      await adapter.setSyncState({ lastPushedAt: data.pushedAt });
    }
  } catch (err: any) {
    result.errors.push(`push:${adapter.entity}: ${err.message || String(err)}`);
  }

  // ── PULL server changes ───────────────────────────────────────────────────
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
  } catch (err: any) {
    result.errors.push(`pull:${adapter.entity}: ${err.message || String(err)}`);
  }

  return result;
}
