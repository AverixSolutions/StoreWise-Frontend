// src/components/ui/ValidationModal.tsx
"use client";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface ValidationModalProps {
  isOpen: boolean;
  title?: string;
  messages: string[]; // bullet points
  confirmText?: string; // default: OK
  onClose: () => void;
}

export default function ValidationModal({
  isOpen,
  title = "Please fix the following",
  messages,
  confirmText = "OK",
  onClose,
}: ValidationModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !isOpen) return null;

  const body = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md mx-3 rounded-lg bg-white shadow-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>

        <div className="p-4">
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
            {messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>

        <div className="p-3 flex justify-end border-t border-gray-100">
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-md bg-averix-red-dark text-white hover:bg-averix-red-accent text-sm font-medium"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
