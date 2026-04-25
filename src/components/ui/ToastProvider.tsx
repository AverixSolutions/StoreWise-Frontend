// src/components/ui/ToastProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  showToast: (type: ToastType, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, type, message }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed left-1/2 top-4 z-[9999] flex w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
        {toasts.map((toast) => {
          const tone =
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
              : toast.type === "error"
                ? "border-rose-200 bg-rose-50/95 text-rose-800"
                : "border-slate-200 bg-white/95 text-slate-800";

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur ${tone}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {toast.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : toast.type === "error" ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                  )}
                </div>

                <p className="flex-1 text-sm font-medium leading-5">
                  {toast.message}
                </p>

                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}
