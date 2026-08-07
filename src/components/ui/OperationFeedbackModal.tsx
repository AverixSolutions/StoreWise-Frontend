// src/components/ui/OperationFeedbackModal.tsx
"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Printer,
  X,
  XCircle,
} from "lucide-react";

export type OperationFeedbackTone = "success" | "warning" | "error" | "info";

interface OperationFeedbackModalProps {
  isOpen: boolean;
  tone?: OperationFeedbackTone;
  title: string;
  message: string;
  primaryText?: string;
  secondaryText?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onClose: () => void;
}

const toneConfig: Record<
  OperationFeedbackTone,
  {
    icon: typeof CheckCircle2;
    accent: string;
    soft: string;
    border: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    accent: "#10b981",
    soft: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.28)",
  },
  warning: {
    icon: AlertTriangle,
    accent: "#f59e0b",
    soft: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.28)",
  },
  error: {
    icon: XCircle,
    accent: "#ef4444",
    soft: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.28)",
  },
  info: {
    icon: Info,
    accent: "#20b7ff",
    soft: "rgba(32,183,255,0.12)",
    border: "rgba(32,183,255,0.28)",
  },
};

export default function OperationFeedbackModal({
  isOpen,
  tone = "info",
  title,
  message,
  primaryText = "Done",
  secondaryText,
  onPrimary,
  onSecondary,
  onClose,
}: OperationFeedbackModalProps) {
  const [mounted, setMounted] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const config = toneConfig[tone];
  const Icon = config.icon;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => primaryRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Enter") {
        event.preventDefault();
        onPrimary();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose, onPrimary]);

  if (!mounted || !isOpen) return null;

  const body = (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center p-4"
      role="presentation"
      style={{
        background: "rgba(4,8,20,0.78)",
        backdropFilter: "blur(8px)",
      }}
    >
      <button
        type="button"
        aria-label="Close feedback"
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
        onClick={onClose}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="operation-feedback-title"
        aria-describedby="operation-feedback-message"
        className="relative w-full max-w-md overflow-hidden rounded-2xl"
        style={{
          background: "var(--kyn-surface)",
          border: "1px solid var(--kyn-border)",
          boxShadow:
            "0 26px 90px rgba(4,8,20,0.82), 0 0 0 1px rgba(32,183,255,0.04)",
        }}
      >
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, ${config.accent}, var(--kyn-brand-end))`,
          }}
        />

        <div
          className="flex items-start justify-between gap-4 border-b px-5 py-4"
          style={{ borderColor: "var(--kyn-border)" }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: config.soft,
                border: `1px solid ${config.border}`,
              }}
            >
              <Icon className="h-5 w-5" style={{ color: config.accent }} />
            </span>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: config.accent }}
                />
                <span
                  className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: config.accent }}
                >
                  KYNFLOW
                </span>
              </div>
              <h3
                id="operation-feedback-title"
                className="text-base font-semibold tracking-[-0.02em]"
                style={{ color: "var(--kyn-text)" }}
              >
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:brightness-110"
            style={{
              background: "var(--kyn-surface-2)",
              color: "var(--kyn-text-muted)",
            }}
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          <p
            id="operation-feedback-message"
            className="whitespace-pre-line text-sm leading-6"
            style={{ color: "var(--kyn-text-soft)" }}
          >
            {message}
          </p>
        </div>

        <div
          className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4"
          style={{ borderColor: "var(--kyn-border)" }}
        >
          {secondaryText && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex h-10 items-center rounded-xl border px-4 text-sm font-medium transition hover:brightness-110"
              style={{
                borderColor: "var(--kyn-border)",
                background: "var(--kyn-surface-2)",
                color: "var(--kyn-text-soft)",
              }}
            >
              {secondaryText}
            </button>
          ) : null}

          <button
            ref={primaryRef}
            type="button"
            onClick={onPrimary}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${config.accent}, var(--kyn-brand-end))`,
              boxShadow: `0 8px 24px ${config.soft}`,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {primaryText.toLowerCase().includes("print") ? (
              <Printer className="h-4 w-4" />
            ) : null}
            {primaryText}
            <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[8px] text-white/70">
              Enter
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
