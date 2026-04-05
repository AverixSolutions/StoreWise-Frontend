// src/app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/hooks/useAuth";
import {
  Boxes,
  CircleDollarSign,
  CreditCard,
  Package,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { platform } from "@/platform";
import {
  getActiveLicenseId,
  getActiveLicenseName,
} from "@/lib/session/runtimeSession";
import type { DashboardOverview } from "@/platform/types";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function shortDate(value: string) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function fullDateTime(value: string | number | Date) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "--";

  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function liveClock(value: Date) {
  return value.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function resolveLicenseId(user: any) {
  return (
    user?.licenseId ||
    user?.license?.id ||
    user?.license ||
    user?.userId ||
    user?.id ||
    ""
  );
}

function buildLinePath(
  values: number[],
  width: number,
  height: number,
  padding = 16,
) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return values
    .map((value, index) => {
      const x =
        padding +
        (values.length === 1
          ? innerWidth / 2
          : (index * innerWidth) / (values.length - 1));
      const y = padding + innerHeight - (value / max) * innerHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildAreaPath(
  values: number[],
  width: number,
  height: number,
  padding = 16,
) {
  if (!values.length) return "";

  const max = Math.max(...values, 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points = values.map((value, index) => ({
    x:
      padding +
      (values.length === 1
        ? innerWidth / 2
        : (index * innerWidth) / (values.length - 1)),
    y: padding + innerHeight - (value / max) * innerHeight,
  }));

  const first = points[0];
  const last = points[points.length - 1];
  const baseY = height - padding;

  return [
    `M ${first.x} ${baseY}`,
    ...points.map((p) => `L ${p.x} ${p.y}`),
    `L ${last.x} ${baseY}`,
    "Z",
  ].join(" ");
}

function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,250,252,0.78))] shadow-[0_18px_45px_rgba(3,10,24,0.08)] backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string;
  sub: string;
  icon: any;
}) {
  return (
    <Surface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-slate-950">
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">{sub}</p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,rgba(32,183,255,0.16),rgba(176,38,255,0.16))] text-slate-900 shadow-[0_10px_24px_rgba(32,183,255,0.08)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Surface>
  );
}

