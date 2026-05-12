// src/components/barcode/PrintLabelsModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  LabelPrintEngine,
  LabelPrintRequest,
  LabelPrintRow,
} from "@/lib/barcode/labelPrintTypes";
import { printLabels } from "@/lib/barcode/printLabels";
import { canUseBarcode } from "@/lib/session/runtimeSession";

type PrinterRow = {
  id: string;
  licenseId: string;
  name: string;
  engine: LabelPrintEngine;
  printerName: string;
  connectionType?: string | null;
  host?: string | null;
  port?: number | null;
  dpi?: number | null;
  isDefault?: number;
};

type TemplateRow = {
  id: string;
  licenseId: string;
  name: string;
  engine: Exclude<LabelPrintEngine, "HTML">;
  templatePath: string;
  widthMm?: number | null;
  heightMm?: number | null;
  defaultPrinterId?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  licenseId: string;
  rows: LabelPrintRow[];
  title?: string;
};

export default function PrintLabelsModal({
  open,
  onClose,
  licenseId,
  rows,
  title = "Print Labels",
}: Props) {
  const barcodeEnabled = canUseBarcode();
  const [engine, setEngine] = useState<LabelPrintEngine>("HTML");
  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [copiesOverride, setCopiesOverride] = useState<string>("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !barcodeEnabled) return;

    let cancelled = false;

    async function loadMeta() {
      setLoadingMeta(true);
      setError("");
      try {
        const [printersRes, templatesRes] = await Promise.all([
          window.electronAPI.listLabelPrinters(licenseId),
          window.electronAPI.listLabelTemplates(licenseId),
        ]);

        if (cancelled) return;

        const nextPrinters = printersRes?.success ? printersRes.rows || [] : [];
        const nextTemplates = templatesRes?.success
          ? templatesRes.rows || []
          : [];

        setPrinters(nextPrinters);
        setTemplates(nextTemplates);

        const defaultPrinter =
          nextPrinters.find((p) => Number(p.isDefault || 0) === 1) ||
          nextPrinters[0];
        if (defaultPrinter) setSelectedPrinterId(defaultPrinter.id);

        const preferredTemplate =
          nextTemplates.find((t) => t.engine === "BARTENDER") ||
          nextTemplates[0];
        if (preferredTemplate) setSelectedTemplateId(preferredTemplate.id);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load print settings",
          );
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, [open, licenseId, barcodeEnabled]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setMessage("");
  }, [open, engine]);

  const filteredPrinters = useMemo(() => {
    if (engine === "HTML") return printers;
    return printers.filter((p) => p.engine === engine);
  }, [printers, engine]);

  const filteredTemplates = useMemo(() => {
    if (engine === "HTML") return [];
    return templates.filter((t) => t.engine === engine);
  }, [templates, engine]);

  useEffect(() => {
    if (engine === "HTML") return;

    if (
      selectedPrinterId &&
      filteredPrinters.some((p) => p.id === selectedPrinterId)
    ) {
      return;
    }

    setSelectedPrinterId(filteredPrinters[0]?.id || "");
  }, [engine, filteredPrinters, selectedPrinterId]);

  useEffect(() => {
    if (engine === "HTML") return;

    if (
      selectedTemplateId &&
      filteredTemplates.some((t) => t.id === selectedTemplateId)
    ) {
      return;
    }

    setSelectedTemplateId(filteredTemplates[0]?.id || "");
  }, [engine, filteredTemplates, selectedTemplateId]);

  const effectiveRows = useMemo(() => {
    const override = Number(copiesOverride || 0);

    return rows.map((row) => ({
      ...row,
      copies: override > 0 ? override : Number(row.copies || 1),
    }));
  }, [rows, copiesOverride]);

  async function handlePrint() {
    setPrinting(true);
    setError("");
    setMessage("");

    try {
      const payload: LabelPrintRequest = {
        licenseId,
        engine,
        printerId:
          engine === "HTML" ? undefined : selectedPrinterId || undefined,
        templateId:
          engine === "HTML" ? undefined : selectedTemplateId || undefined,
        rows: effectiveRows,
      };

      const res = await printLabels(payload);

      if (res?.success === false) {
        throw new Error(res.error || "Print failed");
      }

      setMessage("Print request sent successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Print failed");
    } finally {
      setPrinting(false);
    }
  }

  if (!open || !barcodeEnabled) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">
              {rows.length} label row{rows.length !== 1 ? "s" : ""} selected
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loadingMeta ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Loading printers and templates...
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Engine
              </label>
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value as LabelPrintEngine)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                <option value="HTML">HTML Sheet</option>
                <option value="BARTENDER">BarTender</option>
                <option value="ZPL">ZPL</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Copies override
              </label>
              <input
                type="number"
                min={1}
                placeholder="Optional"
                value={copiesOverride}
                onChange={(e) => setCopiesOverride(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>

          {engine !== "HTML" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Printer
                </label>
                <select
                  value={selectedPrinterId}
                  onChange={(e) => setSelectedPrinterId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">Select printer</option>
                  {filteredPrinters.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.printerName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">Select template</option>
                  {filteredTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Preview Data
              </h3>
            </div>

            <div className="max-h-72 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th className="px-4 py-2.5">Item</th>
                    <th className="px-4 py-2.5">Barcode</th>
                    <th className="px-4 py-2.5">Sale Price</th>
                    <th className="px-4 py-2.5">MRP</th>
                    <th className="px-4 py-2.5">Copies</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveRows.map((row, idx) => (
                    <tr
                      key={`${row.batchId || row.productId}-${idx}`}
                      className="border-t"
                    >
                      <td className="px-4 py-2.5 text-slate-800">
                        {row.itemName || "-"}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {row.barcode}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {row.salePrice ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {row.mrp ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {row.copies ?? 1}
                      </td>
                    </tr>
                  ))}

                  {!effectiveRows.length ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-slate-500"
                      >
                        No label rows selected
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              printing ||
              !effectiveRows.length ||
              (engine !== "HTML" && (!selectedPrinterId || !selectedTemplateId))
            }
            onClick={handlePrint}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {printing ? "Printing..." : "Print Labels"}
          </button>
        </div>
      </div>
    </div>
  );
}
