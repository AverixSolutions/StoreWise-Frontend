// src/app/dashboard/layout.tsx
"use client";

import Header from "@/components/ui/Header";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import SyncProvider from "@/components/SyncProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerHeight = 72;
  const pathname = usePathname();

  const HIDE_SIDEBAR_PREFIXES = [
    "/dashboard/purchase",
    "/dashboard/sales",
    "/dashboard/sales-return",
  ];

  const hideSidebar = HIDE_SIDEBAR_PREFIXES.some((p) =>
    pathname?.startsWith(p)
  );
  const isFullWidth = hideSidebar;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SyncProvider />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {!hideSidebar && <Sidebar topOffset={headerHeight} />}
        <main
          className={
            "flex-1 overflow-y-auto " +
            (isFullWidth ? "p-0" : "p-6 max-w-[1400px] w-full mx-auto")
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
