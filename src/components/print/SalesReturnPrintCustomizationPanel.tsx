"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  DEFAULT_SALES_RETURN_PRINT_CUSTOMIZATION,
  loadSalesReturnPrintCustomization,
  resetSalesReturnPrintCustomization,
  saveSalesReturnPrintCustomization,
  type SalesReturnPrintCustomization,
} from "@/lib/print/salesReturnPrintCustomization";

const toggles: Array<{
  key: keyof SalesReturnPrintCustomization;
  label: string;
}> = [
  { key: "showLogo", label: "Business logo" },
  { key: "showCustomer", label: "Customer" },
  { key: "showSourceSale", label: "Source Sale" },
  { key: "showBatch", label: "Batch" },
  { key: "showRateType", label: "Original rate type" },
  { key: "showTax", label: "Tax" },
  { key: "showDiscount", label: "Discount" },
  { key: "showAmountInWords", label: "Amount in words" },
];

export default function SalesReturnPrintCustomizationPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [value, setValue] = useState<SalesReturnPrintCustomization>(
    DEFAULT_SALES_RETURN_PRINT_CUSTOMIZATION,
  );
  useEffect(() => setValue(loadSalesReturnPrintCustomization()), []);
  const patch = <K extends keyof SalesReturnPrintCustomization>(
    key: K,
    next: SalesReturnPrintCustomization[K],
  ) => {
    setValue((prev) => {
      const updated = { ...prev, [key]: next };
      saveSalesReturnPrintCustomization(updated);
      return updated;
    });
  };
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Sales Return template
          </div>
          <div className="text-xs text-slate-500">
            Dedicated template. Business identity comes from the shared Business
            Profile.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            resetSalesReturnPrintCustomization();
            setValue(DEFAULT_SALES_RETURN_PRINT_CUSTOMIZATION);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset template
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>A4 style</span>
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {(["classic", "modern"] as const).map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => patch("a4Template", template)}
                className={`h-8 rounded-lg text-xs font-semibold capitalize ${value.a4Template === template ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
              >
                {template}
              </button>
            ))}
          </div>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Document title</span>
          <input
            value={value.title}
            onChange={(e) => patch("title", e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600 sm:col-span-2">
          <span>Subtitle</span>
          <input
            value={value.subtitle}
            onChange={(e) => patch("subtitle", e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {toggles.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => patch(key, !Boolean(value[key]) as never)}
            className={`flex h-9 items-center justify-between rounded-xl border px-3 text-xs font-medium ${value[key] ? "border-cyan-200 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-white text-slate-500"}`}
          >
            <span>{label}</span>
            <span>{value[key] ? "On" : "Off"}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Footer</span>
          <input
            value={value.footerText}
            onChange={(e) => patch("footerText", e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Signatory label</span>
          <input
            value={value.signatoryLabel}
            onChange={(e) => patch("signatoryLabel", e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
      </div>
    </div>
  );
}
