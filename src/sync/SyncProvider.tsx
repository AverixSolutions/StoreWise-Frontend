// frontend/src/sync/SyncProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { SyncManager, SyncStatus } from "./SyncManager";
import { isSyncEnabled } from "@/platform/mode";

type SyncContextValue = {
  status: SyncStatus;
  syncNow: () => void;
};

const SyncContext = createContext<SyncContextValue>({
  status: {
    running: false,
    bootstrapping: false,
    lastSyncAt: null,
    lastError: null,
    stats: {},
  },
  syncNow: () => {},
});

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>({
    running: false,
    bootstrapping: false,
    lastSyncAt: null,
    lastError: null,
    stats: {},
  });

  useEffect(() => {
    if (!isSyncEnabled()) return;

    const isDesktop =
      typeof window !== "undefined" && !!(window as any).electronAPI;

    // init() is idempotent — safe even if login already called initAndSync()
    SyncManager.init(isDesktop);
    const unsub = SyncManager.subscribe(setStatus);

    return () => {
      unsub();
    };
  }, []);

  const syncNow = useCallback(() => {
    SyncManager.syncNow();
  }, []);

  return (
    <SyncContext.Provider value={{ status, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  return useContext(SyncContext);
}
