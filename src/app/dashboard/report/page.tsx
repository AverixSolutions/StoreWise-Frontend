// src/app/report/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  RefreshCcw,
  IndianRupee,
  RotateCcw,
  ArrowRight,
  PackageSearch,
} from "lucide-react";
import { motion } from "framer-motion";
import { platform } from "@/platform";

import PurchaseReportsModal from "@/components/purchase/PurchaseReportsModal";
import PurchaseReturnReportsModal from "@/components/purchase-return/PurchaseReturnReportsModal";
import SalesReportsModal from "@/components/sales/SalesReportsModal";
import SalesReturnReportsModal from "@/components/sales-return/SalesReturnReportsModal";
import ItemWiseReportModal from "@/components/products/ItemWiseReportModal";

type SimpleOption = { id: string; name: string };

type ReportCard = {
  id: "purchase" | "purchase-return" | "sales" | "sales-return" | "items";
  title: string;
  shortName: string;
  description: string;
  icon: any;
  iconBg: string;
  iconText: string;
  border: string;
  hoverBg: string;
};

const reportCards: ReportCard[] = [
  {
    id: "purchase",
    title: "Purchase Reports",
    shortName: "Purchase",
    description: "Bills, supplier-wise, date ranges, tax splits and more.",
    icon: ShoppingCart,
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
    border: "border-emerald-300",
    hoverBg: "hover:bg-emerald-50/50",
  },
  {
    id: "purchase-return",
    title: "Purchase Returns",
    shortName: "Purchase Returns",
    description: "Returns by supplier, item, and period; credit notes etc.",
    icon: RotateCcw,
    iconBg: "bg-cyan-100",
    iconText: "text-cyan-600",
    border: "border-cyan-300",
    hoverBg: "hover:bg-cyan-50/50",
  },
  {
    id: "sales",
    title: "Sales Reports",
    shortName: "Sales",
    description: "Bills, customer-wise, item-wise, tax, discounts and more.",
    icon: IndianRupee,
    iconBg: "bg-violet-100",
    iconText: "text-violet-600",
    border: "border-violet-300",
    hoverBg: "hover:bg-violet-50/50",
  },
  {
    id: "sales-return",
    title: "Sales Returns",
    shortName: "Sales Returns",
    description: "Customer returns, refunds, adjustments, period summaries.",
    icon: RefreshCcw,
    iconBg: "bg-rose-100",
    iconText: "text-rose-600",
    border: "border-rose-300",
    hoverBg: "hover:bg-rose-50/50",
  },
  {
    id: "items",
    title: "Item Wise Report",
    shortName: "Item Wise",
    description: "Products, stock, pricing, category, brand and tax details.",
    icon: PackageSearch,
    iconBg: "bg-sky-100",
    iconText: "text-sky-600",
    border: "border-sky-300",
    hoverBg: "hover:bg-sky-50/50",
  },
];

function ReportTile({
  card,
  loading,
  onClick,
}: {
  card: ReportCard;
  loading: boolean;
  onClick: () => void;
}) {
  const Icon = card.icon;
  return (
    <motion.button
      type="button"
      whileHover={loading ? {} : { y: -2 }}
      whileTap={loading ? {} : { scale: 0.985 }}
      disabled={loading}
      onClick={onClick}
      className={`group w-full rounded-[22px] border bg-white p-4 text-left shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition-all duration-200 ${
        loading
          ? "cursor-not-allowed opacity-50"
          : `cursor-pointer ${card.border} ${card.hoverBg} hover:shadow-[0_10px_28px_rgba(15,23,42,0.10)]`
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${card.iconBg} ${card.iconText}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <ArrowRight
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:${card.iconText}`}
        />
      </div>
      <div className="mt-3.5">
        <h3 className="text-sm font-semibold tracking-[-0.02em] text-slate-900">
          {card.shortName}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {card.description}
        </p>
      </div>
    </motion.button>
  );
}

