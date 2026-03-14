// src/components/barcodes/BarcodePrintModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarcodePrintItem,
  BarcodePrintOptions,
} from "@/lib/barcode/barcodeTemplates";
import { buildBarcodePrintHtml } from "@/lib/barcode/printBarcodeHtml";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  items: BarcodePrintItem[];
  defaultShopName?: string;
};

export default function BarcodePrintModal({
  isOpen,
  onClose,
  items,
  defaultShopName = "My Shop",
}: Props) {
  const [shopName, setShopName] = useState(defaultShopName);
  const [labelWidthMm, setLabelWidthMm] = useState(50);
  const [labelHeightMm, setLabelHeightMm] = useState(30);
  const [columns, setColumns] = useState(4);
  const [showShopName, setShowShopName] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showSalePrice, setShowSalePrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [barcodeHeight, setBarcodeHeight] = useState(32);
  const [fontSizeShop, setFontSizeShop] = useState(11);
  const [fontSizeName, setFontSizeName] = useState(10);
  const [fontSizeMeta, setFontSizeMeta] = useState(9);

  const [draftItems, setDraftItems] = useState<BarcodePrintItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDraftItems(
        (items || []).map((x) => ({
          ...x,
          copies: Math.max(0, Number(x.copies ?? 1)),
        })),
      );
    }
  }, [isOpen, items]);

  const totalLabels = useMemo(
    () =>
      draftItems.reduce(
        (sum, item) => sum + Math.max(0, Number(item.copies ?? 0)),
        0,
      ),
    [draftItems],
  );

  const options: BarcodePrintOptions = useMemo(
    () => ({
      shopName,
      pageTitle: "Barcode Print",
      labelWidthMm,
      labelHeightMm,
      columns,
      showShopName,
      showName,
      showSalePrice,
      showMrp,
      barcodeHeight,
      fontSizeShop,
      fontSizeName,
      fontSizeMeta,
    }),
    [
      shopName,
      labelWidthMm,
      labelHeightMm,
      columns,
      showShopName,
      showName,
      showSalePrice,
      showMrp,
      barcodeHeight,
      fontSizeShop,
      fontSizeName,
      fontSizeMeta,
    ],
  );

  const previewHtml = useMemo(() => {
    const validItems = draftItems.filter(
      (x) =>
        String(x.code || "").trim() && Math.max(0, Number(x.copies ?? 0)) > 0,
    );
    return buildBarcodePrintHtml(validItems, options);
  }, [draftItems, options]);

  if (!isOpen) return null;

  async function handlePrint() {
    const validItems = draftItems.filter(
      (x) =>
        String(x.code || "").trim() && Math.max(0, Number(x.copies ?? 0)) > 0,
    );

    if (!validItems.length) {
      alert("No valid barcode items to print");
      return;
    }

    try {
      const html = buildBarcodePrintHtml(validItems, options);

      const res = await window.electronAPI.printHtml(html, {
        preview: false,
        pageSize: "A4",
      });

      if (!res?.success) {
        alert(res?.error || "Print failed");
        return;
      }
    } catch (error: any) {
      alert("Print failed: " + String(error?.message || error));
      console.error("Barcode modal print error:", error);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[85vh] bg-white rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Print Barcodes</h2>
            <p className="text-sm text-gray-500">Total labels: {totalLabels}</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-[360px_1fr] flex-1 min-h-0">
          {/* Left panel — settings + items */}
          <div className="border-r p-4 space-y-4 overflow-y-auto min-h-0">
            <div>
              <label className="block text-sm font-medium mb-1">
                Shop name
              </label>
              <input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Label width (mm)
                </label>
                <input
                  type="number"
                  value={labelWidthMm}
                  onChange={(e) =>
                    setLabelWidthMm(Number(e.target.value || 50))
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Label height (mm)
                </label>
                <input
                  type="number"
                  value={labelHeightMm}
                  onChange={(e) =>
                    setLabelHeightMm(Number(e.target.value || 30))
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Columns
                </label>
                <input
                  type="number"
                  value={columns}
                  onChange={(e) => setColumns(Number(e.target.value || 4))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Barcode height
                </label>
                <input
                  type="number"
                  value={barcodeHeight}
                  onChange={(e) =>
                    setBarcodeHeight(Number(e.target.value || 32))
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Shop font
                </label>
                <input
                  type="number"
                  value={fontSizeShop}
                  onChange={(e) =>
                    setFontSizeShop(Number(e.target.value || 11))
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name font
                </label>
                <input
                  type="number"
                  value={fontSizeName}
                  onChange={(e) =>
                    setFontSizeName(Number(e.target.value || 10))
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Meta font
                </label>
                <input
                  type="number"
                  value={fontSizeMeta}
                  onChange={(e) => setFontSizeMeta(Number(e.target.value || 9))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showShopName}
                  onChange={(e) => setShowShopName(e.target.checked)}
                />
                Show shop name
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showName}
                  onChange={(e) => setShowName(e.target.checked)}
                />
                Show item name
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showSalePrice}
                  onChange={(e) => setShowSalePrice(e.target.checked)}
                />
                Show sale price
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showMrp}
                  onChange={(e) => setShowMrp(e.target.checked)}
                />
                Show MRP
              </label>
            </div>

            <div className="pt-2 border-t">
              <h3 className="text-sm font-semibold mb-2">Print items</h3>

              <div className="space-y-2 max-h-[260px] overflow-auto">
                {draftItems.map((item, index) => (
                  <div
                    key={`${item.code}-${index}`}
                    className="border rounded-lg p-2"
                  >
                    <div className="text-sm font-medium">
                      {item.name || "Unnamed item"}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {item.code}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={item.code}
                        onChange={(e) => {
                          const next = [...draftItems];
                          next[index].code = e.target.value;
                          setDraftItems(next);
                        }}
                        placeholder="Barcode"
                        className="border rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        value={item.salePrice ?? ""}
                        onChange={(e) => {
                          const next = [...draftItems];
                          next[index].salePrice =
                            e.target.value === ""
                              ? null
                              : Number(e.target.value);
                          setDraftItems(next);
                        }}
                        placeholder="SP"
                        className="border rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        value={item.mrp ?? ""}
                        onChange={(e) => {
                          const next = [...draftItems];
                          next[index].mrp =
                            e.target.value === ""
                              ? null
                              : Number(e.target.value);
                          setDraftItems(next);
                        }}
                        placeholder="MRP"
                        className="border rounded px-2 py-1 text-xs"
                      />
                    </div>

                    <div className="mt-2">
                      <input
                        type="number"
                        min={0}
                        value={item.copies ?? 0}
                        onChange={(e) => {
                          const next = [...draftItems];
                          next[index].copies = Math.max(
                            0,
                            Number(e.target.value === "" ? 0 : e.target.value),
                          );
                          setDraftItems(next);
                        }}
                        placeholder="Copies"
                        className="border rounded px-2 py-1 text-xs w-24"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="w-full bg-averix-red-dark text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-averix-red-accent"
            >
              Print
            </button>
          </div>

          {/* Right panel — real preview */}
          <div className="p-4 overflow-y-auto bg-gray-100 min-h-0">
            <div className="bg-white border rounded-xl overflow-hidden h-full flex flex-col">
              <div className="px-4 py-3 border-b shrink-0">
                <div className="text-sm font-semibold text-gray-900">
                  Preview
                </div>
                <div className="text-xs text-gray-500">
                  Live barcode layout preview
                </div>
              </div>

              {draftItems.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  No barcode items selected.
                </div>
              ) : (
                <iframe
                  title="Barcode Preview"
                  srcDoc={previewHtml}
                  className="w-full flex-1 bg-white border-0"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
