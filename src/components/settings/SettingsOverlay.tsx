"use client";

import { useEffect, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";

type SettingsOverlayProps = {
  open: boolean;
  title: string;
  description?: string;
  icon?: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  width?: "lg" | "xl" | "2xl";
};

const widthClasses: Record<
  NonNullable<SettingsOverlayProps["width"]>,
  string
> = {
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
  "2xl": "sm:max-w-6xl",
};

export default function SettingsOverlay({
  open,
  title,
  description,
  icon: Icon,
  onClose,
  children,
  width = "xl",
}: SettingsOverlayProps) {
  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1800] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-slate-200 bg-slate-50 shadow-[0_32px_100px_rgba(2,8,23,0.48)] sm:rounded-[24px] ${widthClasses[width]}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-4 py-3.5 text-white sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-cyan-300">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold sm:text-base">
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 truncate text-[10px] text-slate-400 sm:text-xs">
                  {description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
