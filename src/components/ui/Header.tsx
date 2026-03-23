// src/components/ui/Header.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { getCurrentUser, logout } from "@/hooks/useAuth";

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const userName = currentUser.userName || "Admin";
  const licenseName = currentUser.licenseName || "KYNFLOW Offline";

  const getInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "AD";

    const parts = trimmed.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-white/10 bg-[#08101d]/85 px-6 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-4">
        <div className="hidden md:flex h-10 w-[260px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-slate-400">
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">
            Search products, bills, suppliers...
          </span>
        </div>

        {title ? (
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-semibold text-white">{userName}</span>
          <span className="text-xs text-slate-400">{licenseName}</span>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-sm font-semibold text-white">
          {getInitials(userName)}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </header>
  );
}
