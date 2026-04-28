// src/components/barcode/BarcodePrintCenterModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Tags, Plus, Trash2, Printer } from "lucide-react";
import { buildBarcodePrintHtml } from "@/lib/barcode/printBarcodeHtml";
import { printLabels } from "@/lib/barcode/printLabels";
import type {
  LabelPrintEngine,
  LabelPrintRequest,
} from "@/lib/barcode/labelPrintTypes";
import type {
  PrintCenterMode,
  PrintCenterItemRow,
  DefaultPrintSettings,
  LabelModeSettings,
} from "@/lib/barcode/printCenterTypes";
import SearchableDropdown from "@/components/ui/SearchableDropdown";

type ProductRow = {
  id: string;
  name: string;
  code?: string | null;
};

type BatchRow = {
  id: string;
  productId: string;
  barcode?: string | null;
  batchNo?: string | null;
  salePrice?: number | null;
  mrp?: number | null;
  stock?: number | null;
};

type PrinterRow = {
  id: string;
  licenseId: string;
  name: string;
  engine: LabelPrintEngine;
  printerName: string;
  isDefault?: number;
};

type TemplateRow = {
  id: string;
  licenseId: string;
  name: string;
  engine: Exclude<LabelPrintEngine, "HTML">;
  templatePath: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  licenseId: string;
  initialRows?: PrintCenterItemRow[];
  defaultShopName?: string;
};

