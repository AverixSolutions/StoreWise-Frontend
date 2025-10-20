// src/app/master/page.tsx
"use client";
import { useState, useEffect } from "react";
import {
  Users,
  Package,
  Building2,
  Truck,
  CreditCard,
  Settings,
  ArrowLeft,
} from "lucide-react";
import SuppliersTable from "@/components/suppliers/SuppliersTable";
import CustomersTable from "@/components/customers/CustomersTable";

type MasterSection =
  | "dashboard"
  | "suppliers"
  | "customers"
  | "categories"
  | "brands"
  | "units"
  | "warehouses";

const masterSections = [
  {
    id: "suppliers" as MasterSection,
    title: "Suppliers",
    description: "Manage supplier information and contacts",
    icon: Truck,
    color: "bg-blue-500",
    hoverColor: "hover:bg-blue-600",
    count: 0,
  },
  {
    id: "customers" as MasterSection,
    title: "Customers",
    description: "Manage customer database",
    icon: Users,
    color: "bg-green-500",
    hoverColor: "hover:bg-green-600",
    count: 0,
  },
  {
    id: "categories" as MasterSection,
    title: "Categories",
    description: "Product categories and classifications",
    icon: Package,
    color: "bg-purple-500",
    hoverColor: "hover:bg-purple-600",
    count: 0,
  },
  {
    id: "brands" as MasterSection,
    title: "Brands",
    description: "Manage product brands",
    icon: CreditCard,
    color: "bg-orange-500",
    hoverColor: "hover:bg-orange-600",
    count: 0,
  },
  {
    id: "units" as MasterSection,
    title: "Units",
    description: "Measurement units configuration",
    icon: Settings,
    color: "bg-gray-500",
    hoverColor: "hover:bg-gray-600",
    count: 0,
  },
  {
    id: "warehouses" as MasterSection,
    title: "Warehouses",
    description: "Storage location management",
    icon: Building2,
    color: "bg-red-500",
    hoverColor: "hover:bg-red-600",
    count: 0,
  },
];

export default function MasterPage() {
  const [currentSection, setCurrentSection] =
    useState<MasterSection>("dashboard");
  const [supplierCount, setSupplierCount] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);

  useEffect(() => {
    if (currentSection !== "dashboard") return;
    const licenseId = localStorage.getItem("licenseId") || "demo-license";
    (async () => {
      try {
        const { count: supCnt } = await (
          window as any
        ).electronAPI.getSupplierCount(licenseId, { q: "" });
        setSupplierCount(Number(supCnt || 0));

        const { count: custCnt } = await (
          window as any
        ).electronAPI.getCustomerCount(licenseId, { q: "" });
        setCustomerCount(Number(custCnt || 0));
      } catch (e) {
        console.error("master counts failed", e);
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
          return (
            <div
              key={section.id}
              onClick={() => setCurrentSection(section.id)}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 rounded-lg ${section.color} text-white group-hover:scale-110 transition-transform duration-200`}
                >
                  <IconComponent className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-gray-400">
                  {count}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-averix-red-dark transition-colors">
                {section.title}
              </h3>
              <p className="text-gray-600 text-sm">{section.description}</p>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">Click to manage</span>
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
      case "categories":
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Categories Management
            </h3>
            <p className="text-gray-600">
              Category management feature coming soon...
            </p>
          </div>
        );
      case "brands":
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Brands Management
            </h3>
            <p className="text-gray-600">
              Brand management feature coming soon...
            </p>
          </div>
        );
      case "units":
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Units Management
            </h3>
            <p className="text-gray-600">
              Unit management feature coming soon...
            </p>
          </div>
        );
      case "warehouses":
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Warehouses Management
            </h3>
            <p className="text-gray-600">
              Warehouse management feature coming soon...
            </p>
          </div>
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <main className="p-6 min-h-screen bg-gray-50">
      {currentSection !== "dashboard" && (
        <div className="mb-6">
          <button
            onClick={() => setCurrentSection("dashboard")}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Master Dashboard
          </button>
        </div>
      )}

      {renderSectionContent()}
    </main>
  );
}
