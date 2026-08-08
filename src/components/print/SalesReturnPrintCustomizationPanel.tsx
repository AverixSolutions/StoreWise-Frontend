"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  Eye,
  FileText,
  LayoutTemplate,
  PackageSearch,
  Palette,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import {
  DEFAULT_SALES_RETURN_PRINT_CUSTOMIZATION,
  loadSalesReturnPrintCustomization,
  resetSalesReturnPrintCustomization,
  saveSalesReturnPrintCustomization,
  type SalesReturnPrintCustomization,
} from "@/lib/print/salesReturnPrintCustomization";
import { getTaskPref } from "@/lib/print/printPreferences";
import { buildSalesReturnInvoiceHtml } from "@/lib/print/buildSalesReturnInvoiceHtml";
import { buildSalesReturnThermalHtml } from "@/lib/print/buildSalesReturnThermalHtml";

type ToggleDefinition = {
  key: keyof SalesReturnPrintCustomization;
  label: string;
  description: string;
};

type EditorTab = "style" | "business" | "document" | "items";
type PreviewMode = "classic" | "modern" | "thermal";

const BUSINESS_TOGGLES: ToggleDefinition[] = [
  {
    key: "showLogo",
    label: "Business logo",
    description: "Show the logo saved in the shared Business Profile.",
  },
];

const DOCUMENT_TOGGLES: ToggleDefinition[] = [
  {
    key: "showCustomer",
    label: "Customer",
    description: "Show the customer details on the Sales Return.",
  },
  {
    key: "showSourceSale",
    label: "Source Sale",
    description: "Show the linked source Sale reference when available.",
  },
];

const ITEM_TOGGLES: ToggleDefinition[] = [
  {
    key: "showBatch",
    label: "Batch",
    description: "Show the selected batch information for each return item.",
  },
  {
    key: "showRateType",
    label: "Original rate type",
    description: "Show the saved source rate type when available.",
  },
  {
    key: "showTax",
    label: "Tax",
    description: "Show tax information on printed return items.",
  },
  {
    key: "showDiscount",
    label: "Discount",
    description: "Show discount information on the Sales Return.",
  },
];

const FOOTER_TOGGLES: ToggleDefinition[] = [
  {
    key: "showAmountInWords",
    label: "Amount in words",
    description: "Write the final Sales Return amount in words.",
  },
];

const tabs: Array<{
  key: EditorTab;
  label: string;
  description: string;
  icon: typeof Palette;
}> = [
  {
    key: "style",
    label: "Style",
    description: "A4 appearance",
    icon: Palette,
  },
  {
    key: "business",
    label: "Business",
    description: "Header visibility",
    icon: Building2,
  },
  {
    key: "document",
    label: "Return",
    description: "Document fields",
    icon: FileText,
  },
  {
    key: "items",
    label: "Items & Footer",
    description: "Rows and closing text",
    icon: PackageSearch,
  },
];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100";

