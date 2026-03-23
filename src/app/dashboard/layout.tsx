// src/app/dashboard/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";

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
    return <div className="min-h-screen kyn-shell">{children}</div>;
  }

  return (
    <div className="h-screen overflow-hidden kyn-shell">
      <div className="flex h-full">
        <Sidebar />

        <div className="flex-1 p-3 md:p-3.5">
          <main className="h-full overflow-y-auto rounded-2xl border border-black/5 bg-[#f6f5ef] text-black shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
            <div className="min-h-full p-5 md:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
