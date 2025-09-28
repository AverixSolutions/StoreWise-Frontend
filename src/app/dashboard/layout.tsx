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

  const showSidebar = !pathname?.includes("/dashboard/purchase");
  const isPurchase = pathname?.startsWith("/dashboard/purchase");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SyncProvider />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && <Sidebar topOffset={headerHeight} />}
        <main
          className={
            "flex-1 overflow-y-auto " +
            (isPurchase ? "p-0" : "p-6 max-w-[1400px] w-full mx-auto")
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
