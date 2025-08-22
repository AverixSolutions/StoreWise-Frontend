// src/app/dashboard/page.tsx
"use client";
import { motion } from "framer-motion";
import {
  Package,
  ShoppingCart,
  RotateCcw,
  RotateCw,
  CreditCard,
  Wallet,
  FileText,
} from "lucide-react";
import Header from "@/components/ui/Header";
import Sidebar from "@/components/ui/Sidebar";
import { useRouter } from "next/navigation";

const features = [
  { name: "Item Creation", icon: Package, path: "/dashboard/items" },
  { name: "Sales", icon: ShoppingCart, path: "/dashboard/sales" },
  { name: "Sales Return", icon: RotateCcw, path: "/dashboard/sales-return" },
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
  const headerHeight = 72;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar topOffset={headerHeight} />

        {/* Main content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Toolbox container */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow p-4">
            <div className="flex space-x-6 items-center justify-center overflow-x-auto py-2">
              {features.map((feature) => (
                <motion.div
                  key={feature.name}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push(feature.path)}
                  className="flex-shrink-0 w-36 h-24 flex flex-col items-center justify-center bg-gray-50 rounded-xl shadow hover:shadow-lg cursor-pointer transition"
                >
                  <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-r from-averix-red-dark to-averix-red-vivid text-white shadow-md mb-2">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-center text-xs font-medium text-gray-800">
                    {feature.name}
                  </h3>
                </motion.div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
