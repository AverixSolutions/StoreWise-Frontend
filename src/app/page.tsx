// src/app/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SplashScreen from "@/components/ui/SplashScreen";
import { getCurrentUser } from "@/hooks/useAuth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const { token } = getCurrentUser();

    const timer = setTimeout(() => {
      if (token) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [router]);

  return <SplashScreen />;
}