export default function ReportPage() {
  const router = useRouter();

  const licenseId =
    typeof window !== "undefined"
      ? localStorage.getItem("licenseId") || ""
      : "";

  const [suppliers, setSuppliers] = useState<SimpleOption[]>([]);
  const [customers, setCustomers] = useState<SimpleOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [openPurchase, setOpenPurchase] = useState(false);
  const [openPurchaseReturn, setOpenPurchaseReturn] = useState(false);
  const [openSales, setOpenSales] = useState(false);
  const [openSalesReturn, setOpenSalesReturn] = useState(false);
  const [openItems, setOpenItems] = useState(false);

  const [opening, setOpening] = useState<{
    kind: "purchase" | "purchase-return" | "sales" | "sales-return";
    id: string;
  } | null>(null);

  useEffect(() => {
    router.prefetch("/dashboard/purchase");
    router.prefetch("/dashboard/purchase-return");
    router.prefetch("/dashboard/sales");
    router.prefetch("/dashboard/sales-return");
  }, [router]);

  const handleOpenPurchase = useCallback(
    (id: string) => {
      if (typeof window !== "undefined")
        sessionStorage.setItem("openPurchaseId", id);
      setOpening({ kind: "purchase", id });
      router.push("/dashboard/purchase");
    },
    [router],
  );

  const handleOpenPurchaseReturn = useCallback(
    (id: string) => {
      if (typeof window !== "undefined")
        sessionStorage.setItem("openPurchaseReturnId", id);
      setOpening({ kind: "purchase-return", id });
      router.push("/dashboard/purchase-return");
    },
    [router],
  );

  const handleOpenSale = useCallback(
    (id: string) => {
      if (typeof window !== "undefined")
        sessionStorage.setItem("openSaleId", id);
      setOpening({ kind: "sales", id });
      router.push("/dashboard/sales");
    },
    [router],
  );

  const handleOpenSaleReturn = useCallback(
    (id: string) => {
      if (typeof window !== "undefined")
        sessionStorage.setItem("openSaleReturnId", id);
      setOpening({ kind: "sales-return", id });
      router.push("/dashboard/sales-return");
    },
    [router],
  );

  useEffect(() => {
    if (!licenseId) return;
    (async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          platform.listCustomers?.(licenseId, {
            q: "",
            page: 1,
            pageSize: 1000,
          }),
          platform.listSuppliers?.(licenseId, { page: 1, pageSize: 1000 }),
        ]);
        setCustomers(
          (cRes?.customers || []).map((c) => ({ id: c.id, name: c.name })),
        );
        setSuppliers(
          (sRes?.suppliers || []).map((s) => ({ id: s.id, name: s.name })),
        );
      } catch (e) {
        console.error("Failed to preload report filters", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [licenseId]);

  const openHandlers: Record<ReportCard["id"], () => void> = {
    purchase: () => setOpenPurchase(true),
    "purchase-return": () => setOpenPurchaseReturn(true),
    sales: () => setOpenSales(true),
    "sales-return": () => setOpenSalesReturn(true),
    items: () => setOpenItems(true),
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden pb-10 md:pb-0">
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_58%,#16213d_100%)] px-5 py-4 text-white shadow-[0_8px_20px_rgba(7,12,24,0.10)] md:px-6 md:py-5">
        <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative">
          <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
            KYNFLOW • REPORTS
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-[30px]">
            All your records. <span className="kyn-brand-text">One place.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Browse purchases, returns, sales and summaries with filters and date
            ranges.
          </p>
        </div>
      </section>

      {/* Tiles container */}
      <section className="flex-1 min-h-0 rounded-[26px] border border-slate-200 bg-slate-50/70 p-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)] md:p-5">
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Report Sections
            </div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Select a report to view
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {reportCards.map((card) => (
              <ReportTile
                key={card.id}
                card={card}
                loading={loading}
                onClick={openHandlers[card.id]}
              />
            ))}
          </div>
        </div>
      </section>

      {openPurchase && (
        <PurchaseReportsModal
          isOpen={openPurchase}
          onClose={() => setOpenPurchase(false)}
          licenseId={licenseId}
          suppliers={suppliers}
          onOpenPurchase={handleOpenPurchase}
          openingId={opening?.kind === "purchase" ? opening.id : undefined}
        />
      )}

      {openPurchaseReturn && (
        <PurchaseReturnReportsModal
          isOpen={openPurchaseReturn}
          onClose={() => setOpenPurchaseReturn(false)}
          licenseId={licenseId}
          suppliers={suppliers}
          onOpenPurchaseReturn={handleOpenPurchaseReturn}
          openingId={
            opening?.kind === "purchase-return" ? opening.id : undefined
          }
        />
      )}

      {openSales && (
        <SalesReportsModal
          isOpen={openSales}
          onClose={() => setOpenSales(false)}
          licenseId={licenseId}
          customers={customers}
          onOpenSale={handleOpenSale}
          openingId={opening?.kind === "sales" ? opening.id : undefined}
        />
      )}

      {openSalesReturn && (
        <SalesReturnReportsModal
          isOpen={openSalesReturn}
          onClose={() => setOpenSalesReturn(false)}
          licenseId={licenseId}
          customers={customers}
          onOpenSaleReturn={handleOpenSaleReturn}
          openingId={opening?.kind === "sales-return" ? opening.id : undefined}
        />
      )}

      {openItems && (
        <ItemWiseReportModal
          isOpen={openItems}
          onClose={() => setOpenItems(false)}
          licenseId={licenseId}
        />
      )}
    </div>
  );
}
