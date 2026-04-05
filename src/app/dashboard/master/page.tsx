// src/app/dashboard/master/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Building2,
  Truck,
  Settings,
  Percent,
  ArrowLeft,
  Printer,
  Tag,
} from "lucide-react";
import { platform } from "@/platform";
import { getActiveLicenseId } from "@/lib/session/runtimeSession";
import SuppliersTable from "@/components/suppliers/SuppliersTable";
import CustomersTable from "@/components/customers/CustomersTable";
import AccountMaster from "@/components/accounts/AccountMaster";
import TaxSettings from "@/components/tax/TaxSettings";
import ShopSettingsPanel from "@/components/master/ShopSettingsPanel";
import LabelPrintSettings from "@/components/master/LabelPrintSettings";
import BrandsCategoriesManager from "@/components/master/BrandsCategoriesManager";

type MasterSection =
  | "dashboard"
  | "suppliers"
  | "customers"
  | "brandCategory"
  | "shopSettings"
  | "accounts"
  | "tax"
  | "labelPrint";

const masterSections = [
  {
    id: "suppliers" as MasterSection,
    title: "Suppliers",
    description: "Manage supplier information and contacts",
    icon: Truck,
    color: "bg-blue-500",
    count: 0,
  },
  {
    id: "customers" as MasterSection,
    title: "Customers",
    description: "Manage customer database",
    icon: Users,
    color: "bg-green-500",
    count: 0,
  },
  {
    id: "accounts" as MasterSection,
    title: "Account Master",
    description: "Create groups and ledger accounts",
    icon: Settings,
    color: "bg-indigo-500",
    count: 0,
  },
  {
    id: "tax" as MasterSection,
    title: "Tax Settings",
    description: "GST slabs, splits & posting heads",
    icon: Percent,
    color: "bg-rose-500",
    count: 0,
  },
  {
    id: "brandCategory" as MasterSection,
    title: "Brands & Categories",
    description: "Add, rename and delete brands and categories",
    icon: Tag,
    color: "bg-fuchsia-500",
    count: 0,
  },
  {
    id: "shopSettings" as MasterSection,
    title: "Shop Settings",
    description: "Manage shop profile, logo, GST and print details",
    icon: Building2,
    color: "bg-orange-500",
    count: 1,
  },
  {
    id: "labelPrint" as MasterSection,
    title: "Label Print Settings",
    description: "Configure printers and print templates",
    icon: Printer,
    color: "bg-cyan-500",
    count: 0,
  },
];

const webSafeSections: MasterSection[] = ["shopSettings", "brandCategory"];

export default function MasterPage() {
  const [currentSection, setCurrentSection] =
    useState<MasterSection>("dashboard");
  const [supplierCount, setSupplierCount] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);

  const runtime = platform.getRuntimeInfo();
  const isWeb = runtime.runtime === "web";

  useEffect(() => {
    if (currentSection !== "dashboard") return;

    const licenseId = getActiveLicenseId();
    if (!licenseId) {
      setSupplierCount(0);
      setCustomerCount(0);
      return;
    }

    (async () => {
      try {
        const counts = await platform.getMasterCounts(licenseId);
        setSupplierCount(counts.supplierCount);
        setCustomerCount(counts.customerCount);
      } catch (e) {
        console.error("master counts failed", e);
        setSupplierCount(0);
        setCustomerCount(0);
      }
    })();
  }, [currentSection]);

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Master Data Management
        </h1>
        <p className="text-gray-600">
          Manage all your master data from one centralized location
        </p>
        {isWeb && (
          <div className="mt-3 inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Browser mode — only Shop Settings and Brands & Categories are
            available. Other sections require the desktop app.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {masterSections.map((section) => {
          const IconComponent = section.icon;
          const count =
            section.id === "suppliers"
              ? supplierCount
              : section.id === "customers"
                ? customerCount
                : section.count;

          const disabled = isWeb && !webSafeSections.includes(section.id);

          return (
            <div
              key={section.id}
              onClick={() => {
                if (disabled) return;
                setCurrentSection(section.id);
              }}
              className={`bg-white rounded-xl border border-gray-200 p-6 shadow-sm transition-all duration-200 group
                ${
                  disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:shadow-md cursor-pointer"
                }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 rounded-lg ${section.color} text-white ${!disabled ? "group-hover:scale-110" : ""} transition-transform duration-200`}
                >
                  <IconComponent className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-400">
                    {count}
                  </span>
                  {disabled && (
                    <div className="text-[10px] text-amber-600 font-medium mt-1">
                      Desktop only
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {section.title}
              </h3>
              <p className="text-gray-600 text-sm">{section.description}</p>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  {disabled
                    ? "Not available in browser mode"
                    : "Click to manage"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quick Stats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {supplierCount}
            </div>
            <div className="text-sm text-gray-600">Total Suppliers</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {customerCount}
            </div>
            <div className="text-sm text-gray-600">Total Customers</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">0</div>
            <div className="text-sm text-gray-600">Total Categories</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (currentSection) {
      case "suppliers":
        return <SuppliersTable />;
      case "customers":
        return <CustomersTable />;
      case "accounts":
        return <AccountMaster />;
      case "tax":
        return <TaxSettings />;
      case "shopSettings":
        return <ShopSettingsPanel />;
      case "labelPrint":
        return <LabelPrintSettings />;
      case "brandCategory":
        return (
          <BrandsCategoriesManager
            onBackToMaster={() => setCurrentSection("dashboard")}
          />
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <main className="">
      {/* {currentSection !== "dashboard" && (
        <div className="mb-6">
          <button
            onClick={() => setCurrentSection("dashboard")}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Master Dashboard
          </button>
        </div>
      )} */}
      {renderSectionContent()}
    </main>
  );
}