function ToggleRow({
  definition,
  checked,
  onChange,
}: {
  definition: ToggleDefinition;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex min-h-[50px] items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
        checked
          ? "border-slate-300 bg-white shadow-sm"
          : "border-slate-200 bg-slate-100/70"
      } hover:border-cyan-300`}
      aria-pressed={checked}
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-slate-800">
          {definition.label}
        </span>
        <span className="mt-0.5 block text-[9px] leading-[14px] text-slate-500">
          {definition.description}
        </span>
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          checked ? "bg-cyan-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </button>
  );
}

function ToggleGrid({
  definitions,
  prefs,
  onChange,
}: {
  definitions: ToggleDefinition[];
  prefs: SalesReturnPrintCustomization;
  onChange: (
    key: keyof SalesReturnPrintCustomization,
    checked: boolean,
  ) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {definitions.map((definition) => (
        <ToggleRow
          key={String(definition.key)}
          definition={definition}
          checked={Boolean(prefs[definition.key])}
          onChange={(checked) => onChange(definition.key, checked)}
        />
      ))}
    </div>
  );
}

function SalesReturnTemplatePreview({
  prefs,
  mode,
  onModeChange,
}: {
  prefs: SalesReturnPrintCustomization;
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
}) {
  const previewHtml = useMemo(() => {
    const previewPrefs: SalesReturnPrintCustomization = {
      ...prefs,
      a4Template: mode === "modern" ? "modern" : "classic",
    };
    const input = {
      shop: {
        shopName: "KYNSTACK TRADERS",
        logoUrl: null,
        addressLine1: "Business Street",
        addressLine2: "Market Junction",
        city: "Kochi",
        state: "Kerala",
        pincode: "682001",
        mobile: "+91 98765 43210",
        email: "billing@example.com",
        gstin: "32ABCDE1234F1Z5",
        footerNote: "Thank you for your business.",
        authorizedSignatory: "Authorized Signatory",
      } as any,
      saleReturn: {
        slNo: "SR-000042",
        returnDate: "2026-08-08T11:30:00",
        customerName: "Sample Customer",
        saleId: "SALE-000128",
        billNo: "INV-2841",
        totalAmount: 3050,
        discount: 50,
      },
      items: [
        {
          productName: "Premium Product",
          productCode: "PRD-001",
          batchNo: "B-2408",
          quantity: 2,
          unit: "NOS",
          rate: 1200,
          rateTypeName: "Retail",
          taxPercent: "P18",
          discount: 0,
          billedValue: 2400,
        },
        {
          productName: "Standard Product",
          productCode: "PRD-002",
          batchNo: "B-2409",
          quantity: 1,
          unit: "NOS",
          rate: 650,
          rateTypeName: "Wholesale",
          taxPercent: "P5",
          discount: 0,
          billedValue: 650,
        },
      ],
      customization: previewPrefs,
    };

    const html =
      mode === "thermal"
        ? buildSalesReturnThermalHtml(input)
        : buildSalesReturnInvoiceHtml(input);

    const fitStyles =
      mode === "thermal"
        ? [
            '<style id="kynflow-sales-return-template-preview-fit">',
            "html, body { width: 80mm !important; margin: 0 !important; overflow: hidden !important; background: #ffffff !important; }",
            "body { transform-origin: top left !important; }",
            ".thermal-receipt { margin: 0 auto !important; box-shadow: none !important; }",
            "</style>",
          ].join("")
        : [
            '<style id="kynflow-sales-return-template-preview-fit">',
            "html, body { width: 210mm !important; min-height: 297mm !important; margin: 0 !important; overflow: hidden !important; background: #ffffff !important; }",
            "body { transform-origin: top left !important; }",
            ".classic-bill, .modern-invoice { margin: 0 auto !important; box-shadow: none !important; }",
            "</style>",
          ].join("");

    return html.replace("</head>", `${fitStyles}</head>`);
  }, [mode, prefs]);

  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const doc = frame.contentDocument;
    if (!doc) return;

    let cancelled = false;
    let animationFrame = 0;
    let retryTimer = 0;
    let resizeObserver: ResizeObserver | null = null;

    const fitPage = () => {
      if (cancelled || !doc.body || !doc.documentElement) return;

      const viewportWidth = frame.clientWidth;
      if (viewportWidth <= 0) return;

      const pageWidthMm = mode === "thermal" ? 80 : 210;
      const pageHeightMm = mode === "thermal" ? null : 297;
      const pageWidthPx = (pageWidthMm * 96) / 25.4;
      const scale = Math.min(1, viewportWidth / pageWidthPx);

      doc.documentElement.style.width = `${pageWidthPx}px`;
      doc.documentElement.style.overflow = "hidden";
      doc.body.style.width = `${pageWidthPx}px`;
      doc.body.style.transformOrigin = "top left";
      doc.body.style.transform = `scale(${scale})`;
      doc.body.style.overflow = "hidden";

      if (pageHeightMm) {
        const pageHeightPx = (pageHeightMm * 96) / 25.4;
        doc.documentElement.style.height = `${pageHeightPx}px`;
        doc.body.style.minHeight = `${pageHeightPx}px`;
        frame.style.height = `${Math.ceil(pageHeightPx * scale)}px`;
      } else {
        doc.body.style.minHeight = "0";
        const naturalHeight = Math.max(
          doc.body.scrollHeight,
          doc.documentElement.scrollHeight,
        );
        frame.style.height = `${Math.max(300, Math.ceil(naturalHeight * scale + 4))}px`;
      }
    };

    doc.open();
    doc.write(previewHtml);
    doc.close();

    animationFrame = window.requestAnimationFrame(fitPage);
    retryTimer = window.setTimeout(fitPage, 180);

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(fitPage);
      resizeObserver.observe(frame);
    }

    window.addEventListener("resize", fitPage);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(retryTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", fitPage);
    };
  }, [mode, previewHtml]);

  const label =
    mode === "thermal"
      ? "80mm Thermal"
      : mode === "modern"
        ? "Modern A4"
        : "Classic A4";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="h-4 w-4 shrink-0 text-cyan-600" />
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-slate-800">
              Exact print preview
            </h4>
            <p className="truncate text-[9px] text-slate-500">
              Uses the same builders as final Sales Return printing.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-slate-300 bg-white px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">
          {label}
        </span>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 p-2">
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
          {(
            [
              ["classic", "Classic A4"],
              ["modern", "Modern A4"],
              ["thermal", "80mm Thermal"],
            ] as Array<[PreviewMode, string]>
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value)}
              className={`rounded-md px-2 py-1.5 text-[9px] font-semibold transition ${
                mode === value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-100 p-3">
        <div
          className={`mx-auto overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg ${
            mode === "thermal" ? "max-w-[310px]" : "w-full max-w-[520px]"
          }`}
        >
          <iframe
            ref={frameRef}
            title={`${label} Sales Return template preview`}
            src="about:blank"
            scrolling="no"
            className="block w-full border-0 bg-white"
          />
        </div>
        <p className="mt-2 text-center text-[9px] font-medium text-slate-500">
          Sample values only. Layout and visible fields use the real Sales
          Return renderer.
        </p>
      </div>
    </section>
  );
}

