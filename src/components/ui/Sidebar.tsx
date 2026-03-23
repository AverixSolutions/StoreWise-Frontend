// src/components/ui/Sidebar.tsx
"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus,
  Database,
  BarChart2,
  Settings,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getCurrentUser, logout } from "@/hooks/useAuth";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface Tab {
  name: string;
  icon: LucideIcon;
  path: string;
}

const tabs: Tab[] = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Entries", icon: FilePlus, path: "/dashboard/entries" },
  { name: "Master", icon: Database, path: "/dashboard/master" },
  { name: "Reports", icon: BarChart2, path: "/dashboard/report" },
  { name: "Settings", icon: Settings, path: "/dashboard/settings" },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const userName = currentUser.userName || "Admin";

  const getInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "AD";

    const parts = trimmed.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const isTabActive = (tabPath: string) => {
    const current = pathname?.replace(/\/+$/, "") || "";
    const target = tabPath.replace(/\/+$/, "");

    if (target === "/dashboard") {
      return current === "/dashboard";
    }

    return current === target || current.startsWith(`${target}/`);
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <>
      <aside className="relative flex h-full w-[60px] shrink-0 flex-col items-center py-4 text-white">
        <div className="mb-6 flex w-full justify-center">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex h-12 w-12 items-center justify-center transition hover:scale-[1.03]"
            aria-label="Go to dashboard"
          >
            <Image
              src="/branding/kyn-Photoroom.png"
              alt="KYNSTACK"
              width={34}
              height={34}
              className="h-9 w-9 object-contain"
              priority
            />
          </button>
        </div>

        <nav className="flex w-full flex-1 flex-col items-center gap-2.5">
          {tabs.map((tab) => {
            const isActive = isTabActive(tab.path);

            return (
              <div
                key={tab.name}
                className="relative flex w-full justify-center"
              >
                <button
                  type="button"
                  onClick={() => router.push(tab.path)}
                  title={tab.name}
                  aria-label={tab.name}
                  className={[
                    "group relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border transition-all duration-200",
                    isActive
                      ? "border-white/70 bg-gradient-to-r from-[#20b7ff] to-[#b026ff] text-white shadow-[0_10px_30px_rgba(32,183,255,0.4)]"
                      : "border-transparent bg-transparent text-slate-500 hover:border-white/8 hover:bg-white/[0.05] hover:text-white",
                  ].join(" ")}
                >
                  <tab.icon className="h-[20px] w-[20px]" />

                  <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-[120] hidden -translate-y-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-[#0d1119] px-2.5 py-1.5 text-xs font-medium text-slate-200 shadow-xl group-hover:block">
                    {tab.name}
                  </span>
                </button>
              </div>
            );
          })}
        </nav>

        <div className="mt-4 flex w-full flex-col items-center gap-2.5">
          <div
            title={userName}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-slate-100 shadow-[0_8px_18px_rgba(0,0,0,0.24)]"
          >
            {getInitials(userName)}
          </div>

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            disabled={loggingOut}
            title="Logout"
            aria-label="Logout"
            className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-transparent text-slate-500 transition hover:border-white/8 hover:bg-white/[0.05] hover:text-white disabled:opacity-60 cursor-pointer"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </aside>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Log out of KYNFLOW?"
        message="You are about to end the current session and return to the login screen."
        confirmText={loggingOut ? "Logging out..." : "Log out"}
        cancelText="Stay here"
        onConfirm={handleLogout}
        onCancel={() => {
          if (!loggingOut) setShowLogoutConfirm(false);
        }}
      />
    </>
  );
}
