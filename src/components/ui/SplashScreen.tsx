// src/components/ui/SplashScreen.tsx
"use client";
import Image from "next/image";
import { motion } from "framer-motion";

export default function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center"
      >
        <Image
          src="/Averix-icon.png"
          alt="Averix Logo"
          width={120}
          height={120}
          className="mb-6"
        />
        <h1 className="text-3xl font-bold text-averix-black">
          Averix Solutions
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Where Innovation Meets Integrity
        </p>

        <div className="mt-8 text-center">
          <h2 className="text-2xl font-semibold text-averix-red-vivid">
            StoreWise
          </h2>
          <p className="text-sm text-gray-400">Smart Inventory Management</p>
        </div>
      </motion.div>
    </div>
  );
}
