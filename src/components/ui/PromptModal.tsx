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

  const handleSubmit = () => {
    onConfirm(value);
  };

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

  return (
    <div className="fixed inset-0 z-[1100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-averix-red-vivid/10 flex items-center justify-center">
                <Type className="w-4 h-4 text-averix-red-vivid" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                {label && <p className="text-sm text-gray-600">{label}</p>}
              </div>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-3">
            <div className="relative">
              <input
                autoFocus
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full h-12 px-4 text-sm border-2 border-gray-200 rounded-xl outline-none focus:border-averix-red-vivid focus:ring-4 focus:ring-averix-red-vivid/10 transition-all duration-200 placeholder-gray-400 bg-gray-50/50 focus:bg-white"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                <Type className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Character count indicator */}
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Enter a descriptive name (optional)</span>
              <span className={`${value.length > 50 ? "text-amber-600" : ""}`}>
                {value.length}/50
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white hover:border-gray-300 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-averix-red-vivid text-white text-sm font-medium hover:bg-averix-red-dark transition-colors shadow-sm hover:shadow-md"
          >
            <Save className="w-4 h-4" />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
