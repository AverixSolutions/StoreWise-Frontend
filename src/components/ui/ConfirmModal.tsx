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
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-md mx-3 rounded-lg bg-white shadow-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-700 whitespace-pre-line">{message}</p>
        </div>
        <div className="p-3 flex gap-2 justify-end border-t border-gray-100">
          <button
            onClick={onCancel}
            className="h-9 px-3 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium"
          >
            {cancelText}
          </button>
          {secondaryText && onSecondary && (
            <button
              onClick={onSecondary}
              className="h-9 px-3 rounded-md bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-medium"
            >
              {secondaryText}
            </button>
          )}
          <button
            onClick={onConfirm}
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
