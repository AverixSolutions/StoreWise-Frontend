// src/components/ui/Sidebar.tsx
"use client";
import { useRouter } from "next/navigation";
import { Package, ShoppingCart, CreditCard, Settings } from "lucide-react";

interface Tab {
  name: string;
  icon: any;
  path: string;
}

const tabs: Tab[] = [
  { name: "Dashboard", icon: Package, path: "/dashboard" },
  { name: "Sales", icon: ShoppingCart, path: "/dashboard/sales" },
  { name: "Items", icon: Package, path: "/dashboard/items" },
  { name: "Payments", icon: CreditCard, path: "/dashboard/payment" },
  { name: "Settings", icon: Settings, path: "/dashboard/settings" },
];

interface SidebarProps {
  topOffset?: number;
}

export default function Sidebar({ topOffset = 0 }: SidebarProps) {
  const router = useRouter();

  return (
    <aside
      className="w-72 bg-white shadow-lg border-gray-200 p-4 flex flex-col space-y-3 overflow-y-auto"
      style={{ position: "sticky", top: topOffset }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.name}
          onClick={() => router.push(tab.path)}
          className="flex items-center p-3 rounded-xl hover:bg-gray-100 cursor-pointer transition"
        >
          <div className="w-8 h-8 flex items-center justify-center text-averix-red-dark mr-3">
            <tab.icon className="w-5 h-5" />
          </div>
          <span className="font-medium text-gray-700">{tab.name}</span>
        </div>
      ))}
    </aside>
  );
}
