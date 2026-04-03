// src/app/entries/page.tsx
"use client";

import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/hooks/useAuth";
import {
  ArrowRight,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  RotateCcw,
  RotateCw,
  ShoppingBag,
  ShoppingCart,
  Wallet,
} from "lucide-react";

type NavItem = {
  name: string;
  shortName: string;
  description: string;
  icon: any;
  path: string;
  featured?: boolean;
};

const actions: NavItem[] = [
  {
    name: "Dashboard Overview",
    shortName: "Dashboard",
    description: "Overview, stock, sales, purchases, dues",
    icon: LayoutDashboard,
    path: "/dashboard",
    featured: true,
  },
  {
    name: "Items",
    shortName: "Items",
    description: "Products, pricing, stock structure",
    icon: Package,
    path: "/dashboard/items",
    featured: true,
  },
  {
    name: "Sales",
    shortName: "Sales",
    description: "Billing and sales entry",
    icon: ShoppingCart,
    path: "/dashboard/sales",
    featured: true,
  },
  {
    name: "Purchase",
    shortName: "Purchase",
    description: "Purchase entry and inward stock",
    icon: ShoppingBag,
    path: "/dashboard/purchase",
    featured: true,
  },
  {
    name: "Sales Return",
    shortName: "Sales Return",
    description: "Reverse sold stock",
    icon: RotateCcw,
    path: "/dashboard/sales-return",
  },
  {
    name: "Purchase Return",
    shortName: "Purchase Return",
    description: "Supplier return entry",
    icon: RotateCw,
    path: "/dashboard/purchase-return",
  },
  {
    name: "Payment",
    shortName: "Payment",
    description: "Outgoing payments",
    icon: CreditCard,
    path: "/dashboard/payment",
  },
  {
    name: "Collection",
    shortName: "Collection",
    description: "Incoming collections",
    icon: Wallet,
    path: "/dashboard/collection",
  },
  {
    name: "Quotation",
    shortName: "Quotation",
    description: "Quotation workflow",
    icon: FileText,
    path: "/dashboard/quotation",
  },
];

function EntryTile({
  item,
  onOpen,
  compact = false,
}: {
  item: NavItem;
  onOpen: (path: string) => void;
  compact?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onOpen(item.path)}
      className={`group w-full rounded-[22px] border border-slate-200/80 bg-[#fcfbf7] text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:border-fuchsia-200 hover:shadow-[0_16px_30px_rgba(32,183,255,0.08)] ${
        compact ? "p-4" : "p-4.5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`kyn-brand-chip flex items-center justify-center rounded-2xl text-slate-900 ring-1 ring-black/5 ${
            compact ? "h-10 w-10" : "h-11 w-11"
          }`}
        >
          <item.icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </div>

        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-fuchsia-500" />
      </div>

      <div className={compact ? "mt-3.5" : "mt-4"}>
        <h3
          className={`font-semibold tracking-[-0.02em] text-slate-900 ${
            compact ? "text-sm" : "text-[15px]"
          }`}
        >
          {item.shortName}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {item.description}
        </p>
      </div>
    </motion.button>
  );
}

export default function EntriesPage() {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();

    if (!user?.token) {
      router.push("/login");
    }
  }, [router]);

  const featuredActions = useMemo(
    () => actions.filter((item) => item.featured),
    [],
  );

  const secondaryActions = useMemo(
    () => actions.filter((item) => !item.featured),
    [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_58%,#16213d_100%)] px-5 py-4 text-white shadow-[0_8px_20px_rgba(7,12,24,0.10)] md:px-6 md:py-5">
        <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative">
          <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
            KYNFLOW • QUICK ENTRIES
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-[30px]">
            Business workflows.{" "}
            <span className="kyn-brand-text">Fast and direct.</span>
          </h1>

          <p className="mt-2 text-sm text-slate-300">
            Open the right screen without digging through the dashboard.
          </p>
        </div>
      </section>

      <section className="flex-1 min-h-0 rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] md:p-5">
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Main Actions
            </div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Daily workflow access
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {featuredActions.map((item) => (
              <EntryTile
                key={item.name}
                item={item}
                onOpen={(path) => router.push(path)}
              />
            ))}
          </div>

          <div className="border-t border-slate-200/80 pt-4">
            <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              More Actions
            </div>
            <h3 className="text-base font-semibold tracking-[-0.02em] text-slate-900">
              Supporting workflows
            </h3>
          </div>

          <div className="grid flex-1 auto-rows-fr gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {secondaryActions.map((item) => (
              <EntryTile
                key={item.name}
                item={item}
                compact
                onOpen={(path) => router.push(path)}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
