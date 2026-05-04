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
  pushEntity: (entity: string) => void;
  pullNow: (entityName?: string) => void;
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
  pushEntity: () => {},
  pullNow: () => {},
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

    // initAndSync is safe to call here — init() inside it is guarded by
    // `if (this.initialized) return`, and syncNow() is guarded by
    // `if (this.status.running) return`. No double-sync risk.
    SyncManager.initAndSync(isDesktop).catch(console.error);

    const unsub = SyncManager.subscribe(setStatus);

    return () => {
      unsub();
    };
  }, []);

  const syncNow = useCallback(() => {
    SyncManager.syncNow();
  }, []);

  const pushEntity = useCallback((entity: string) => {
    SyncManager.pushEntity(entity).catch(() => {});
  }, []);

  const pullNow = useCallback((entityName?: string) => {
    SyncManager.pullNow(entityName).catch(() => {});
  }, []);

  return (
    <SyncContext.Provider value={{ status, syncNow, pushEntity, pullNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  return useContext(SyncContext);
}
