// src/app/settings/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/hooks/useAuth";

export default function SettingsPage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="text-5xl text-averix-red-dark">Settings Page</h1>
      <button
        onClick={handleLogout}
        className="px-6 py-3 rounded-xl bg-averix-red-dark text-white text-lg font-semibold hover:bg-averix-red transition"
      >
        Logout
      </button>
    </main>
  );
}
