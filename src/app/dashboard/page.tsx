// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import SyncInfoCard from "@/components/ui/SyncInfoCard";
import {
  Package,
  ShoppingCart,
  RotateCcw,
  ShoppingBag,
  RotateCw,
  CreditCard,
  Wallet,
  FileText,
  ArrowRight,
} from "lucide-react";
import { getCurrentUser } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

const features = [
  { name: "Item Creation", icon: Package, path: "/dashboard/items" },
  { name: "Sales", icon: ShoppingCart, path: "/dashboard/sales" },
  { name: "Sales Return", icon: RotateCcw, path: "/dashboard/sales-return" },
  { name: "Purchase", icon: ShoppingBag, path: "/dashboard/purchase" },
  {
    name: "Purchase Return",
    icon: RotateCw,
    path: "/dashboard/purchase-return",
  },
  { name: "Payment", icon: CreditCard, path: "/dashboard/payment" },
  { name: "Collection", icon: Wallet, path: "/dashboard/collection" },
  { name: "Quotation", icon: FileText, path: "/dashboard/quotation" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [licenseName, setLicenseName] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user.token) {
      router.push("/login");
      return;
    }
    setLicenseName(user.licenseName || null);
  }, [router]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-black/6 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_52%,#16213d_100%)] px-6 py-6 text-white shadow-[0_20px_50px_rgba(7,12,24,0.22)] md:px-8 md:py-8">
        <div className="pointer-events-none absolute -left-8 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative max-w-3xl">
          <div className="kyn-brand-pill mb-4 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
            KYNSTACK • KYNFLOW
          </div>

          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
            Business operations,{" "}
            <span className="kyn-brand-text">billing and inventory</span> in one
            focused desktop workspace.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-[15px]">
            Manage stock, purchases, sales, returns, payments, and reporting
            from a clean offline-first workflow built for speed.
          </p>

          {licenseName && (
            <div className="mt-5 inline-flex items-center rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
              <span className="text-white/55">Licensed to</span>
              <span className="mx-2 text-white/30">•</span>
              <span className="font-medium text-white">{licenseName}</span>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[26px] border border-black/6 bg-white/72 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Quick Access
            </div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Quick actions
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Jump straight into the workflows you use most.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {features.map((feature) => (
            <motion.button
              key={feature.name}
              type="button"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => router.push(feature.path)}
              className="group rounded-[22px] border border-slate-200/80 bg-[#fcfbf7] p-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:border-fuchsia-200 hover:shadow-[0_16px_30px_rgba(32,183,255,0.08)]"
            >
              <div className="flex items-start justify-between">
                <div className="kyn-brand-chip flex h-11 w-11 items-center justify-center rounded-2xl text-slate-900 ring-1 ring-black/5">
                  <feature.icon className="h-5 w-5" />
                </div>

                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-fuchsia-500" />
              </div>

              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  {feature.name}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Open {feature.name.toLowerCase()} workflow.
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[26px] border border-black/6 bg-white/72 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Overview
          </div>

          <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
            Workspace overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Use KYNFLOW as a central operations desk for your daily business
            flow.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-[#fcfbf7] p-4">
              <div className="mb-3 h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,#20b7ff_0%,#b026ff_100%)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Inventory
              </p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                Keep stock movement accurate across items, batches, and returns.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-[#fcfbf7] p-4">
              <div className="mb-3 h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,#20b7ff_0%,#b026ff_100%)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Billing
              </p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                Run sales, payments, collections, and quotations from one place.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-[#fcfbf7] p-4">
              <div className="mb-3 h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,#20b7ff_0%,#b026ff_100%)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Control
              </p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                Manage purchases, reporting, and daily operations with less
                clutter.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-black/6 bg-white/72 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            System
          </div>

          <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
            Sync status
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Current local and sync health for this installation.
          </p>
        </div>
      </section>
    </div>
  );
}
