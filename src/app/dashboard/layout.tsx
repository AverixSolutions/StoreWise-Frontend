// src/app/dashboard/layout.tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import { SyncProvider, useSyncStatus } from "@/sync/SyncProvider";
import { isSyncEnabled } from "@/platform/mode";
import { RefreshCw } from "lucide-react";
import {
  getActiveLicenseId,
  getLicenseFeatures,
} from "@/lib/session/runtimeSession";

function BootstrapOverlay() {
  const { status } = useSyncStatus();

  if (!isSyncEnabled() || !status.bootstrapping) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050b17]">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#20b7ff]/20 to-[#b026ff]/20 border border-white/10">
        <RefreshCw className="h-6 w-6 animate-spin text-[#20b7ff]" />
      </div>
      <p className="text-sm font-medium text-white/70">Loading your data…</p>
      <p className="mt-1 text-xs text-white/30">Syncing from server</p>
    </div>
  );
}

function LicenseFeatureBridge() {
  useEffect(() => {
    const licenseId = getActiveLicenseId();
    if (!licenseId) return;
    (window as any).electronAPI?.setLicenseFeatures?.({
      licenseId,
      ...getLicenseFeatures(),
    });
  }, []);

  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const HIDE_SIDEBAR_PREFIXES = [
    "/dashboard/purchase",
    "/dashboard/sales",
    "/dashboard/sales-return",
  ];

  const hideSidebar = HIDE_SIDEBAR_PREFIXES.some((p) =>
    pathname?.startsWith(p),
  );

  if (hideSidebar) {
    return (
      <SyncProvider>
        <LicenseFeatureBridge />
        <BootstrapOverlay />
        <div className="min-h-screen kyn-shell">{children}</div>
      </SyncProvider>
    );
  }

  return (
    <SyncProvider>
      <LicenseFeatureBridge />
      <BootstrapOverlay />
      <div className="kyn-shell h-screen overflow-hidden overscroll-none bg-[#f6f5ef] lg:bg-transparent">
        <div className="flex h-full overflow-hidden">
          <Sidebar />
          <div className="flex-1 p-0 pb-[5.4rem] md:p-2 md:pb-24 lg:pb-2">
            <main
              className="
              h-full overflow-y-auto overscroll-y-contain bg-[#f6f5ef] text-black
              rounded-none border-0 shadow-none
              [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0
              lg:rounded-2xl lg:border lg:border-black/5 lg:shadow-[0_12px_40px_rgba(0,0,0,0.24)]
              lg:[scrollbar-width:auto] lg:[-ms-overflow-style:auto] lg:[&::-webkit-scrollbar]:w-2
            "
            >
              <div className="min-h-full px-3 pt-3 pb-4 md:p-6">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </SyncProvider>
  );
}
