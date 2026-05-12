// src/app/dashboard/master/page.tsx
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Building2,
  Truck,
  Settings,
  Percent,
  Printer,
  Tag,
  ArrowRight,
  ChevronLeft,
  Ruler,
  FileText,
} from "lucide-react";
import { platform } from "@/platform";
import {
  canUseBarcode,
  getActiveLicenseId,
} from "@/lib/session/runtimeSession";
import SuppliersTable from "@/components/suppliers/SuppliersTable";
import CustomersTable from "@/components/customers/CustomersTable";
import AccountMaster from "@/components/accounts/AccountMaster";
import TaxSettings from "@/components/master/TaxSettings";
import ShopSettingsPanel from "@/components/master/ShopSettingsPanel";
import LabelPrintSettings from "@/components/master/LabelPrintSettings";
import BrandsCategoriesManager from "@/components/master/BrandsCategoriesManager";
import UnitsManager from "@/components/master/UnitsManager";
import TransactionTypesManager from "@/components/master/TransactionTypesManager";

type MasterSection =
  | "dashboard"
  | "suppliers"
  | "customers"
  | "brandCategory"
  | "shopSettings"
  | "accounts"
  | "tax"
  | "labelPrint"
  | "units"
  | "transactionTypes";

type SectionDef = {
  id: MasterSection;
  title: string;
  shortName: string;
  description: string;
  icon: any;
  iconBg: string;
  iconText: string;
  border: string;
  hoverBg: string;
  countBg: string;
  countText: string;
};

const masterSections: SectionDef[] = [
  {
    id: "suppliers",
    title: "Suppliers",
    shortName: "Suppliers",
    description: "Supplier info and contacts",
    icon: Truck,
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    border: "border-blue-200",
    hoverBg: "hover:bg-blue-50/60",
    countBg: "bg-blue-100",
    countText: "text-blue-700",
  },
  {
    id: "customers",
    title: "Customers",
    shortName: "Customers",
    description: "Customer database",
    icon: Users,
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
    border: "border-emerald-200",
    hoverBg: "hover:bg-emerald-50/60",
    countBg: "bg-emerald-100",
    countText: "text-emerald-700",
  },
  {
    id: "shopSettings",
    title: "Shop Settings",
    shortName: "Shop Settings",
    description: "Profile, logo, GST & print details",
    icon: Building2,
    iconBg: "bg-orange-100",
    iconText: "text-orange-600",
    border: "border-orange-200",
    hoverBg: "hover:bg-orange-50/60",
    countBg: "bg-orange-100",
    countText: "text-orange-700",
  },
  {
    id: "brandCategory",
    title: "Brands & Categories",
    shortName: "Brands & Categories",
    description: "Add, rename and delete brands/categories",
    icon: Tag,
    iconBg: "bg-fuchsia-100",
    iconText: "text-fuchsia-600",
    border: "border-fuchsia-200",
    hoverBg: "hover:bg-fuchsia-50/60",
    countBg: "bg-fuchsia-100",
    countText: "text-fuchsia-700",
  },
  {
    id: "units",
    title: "Units of Measure",
    shortName: "Units",
    description: "Manage KG, NOS, LTR and custom units",
    icon: Ruler,
    iconBg: "bg-teal-100",
    iconText: "text-teal-600",
    border: "border-teal-200",
    hoverBg: "hover:bg-teal-50/60",
    countBg: "bg-teal-100",
    countText: "text-teal-700",
  },
  {
    id: "transactionTypes",
    title: "Transaction Types",
    shortName: "Types",
    description: "Define B2B, B2C, etc.",
    icon: FileText,
    iconBg: "bg-violet-100",
    iconText: "text-violet-600",
    border: "border-violet-200",
    hoverBg: "hover:bg-violet-50/60",
    countBg: "bg-violet-100",
    countText: "text-violet-700",
  },
  {
    id: "accounts",
    title: "Account Master",
    shortName: "Accounts",
    description: "Groups and ledger accounts",
    icon: Settings,
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-600",
    border: "border-indigo-200",
    hoverBg: "hover:bg-indigo-50/60",
    countBg: "bg-indigo-100",
    countText: "text-indigo-700",
  },
  {
    id: "tax",
    title: "Tax Settings",
    shortName: "Tax Settings",
    description: "GST slabs, splits & posting heads",
    icon: Percent,
    iconBg: "bg-rose-100",
    iconText: "text-rose-600",
    border: "border-rose-200",
    hoverBg: "hover:bg-rose-50/60",
    countBg: "bg-rose-100",
    countText: "text-rose-700",
  },
  {
    id: "labelPrint",
    title: "Label Print Settings",
    shortName: "Label Print",
    description: "Printers and print templates",
    icon: Printer,
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
    border: "border-amber-200",
    hoverBg: "hover:bg-amber-50/60",
    countBg: "bg-amber-100",
    countText: "text-amber-700",
  },
];

