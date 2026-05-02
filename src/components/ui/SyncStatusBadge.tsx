// frontend/src/components/ui/SyncStatusBadge.tsx
"use client";

import { useSyncStatus } from "@/sync/SyncProvider";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { isSyncEnabled } from "@/platform/mode";

export function SyncStatusBadge() {
  const { status, syncNow } = useSyncStatus();

  // Don't render anything in offline-only mode
  if (!isSyncEnabled()) return null;

  if (status.running) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-400">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Syncing…
      </span>
    );
  }

  if (status.lastError) {
    return (
      <button
        type="button"
        onClick={syncNow}
        title={status.lastError}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-400/20 transition cursor-pointer"
      >
        <AlertCircle className="h-3 w-3" />
        Sync error — retry
      </button>
    );
  }

  if (status.lastSyncAt) {
    return (
      <button
        type="button"
        onClick={syncNow}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-400/20 transition cursor-pointer"
      >
        <CheckCircle2 className="h-3 w-3" />
        Synced
      </button>
    );
  }

  return null;
}
