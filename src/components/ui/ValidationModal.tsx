// src/components/ui/ValidationModal.tsx
"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ValidationModalProps {
  isOpen: boolean;
  title?: string;
  messages: string[];
  confirmText?: string;
  onClose: () => void;
}

export default function ValidationModal({
  isOpen,
  title = "Please fix the following",
  messages,
  confirmText = "Got it",
  onClose,
}: ValidationModalProps) {
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Auto-focus confirm button & keyboard close
  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => btnRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const body = (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{
        background: "rgba(4, 8, 20, 0.80)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "var(--kyn-surface)",
          border: "1px solid var(--kyn-border)",
          boxShadow:
            "0 24px 80px rgba(4, 8, 20, 0.8), 0 0 0 1px rgba(239,68,68,0.08)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--kyn-border)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.22)",
              }}
            >
              <AlertTriangle className="w-4 h-4 text-[var(--kyn-danger)]" />
            </span>
            <h3 className="text-base font-semibold text-[var(--kyn-text)]">
              {title}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer text-[var(--kyn-text-muted)] hover:text-[var(--kyn-text)]"
            style={{ background: "var(--kyn-surface-2)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5">
          <ul className="space-y-2">
            {messages.map((m, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span
                  className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "var(--kyn-danger)" }}
                />
                <span className="text-[var(--kyn-text-soft)]">{m}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Footer ── */}
        <div
          className="px-6 py-4 flex justify-end"
          style={{ borderTop: "1px solid var(--kyn-border)" }}
        >
          <button
            ref={btnRef}
            onClick={onClose}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer"
            style={{
              background: "var(--kyn-danger)",
              color: "var(--kyn-white)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.88";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
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
