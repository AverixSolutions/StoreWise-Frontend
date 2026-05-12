// src/components/ui/Dropdown.tsx
"use client";
import { useState, useRef, useEffect, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  error?: boolean;
  onEnter?: () => void;
}

const Dropdown = forwardRef<HTMLButtonElement, DropdownProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = "Select an option",
      required = false,
      className = "",
      error = false,
      onEnter,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState<number>(-1);
    const [menuPosition, setMenuPosition] = useState({
      top: 0,
      left: 0,
      width: 0,
    });

    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
      if (!isOpen) return;

      const updatePosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const viewportPadding = 8;
        const maxWidth = window.innerWidth - viewportPadding * 2;

        setMenuPosition({
          top: rect.bottom + 6,
          left: Math.max(
            viewportPadding,
            Math.min(
              rect.left,
              window.innerWidth - rect.width - viewportPadding,
            ),
          ),
          width: Math.min(rect.width, maxWidth),
        });
      };

      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }, [isOpen]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;

        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(target) &&
          menuRef.current &&
          !menuRef.current.contains(target)
        ) {
          setIsOpen(false);
          setHighlightIndex(-1);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
      if (!isOpen) return;

      const selectedIndex = options.findIndex(
        (option) => option.value === value,
      );
      setHighlightIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }, [isOpen, options, value]);

    const selectedOption = options.find((option) => option.value === value);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const option =
          highlightIndex >= 0 ? options[highlightIndex] : options[0];
        if (option) onChange(option.value);
        setIsOpen(false);
        setHighlightIndex(-1);
        onEnter?.();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        setHighlightIndex(-1);
      } else if (e.key === "Tab") {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    };

    const menu = isOpen
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              zIndex: 9999,
            }}
            className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(3,10,24,0.12)]"
          >
            <div className="max-h-60 overflow-y-auto">
              {options.map((option, idx) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setHighlightIndex(-1);
                    onEnter?.();
                  }}
                  className={`w-full cursor-pointer px-3.5 py-2.5 text-left text-sm transition-colors ${
                    idx === highlightIndex
                      ? "bg-slate-900 text-white"
                      : value === option.value
                        ? "bg-cyan-50 font-medium text-cyan-800"
                        : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

    return (
      <div className={`relative w-full ${className}`} ref={dropdownRef}>
        <button
          ref={(node) => {
            triggerRef.current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-required={required}
          className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 bg-white/80 text-sm outline-none transition focus:ring-4 ${
            error
              ? "border-rose-300 focus:border-rose-400 focus:ring-rose-400/10"
              : "border-slate-200 focus:border-cyan-400/60 focus:ring-cyan-400/10"
          }`}
        >
          <span
            className={selectedOption ? "text-slate-900" : "text-slate-400"}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={`ml-2 h-4 w-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>

        {menu}
      </div>
    );
  },
);

Dropdown.displayName = "Dropdown";
export default Dropdown;
