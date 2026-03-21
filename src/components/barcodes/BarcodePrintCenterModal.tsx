// src/components/barcode/BarcodePrintCenterModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Tags } from "lucide-react";
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

      console.log("BarcodePrintCenterModal getProducts response:", productsRes);

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

  const productOptions = useMemo(() => {
    return products.map((p) => ({
      value: p.id,
      label: p.code ? `${p.name} (${p.code})` : p.name,
    }));
  }, [products]);

  const batchOptions = useMemo(() => {
    return batches.map((b) => ({
      value: b.id,
      label: [
        b.barcode || "No barcode",
        b.batchNo ? `Batch ${b.batchNo}` : null,
        b.stock != null ? `Stock ${b.stock}` : null,
      ]
        .filter(Boolean)
        .join(" • "),
    }));
  }, [batches]);

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

  const printerOptions = useMemo(() => {
    return filteredPrinters.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.printerName})`,
    }));
  }, [filteredPrinters]);

  const filteredTemplates = useMemo(() => {
    if (labelSettings.engine === "HTML") return [];
    return templates.filter((t) => t.engine === labelSettings.engine);
  }, [templates, labelSettings.engine]);

  const templateOptions = useMemo(() => {
    return filteredTemplates.map((t) => ({
      value: t.id,
      label: t.name,
    }));
  }, [filteredTemplates]);

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

      if (!rows.length) {
        throw new Error("No rows selected");
      }

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

        if (!res?.success) {
          throw new Error(res?.error || "Default print failed");
        }
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
        if (res?.success === false) {
          throw new Error(res.error || "Label print failed");
        }
      }

      setMessage("Print request sent successfully.");
    } catch (err: any) {
      setError(err?.message || "Print failed");
    } finally {
      setPrinting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2">
              <Tags className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Barcode Print Center
              </h2>
              <p className="text-sm text-slate-500">
                One place to select products and print any barcode format
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[420px_1fr]">
          <div className="overflow-y-auto border-r p-5 space-y-5">
            {loading ? (
              <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Loading print data...
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            <div className="rounded-2xl border p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">
                Add item
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Product
                </label>
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
                  buttonProps={{
                    className:
                      "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white",
                  }}
                  menuClassName="rounded-xl"
                  inputClassName="rounded-lg"
                  optionClassName=""
                />
                {!loading && products.length === 0 ? (
                  <p className="mt-2 text-xs text-red-600">
                    No products loaded. Check getProducts response and
                    licenseId.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Barcode / Batch
                </label>
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
                    className:
                      "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white",
                    disabled: !selectedProductId || batchOptions.length === 0,
                  }}
                  menuClassName="rounded-xl"
                  inputClassName="rounded-lg"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Copies
                </label>
                <input
                  type="number"
                  min={1}
                  value={copiesToAdd}
                  onChange={(e) => setCopiesToAdd(Number(e.target.value || 1))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={addRow}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Add to print list
              </button>
            </div>

            <div className="rounded-2xl border p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">
                Print mode
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("DEFAULT")}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
                    mode === "DEFAULT"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 text-slate-700"
                  }`}
                >
                  Default Print
                </button>

                <button
                  type="button"
                  onClick={() => setMode("LABEL")}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
                    mode === "LABEL"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 text-slate-700"
                  }`}
                >
                  Label Print
                </button>
              </div>
            </div>

            {mode === "DEFAULT" ? (
              <div className="rounded-2xl border p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-900">
                  Default print settings
                </div>

                <input
                  value={defaultSettings.shopName}
                  onChange={(e) =>
                    setDefaultSettings((p) => ({
                      ...p,
                      shopName: e.target.value,
                    }))
                  }
                  placeholder="Shop name"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={defaultSettings.labelWidthMm}
                    onChange={(e) =>
                      setDefaultSettings((p) => ({
                        ...p,
                        labelWidthMm: Number(e.target.value || 50),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    placeholder="Width"
                  />
                  <input
                    type="number"
                    value={defaultSettings.labelHeightMm}
                    onChange={(e) =>
                      setDefaultSettings((p) => ({
                        ...p,
                        labelHeightMm: Number(e.target.value || 30),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    placeholder="Height"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={defaultSettings.columns}
                    onChange={(e) =>
                      setDefaultSettings((p) => ({
                        ...p,
                        columns: Number(e.target.value || 4),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    placeholder="Columns"
                  />
                  <input
                    type="number"
                    value={defaultSettings.barcodeHeight}
                    onChange={(e) =>
                      setDefaultSettings((p) => ({
                        ...p,
                        barcodeHeight: Number(e.target.value || 32),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    placeholder="Barcode height"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={defaultSettings.showShopName}
                    onChange={(e) =>
                      setDefaultSettings((p) => ({
                        ...p,
                        showShopName: e.target.checked,
                      }))
                    }
                  />
                  Show shop name
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={defaultSettings.showName}
                    onChange={(e) =>
                      setDefaultSettings((p) => ({
                        ...p,
                        showName: e.target.checked,
                      }))
                    }
                  />
                  Show item name
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={defaultSettings.showSalePrice}
                    onChange={(e) =>
                      setDefaultSettings((p) => ({
                        ...p,
                        showSalePrice: e.target.checked,
                      }))
                    }
                  />
                  Show sale price
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={defaultSettings.showMrp}
                    onChange={(e) =>
                      setDefaultSettings((p) => ({
                        ...p,
                        showMrp: e.target.checked,
                      }))
                    }
                  />
                  Show MRP
                </label>
              </div>
            ) : (
              <div className="rounded-2xl border p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-900">
                  Label print settings
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Engine
                  </label>
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
                    buttonProps={{
                      className:
                        "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white",
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Printer
                  </label>
                  <SearchableDropdown
                    value={labelSettings.printerId || ""}
                    onChange={(value) =>
                      setLabelSettings((p) => ({
                        ...p,
                        printerId: value,
                      }))
                    }
                    options={printerOptions}
                    placeholder="Select printer"
                    autoOpenOnFocus={false}
                    className="w-full"
                    buttonProps={{
                      className:
                        "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white",
                      disabled: printerOptions.length === 0,
                    }}
                  />
                </div>

                {labelSettings.engine !== "HTML" ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Template
                    </label>
                    <SearchableDropdown
                      value={labelSettings.templateId || ""}
                      onChange={(value) =>
                        setLabelSettings((p) => ({
                          ...p,
                          templateId: value,
                        }))
                      }
                      options={templateOptions}
                      placeholder="Select template"
                      autoOpenOnFocus={false}
                      className="w-full"
                      buttonProps={{
                        className:
                          "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white",
                        disabled: templateOptions.length === 0,
                      }}
                    />
                  </div>
                ) : null}

                <input
                  type="number"
                  min={1}
                  placeholder="Copies override (optional)"
                  value={labelSettings.copiesOverride || ""}
                  onChange={(e) =>
                    setLabelSettings((p) => ({
                      ...p,
                      copiesOverride: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
            )}

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
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {printing ? "Printing..." : "Print Now"}
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto bg-slate-100 p-5 space-y-5">
            <div className="rounded-2xl border bg-white">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Selected rows
                </h3>
              </div>

              <div className="max-h-[260px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="px-4 py-2.5">Item</th>
                      <th className="px-4 py-2.5">Barcode</th>
                      <th className="px-4 py-2.5">Copies</th>
                      <th className="px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={`${row.batchId || row.productId}-${index}`}
                        className="border-t"
                      >
                        <td className="px-4 py-2.5">{row.itemName}</td>
                        <td className="px-4 py-2.5 font-medium">
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
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="rounded-lg border px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!rows.length ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          No barcode rows selected
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {mode === "DEFAULT" ? (
              <div className="rounded-2xl border bg-white overflow-hidden min-h-[420px] flex flex-col">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Live preview
                  </h3>
                </div>

                {previewItems.length ? (
                  <iframe
                    title="Barcode Preview"
                    srcDoc={previewHtml}
                    className="flex-1 w-full border-0 bg-white"
                  />
                ) : (
                  <div className="p-6 text-sm text-slate-500">
                    Add rows to preview barcode layout.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border bg-white">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Label print summary
                  </h3>
                </div>

                <div className="p-4 text-sm text-slate-700 space-y-2">
                  <div>
                    <span className="font-medium">Engine:</span>{" "}
                    {labelSettings.engine}
                  </div>
                  <div>
                    <span className="font-medium">Printer:</span>{" "}
                    {filteredPrinters.find(
                      (p) => p.id === labelSettings.printerId,
                    )?.name || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Template:</span>{" "}
                    {filteredTemplates.find(
                      (t) => t.id === labelSettings.templateId,
                    )?.name || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Rows:</span> {rows.length}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
