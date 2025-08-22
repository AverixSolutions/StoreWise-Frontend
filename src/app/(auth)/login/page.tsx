// src/app/(auth)/login/page.tsx
"use client";
import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex w-full max-w-5xl shadow-2xl rounded-2xl overflow-hidden">
        {/* Left Branding Card */}
        <div className="hidden lg:flex flex-1 bg-averix-black text-white flex-col justify-center items-center p-12">
          <Image
            src="/Averix-icon.png"
            alt="Averix Logo"
            width={120}
            height={120}
            className="mb-6"
          />
          <h1 className="text-3xl font-bold">Averix Solutions</h1>
          <p className="mt-2 text-base opacity-80">
            Where Innovation Meets Integrity
          </p>

          <div className="mt-8 text-center">
            <h2 className="text-2xl font-semibold text-averix-red-vivid">
              StoreWise
            </h2>
            <p className="text-sm text-gray-400">Smart Inventory Management</p>
          </div>
        </div>

        {/* Right Login Card */}
        <div className="flex-1 flex justify-center items-center bg-white">
          <div className="w-full max-w-md p-8">
            <h2 className="text-2xl font-extrabold text-averix-red-dark tracking-tight text-center">
              StoreWise Login
            </h2>
            <p className="text-sm text-gray-500 mt-2 mb-4 text-center">
              Access your dashboard securely by selecting your role
            </p>

            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
