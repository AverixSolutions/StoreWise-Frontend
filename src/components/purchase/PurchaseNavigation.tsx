// src/components/purchase/PurchaseNavigation.tsx
import { ArrowLeft, ArrowRight } from "lucide-react";

interface PurchaseNavigationProps {
  onNavigate: (path: string) => void;
}

export default function PurchaseNavigation({
  onNavigate,
}: PurchaseNavigationProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-0 py-3 flex items-center justify-between">
        <button
          onClick={() => onNavigate("/dashboard")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        <h1 className="text-lg font-semibold text-gray-900">Purchase Entry</h1>

        <button
          onClick={() => onNavigate("/dashboard/purchase-return")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <span className="text-sm font-medium">Purchase Return</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
