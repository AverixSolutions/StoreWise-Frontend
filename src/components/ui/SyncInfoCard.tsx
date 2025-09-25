// src/components/ui/SyncInfoCard.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  X,
  ChevronDown,
} from "lucide-react";
import {
  getManager,
  createProductsManager,
  createSuppliersManager,
} from "@/sync/registry";

type SyncState = {
  scope: string;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
};

// Define sync scopes - easily extensible for future sync types
const SYNC_SCOPES = [
  { key: "products", label: "Products" },
  { key: "suppliers", label: "Suppliers" },
  // Future scopes can be added here:
  // { key: "purchases", label: "Purchases" },
  // { key: "sales", label: "Sales" },
  // { key: "payments", label: "Payments" },
  // { key: "collections", label: "Collections" },
];

export default function SyncInfoCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>(
    {}
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const checkSyncStatus = useCallback(async () => {
    const licenseId = localStorage.getItem("licenseId");
    if (!licenseId) return;

    try {
      const [productState, dirtyProducts, supplierState, dirtySuppliers] =
        await Promise.all([
          (window as any).electronAPI.getSyncState("products"),
          (window as any).electronAPI.getDirtyProducts(licenseId, 1),
          (window as any).electronAPI.getSyncState("suppliers"),
          (window as any).electronAPI.getDirtySuppliers(licenseId, 1),
        ]);

      setSyncStates({
        products: productState || {
          scope: "products",
          lastPulledAt: null,
          lastPushedAt: null,
        },
        suppliers: supplierState || {
          scope: "suppliers",
          lastPulledAt: null,
          lastPushedAt: null,
        },
      });

      setPendingCounts({
        products: (dirtyProducts && dirtyProducts.length) || 0,
        suppliers: (dirtySuppliers && dirtySuppliers.length) || 0,
      });
    } catch (error) {
      try {
        const p = getManager("products");
        const s = getManager("suppliers");
        const pState = await (p?.status
          ? Promise.resolve(p.status())
          : Promise.resolve(null));
        const sState = await (s?.status
          ? Promise.resolve(s.status())
          : Promise.resolve(null));

        setSyncStates({
          products: {
            scope: "products",
            lastPulledAt: null,
            lastPushedAt: pState?.lastPushedAt ?? null,
          },
          suppliers: {
            scope: "suppliers",
            lastPulledAt: null,
            lastPushedAt: sState?.lastPushedAt ?? null,
          },
        });

        setPendingCounts({ products: 0, suppliers: 0 });
      } catch (e) {
        console.error("Error checking sync status (fallback):", e);
      }
    }
  }, []);

  useEffect(() => {
    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 15000);
    return () => clearInterval(interval);
  }, [checkSyncStatus]);

  useEffect(() => {
    const p = getManager("products");
    const s = getManager("suppliers");

    const onAny = () => {
      checkSyncStatus().catch((e) =>
        console.error("checkSyncStatus failed:", e)
      );
    };

    if (p?.on) {
      p.on("pushed", onAny);
      p.on("markedSynced", onAny);
      p.on("pushing", onAny);
      p.on("backoff", onAny);
      p.on("idle", onAny);
    }
    if (s?.on) {
      s.on("pushed", onAny);
      s.on("markedSynced", onAny);
      s.on("pushing", onAny);
      s.on("backoff", onAny);
      s.on("idle", onAny);
    }

    return () => {
      if (p?.off) {
        p.off("pushed", onAny);
        p.off("markedSynced", onAny);
        p.off("pushing", onAny);
        p.off("backoff", onAny);
        p.off("idle", onAny);
      }
      if (s?.off) {
        s.off("pushed", onAny);
        s.off("markedSynced", onAny);
        s.off("pushing", onAny);
        s.off("backoff", onAny);
        s.off("idle", onAny);
      }
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkSyncStatus();

    if (isOnline) {
      try {
        let p = getManager("products");
        if (!p) {
          p = createProductsManager();
        }
        let s = getManager("suppliers");
        if (!s) {
          s = createSuppliersManager();
        }

        // Force immediate sync push
        if (p?.triggerOnce) await p.triggerOnce();
        await new Promise((r) => setTimeout(r, 500));
        if (s?.triggerOnce) await s.triggerOnce();
      } catch (error) {
        console.error("Error ensuring/triggering managers:", error);
      }
    }

    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getSyncStatus = (scope: string) => {
    if (!isOnline) return "offline";
    if ((pendingCounts[scope] || 0) > 0) return "pending";
    if (syncStates[scope]?.lastPushedAt) return "synced";
    return "error";
  };

  // Improved formatting - clearer messaging
  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return "Not yet synced";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "synced":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "pending":
        return <Clock className="w-5 h-5 text-amber-600 animate-pulse" />;
      case "offline":
        return <WifiOff className="w-5 h-5 text-slate-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "synced":
        return "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 shadow-emerald-100/50";
      case "pending":
        return "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 shadow-amber-100/50";
      case "offline":
        return "bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200 shadow-slate-100/50";
      case "error":
        return "bg-gradient-to-r from-red-50 to-rose-50 border-red-200 shadow-red-100/50";
      default:
        return "bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200 shadow-slate-100/50";
    }
  };

  const getCardStatusStyle = (status: string) => {
    switch (status) {
      case "synced":
        return "bg-gradient-to-br from-emerald-50/80 via-green-50/60 to-emerald-50/80 border-emerald-200/60 hover:border-emerald-300/80";
      case "pending":
        return "bg-gradient-to-br from-amber-50/80 via-yellow-50/60 to-amber-50/80 border-amber-200/60 hover:border-amber-300/80";
      case "offline":
        return "bg-gradient-to-br from-slate-50/80 via-gray-50/60 to-slate-50/80 border-slate-200/60 hover:border-slate-300/80";
      case "error":
        return "bg-gradient-to-br from-red-50/80 via-rose-50/60 to-red-50/80 border-red-200/60 hover:border-red-300/80";
      default:
        return "bg-gradient-to-br from-slate-50/80 via-gray-50/60 to-slate-50/80 border-slate-200/60 hover:border-slate-300/80";
    }
  };

  // Calculate overall status
  const totalPending = SYNC_SCOPES.reduce(
    (sum, scope) => sum + (pendingCounts[scope.key] || 0),
    0
  );
  const overallStatus = isOnline
    ? totalPending > 0
      ? "pending"
      : "synced"
    : "offline";

  // Compact status bar (always visible) - moved to top-right
  const StatusBar = () => (
    <div
      onClick={() => setIsOpen(!isOpen)}
      className="fixed bottom-8 right-10 cursor-pointer transition-all duration-300 z-50 group"
    >
      <div
        className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-lg border backdrop-blur-sm text-base transition-all duration-200 hover:shadow-xl hover:scale-105 ${getStatusColor(
          overallStatus
        )}`}
      >
        {/* Single connection/status icon - no duplication */}
        {getStatusIcon(overallStatus)}

        <span className="text-slate-700 font-medium">
          {isOnline
            ? totalPending > 0
              ? `Syncing ${totalPending}`
              : "All synced"
            : "Offline"}
        </span>

        <ChevronDown
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          } group-hover:text-slate-600`}
        />
      </div>
    </div>
  );

  // Detailed card (expandable) - positioned below status bar
  const DetailedCard = () => (
    <div
      className={`fixed bottom-24 right-4 transition-all duration-300 z-40 ${
        isOpen
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-200/50 p-6 w-96">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-800 text-lg">Sync Status</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-averix-red-vivid text-white rounded-lg hover:bg-averix-red-dark transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Syncing…" : "Sync now"}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-all duration-200 hover:shadow-md"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Scrollable sync scopes container - hidden scrollbar */}
        <div className="space-y-3 max-h-72 overflow-y-auto no-scrollbar pr-2">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 rounded-xl border backdrop-blur-sm transition-all duration-200 hover:shadow-md bg-white/50 border-slate-200/60">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-emerald-600" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <span className="text-sm font-medium text-slate-700">
                Connection
              </span>
            </div>
            <span
              className={`text-sm px-3 py-1.5 rounded-full font-medium shadow-sm ${
                isOnline
                  ? "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200/50"
                  : "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200/50"
              }`}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>

          {/* Dynamic Sync Scopes */}
          {SYNC_SCOPES.map((scope) => (
            <div
              key={scope.key}
              className={`flex items-center justify-between p-4 rounded-xl border backdrop-blur-sm transition-all duration-200 hover:shadow-md ${getCardStatusStyle(
                getSyncStatus(scope.key)
              )}`}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(getSyncStatus(scope.key))}
                <span className="text-sm font-medium text-slate-700">
                  {scope.label}
                </span>
              </div>
              <div className="text-right">
                {(pendingCounts[scope.key] || 0) > 0 && (
                  <div className="bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 px-3 py-1.5 rounded-full text-xs mb-2 font-medium shadow-sm border border-amber-200/50">
                    {pendingCounts[scope.key]} pending
                  </div>
                )}
                <div className="text-xs text-slate-500 font-medium">
                  {formatLastSync(syncStates[scope.key]?.lastPushedAt)}
                </div>
              </div>
            </div>
          ))}

          {/* Offline Message */}
          {!isOnline && (
            <div className="p-4 bg-gradient-to-r from-slate-50/80 to-gray-50/80 rounded-xl border-l-4 border-slate-400 backdrop-blur-sm">
              <p className="text-sm text-slate-700">
                You're working offline. Changes will sync when connection is
                restored.
              </p>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-slate-500 text-center pt-4 border-t border-slate-200/60">
            Data syncs automatically every few minutes
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <StatusBar />
      <DetailedCard />
    </>
  );
}
