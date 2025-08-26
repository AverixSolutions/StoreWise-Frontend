// src/components/ui/Header.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/hooks/useAuth";

interface HeaderProps {
  title?: string;
}

export default function Header({ title = "StoreWise" }: HeaderProps) {
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const user = getCurrentUser();
    if (user.userName) {
      setUserName(user.userName);
    }
  }, []);

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between border border-gray-200">
      {/* Logo + Title */}
      <div className="flex items-center space-x-3">
        {/* Logo */}
        <Image
          src="/Averix-icon.png"
          alt="Averix Logo"
          width={40}
          height={40}
          className="rounded-md"
        />

        {/* Title */}
        <h1 className="text-2xl font-bold text-averix-red-dark">{title}</h1>
      </div>

      {/* User Badge */}
      <div className="flex items-center space-x-3 cursor-pointer group relative">
        {/* Circle with initials */}
        <div className="w-10 h-10 flex items-center justify-center bg-averix-red-vivid text-white rounded-full font-semibold shadow-md">
          {getInitials(userName)}
        </div>
      </div>
    </header>
  );
}