function OverviewChart({ series }: { series: DashboardOverview["series"] }) {
  const width = 720;
  const height = 240;

  const sales = series.map((s) => Number(s.sales || 0));
  const purchases = series.map((s) => Number(s.purchases || 0));

  const salesLine = buildLinePath(sales, width, height);
  const salesArea = buildAreaPath(sales, width, height);
  const purchasesLine = buildLinePath(purchases, width, height);

  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/90 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] w-full">
        {[0.25, 0.5, 0.75].map((step) => (
          <line
            key={step}
            x1="0"
            y1={height * step}
            x2={width}
            y2={height * step}
            stroke="rgba(148,163,184,0.18)"
            strokeDasharray="5 7"
          />
        ))}

        <path d={salesArea} fill="rgba(32,183,255,0.10)" />

        <path
          d={salesLine}
          fill="none"
          stroke="#20b7ff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d={purchasesLine}
          fill="none"
          stroke="#b026ff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </svg>

      <div
        className="mt-2 grid gap-2 text-center text-[11px] text-slate-400"
        style={{
          gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
        }}
      >
        {series.map((item) => (
          <div key={item.day}>{shortDate(item.day)}</div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-[26px] bg-white/50" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-[22px] bg-white/50"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="h-96 animate-pulse rounded-[26px] bg-white/50" />
        <div className="h-96 animate-pulse rounded-[26px] bg-white/50" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [licenseName, setLicenseName] = useState<string>("");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [error, setError] = useState("");
  const [webMode, setWebMode] = useState(false);

  const loadOverview = async (showRefreshState = true) => {
    const startedAt = Date.now();

    try {
      if (showRefreshState) setRefreshing(true);
      setError("");

      const user: any = getCurrentUser();
      if (!user?.token) {
        router.push("/login");
        return;
      }

      const licenseId = getActiveLicenseId();
      setLicenseName(getActiveLicenseName());

      if (!licenseId) {
        throw new Error("License ID is missing in the current session.");
      }

      const result = await platform.getDashboardOverview?.(licenseId, 7);
      if (!result || !result.success) {
        setWebMode(true);
        setOverview(null);
        setError("");
        return;
      }
      setWebMode(false);
      setOverview(result.overview);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard overview.");
    } finally {
      const elapsed = Date.now() - startedAt;
      const minSpin = 500;

      if (showRefreshState && elapsed < minSpin) {
        await new Promise((resolve) => setTimeout(resolve, minSpin - elapsed));
      }

      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    loadOverview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const metrics = useMemo(() => {
    if (!overview) return [];

    return [
      {
        title: "Today Sales",
        value: money(overview.kpis.todaySalesAmount),
        sub: `${compactNumber(overview.kpis.todaySalesCount)} bills today`,
        icon: ShoppingCart,
      },
      {
        title: "Today Purchase",
        value: money(overview.kpis.todayPurchaseAmount),
        sub: `${compactNumber(overview.kpis.todayPurchaseCount)} entries today`,
        icon: ShoppingBag,
      },
      {
        title: "Stock Qty",
        value: compactNumber(overview.kpis.stockQty),
        sub: `${compactNumber(overview.kpis.itemCount)} items in catalog`,
        icon: Boxes,
      },
      {
        title: "Inventory Cost",
        value: money(overview.kpis.inventoryCostValue),
        sub: `Sale value ${money(overview.kpis.inventorySaleValue)}`,
        icon: CircleDollarSign,
      },
      {
        title: "Receivables",
        value: money(overview.kpis.receivableAmount),
        sub: `${compactNumber(overview.kpis.customerCount)} customers`,
        icon: Wallet,
      },
      {
        title: "Payables",
        value: money(overview.kpis.payableAmount),
        sub: `${compactNumber(overview.kpis.supplierCount)} suppliers`,
        icon: CreditCard,
      },
    ];
  }, [overview]);

  if (loading) return <DashboardSkeleton />;

  if (webMode) {
    return (
      <div className="space-y-4">
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)] md:px-6 md:py-6">
          <div className="max-w-3xl">
            <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              KYNFLOW • WEB MODE
            </div>
            <h1 className="text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[34px]">
              Browser mode is active.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Login is working and your browser session is active. Desktop-only
              dashboard analytics are not available here yet.
            </p>
            <div className="mt-4 text-sm text-slate-300">
              <span className="text-white/60">Workspace:</span>{" "}
              <span className="font-medium text-white">
                {licenseName || "KYNFLOW Web"}
              </span>
            </div>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_rgba(3,10,24,0.08)]">
            <h2 className="text-lg font-semibold text-slate-900">
              What works now
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Browser login and token session</li>
              <li>• Routing into dashboard shell</li>
              <li>• Shop Settings via platform layer</li>
              <li>• Local-first browser runtime path</li>
            </ul>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_rgba(3,10,24,0.08)]">
            <h2 className="text-lg font-semibold text-slate-900">
              What is not wired yet
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Dashboard analytics aggregation</li>
              <li>• Product list browser data</li>
              <li>• Purchase and sales browser data</li>
              <li>• Full online sync backend</li>
            </ul>
          </div>
        </section>
        <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_rgba(3,10,24,0.08)]">
          <h2 className="text-lg font-semibold text-slate-900">
            Next browser step
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Start with Master → Shop Settings in browser mode.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard/master")}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open Master Settings
            </button>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Login
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="rounded-[26px] border border-rose-200 bg-rose-50 p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 text-rose-600" />
          <div>
            <h2 className="text-lg font-semibold text-rose-900">
              Dashboard failed to load
            </h2>
            <p className="mt-1 text-sm text-rose-700">
              {error || "Unknown dashboard error."}
            </p>
            <button
              onClick={() => loadOverview(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const lowStockPreview = overview.lowStockItems.slice(0, 5);
  const topProductsPreview = overview.topProducts.slice(0, 5);
  const recentActivityPreview = overview.recentActivity.slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)] md:px-6 md:py-6">
        <div className="pointer-events-none absolute -left-12 top-0 h-32 w-32 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-fuchsia-500/12 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              KYNFLOW • OPERATIONS DASHBOARD
            </div>

            <h1 className="text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[34px]">
              Business clarity.{" "}
              <span className="kyn-brand-text">Inventory in control.</span>
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Track stock, sales, purchases, and dues in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
              <span className="text-white/55">Updated</span>
              <span className="mx-2 text-white/30">•</span>
              <span className="font-medium text-white">
                {fullDateTime(overview.lastUpdatedAt)}
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
              <span className="text-white/55">Local Time</span>
              <span className="mx-2 text-white/30">•</span>
              <span className="inline-block w-[112px] text-right tabular-nums font-medium text-white whitespace-nowrap">
                {liveClock(now)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => loadOverview(true)}
              disabled={refreshing}
              aria-busy={refreshing}
              className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(255,255,255,0.12)] transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-85 cursor-pointer"
            >
              <span className="flex h-4 w-4 items-center justify-center">
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </span>

              <span className="inline-block w-[78px] text-center">
                {refreshing ? "Refreshing" : "Refresh"}
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Surface className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Trend
              </div>
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                Sales vs purchases
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Last {overview.series.length} days movement
              </p>
            </div>

            <div className="hidden items-center gap-3 text-xs font-medium sm:flex">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                Sales
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-500" />
                Purchases
              </div>
            </div>
          </div>

          <div className="mt-4">
            <OverviewChart series={overview.series} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              {
                label: "30D Sales",
                value: money(overview.kpis.sales30Amount),
                sub: `${compactNumber(overview.kpis.sales30Count)} bills`,
              },
              {
                label: "30D Purchase",
                value: money(overview.kpis.purchases30Amount),
                sub: `${compactNumber(overview.kpis.purchases30Count)} entries`,
              },
              {
                label: "Live Batches",
                value: compactNumber(overview.kpis.liveBatchCount),
                sub: "Current batch layer",
              },
              {
                label: "Items",
                value: compactNumber(overview.kpis.itemCount),
                sub: "Tracked products",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[18px] border border-slate-200/80 bg-white/90 p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {item.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
              </div>
            ))}
          </div>
        </Surface>

        <div className="space-y-4">
          <Surface className="p-5">
            <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Stock Health
            </div>

            <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Risk snapshot
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    Low stock items
                  </span>
                  <span className="font-semibold text-amber-600">
                    {overview.kpis.lowStockCount}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{
                      width: `${Math.min(
                        (overview.kpis.lowStockCount /
                          Math.max(overview.kpis.itemCount, 1)) *
                          100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    Zero stock items
                  </span>
                  <span className="font-semibold text-rose-600">
                    {overview.kpis.zeroStockCount}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-rose-400"
                    style={{
                      width: `${Math.min(
                        (overview.kpis.zeroStockCount /
                          Math.max(overview.kpis.itemCount, 1)) *
                          100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Customers
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {compactNumber(overview.kpis.customerCount)}
                  </p>
                </div>

                <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Suppliers
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {compactNumber(overview.kpis.supplierCount)}
                  </p>
                </div>
              </div>
            </div>
          </Surface>

          <Surface className="p-5">
            <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Attention
            </div>

            <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Low stock watch
            </h2>

            <div className="mt-4 space-y-3">
              {lowStockPreview.length === 0 ? (
                <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                  No immediate stock risk.
                </div>
              ) : (
                lowStockPreview.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white/90 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Restock soon
                      </p>
                    </div>

                    <div
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        item.stock === 0
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {item.stock} left
                    </div>
                  </div>
                ))
              )}
            </div>
          </Surface>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Surface className="p-5">
          <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Recent Activity
          </div>

          <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
            Latest transactions
          </h2>

          <div className="mt-4 space-y-3">
            {recentActivityPreview.length === 0 ? (
              <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-4 text-sm text-slate-500">
                No recent activity yet.
              </div>
            ) : (
              recentActivityPreview.map((entry) => (
                <div
                  key={`${entry.type}-${entry.id}`}
                  className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white/90 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          entry.type === "SALE"
                            ? "bg-cyan-100 text-cyan-700"
                            : "bg-fuchsia-100 text-fuchsia-700"
                        }`}
                      >
                        {entry.type}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {entry.slNo ? `#${entry.slNo}` : "--"}
                      </span>
                    </div>

                    <p className="mt-2 truncate text-sm font-medium text-slate-900">
                      {entry.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {shortDate(entry.date)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {money(entry.amount)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Surface>

        <Surface className="p-5">
          <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Product Performance
          </div>

          <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
            Best selling products
          </h2>

          <div className="mt-4 space-y-3">
            {topProductsPreview.length === 0 ? (
              <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-4 text-sm text-slate-500">
                No sales data yet.
              </div>
            ) : (
              topProductsPreview.map((product, index) => (
                <div
                  key={product.productId}
                  className="grid grid-cols-[34px_minmax(0,1fr)_76px_96px] items-center gap-3 rounded-[18px] border border-slate-200/80 bg-white/90 px-4 py-3"
                >
                  <div className="text-sm font-semibold text-slate-400">
                    #{index + 1}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {product.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Last 30 days</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {compactNumber(product.soldQty)}
                    </p>
                    <p className="text-[11px] text-slate-400">sold</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">
                      {money(product.revenue)}
                    </p>
                    <p className="text-[11px] text-slate-400">revenue</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Surface>
      </section>
    </div>
  );
}
