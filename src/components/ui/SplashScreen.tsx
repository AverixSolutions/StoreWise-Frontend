// src/components/ui/SplashScreen.tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function SplashScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(32,183,255,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(176,38,255,0.08),transparent_32%),linear-gradient(180deg,#040814_0%,#08101d_100%)] text-white">
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <Image
          src="/branding/kynflow-logo-white-nobg.png"
          alt="KynFlow"
          width={280}
          height={80}
          className="h-16 w-auto object-contain sm:h-20"
          priority
        />

        <p className="mt-5 text-xs uppercase tracking-[0.22em] text-white/55">
          Powered by Kynstack
        </p>
      </motion.div>
    </div>
  );
}
