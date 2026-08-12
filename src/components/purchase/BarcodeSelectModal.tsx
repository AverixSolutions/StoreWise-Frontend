"use client";

import { Barcode, Check, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  isOpen: boolean;
  productName?: string;
  itemCode?: string;
  barcodes: string[];
  onSelect: (
    barcode: string,
    options: { createNew: boolean },
  ) => boolean | void | Promise<boolean | void>;
  onClose: () => void;
};

export default function BarcodeSelectModal({
  isOpen,
  productName,
  itemCode,
  barcodes,
  onSelect,
  onClose,
}: Props) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const customRef = useRef<HTMLInputElement>(null);
  const [custom, setCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setCustom("");
    setError("");
    setSubmitting(false);
    const timer = setTimeout(
      () => (firstRef.current || customRef.current)?.focus(),
      60,
    );
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const movePickerFocus = (direction: 1 | -1) => {
    const targets = [
      ...optionRefs.current.slice(0, barcodes.length),
      customRef.current,
    ].filter((target): target is HTMLButtonElement | HTMLInputElement => !!target);
    if (!targets.length) return;

    const activeIndex = targets.findIndex(
      (target) => target === document.activeElement,
    );
    const nextIndex =
      activeIndex < 0
        ? direction === 1
          ? 0
          : targets.length - 1
        : (activeIndex + direction + targets.length) % targets.length;
    targets[nextIndex]?.focus();
    if (targets[nextIndex] === customRef.current) customRef.current?.select();
  };

  const choose = async (value: string, createNew: boolean) => {
    const barcode = value.trim();
    if (!barcode || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const accepted = await onSelect(barcode, { createNew });
      if (accepted === false) {
        setError("Barcode was not selected. Check the message and try again.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not select barcode.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            movePickerFocus(event.key === "ArrowDown" ? 1 : -1);
          }
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
              <Barcode className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">
                Choose Item Barcode
              </h3>
              <p className="truncate text-xs text-slate-500">
                {productName || "Selected item"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-[11px] leading-5 text-slate-500">
            Barcodes are reusable for this item. The purchase will create a new
            stock lot using the barcode you choose.
          </p>

          <div className="space-y-1.5">
            {barcodes.map((value, index) => (
              <button
                key={value}
                ref={(element) => {
                  optionRefs.current[index] = element;
                  if (index === 0) firstRef.current = element;
                }}
                type="button"
                onClick={() => void choose(value, false)}
                disabled={submitting}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-cyan-300 hover:bg-cyan-50 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              >
                <span className="font-mono text-sm font-semibold text-slate-800">
                  {value}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                  {value === itemCode ? "item code default" : "alternate"}
                  <Check className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-700">
              Use a new custom barcode
            </label>
            <div className="flex gap-2">
              <input
                ref={customRef}
                type="text"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void choose(custom, true);
                  }
                }}
                placeholder="Scan or enter barcode"
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 caret-cyan-600 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                aria-keyshortcuts="ArrowUp ArrowDown Enter Escape"
              />
              <button
                type="button"
                onClick={() => void choose(custom, true)}
                disabled={!custom.trim() || submitting}
                className="flex h-9 items-center gap-1 rounded-lg bg-slate-800 px-3 text-xs font-semibold text-white disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
                {submitting ? "Saving..." : "Save & use"}
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">
              The new barcode is saved to this item and will appear here next time.
            </p>
            {error && (
              <p className="mt-2 text-[11px] font-medium text-rose-600">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 text-[10px] text-slate-500">
            <span>
              <kbd className="font-mono font-semibold">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono font-semibold">Enter</kbd> select
            </span>
            <span>
              <kbd className="font-mono font-semibold">Esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
