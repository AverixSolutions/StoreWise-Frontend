"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  LayoutTemplate,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { platform } from "@/platform";
import SearchableDropdown from "@/components/ui/SearchableDropdown";
import SettingsOverlay from "@/components/settings/SettingsOverlay";
import ShopSettingsPanel from "@/components/master/ShopSettingsPanel";
import SalesReturnPrintCustomizationPanel from "@/components/print/SalesReturnPrintCustomizationPanel";
import {
  getTaskPref,
  setTaskPref,
  type PaperSize,
} from "@/lib/print/printPreferences";

type PrinterInfo = {
  name: string;
  displayName: string;
  isDefault: boolean;
};

type PrintDraft = {
  printer: string | null;
  preview: boolean;
  paperSize: PaperSize;
};

function PaperChoice({
  value,
  current,
  title,
  description,
  onChange,
}: {
  value: PaperSize;
  current: PaperSize;
  title: string;
  description: string;
  onChange: (value: PaperSize) => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex flex-1 items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-cyan-400 bg-cyan-50 ring-1 ring-cyan-200"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span>
        <span className="block text-xs font-semibold text-slate-800">
          {title}
        </span>
        <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
          {description}
        </span>
      </span>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          active
            ? "border-cyan-500 bg-cyan-500 text-white"
            : "border-slate-300 text-transparent"
        }`}
      >
        <Check className="h-3 w-3" />
      </span>
    </button>
  );
}

export default function SalesReturnPrintSettingsPanel() {
  const [draft, setDraft] = useState<PrintDraft>(() =>
    getTaskPref("salesReturn"),
  );
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [showBusinessProfile, setShowBusinessProfile] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  const isDesktop =
    typeof window !== "undefined" && !!(window as any).electronAPI;

  useEffect(() => {
    setDraft(getTaskPref("salesReturn"));
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    setLoadingPrinters(true);

    void (async () => {
      try {
        const rows = await platform.getPrinters?.();
        if (!cancelled) setPrinters(rows || []);
      } finally {
        if (!cancelled) setLoadingPrinters(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDesktop]);

  function save(next: PrintDraft) {
    setDraft(next);
    setTaskPref("salesReturn", next);
  }

  function reset() {
    save({
      printer: null,
      preview: true,
      paperSize: "thermal",
    });
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-slate-800">
              Sales Return output
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              These print preferences save immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <h4 className="text-xs font-semibold text-slate-800">Bill format</h4>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Both formats use the dedicated Sales Return template.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <PaperChoice
              value="A4"
              current={draft.paperSize}
              title="A4 Return"
              description="Professional full-page customer return."
              onChange={(paperSize) => save({ ...draft, paperSize })}
            />
            <PaperChoice
              value="thermal"
              current={draft.paperSize}
              title="80mm Thermal"
              description="Compact return receipt."
              onChange={(paperSize) => save({ ...draft, paperSize })}
            />
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => save({ ...draft, preview: !draft.preview })}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              {draft.preview ? (
                <Eye className="h-4 w-4 shrink-0 text-cyan-600" />
              ) : (
                <EyeOff className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span>
                <span className="block text-xs font-semibold text-slate-800">
                  Print preview
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                  {draft.preview
                    ? "Show preview before printing."
                    : "Print directly without preview."}
                </span>
              </span>
            </span>
            <span
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ${
                draft.preview ? "bg-cyan-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  draft.preview ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </span>
          </button>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <label className="mb-1.5 block text-xs font-semibold text-slate-800">
              Printer
            </label>
            {!isDesktop ? (
              <p className="text-[10px] leading-4 text-slate-500">
                Browser mode uses the browser print destination.
              </p>
            ) : loadingPrinters ? (
              <div className="flex items-center gap-2 py-2 text-[10px] text-slate-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Detecting printers...
              </div>
            ) : (
              <SearchableDropdown
                value={draft.printer ?? ""}
                onChange={(value) => save({ ...draft, printer: value || null })}
                options={[
                  { value: "", label: "Use Default output" },
                  ...printers.map((printer) => ({
                    value: printer.name,
                    label: `${printer.displayName}${
                      printer.isDefault ? " (default)" : ""
                    }`,
                  })),
                ]}
                placeholder="Use Default output"
                autoOpenOnFocus
                className="w-full"
                controlClassName="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 transition hover:border-slate-300 focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                menuClassName="z-[1900] max-h-56 text-xs"
                buttonProps={{ "aria-label": "Sales Return printer" }}
              />
            )}
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setShowBusinessProfile(true)}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <Building2 className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs font-semibold text-slate-800">
                  Business Profile
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  Shared logo and business details.
                </span>
              </span>
            </span>
            <span className="text-[10px] font-semibold text-cyan-700">
              Edit
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowTemplate(true)}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                <LayoutTemplate className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs font-semibold text-slate-800">
                  Sales Return Template
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  Classic/Modern A4 and printed field visibility.
                </span>
              </span>
            </span>
            <span className="text-[10px] font-semibold text-cyan-700">
              Customize
            </span>
          </button>
        </section>

        <div className="rounded-xl border border-slate-300 bg-slate-900 px-3 py-2 text-[10px] leading-4 text-slate-100">
          <strong>Ctrl+P:</strong> prints the saved Sales Return using these
          A4/80mm, preview and printer settings.
        </div>
      </div>

      <SettingsOverlay
        open={showBusinessProfile}
        title="Business Profile"
        description="Shared logo and shop details used by every document"
        icon={Building2}
        onClose={() => setShowBusinessProfile(false)}
        width="xl"
      >
        <ShopSettingsPanel embedded />
      </SettingsOverlay>

      <SettingsOverlay
        open={showTemplate}
        title="Sales Return Template"
        description="Customize A4 and 80mm Sales Return output"
        icon={LayoutTemplate}
        onClose={() => setShowTemplate(false)}
        width="xl"
      >
        <SalesReturnPrintCustomizationPanel />
      </SettingsOverlay>
    </>
  );
}
