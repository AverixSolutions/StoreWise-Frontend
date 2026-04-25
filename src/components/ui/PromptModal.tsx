// src/components/ui/PromptModal.tsx
"use client";
import { useEffect, useState } from "react";
import { X, Save, Type } from "lucide-react";

interface PromptModalProps {
  isOpen: boolean;
  title?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export default function PromptModal({
  isOpen,
  title = "Enter value",
  label,
  placeholder,
  defaultValue = "",
  confirmText = "Save",
  cancelText = "Cancel",
  onCancel,
  onConfirm,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) setValue(defaultValue || "");
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = () => onConfirm(value);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const overLimit = value.length > 50;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{
        background: "rgba(4, 8, 20, 0.80)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "var(--kyn-surface)",
          border: "1px solid var(--kyn-border)",
          boxShadow:
            "0 24px 80px rgba(4, 8, 20, 0.8), 0 0 0 1px rgba(32,183,255,0.06)",
        }}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--kyn-border)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(32, 183, 255, 0.12)",
                border: "1px solid rgba(32,183,255,0.2)",
              }}
            >
              <Type className="w-4 h-4 text-[var(--kyn-primary)]" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-[var(--kyn-text)]">
                {title}
              </h3>
              {label && (
                <p className="text-xs text-[var(--kyn-text-muted)] mt-0.5">
                  {label}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer text-[var(--kyn-text-muted)] hover:text-[var(--kyn-text)]"
            style={{ background: "var(--kyn-surface-2)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="p-6 space-y-3">
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full h-11 pl-4 pr-10 text-sm rounded-xl outline-none transition-all duration-150"
              style={{
                background: "var(--kyn-surface-2)",
                border: "1px solid var(--kyn-border)",
                color: "var(--kyn-text)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--kyn-primary)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px var(--kyn-glow-primary)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--kyn-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <Type className="w-4 h-4 text-[var(--kyn-text-muted)]" />
            </div>
          </div>

          {/* Character hint */}
          <div className="flex justify-between items-center text-xs text-[var(--kyn-text-muted)]">
            <span>Enter a descriptive name (optional)</span>
            <span
              style={{ color: overLimit ? "var(--kyn-warning)" : undefined }}
            >
              {value.length}/50
            </span>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div
          className="px-6 py-4 flex justify-end gap-2"
          style={{ borderTop: "1px solid var(--kyn-border)" }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-[var(--kyn-text-soft)] hover:text-[var(--kyn-text)]"
            style={{
              background: "var(--kyn-surface-2)",
              border: "1px solid var(--kyn-border)",
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer"
            style={{
              background: "var(--kyn-primary)",
              color: "var(--kyn-bg)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--kyn-primary-strong)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--kyn-primary)";
            }}
          >
            <Save className="w-4 h-4" />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
