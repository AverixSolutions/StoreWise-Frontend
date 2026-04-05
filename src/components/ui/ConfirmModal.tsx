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
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center px-4"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(4,8,20,0.72)] backdrop-blur-[6px]"
        onClick={onCancel}
      />

      {/* Modal card */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[24px] shadow-[0_32px_80px_rgba(0,0,0,0.56),0_0_0_1px_rgba(93,135,201,0.18)]"
        style={{ background: "var(--kyn-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top brand line */}
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(32,183,255,0),rgba(32,183,255,0.9),rgba(176,38,255,0.9),rgba(176,38,255,0))]" />

        {/* Subtle inner glow */}
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(32,183,255,0.07),transparent_70%)] pointer-events-none" />

        {/* Header */}
        <div
          className="border-b px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--kyn-border)" }}
        >
          <div
            className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1"
            style={{
              borderColor: "rgba(93,135,201,0.22)",
              background: "rgba(32,183,255,0.07)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--kyn-primary)] opacity-80" />
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--kyn-primary)" }}
            >
              KYNFLOW
            </span>
          </div>

          <h3
            className="text-base font-semibold tracking-[-0.02em] sm:text-lg"
            style={{ color: "var(--kyn-text)" }}
          >
            {title}
          </h3>
        </div>

        {/* Body */}
        <div className="px-5 py-5 sm:px-6">
          <p
            className="whitespace-pre-line text-sm leading-6"
            style={{ color: "var(--kyn-text-muted)" }}
          >
            {message}
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--kyn-border)" }}
        >
          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border px-4 text-sm font-medium transition hover:brightness-110 cursor-pointer"
            style={{
              borderColor: "var(--kyn-border)",
              background: "var(--kyn-surface-2)",
              color: "var(--kyn-text-soft)",
            }}
          >
            {cancelText}
          </button>

          {/* Secondary (optional) */}
          {secondaryText && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="h-10 rounded-xl border px-4 text-sm font-medium transition hover:brightness-110 cursor-pointer"
              style={{
                borderColor: "rgba(245,158,11,0.35)",
                background: "rgba(245,158,11,0.1)",
                color: "var(--kyn-warning)",
              }}
            >
              {secondaryText}
            </button>
          )}

          {/* Confirm */}
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-xl px-4 text-sm font-semibold text-white transition hover:brightness-110 cursor-pointer"
            style={{
              background:
                "linear-gradient(135deg, var(--kyn-brand-start) 0%, var(--kyn-brand-end) 100%)",
              boxShadow: "0 8px 24px var(--kyn-glow-primary)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
