// src/components/purchase/BatchSelectModal.tsx
"use client";
import { X, Barcode, CalendarDays, Boxes } from "lucide-react";
import { BatchInfo } from "./types";
import { useEffect, useRef } from "react";

interface BatchSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  batches: BatchInfo[];
  onSelect: (batch: BatchInfo | null) => void;
  productName?: string;
}

export default function BatchSelectModal({
  isOpen,
  onClose,
  batches,
  onSelect,
  productName,
}: BatchSelectModalProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && firstButtonRef.current) {
      setTimeout(() => {
        firstButtonRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSelect(batch: BatchInfo | null) {
    onSelect(batch);
    onClose();
  }

  function handleItemKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    batch: BatchInfo
  ) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(batch);
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();

      const container = e.currentTarget as HTMLElement;
      const buttons = Array.from(
        container.querySelectorAll<HTMLButtonElement>("[data-batch-btn='1']")
      );

      if (buttons.length === 0) return;

      const currentIndex = buttons.findIndex(
        (btn) => btn === document.activeElement
      );

      let nextIndex = 0;
      if (currentIndex === -1) {
        nextIndex = 0;
      } else if (e.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % buttons.length;
      } else {
        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      }

      buttons[nextIndex].focus();
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
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center">
              <Boxes className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-base font-semibold text-gray-900">
                Select Batch for Purchase
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

        {/* Info Banner */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-700">
            💡 <strong>Tip:</strong> Use{" "}
            <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-[10px] font-mono">
              ↑
            </kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-[10px] font-mono">
              ↓
            </kbd>{" "}
            to navigate,{" "}
            <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-[10px] font-mono">
              Enter
            </kbd>{" "}
            to select,{" "}
            <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-[10px] font-mono">
              Esc
            </kbd>{" "}
            to close.
          </p>
        </div>

        {/* List */}
        <div
          className="p-4 space-y-2 max-h-[50vh] overflow-y-auto"
          onKeyDown={handleListKeyDown}
        >
          {batches.map((b, idx) => (
            <button
              key={b.id}
              ref={idx === 0 ? firstButtonRef : null}
              type="button"
              data-batch-btn="1"
              onClick={() => handleSelect(b)}
              onKeyDown={(e) => handleItemKeyDown(e, b)}
              className="w-full text-left border-2 border-gray-200 rounded-xl px-4 py-3 hover:border-blue-500 hover:bg-blue-50 focus:border-blue-600 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all flex gap-3 items-start"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                <Barcode className="w-6 h-6 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">
                    {b.barcode || "No barcode"}
                  </span>
                  {b.batchNo && (
                    <span className="inline-flex px-2 py-0.5 rounded-md bg-purple-100 text-xs font-medium text-purple-700">
                      Batch: {b.batchNo}
                    </span>
                  )}
                </div>
                {(b.mfgDate || b.expiryDate) && (
                  <div className="mt-1 text-xs text-gray-600 flex items-center gap-3">
                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                    <div className="flex gap-3">
                      {b.mfgDate && (
                        <span>
                          <span className="text-gray-500">MFG:</span>{" "}
                          <span className="font-medium">
                            {new Date(b.mfgDate).toLocaleDateString()}
                          </span>
                        </span>
                      )}
                      {b.expiryDate && (
                        <span>
                          <span className="text-gray-500">EXP:</span>{" "}
                          <span className="font-medium">
                            {new Date(b.expiryDate).toLocaleDateString()}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400 flex-shrink-0">
                #{idx + 1}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            <span className="font-medium">{batches.length}</span> batch
            {batches.length === 1 ? "" : "es"} available
          </div>
          <div className="flex gap-2">
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
    </div>
  );
}
