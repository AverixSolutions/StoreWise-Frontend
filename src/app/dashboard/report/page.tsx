// src/app/report/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ShoppingCart,
  RefreshCcw,
  IndianRupee,
  RotateCcw,
} from "lucide-react";

import PurchaseReportsModal from "@/components/purchase/PurchaseReportsModal";
import PurchaseReturnReportsModal from "@/components/purchase-return/PurchaseReturnReportsModal";
import SalesReportsModal from "@/components/sales/SalesReportsModal";
import SalesReturnReportsModal from "@/components/sales-return/SalesReturnReportsModal";

type SimpleOption = { id: string; name: string };

export default function ReportPage() {
  const router = useRouter();

  const licenseId =
    typeof window !== "undefined"
      ? localStorage.getItem("licenseId") || ""
      : "";

  const [suppliers, setSuppliers] = useState<SimpleOption[]>([]);
  const [customers, setCustomers] = useState<SimpleOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [openPurchase, setOpenPurchase] = useState(false);
  const [openPurchaseReturn, setOpenPurchaseReturn] = useState(false);
  const [openSales, setOpenSales] = useState(false);
  const [openSalesReturn, setOpenSalesReturn] = useState(false);

  // Opening state for showing "Opening..." indicator
  const [opening, setOpening] = useState<{
    kind: "purchase" | "purchase-return" | "sales" | "sales-return";
    id: string;
  } | null>(null);

  // Prefetch routes on mount
  useEffect(() => {
    router.prefetch("/dashboard/purchase");
    router.prefetch("/dashboard/purchase-return");
    router.prefetch("/dashboard/sales");
    router.prefetch("/dashboard/sales-return");
  }, [router]);

  const handleOpenPurchase = useCallback(
    (id: string) => {
      // sessionStorage handoff (no URL flicker)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("openPurchaseId", id);
      }
      setOpening({ kind: "purchase", id }); // show "Opening…" in the modal
      router.push("/dashboard/purchase"); // do NOT close the modal here
      // the page unmounts automatically on route change
    },
    [router]
  );

  const handleOpenPurchaseReturn = useCallback(
    (id: string) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("openPurchaseReturnId", id);
      }
      setOpening({ kind: "purchase-return", id });
      router.push("/dashboard/purchase-return");
    },
    [router]
  );

  const handleOpenSale = useCallback(
    (id: string) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("openSaleId", id);
      }
      setOpening({ kind: "sales", id });
      router.push("/dashboard/sales");
    },
    [router]
  );

  const handleOpenSaleReturn = useCallback(
    (id: string) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("openSaleReturnId", id);
      }
      setOpening({ kind: "sales-return", id });
      router.push("/dashboard/sales-return");
    },
    [router]
  );

  // Load lists once for filters inside modals
  useEffect(() => {
    if (!licenseId) return;
    (async () => {
      try {
        // customers
        const cRes = await (window as any).electronAPI.listCustomers(
          licenseId,
          {
            q: "",
            page: 1,
            pageSize: 1000,
          }
        );
        const cs: SimpleOption[] = (cRes.customers || []).map((c: any) => ({
          id: c.id,
          name: c.name,
        }));
        setCustomers(cs);

        // suppliers
        const sRes = await (window as any).electronAPI.listSuppliers(
          licenseId,
          {
            page: 1,
            pageSize: 1000,
            name: "",
            category: "",
          }
        );
        const ss: SimpleOption[] = (sRes.suppliers || []).map((s: any) => ({
          id: s.id,
          name: s.name,
        }));
        setSuppliers(ss);
      } catch (e) {
        console.error("Failed to preload report filters", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [licenseId]);

  return (
    <main className="p-6 min-h-screen bg-gray-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600">
          View purchases, returns, sales, and summaries — all in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <ReportCard
          title="Purchase Reports"
          description="Bills, supplier-wise, date ranges, tax splits, and more."
          icon={<ShoppingCart className="w-6 h-6" />}
          accent="from-emerald-500 to-emerald-600"
          disabled={loading}
          onOpen={() => setOpenPurchase(true)}
        />
        <ReportCard
          title="Purchase Return Reports"
          description="Returns by supplier, item, and period; credit notes, etc."
          icon={<RotateCcw className="w-6 h-6" />}
          accent="from-cyan-500 to-cyan-600"
          disabled={loading}
          onOpen={() => setOpenPurchaseReturn(true)}
        />
        <ReportCard
          title="Sales Reports"
          description="Bills, customer-wise, item-wise, tax, discounts & more."
          icon={<IndianRupee className="w-6 h-6" />}
          accent="from-indigo-500 to-indigo-600"
          disabled={loading}
          onOpen={() => setOpenSales(true)}
        />
        <ReportCard
          title="Sales Return Reports"
          description="Customer returns, refunds/adjustments, period summaries."
          icon={<RefreshCcw className="w-6 h-6" />}
          accent="from-rose-500 to-rose-600"
          disabled={loading}
          onOpen={() => setOpenSalesReturn(true)}
        />
      </div>

      {/* Modals (only render when opened so they mount cleanly) */}
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
    </main>
  );
}

function ReportCard({
  title,
  description,
  icon,
  accent,
  disabled,
  onOpen,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string; // tailwind gradient: "from-x to-y"
  disabled?: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-white bg-gradient-to-br ${accent}`}
        >
          {icon}
        </div>
        <FileText className="w-5 h-5 text-gray-300" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1 flex-1">{description}</p>

      <button
        disabled={disabled}
        onClick={onOpen}
        className={`mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors
          ${
            disabled
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-averix-red-dark text-white hover:bg-averix-red-darker"
          }`}
      >
        Open
      </button>
    </div>
  );
}
