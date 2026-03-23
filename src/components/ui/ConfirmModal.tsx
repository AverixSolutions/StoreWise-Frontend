// src/components/ui/ConfirmModal.tsx
"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  secondaryText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onSecondary?: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = "Are you sure?",
  message = "",
  confirmText = "Confirm",
  secondaryText,
  cancelText = "Cancel",
  onConfirm,
  onSecondary,
  onCancel,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || !isOpen) return null;

  const body = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-[rgba(3,8,20,0.62)] backdrop-blur-[3px]"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#f6f5ef] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(32,183,255,0),rgba(32,183,255,0.9),rgba(176,38,255,0.9),rgba(176,38,255,0))]" />

        <div className="border-b border-black/6 px-5 py-4 sm:px-6">
          <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            KYNSTACK
          </div>

          <h3 className="text-base font-semibold tracking-[-0.02em] text-slate-900 sm:text-lg">
            {title}
          </h3>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
            {message}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/6 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer"
          >
            {cancelText}
          </button>

          {secondaryText && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="h-10 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-medium text-amber-700 transition hover:bg-amber-100 cursor-pointer"
            >
              {secondaryText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-xl border border-white/20 bg-[linear-gradient(135deg,#20b7ff_0%,#b026ff_100%)] px-4 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(32,183,255,0.24)] transition hover:brightness-110 cursor-pointer"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
