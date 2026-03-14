// src/components/ui/Header.tsx
"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, logout } from "@/hooks/useAuth";

interface HeaderProps {
  title?: string;
}

export default function Header({ title = "StoreWise" }: HeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const userName = currentUser.userName || "admin";
  const licenseName = currentUser.licenseName || "StoreWise Offline";

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
    <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between border border-gray-200">
      <div className="flex items-center space-x-3">
        <Image
          src="/Averix-icon.png"
          alt="StoreWise Logo"
          width={40}
          height={40}
          className="rounded-md"
        />

        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-averix-red-dark">{title}</h1>
          <p className="text-xs text-gray-500">{licenseName}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 flex items-center justify-center bg-averix-red-vivid text-white rounded-full font-semibold shadow-md">
            {getInitials(userName)}
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-sm font-semibold text-gray-800">
              {userName}
            </span>
            <span className="text-xs text-gray-500">Offline Admin</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </header>
  );
}
