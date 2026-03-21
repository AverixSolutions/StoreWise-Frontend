// src/components/purchase/BatchSelectModal.tsx
"use client";
import { X, Barcode, CalendarDays, Boxes, Plus, Zap } from "lucide-react";
import { BatchInfo } from "./types";
import { useEffect, useRef, useState } from "react";

interface BatchSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  batches: BatchInfo[];
  onSelect: (batch: BatchInfo | null) => void;
  onAddNewBatch?: (barcode: string) => void; // user wants a brand-new barcode
  productName?: string;
  nextBarcode?: string; // pre-fetched next global barcode (peek)
  licenseId?: string;
  allowCreateNew?: boolean;
}

export default function BatchSelectModal({
  isOpen,
  onClose,
  batches,
  onSelect,
  onAddNewBatch,
  productName,
  nextBarcode,
  licenseId,
  allowCreateNew = true,
}: BatchSelectModalProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const [customBarcode, setCustomBarcode] = useState("");
  const [tab, setTab] = useState<"existing" | "new">("existing");

  useEffect(() => {
    if (isOpen) {
      setCustomBarcode("");
      // If no existing batches, jump to "new" tab
      setTab(batches.length === 0 ? "new" : "existing");
      setTimeout(() => firstButtonRef.current?.focus(), 100);
    }
  }, [isOpen, batches.length]);

  if (!isOpen) return null;

  function handleSelect(batch: BatchInfo | null) {
    onSelect(batch);
    onClose();
  }

  function handleAddNew(barcode: string) {
    if (!barcode.trim()) return;
    onAddNewBatch?.(barcode.trim());
    onClose();
  }

  function handleListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const buttons = Array.from(
        e.currentTarget.querySelectorAll<HTMLButtonElement>(
          "[data-batch-btn='1']",
        ),
      );
      if (!buttons.length) return;
      const cur = buttons.findIndex((b) => b === document.activeElement);
      const next =
        cur === -1
          ? 0
          : e.key === "ArrowDown"
            ? (cur + 1) % buttons.length
            : (cur - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center">
              <Boxes className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-base font-semibold text-gray-900">
                Select / Add Batch
              </div>
              {productName && (
                <div className="text-sm text-gray-600 truncate max-w-[320px]">
                  {productName}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          <button
            type="button"
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === "existing"
                ? "border-b-2 border-blue-600 text-blue-700 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setTab("existing")}
          >
            Existing Barcodes{" "}
            <span className="ml-1 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
              {batches.length}
            </span>
          </button>
          {allowCreateNew && (
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === "new"
                  ? "border-b-2 border-blue-600 text-blue-700 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setTab("new")}
            >
              Add New Barcode
            </button>
          )}
        </div>

        {/* Info Banner */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <p className="text-xs text-blue-700">
            💡 Each barcode = a separate batch with independent stock tracking.{" "}
            {tab === "existing"
              ? "Select an existing barcode or switch to add a new one. You can reopen this popup from barcode field using F2 or Ctrl+B."
              : `Next auto-generated barcode: `}
            {tab === "new" && nextBarcode && (
              <span className="font-mono font-bold">{nextBarcode}</span>
            )}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "existing" && (
            <div onKeyDown={handleListKeyDown} className="space-y-2">
              {batches.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <Barcode className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No barcodes yet for this product.</p>
                  {allowCreateNew ? (
                    <button
                      type="button"
                      onClick={() => setTab("new")}
                      className="mt-3 text-blue-600 text-sm underline"
                    >
                      Add a new barcode
                    </button>
                  ) : (
                    <p className="mt-3 text-xs text-gray-500">
                      No sellable batch available for this product.
                    </p>
                  )}
                </div>
              ) : (
                batches.map((b, idx) => (
                  <button
                    key={b.id}
                    ref={idx === 0 ? firstButtonRef : null}
                    type="button"
                    data-batch-btn="1"
                    onClick={() => handleSelect(b)}
                    className="w-full text-left border border-gray-200 rounded-xl overflow-hidden hover:border-blue-500 hover:bg-blue-50 focus:border-blue-600 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <div className="grid grid-cols-[1.2fr_1.3fr_0.8fr_0.9fr_0.9fr_0.8fr] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-600 uppercase">
                      <div>Barcode</div>
                      <div>Purchase Batch</div>
                      <div>MRP</div>
                      <div>Sale</div>
                      <div>Rate</div>
                      <div>Stock</div>
                    </div>

                    <div className="grid grid-cols-[1.2fr_1.3fr_0.8fr_0.9fr_0.9fr_0.8fr] gap-2 px-4 py-3 text-sm text-gray-900 items-center">
                      <div className="font-mono font-semibold">
                        {b.barcode || "—"}
                      </div>
                      <div>{b.purchaseBatchNo || b.batchNo || "—"}</div>
                      <div>{b.mrp != null ? `₹${b.mrp}` : "—"}</div>
                      <div>{b.salePrice != null ? `₹${b.salePrice}` : "—"}</div>
                      <div>
                        {(b as any).costPrice != null
                          ? `₹${(b as any).costPrice}`
                          : "—"}
                      </div>
                      <div>
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-green-100 text-xs font-medium text-green-700">
                          {(b as any).stock ?? 0}
                        </span>
                      </div>
                    </div>

                    {(b.mfgDate || b.expiryDate) && (
                      <div className="px-4 pb-3 text-xs text-gray-500 flex gap-4">
                        {b.mfgDate && (
                          <span>
                            MFG: {new Date(b.mfgDate).toLocaleDateString()}
                          </span>
                        )}
                        {b.expiryDate && (
                          <span>
                            EXP: {new Date(b.expiryDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {allowCreateNew && tab === "new" && (
            <div className="space-y-4 py-2">
              {/* Auto-generate option */}
              <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">
                    Auto-generate
                  </span>
                </div>
                <p className="text-xs text-blue-600 mb-3">
                  System will assign the next available barcode:{" "}
                  <span className="font-mono font-bold">
                    {nextBarcode || "—"}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => handleAddNew(nextBarcode || "")}
                  disabled={!nextBarcode}
                  className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Use {nextBarcode}
                </button>
              </div>

              {/* Custom barcode */}
              <div className="border-2 border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-semibold text-gray-800">
                    Custom barcode
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Enter any barcode value (EAN-13, QR code string, custom code,
                  etc.)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customBarcode}
                    onChange={(e) => setCustomBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNew(customBarcode);
                      }
                    }}
                    placeholder="e.g. 90808909 or EAN123456"
                    className="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                    autoFocus={batches.length === 0}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddNew(customBarcode)}
                    disabled={!customBarcode.trim()}
                    className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
                  >
                    Use
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center flex-shrink-0">
          <div className="text-xs text-gray-500">
            <span className="font-medium">{batches.length}</span> batch
            {batches.length === 1 ? "" : "es"} available
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
