"use client";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus,
  Database,
  BarChart2,
  Settings,
} from "lucide-react";

interface Tab {
  name: string;
  icon: any;
  path: string;
}

const tabs: Tab[] = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Entries", icon: FilePlus, path: "/dashboard/entries" },
  { name: "Master", icon: Database, path: "/dashboard/master" },
  { name: "Report", icon: BarChart2, path: "/dashboard/report" },
  { name: "Settings", icon: Settings, path: "/dashboard/settings" },
];

interface SidebarProps {
  topOffset?: number;
}

export default function Sidebar({ topOffset = 0 }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside
      className="w-56 bg-white shadow-lg border-gray-200 p-3 pt-7 flex flex-col space-y-4 overflow-y-auto"
      style={{ position: "sticky", top: topOffset }}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;

        return (
          <div
            key={tab.name}
            onClick={() => router.push(tab.path)}
            className={`flex items-center p-2 rounded-xl cursor-pointer transition ${
              isActive
                ? "bg-averix-red-dark text-white"
                : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <div
              className={`w-8 h-8 flex items-center justify-center mr-3 ${
                isActive ? "text-white" : "text-averix-red-dark"
              }`}
            >
              <tab.icon className="w-5 h-5" />
            </div>
            <span className="font-medium">{tab.name}</span>
          </div>
        );
      })}
    </aside>
  );
}