export default function SalesReturnPrintCustomizationPanel(
  _props: { compact?: boolean } = {},
) {
  const [activeTab, setActiveTab] = useState<EditorTab>("style");
  const [prefs, setPrefs] = useState<SalesReturnPrintCustomization>(
    DEFAULT_SALES_RETURN_PRINT_CUSTOMIZATION,
  );
  const [previewMode, setPreviewMode] = useState<PreviewMode>("classic");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const current = loadSalesReturnPrintCustomization();
    setPrefs(current);
    const paper = getTaskPref("salesReturn").paperSize;
    setPreviewMode(paper === "thermal" ? "thermal" : current.a4Template);
  }, []);

  function showSaved() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1300);
  }

  function updatePreference<K extends keyof SalesReturnPrintCustomization>(
    key: K,
    value: SalesReturnPrintCustomization[K],
  ) {
    setPrefs((current) => {
      const next = { ...current, [key]: value };
      saveSalesReturnPrintCustomization(next);
      return next;
    });
    showSaved();
  }

  function updateToggle(
    key: keyof SalesReturnPrintCustomization,
    checked: boolean,
  ) {
    updatePreference(key, checked as never);
  }

  function chooseA4Template(template: "classic" | "modern") {
    setPreviewMode(template);
    updatePreference("a4Template", template);
  }

  function choosePreviewMode(mode: PreviewMode) {
    setPreviewMode(mode);
    if (mode !== "thermal") {
      updatePreference("a4Template", mode);
    }
  }

  function resetLayout() {
    resetSalesReturnPrintCustomization();
    const next = loadSalesReturnPrintCustomization();
    setPrefs(next);
    setPreviewMode(next.a4Template);
    showSaved();
  }

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-cyan-300">
            <LayoutTemplate className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">
              Sales Return template
            </h3>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Changes save automatically and affect A4 and thermal output.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-600">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={resetLayout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${
                  active ? "text-cyan-600" : "text-slate-400"
                }`}
              />
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-semibold">
                  {tab.label}
                </span>
                <span className="hidden truncate text-[8px] text-slate-400 sm:block">
                  {tab.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "style" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Palette className="h-4 w-4 text-cyan-600" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800">
                A4 design
              </h4>
              <p className="text-[9px] text-slate-500">
                Thermal stays monochrome and printer-safe.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                A4 style
              </label>
              <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1">
                {(["classic", "modern"] as const).map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => chooseA4Template(template)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[10px] font-semibold capitalize transition ${
                      prefs.a4Template === template
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {prefs.a4Template === template && (
                      <Check className="h-3 w-3" />
                    )}
                    {template}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Document title
              </label>
              <input
                value={prefs.title}
                onChange={(event) =>
                  updatePreference("title", event.target.value)
                }
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Subtitle
              </label>
              <input
                value={prefs.subtitle}
                onChange={(event) =>
                  updatePreference("subtitle", event.target.value)
                }
                className={inputClass}
              />
            </div>
          </div>
        </section>
      )}

      {activeTab === "business" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan-600" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800">
                Business header visibility
              </h4>
              <p className="text-[9px] text-slate-500">
                Business identity still comes from the shared Business Profile.
              </p>
            </div>
          </div>
          <ToggleGrid
            definitions={BUSINESS_TOGGLES}
            prefs={prefs}
            onChange={updateToggle}
          />
        </section>
      )}

      {activeTab === "document" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-600" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800">
                Sales Return document details
              </h4>
              <p className="text-[9px] text-slate-500">
                Customer and linked source Sale visibility stay unchanged.
              </p>
            </div>
          </div>
          <ToggleGrid
            definitions={DOCUMENT_TOGGLES}
            prefs={prefs}
            onChange={updateToggle}
          />
        </section>
      )}

      {activeTab === "items" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <PackageSearch className="h-4 w-4 text-cyan-600" />
              <div>
                <h4 className="text-xs font-semibold text-slate-800">
                  Item details
                </h4>
                <p className="text-[9px] text-slate-500">
                  Existing batch, rate type, tax and discount visibility.
                </p>
              </div>
            </div>
            <ToggleGrid
              definitions={ITEM_TOGGLES}
              prefs={prefs}
              onChange={updateToggle}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-cyan-600" />
              <div>
                <h4 className="text-xs font-semibold text-slate-800">
                  Totals and footer
                </h4>
                <p className="text-[9px] text-slate-500">
                  Closing text and amount presentation below the item table.
                </p>
              </div>
            </div>

            <ToggleGrid
              definitions={FOOTER_TOGGLES}
              prefs={prefs}
              onChange={updateToggle}
            />

            <div className="mt-3 grid gap-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Footer
                </label>
                <input
                  value={prefs.footerText}
                  onChange={(event) =>
                    updatePreference("footerText", event.target.value)
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Signatory label
                </label>
                <input
                  value={prefs.signatoryLabel}
                  onChange={(event) =>
                    updatePreference("signatoryLabel", event.target.value)
                  }
                  className={inputClass}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      <SalesReturnTemplatePreview
        prefs={prefs}
        mode={previewMode}
        onModeChange={choosePreviewMode}
      />
    </div>
  );
}