export default function BarcodePrintCenterModal({
  open,
  onClose,
  licenseId,
  initialRows = [],
  defaultShopName = "My Shop",
}: Props) {
  const api = (window as any).electronAPI;

  const [mode, setMode] = useState<PrintCenterMode>("LABEL");

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [copiesToAdd, setCopiesToAdd] = useState(1);

  const [rows, setRows] = useState<PrintCenterItemRow[]>([]);

  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  const [defaultSettings, setDefaultSettings] = useState<DefaultPrintSettings>({
    shopName: defaultShopName,
    labelWidthMm: 50,
    labelHeightMm: 30,
    columns: 4,
    showShopName: true,
    showName: true,
    showSalePrice: true,
    showMrp: true,
    barcodeHeight: 32,
    fontSizeShop: 11,
    fontSizeName: 10,
    fontSizeMeta: 9,
  });

  const [labelSettings, setLabelSettings] = useState<LabelModeSettings>({
    engine: "HTML",
    printerId: "",
    templateId: "",
    copiesOverride: "",
  });

  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setRows(initialRows || []);
    setError("");
    setMessage("");
    loadMeta();
  }, [open, initialRows]);

  async function loadMeta() {
    try {
      setLoading(true);
      setError("");

      const [productsRes, printersRes, templatesRes] = await Promise.all([
        api.getProducts?.(licenseId, { page: 1, pageSize: 300 }),
        api.listLabelPrinters?.(licenseId),
        api.listLabelTemplates?.(licenseId),
      ]);

      const nextProducts = Array.isArray(productsRes?.products)
        ? productsRes.products
        : Array.isArray(productsRes?.data)
          ? productsRes.data
          : Array.isArray(productsRes)
            ? productsRes
            : [];

      const nextPrinters = printersRes?.success ? printersRes.rows || [] : [];
      const nextTemplates = templatesRes?.success
        ? templatesRes.rows || []
        : [];

      setProducts(
        nextProducts.map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
        })),
      );

      setPrinters(nextPrinters);
      setTemplates(nextTemplates);

      const defaultPrinter =
        nextPrinters.find((p: any) => Number(p.isDefault || 0) === 1) ||
        nextPrinters[0];

      if (defaultPrinter) {
        setLabelSettings((prev) => ({
          ...prev,
          printerId: defaultPrinter.id,
          engine: defaultPrinter.engine || "HTML",
        }));
      }

      if (nextTemplates[0]) {
        setLabelSettings((prev) => ({
          ...prev,
          templateId: nextTemplates[0].id,
        }));
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load print data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedProductId) {
      setBatches([]);
      return;
    }

    api
      .listBarcodesForProduct?.(licenseId, selectedProductId)
      .then((res: any) => {
        const next = (res?.rows || []).map((b: any) => ({
          id: b.id,
          productId: selectedProductId,
          barcode: b.barcode,
          batchNo: b.batchNo,
          salePrice: b.salePrice,
          mrp: b.mrp,
          stock: b.stock,
        }));
        setBatches(next);
      });
  }, [selectedProductId, licenseId]);

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: p.code ? `${p.name} (${p.code})` : p.name,
      })),
    [products],
  );

  const batchOptions = useMemo(
    () =>
      batches.map((b) => ({
        value: b.id,
        label: [
          b.barcode || "No barcode",
          b.batchNo ? `Batch ${b.batchNo}` : null,
          b.stock != null ? `Stock ${b.stock}` : null,
        ]
          .filter(Boolean)
          .join(" • "),
      })),
    [batches],
  );

  const engineOptions = useMemo(
    () => [
      { value: "HTML", label: "HTML Sheet" },
      { value: "BARTENDER", label: "BarTender" },
      { value: "ZPL", label: "ZPL" },
    ],
    [],
  );

  const filteredPrinters = useMemo(() => {
    if (labelSettings.engine === "HTML") return printers;
    return printers.filter((p) => p.engine === labelSettings.engine);
  }, [printers, labelSettings.engine]);

  const printerOptions = useMemo(
    () =>
      filteredPrinters.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.printerName})`,
      })),
    [filteredPrinters],
  );

  const filteredTemplates = useMemo(() => {
    if (labelSettings.engine === "HTML") return [];
    return templates.filter((t) => t.engine === labelSettings.engine);
  }, [templates, labelSettings.engine]);

  const templateOptions = useMemo(
    () =>
      filteredTemplates.map((t) => ({
        value: t.id,
        label: t.name,
      })),
    [filteredTemplates],
  );

  function addRow() {
    const product = products.find((p) => p.id === selectedProductId);
    const batch = batches.find((b) => b.id === selectedBatchId);

    if (!product || !batch || !String(batch.barcode || "").trim()) {
      setError("Select a valid product and barcode batch");
      return;
    }

    setRows((prev) => [
      ...prev,
      {
        productId: product.id,
        batchId: batch.id,
        itemName: product.name,
        barcode: String(batch.barcode || ""),
        batchNo: batch.batchNo,
        salePrice: batch.salePrice,
        mrp: batch.mrp,
        copies: Math.max(1, Number(copiesToAdd || 1)),
      },
    ]);

    setSelectedBatchId("");
    setCopiesToAdd(1);
    setError("");
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCopies(index: number, copies: number) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? { ...row, copies: Math.max(1, Number(copies || 1)) }
          : row,
      ),
    );
  }

  const previewItems = useMemo(() => {
    return rows
      .filter(
        (r) => String(r.barcode || "").trim() && Number(r.copies || 0) > 0,
      )
      .map((r) => ({
        code: r.barcode,
        name: r.itemName,
        salePrice: r.salePrice,
        mrp: r.mrp,
        copies: r.copies,
      }));
  }, [rows]);

  const previewHtml = useMemo(() => {
    return buildBarcodePrintHtml(previewItems, {
      shopName: defaultSettings.shopName,
      pageTitle: "Barcode Print",
      labelWidthMm: defaultSettings.labelWidthMm,
      labelHeightMm: defaultSettings.labelHeightMm,
      columns: defaultSettings.columns,
      showShopName: defaultSettings.showShopName,
      showName: defaultSettings.showName,
      showSalePrice: defaultSettings.showSalePrice,
      showMrp: defaultSettings.showMrp,
      barcodeHeight: defaultSettings.barcodeHeight,
      fontSizeShop: defaultSettings.fontSizeShop,
      fontSizeName: defaultSettings.fontSizeName,
      fontSizeMeta: defaultSettings.fontSizeMeta,
    });
  }, [previewItems, defaultSettings]);

  async function handlePrint() {
    try {
      setPrinting(true);
      setError("");
      setMessage("");

      if (!rows.length) throw new Error("No rows selected");

      if (mode === "DEFAULT") {
        const html = buildBarcodePrintHtml(previewItems, {
          shopName: defaultSettings.shopName,
          pageTitle: "Barcode Print",
          labelWidthMm: defaultSettings.labelWidthMm,
          labelHeightMm: defaultSettings.labelHeightMm,
          columns: defaultSettings.columns,
          showShopName: defaultSettings.showShopName,
          showName: defaultSettings.showName,
          showSalePrice: defaultSettings.showSalePrice,
          showMrp: defaultSettings.showMrp,
          barcodeHeight: defaultSettings.barcodeHeight,
          fontSizeShop: defaultSettings.fontSizeShop,
          fontSizeName: defaultSettings.fontSizeName,
          fontSizeMeta: defaultSettings.fontSizeMeta,
        });

        const res = await api.printHtml(html, {
          preview: false,
          pageSize: "A4",
        });
        if (!res?.success)
          throw new Error(res?.error || "Default print failed");
      } else {
        const override = Number(labelSettings.copiesOverride || 0);

        const payload: LabelPrintRequest = {
          licenseId,
          engine: labelSettings.engine,
          printerId:
            labelSettings.engine === "HTML"
              ? undefined
              : labelSettings.printerId || undefined,
          templateId:
            labelSettings.engine === "HTML"
              ? undefined
              : labelSettings.templateId || undefined,
          rows: rows.map((r) => ({
            productId: r.productId,
            batchId: r.batchId,
            barcode: r.barcode,
            itemName: r.itemName,
            salePrice: r.salePrice,
            mrp: r.mrp,
            batchNo: r.batchNo,
            copies: override > 0 ? override : Number(r.copies || 1),
          })),
        };

        const res = await printLabels(payload);
        if (res?.success === false)
          throw new Error(res.error || "Label print failed");
      }

      setMessage("Print request sent successfully.");
    } catch (err: any) {
      setError(err?.message || "Print failed");
    } finally {
      setPrinting(false);
    }
  }

  if (!open) return null;

  /* ─── shared input/label class helpers ─── */
  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[var(--kyn-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--kyn-primary)]/20 transition";

  const labelCls =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  const dropdownButtonCls =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-0 sm:p-4">
      <div
        className="flex w-full max-w-7xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-2xl"
        style={{ height: "92dvh", maxHeight: "92dvh" }}
      >
        {/* ── TOP BAR (dark KYNFLOW) ── */}
        <div
          className="flex shrink-0 items-center justify-between px-5 py-4 sm:px-6"
          style={{
            background:
              "linear-gradient(135deg, var(--kyn-surface) 0%, var(--kyn-surface-2) 100%)",
            borderBottom: "1px solid var(--kyn-border)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(32,183,255,0.18), rgba(176,38,255,0.14))",
                border: "1px solid var(--kyn-border)",
                boxShadow: "0 0 12px var(--kyn-glow-primary)",
              }}
            >
              <Tags
                className="h-4 w-4"
                style={{ color: "var(--kyn-primary)" }}
              />
            </div>

            <div>
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--kyn-text)" }}
              >
                Barcode Print Center
              </h2>
              <p className="text-xs" style={{ color: "var(--kyn-text-muted)" }}>
                Select products and print any barcode format
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/10"
            style={{ color: "var(--kyn-text-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── BODY ── */}
        <div
          className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[400px_1fr]"
          style={{ background: "#f1f5f9" }}
        >
          {/* ── LEFT PANEL ── */}
          <div
            className="flex flex-col gap-4 overflow-y-auto border-r p-4 sm:p-5"
            style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}
          >
            {/* Alerts */}
            {loading && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                Loading print data…
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            )}

            {/* ── Add item card ── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Add Item
              </p>

              <div>
                <label className={labelCls}>Product</label>
                <SearchableDropdown
                  value={selectedProductId}
                  onChange={(value) => {
                    setSelectedProductId(value);
                    setSelectedBatchId("");
                  }}
                  options={productOptions}
                  placeholder="Select product"
                  autoOpenOnFocus={false}
                  className="w-full"
                  buttonProps={{ className: dropdownButtonCls }}
                  menuClassName="rounded-xl"
                  inputClassName="rounded-lg"
                  optionClassName=""
                />
                {!loading && products.length === 0 && (
                  <p className="mt-1.5 text-xs text-red-500">
                    No products loaded. Check getProducts response and
                    licenseId.
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Barcode / Batch</label>
                <SearchableDropdown
                  value={selectedBatchId}
                  onChange={setSelectedBatchId}
                  options={batchOptions}
                  placeholder={
                    selectedProductId
                      ? "Select barcode batch"
                      : "Select product first"
                  }
                  autoOpenOnFocus={false}
                  className="w-full"
                  buttonProps={{
                    className: dropdownButtonCls,
                    disabled: !selectedProductId || batchOptions.length === 0,
                  }}
                  menuClassName="rounded-xl"
                  inputClassName="rounded-lg"
                />
              </div>

              <div>
                <label className={labelCls}>Copies</label>
                <input
                  type="number"
                  min={1}
                  value={copiesToAdd}
                  onChange={(e) => setCopiesToAdd(Number(e.target.value || 1))}
                  className={inputCls}
                />
              </div>

              <button
                type="button"
                onClick={addRow}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[.98]"
                style={{
                  background:
                    "linear-gradient(135deg, var(--kyn-surface-2) 0%, var(--kyn-surface-3) 100%)",
                  border: "1px solid var(--kyn-border)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                  color: "var(--kyn-text)",
                }}
              >
                <Plus className="h-4 w-4" />
                Add to print list
              </button>
            </div>

            {/* ── Print mode ── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Print Mode
              </p>

              <div className="grid grid-cols-2 gap-2">
                {(["DEFAULT", "LABEL"] as PrintCenterMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                    style={
                      mode === m
                        ? {
                            background:
                              "linear-gradient(135deg, var(--kyn-surface-2), var(--kyn-surface-3))",
                            color: "var(--kyn-primary)",
                            border: "1px solid rgba(32,183,255,0.35)",
                            boxShadow: "0 0 10px var(--kyn-glow-primary)",
                          }
                        : {
                            background: "#f1f5f9",
                            color: "#64748b",
                            border: "1px solid #e2e8f0",
                          }
                    }
                  >
                    {m === "DEFAULT" ? "Default Print" : "Label Print"}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Settings panel ── */}
            {mode === "DEFAULT" ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Default Print Settings
                </p>

                <div>
                  <label className={labelCls}>Shop Name</label>
                  <input
                    value={defaultSettings.shopName}
                    onChange={(e) =>
                      setDefaultSettings((p) => ({
                        ...p,
                        shopName: e.target.value,
                      }))
                    }
                    placeholder="Shop name"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Width (mm)</label>
                    <input
                      type="number"
                      value={defaultSettings.labelWidthMm}
                      onChange={(e) =>
                        setDefaultSettings((p) => ({
                          ...p,
                          labelWidthMm: Number(e.target.value || 50),
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Height (mm)</label>
                    <input
                      type="number"
                      value={defaultSettings.labelHeightMm}
                      onChange={(e) =>
                        setDefaultSettings((p) => ({
                          ...p,
                          labelHeightMm: Number(e.target.value || 30),
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Columns</label>
                    <input
                      type="number"
                      value={defaultSettings.columns}
                      onChange={(e) =>
                        setDefaultSettings((p) => ({
                          ...p,
                          columns: Number(e.target.value || 4),
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Barcode H</label>
                    <input
                      type="number"
                      value={defaultSettings.barcodeHeight}
                      onChange={(e) =>
                        setDefaultSettings((p) => ({
                          ...p,
                          barcodeHeight: Number(e.target.value || 32),
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {(
                    [
                      ["showShopName", "Show shop name"],
                      ["showName", "Show item name"],
                      ["showSalePrice", "Show sale price"],
                      ["showMrp", "Show MRP"],
                    ] as [keyof DefaultPrintSettings, string][]
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-3 text-sm text-slate-700"
                    >
                      <span
                        className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition"
                        style={
                          defaultSettings[key]
                            ? {
                                background: "var(--kyn-primary)",
                                borderColor: "var(--kyn-primary)",
                              }
                            : { background: "#f1f5f9", borderColor: "#cbd5e1" }
                        }
                      >
                        <input
                          type="checkbox"
                          checked={defaultSettings[key] as boolean}
                          onChange={(e) =>
                            setDefaultSettings((p) => ({
                              ...p,
                              [key]: e.target.checked,
                            }))
                          }
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        {defaultSettings[key] && (
                          <svg
                            className="h-3 w-3 text-white"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2 6l3 3 5-5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Label Print Settings
                </p>

                <div>
                  <label className={labelCls}>Engine</label>
                  <SearchableDropdown
                    value={labelSettings.engine}
                    onChange={(value) =>
                      setLabelSettings((p) => ({
                        ...p,
                        engine: value as LabelPrintEngine,
                        printerId: "",
                        templateId: "",
                      }))
                    }
                    options={engineOptions}
                    placeholder="Select engine"
                    autoOpenOnFocus={false}
                    className="w-full"
                    buttonProps={{ className: dropdownButtonCls }}
                  />
                </div>

                <div>
                  <label className={labelCls}>Printer</label>
                  <SearchableDropdown
                    value={labelSettings.printerId || ""}
                    onChange={(value) =>
                      setLabelSettings((p) => ({ ...p, printerId: value }))
                    }
                    options={printerOptions}
                    placeholder="Select printer"
                    autoOpenOnFocus={false}
                    className="w-full"
                    buttonProps={{
                      className: dropdownButtonCls,
                      disabled: printerOptions.length === 0,
                    }}
                  />
                </div>

                {labelSettings.engine !== "HTML" && (
                  <div>
                    <label className={labelCls}>Template</label>
                    <SearchableDropdown
                      value={labelSettings.templateId || ""}
                      onChange={(value) =>
                        setLabelSettings((p) => ({ ...p, templateId: value }))
                      }
                      options={templateOptions}
                      placeholder="Select template"
                      autoOpenOnFocus={false}
                      className="w-full"
                      buttonProps={{
                        className: dropdownButtonCls,
                        disabled: templateOptions.length === 0,
                      }}
                    />
                  </div>
                )}

                <div>
                  <label className={labelCls}>Copies Override</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Optional — overrides per-row copies"
                    value={labelSettings.copiesOverride || ""}
                    onChange={(e) =>
                      setLabelSettings((p) => ({
                        ...p,
                        copiesOverride: e.target.value,
                      }))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {/* ── Print button ── */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={
                printing ||
                !rows.length ||
                (mode === "LABEL" &&
                  labelSettings.engine !== "HTML" &&
                  (!labelSettings.printerId || !labelSettings.templateId))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition hover:opacity-90 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background:
                  "linear-gradient(135deg, var(--kyn-primary-strong) 0%, var(--kyn-secondary-strong) 100%)",
                color: "#fff",
                boxShadow: printing
                  ? "none"
                  : "0 4px 16px var(--kyn-glow-primary)",
              }}
            >
              <Printer className="h-4 w-4" />
              {printing ? "Printing…" : "Print Now"}
            </button>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto bg-slate-100 p-4 sm:p-5">
            {/* Selected rows table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div
                className="flex items-center justify-between border-b border-slate-100 px-4 py-3"
                style={{
                  background:
                    "linear-gradient(135deg, var(--kyn-surface) 0%, var(--kyn-surface-2) 100%)",
                  borderBottomColor: "var(--kyn-border)",
                }}
              >
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--kyn-text)" }}
                >
                  Selected Rows
                </h3>
                {rows.length > 0 && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      background: "rgba(32,183,255,0.15)",
                      color: "var(--kyn-primary)",
                      border: "1px solid rgba(32,183,255,0.25)",
                    }}
                  >
                    {rows.length} item{rows.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="max-h-[260px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      {["Item", "Barcode", "Copies", ""].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={`${row.batchId || row.productId}-${index}`}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {row.itemName}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                          {row.barcode}
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min={1}
                            value={row.copies}
                            onChange={(e) =>
                              updateCopies(index, Number(e.target.value || 1))
                            }
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[var(--kyn-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--kyn-primary)]/30 transition"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-400 transition hover:bg-red-100 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!rows.length && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-10 text-center text-sm text-slate-400"
                        >
                          No barcode rows selected
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Preview / Summary */}
            {mode === "DEFAULT" ? (
              <div
                className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                style={{ minHeight: 340 }}
              >
                <div
                  className="shrink-0 border-b px-4 py-3"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--kyn-surface) 0%, var(--kyn-surface-2) 100%)",
                    borderBottomColor: "var(--kyn-border)",
                  }}
                >
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: "var(--kyn-text)" }}
                  >
                    Live Preview
                  </h3>
                </div>

                {previewItems.length ? (
                  <iframe
                    title="Barcode Preview"
                    srcDoc={previewHtml}
                    className="flex-1 w-full border-0 bg-white"
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-400">
                    Add rows to preview barcode layout.
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div
                  className="border-b px-4 py-3"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--kyn-surface) 0%, var(--kyn-surface-2) 100%)",
                    borderBottomColor: "var(--kyn-border)",
                  }}
                >
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: "var(--kyn-text)" }}
                  >
                    Label Print Summary
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 p-1">
                  {[
                    ["Engine", labelSettings.engine],
                    [
                      "Printer",
                      filteredPrinters.find(
                        (p) => p.id === labelSettings.printerId,
                      )?.name || "—",
                    ],
                    [
                      "Template",
                      filteredTemplates.find(
                        (t) => t.id === labelSettings.templateId,
                      )?.name || "—",
                    ],
                    ["Rows", String(rows.length)],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {k}
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
