// src/components/master/LabelPrintSettings.tsx
"use client";

import { useEffect, useState } from "react";

export default function LabelPrintSettingsPage() {
  const licenseId =
    typeof window !== "undefined"
      ? localStorage.getItem("licenseId") || "demo-license"
      : "demo-license";

  const electronAPI = (window as any).electronAPI;

  const [printers, setPrinters] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const [testMode, setTestMode] = useState<"FILE_ONLY" | "REAL_PRINT">(
    "FILE_ONLY",
  );

  const [printerForm, setPrinterForm] = useState({
    name: "",
    engine: "ZPL",
    printerName: "",
    connectionType: "NETWORK",
    host: "",
    port: 9100,
    dpi: 203,
    isDefault: true,
  });

  const [templateForm, setTemplateForm] = useState({
    name: "",
    engine: "ZPL",
    templatePath: "",
    widthMm: 50,
    heightMm: 30,
  });

  async function loadAll() {
    const p = await electronAPI.listLabelPrinters(licenseId);
    const t = await electronAPI.listLabelTemplates(licenseId);

    if (p?.success) setPrinters(p.rows || []);
    if (t?.success) setTemplates(t.rows || []);
  }

  useEffect(() => {
    if (!electronAPI) return;
    loadAll();
  }, []);

  async function savePrinter() {
    const res = await electronAPI.saveLabelPrinter({
      licenseId,
      ...printerForm,
    });

    if (!res?.success) {
      alert(res?.error || "Failed to save printer");
      return;
    }

    alert("Printer saved");
    setPrinterForm({
      name: "",
      engine: "ZPL",
      printerName: "",
      connectionType: "NETWORK",
      host: "",
      port: 9100,
      dpi: 203,
      isDefault: true,
    });
    loadAll();
  }

  async function saveTemplate() {
    const res = await electronAPI.saveLabelTemplate({
      licenseId,
      ...templateForm,
      mappings: [
        { appField: "itemName", externalField: "ItemName" },
        { appField: "barcode", externalField: "BarcodeValue" },
        { appField: "mrp", externalField: "MrpValue" },
        { appField: "salePrice", externalField: "SalePriceValue" },
        { appField: "batchNo", externalField: "BatchValue" },
      ],
    });

    if (!res?.success) {
      alert(res?.error || "Failed to save template");
      return;
    }

    alert("Template saved");
    setTemplateForm({
      name: "",
      engine: "ZPL",
      templatePath: "",
      widthMm: 50,
      heightMm: 30,
    });
    loadAll();
  }

  async function testPrint(engine: "ZPL" | "BARTENDER") {
    const matchingTemplates = templates.filter((t) => t.engine === engine);
    const matchingPrinters = printers.filter((p) => p.engine === engine);

    if (!matchingTemplates.length) {
      alert(`Save a ${engine} template first`);
      return;
    }

    if (engine === "ZPL" && !matchingPrinters.length) {
      alert("Save a ZPL printer first");
      return;
    }

    const res = await electronAPI.printLabelsNative({
      licenseId,
      engine,
      templateId: matchingTemplates[0].id,
      printerId: matchingPrinters[0]?.id,
      testMode,
      rows: [
        {
          productId: "p1",
          batchId: "b1",
          barcode: "123456789012",
          itemName: "Test Item",
          salePrice: 99,
          mrp: 120,
          batchNo: "B001",
          copies: 1,
        },
      ],
    });

    console.log(`${engine} test result`, res);
    alert(JSON.stringify(res, null, 2));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Label Print Settings
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure label printers and templates for your printing operations.
        </p>
      </div>

      {/* Create Printer Section */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Create Printer</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Printer Name
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Main Label Printer"
              value={printerForm.name}
              onChange={(e) =>
                setPrinterForm((s) => ({ ...s, name: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Printer Engine
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={printerForm.engine}
              onChange={(e) =>
                setPrinterForm((s) => ({ ...s, engine: e.target.value }))
              }
            >
              <option value="ZPL">ZPL / PRN</option>
              <option value="BARTENDER">BarTender</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Windows Printer Name
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Zebra ZPL"
              value={printerForm.printerName}
              onChange={(e) =>
                setPrinterForm((s) => ({ ...s, printerName: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Connection Type
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={printerForm.connectionType}
              onChange={(e) =>
                setPrinterForm((s) => ({
                  ...s,
                  connectionType: e.target.value,
                }))
              }
            >
              <option value="NETWORK">Network</option>
              <option value="WINDOWS">Windows Printer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Host / IP Address
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 192.168.1.100"
              value={printerForm.host}
              onChange={(e) =>
                setPrinterForm((s) => ({ ...s, host: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Port
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              placeholder="9100"
              value={printerForm.port}
              onChange={(e) =>
                setPrinterForm((s) => ({ ...s, port: Number(e.target.value) }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DPI
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              placeholder="203"
              value={printerForm.dpi}
              onChange={(e) =>
                setPrinterForm((s) => ({ ...s, dpi: Number(e.target.value) }))
              }
            />
          </div>
        </div>

        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          onClick={savePrinter}
        >
          Save Printer
        </button>
      </div>

      {/* Create Template Section */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Create Template</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Product Label"
              value={templateForm.name}
              onChange={(e) =>
                setTemplateForm((s) => ({ ...s, name: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Engine
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={templateForm.engine}
              onChange={(e) =>
                setTemplateForm((s) => ({ ...s, engine: e.target.value }))
              }
            >
              <option value="ZPL">ZPL / PRN</option>
              <option value="BARTENDER">BarTender</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Path
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="C:\labels\template.zpl"
              value={templateForm.templatePath}
              onChange={(e) =>
                setTemplateForm((s) => ({ ...s, templatePath: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Width (mm)
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              placeholder="50"
              value={templateForm.widthMm}
              onChange={(e) =>
                setTemplateForm((s) => ({
                  ...s,
                  widthMm: Number(e.target.value),
                }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Height (mm)
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              placeholder="30"
              value={templateForm.heightMm}
              onChange={(e) =>
                setTemplateForm((s) => ({
                  ...s,
                  heightMm: Number(e.target.value),
                }))
              }
            />
          </div>
        </div>

        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          onClick={saveTemplate}
        >
          Save Template
        </button>
      </div>

      {/* Test Section */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Test Print</h3>
        <p className="text-sm text-gray-600">
          Test ZPL, PRN, and BarTender with a sample label.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Test Mode
          </label>
          <select
            className="w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={testMode}
            onChange={(e) =>
              setTestMode(e.target.value as "FILE_ONLY" | "REAL_PRINT")
            }
          >
            <option value="FILE_ONLY">File Only</option>
            <option value="REAL_PRINT">Real Print</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            onClick={() => testPrint("ZPL")}
          >
            Test ZPL / PRN
          </button>

          <button
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            onClick={() => testPrint("BARTENDER")}
          >
            Test BarTender
          </button>
        </div>
      </div>

      {/* Saved Printers Section */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Saved Printers
        </h3>
        {printers.length === 0 ? (
          <p className="text-gray-500 text-sm">No printers configured yet.</p>
        ) : (
          <div className="space-y-3">
            {printers.map((printer) => (
              <div
                key={printer.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <h4 className="font-medium text-gray-900">{printer.name}</h4>
                <p className="text-sm text-gray-600">
                  Engine: {printer.engine} •{" "}
                  {printer.connectionType === "NETWORK"
                    ? `${printer.host}:${printer.port}`
                    : printer.printerName}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saved Templates Section */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Saved Templates
        </h3>
        {templates.length === 0 ? (
          <p className="text-gray-500 text-sm">No templates configured yet.</p>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <h4 className="font-medium text-gray-900">{template.name}</h4>
                <p className="text-sm text-gray-600">
                  Engine: {template.engine} • {template.widthMm}mm ×{" "}
                  {template.heightMm}mm
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
