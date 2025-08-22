// src/components/ui/Header.tsx
"use client";

import Image from "next/image";

interface HeaderProps {
  title?: string;
  userName?: string;
}

export default function Header({
  title = "Averix StoreWise",
  userName = "John Doe",
}: HeaderProps) {
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
          {userName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()}
        </div>
      </div>
    </header>
  );
}