const webSafeSections: MasterSection[] = [
  "shopSettings",
  "brandCategory",
  "units",
  "tax",
  "suppliers",
  "customers",
  "transactionTypes",
];

const sectionTitles: Record<MasterSection, string> = {
  dashboard: "Master",
  suppliers: "Suppliers",
  customers: "Customers",
  brandCategory: "Brands & Categories",
  shopSettings: "Shop Settings",
  accounts: "Account Master",
  tax: "Tax Settings",
  labelPrint: "Label Print Settings",
  units: "Units of Measure",
  transactionTypes: "Transaction Types",
};

function MasterTile({
  section,
  count,
  disabled,
  onOpen,
}: {
  section: SectionDef;
  count: number | null;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { scale: 0.985 }}
      onClick={() => {
        if (!disabled) onOpen();
      }}
      className={`group w-full rounded-[20px] border bg-white p-4 text-left shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-all duration-200 ${
        disabled
          ? "cursor-not-allowed border-slate-200/50 opacity-40"
          : `cursor-pointer ${section.border} ${section.hoverBg} hover:shadow-[0_8px_24px_rgba(15,23,42,0.09)]`
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section.iconBg} ${section.iconText}`}
        >
          <section.icon className="h-4 w-4" />
        </div>

        <div className="flex items-center gap-1.5">
          {count !== null && count > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${section.countBg} ${section.countText}`}
            >
              {count}
            </span>
          )}
          {disabled ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
              Desktop
            </span>
          ) : (
            <ArrowRight
              className={`mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:${section.iconText}`}
            />
          )}
        </div>
      </div>

      <div className="mt-3.5">
        <h3 className="text-sm font-semibold tracking-[-0.02em] text-slate-900">
          {section.shortName}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {section.description}
        </p>
      </div>
    </motion.button>
  );
}

export default function MasterPage() {
  const [currentSection, setCurrentSection] =
    useState<MasterSection>("dashboard");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [barcodeEnabled, setBarcodeEnabled] = useState(true);

  const runtime = platform.getRuntimeInfo();
  const isWeb = runtime.runtime === "web";

  useEffect(() => {
    setBarcodeEnabled(canUseBarcode());
  }, []);

  useEffect(() => {
    if (!barcodeEnabled && currentSection === "labelPrint") {
      setCurrentSection("dashboard");
    }
  }, [barcodeEnabled, currentSection]);

  useEffect(() => {
    if (currentSection !== "dashboard") return;

    const licenseId = getActiveLicenseId();
    if (!licenseId) {
      setCountsLoading(false);
      return;
    }

    (async () => {
      setCountsLoading(true);
      try {
        // Base counts from platform (suppliers/customers from IDB or API)
        const result = await platform.getMasterCounts(licenseId);
        const next: Record<string, number> = {
          suppliers: result.supplierCount ?? 0,
          customers: result.customerCount ?? 0,
        };

        // Brands + Categories + Units + Tax + Transaction Types
        try {
          const [brands, cats, units, taxCats, txTypes] = await Promise.all([
            platform.listBrands(licenseId),
            platform.listCategories(licenseId),
            platform.listUnits(licenseId),
            platform.listTaxCategories(licenseId),
            platform.listAllTransactionTypes?.(licenseId),
          ]);

          next.brandCategory =
            (brands.rows?.filter((r) => !r.deletedAt).length ?? 0) +
            (cats.rows?.filter((r) => !r.deletedAt).length ?? 0);

          next.units = units.rows?.filter((r) => !r.deletedAt).length ?? 0;

          next.tax = taxCats.rows?.filter((r) => !r.deletedAt).length ?? 0;

          next.transactionTypes =
            txTypes?.rows?.filter((r) => !r.deletedAt).length ?? 0;
        } catch {
          // not fatal
        }

        try {
          const [suppResult, custResult] = await Promise.all([
            platform.listSuppliers?.(licenseId, { page: 1, pageSize: 1 }),
            platform.listCustomers?.(licenseId, { page: 1, pageSize: 1 }),
          ]);
          if (suppResult?.total != null) next.suppliers = suppResult.total;
          if (custResult?.total != null) next.customers = custResult.total;
        } catch {
          // offline or API down — keep the IDB counts from getMasterCounts above
        }

        setCounts(next);
      } catch (e) {
        console.error("master counts failed", e);
      } finally {
        setCountsLoading(false);
      }
    })();
  }, [currentSection]);

  const renderDashboard = () => (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden pb-10 md:pb-0">
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_58%,#16213d_100%)] px-5 py-4 text-white shadow-[0_8px_20px_rgba(7,12,24,0.10)] md:px-6 md:py-5">
        <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative">
          <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
            KYNFLOW • MASTER DATA
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-[30px]">
            Business data.{" "}
            <span className="kyn-brand-text">All in one place.</span>
          </h1>

          <p className="mt-2 text-sm text-slate-300">
            Suppliers, customers, accounts, settings and more.
          </p>

          {isWeb && (
            <div className="mt-3 inline-flex items-center rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300">
              Browser mode — some sections require the desktop app
            </div>
          )}
        </div>
      </section>

      {/* Tiles container */}
      <section className="flex-1 min-h-0 rounded-[26px] border border-slate-200 bg-slate-50/70 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] md:p-5">
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              All Sections
            </div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Select a section to manage
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-4">
            {masterSections
              .filter((section) => section.id !== "labelPrint" || barcodeEnabled)
              .map((section) => (
                <MasterTile
                  key={section.id}
                  section={section}
                  count={counts[section.id] ?? null}
                  disabled={isWeb && !webSafeSections.includes(section.id)}
                  onOpen={() => setCurrentSection(section.id)}
                />
              ))}
          </div>
        </div>
      </section>
    </div>
  );

  const renderSectionContent = () => {
    switch (currentSection) {
      case "suppliers":
        return <SuppliersTable onBack={() => setCurrentSection("dashboard")} />;
      case "customers":
        return <CustomersTable onBack={() => setCurrentSection("dashboard")} />;
      case "accounts":
        return <AccountMaster />;
      case "tax":
        return <TaxSettings onBack={() => setCurrentSection("dashboard")} />;
      case "shopSettings":
        return (
          <ShopSettingsPanel onBack={() => setCurrentSection("dashboard")} />
        );
      case "labelPrint":
        return <LabelPrintSettings />;
      case "brandCategory":
        return (
          <BrandsCategoriesManager
            onBackToMaster={() => setCurrentSection("dashboard")}
          />
        );
      case "units":
        return <UnitsManager />;
      case "transactionTypes":
        return (
          <TransactionTypesManager
            onBack={() => setCurrentSection("dashboard")}
          />
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <main className="">
      {currentSection !== "dashboard" &&
        currentSection !== "brandCategory" &&
        currentSection !== "shopSettings" &&
        currentSection !== "tax" &&
        currentSection !== "transactionTypes" &&
        currentSection !== "customers" &&
        currentSection !== "suppliers" && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setCurrentSection("dashboard")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              {sectionTitles[currentSection]}
            </button>
          </div>
        )}
      {renderSectionContent()}
    </main>
  );
}
