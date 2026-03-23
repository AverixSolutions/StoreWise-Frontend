// src/app/(auth)/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";
import SplashScreen from "@/components/ui/SplashScreen";
import { getCurrentUser } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const { token } = getCurrentUser();

    const timer = setTimeout(() => {
      if (token) {
        router.replace("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [router]);

  if (checkingAuth) return <SplashScreen />;

  return (
    <main className="min-h-screen bg-kyn-bg text-kyn-text">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left brand section */}
        <section className="hidden lg:flex flex-col justify-between border-r border-kyn-border bg-[radial-gradient(circle_at_top_left,rgba(32,183,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(176,38,255,0.12),transparent_30%),linear-gradient(180deg,#050b17,#091121)] p-10 xl:p-14">
          <div>
            <Image
              src="/branding/kynflow-logo-white-nobg.png"
              alt="KynFlow"
              width={220}
              height={60}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>

          <div className="max-w-xl">
            <div className="inline-flex items-center rounded-full border border-kyn-border bg-white/5 px-4 py-1.5 text-xs font-medium tracking-[0.18em] text-kyn-text-soft uppercase">
              KYNSTACK PRODUCT
            </div>

            <h1 className="mt-6 text-4xl xl:text-5xl font-semibold leading-tight">
              Run your inventory,
              <span className="block kyn-brand-text">
                billing and stock flow
              </span>
              in one system.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-kyn-text-muted">
              KynFlow is your unified desktop workspace for purchases, sales,
              returns, barcode workflows, stock tracking, reporting and billing.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="kyn-card-soft p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-kyn-text-muted">
                  Fast Access
                </p>
                <p className="mt-2 text-sm text-kyn-text-soft">
                  Launch directly into your business operations dashboard.
                </p>
              </div>

              <div className="kyn-card-soft p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-kyn-text-muted">
                  Offline Ready
                </p>
                <p className="mt-2 text-sm text-kyn-text-soft">
                  Built for local-first inventory and billing workflows.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-kyn-text-muted">
            <span>KynFlow by Kynstack</span>
            <Image
              src="/branding/KynstackWhitelogo.png"
              alt="Kynstack"
              width={140}
              height={36}
              className="h-8 w-auto object-contain opacity-80"
            />
          </div>
        </section>

        {/* Right login section */}
        <section className="flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <Image
                src="/branding/kynflow-logo-white.png"
                alt="KynFlow"
                width={180}
                height={50}
                className="h-12 w-auto object-contain"
                priority
              />
            </div>

            <div className="kyn-card p-8 sm:p-10">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-kyn-text">
                  Welcome back
                </h2>
                <p className="mt-2 text-sm leading-6 text-kyn-text-muted">
                  Sign in to access your KynFlow workspace
                </p>
              </div>

              <div className="mt-8">
                <LoginForm />
              </div>

              <div className="mt-6 text-center text-xs text-kyn-text-muted">
                Secure local access for inventory and billing operations
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
