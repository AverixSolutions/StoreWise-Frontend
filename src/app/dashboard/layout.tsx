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
  );
}
