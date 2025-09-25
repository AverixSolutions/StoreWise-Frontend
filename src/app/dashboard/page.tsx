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
    <div>
      <div className="bg-white rounded-3xl border border-gray-200 shadow p-4">
        <div className="flex space-x-6 items-center justify-center overflow-x-auto py-2">
          {features.map((feature) => (
            <motion.div
              key={feature.name}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push(feature.path)}
              className="flex-shrink-0 w-32 h-24 flex flex-col items-center justify-center bg-gray-50 rounded-xl shadow hover:shadow-lg cursor-pointer transition"
            >
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r from-averix-red-dark to-averix-red-vivid text-white shadow-md mb-2">
                <feature.icon className="w-4 h-4" />
              </div>
              <h3 className="text-center text-xs font-medium text-gray-800">
                {feature.name}
              </h3>
            </motion.div>
          ))}
        </div>
      </div>

      {/* License info */}
      {licenseName && (
        <div className="mt-72 flex">
          <div className="max-w-[90%] sm:max-w-md px-4 py-3 rounded-lg border border-gray-200 bg-white shadow-sm text-[15px] text-gray-700 text-center">
            <p className="opacity-70">Software purchased by :</p>
            <p className="font-medium text-gray-900 break-words">
              {licenseName}
            </p>
          </div>
        </div>
      )}

      {/* Sync Status Component */}
      <SyncInfoCard />
    </div>
  );
}
