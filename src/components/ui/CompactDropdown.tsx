// src/components/ui/CompactDropdown.tsx
"use client";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { ChevronDown } from "lucide-react";
import type React from "react";

interface CompactDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> &
    Record<string, any>;
  onEnter?: (dir: 1 | -1) => void;
  autoOpenOnFocus?: boolean;
}

export default function CompactDropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  buttonProps = {},
  onEnter,
  autoOpenOnFocus = true,
}: CompactDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const wasPointerDown = useRef(false);

  const selectedIdx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      const t = e.target as Node | null;
      if (
        (dropdownRef.current && dropdownRef.current.contains(t)) ||
        (menuRef.current && menuRef.current.contains(t))
      )
        return;
      setIsOpen(false);
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        (dropdownRef.current &&
          dropdownRef.current.contains(event.target as Node)) ||
        (menuRef.current && menuRef.current.contains(event.target as Node))
      )
        return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActive(selectedIdx >= 0 ? selectedIdx : 0);
    requestAnimationFrame(() => {
      const el = optionRefs.current[selectedIdx] || optionRefs.current[0];
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "nearest" });
    });
  }, [isOpen, selectedIdx]);

  useEffect(() => {
    if (!isOpen) return;
    const el = optionRefs.current[active];
    el?.scrollIntoView({ block: "nearest" });
  }, [active, isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  useLayoutEffect(() => {}, [isOpen]);

  const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isOpen) return false;
    if (e.key === "Enter") {
      e.preventDefault();
      setIsOpen(true);
      return true;
    } else if (e.key === "ArrowDown" || e.key === " ") {
      e.preventDefault();
      setIsOpen(true);
      return true;
    }
    return false;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onMouseDown={() => {
          wasPointerDown.current = true;
          setTimeout(() => (wasPointerDown.current = false), 0);
        }}
        onClick={() => setIsOpen((p) => !p)}
        onFocus={() => {
          if (autoOpenOnFocus && !wasPointerDown.current) setIsOpen(true);
        }}
        {...buttonProps}
        className={[
          // Base layout
          "w-full flex items-center justify-between",
          "px-3 py-1.5 text-sm rounded-md",
          // KYN surface + border
          "bg-[var(--kyn-surface-2)] border border-[var(--kyn-border)]",
          // KYN text
          "text-[var(--kyn-text-soft)]",
          // Transitions
          "transition-all duration-150 outline-none",
          // Focus / open state: primary glow ring
          isOpen
            ? "border-[var(--kyn-primary)] shadow-[0_0_0_2px_var(--kyn-glow-primary)]"
            : "hover:border-[rgba(93,135,201,0.35)] hover:shadow-[0_0_0_1px_var(--kyn-glow-primary)]",
          buttonProps?.className || "",
        ]
          .filter(Boolean)
          .join(" ")}
        onKeyDown={(e) => {
          const handled = handleButtonKeyDown(e);
          if (!handled) buttonProps?.onKeyDown?.(e);
        }}
      >
        <span
          className={
            selectedOption
              ? "text-[var(--kyn-text)]"
              : "text-[var(--kyn-text-muted)]"
          }
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--kyn-text-muted)] transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[var(--kyn-primary)]" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={[
            "absolute top-full left-0 right-0 mt-1 z-[9999]",
            "rounded-md overflow-hidden overflow-y-auto max-h-48",
            // KYN surface with border + glow shadow
            "bg-[var(--kyn-surface-2)] border border-[var(--kyn-border)]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_var(--kyn-glow-primary)]",
          ].join(" ")}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
              optionRefs.current[
                Math.min(active + 1, options.length - 1)
              ]?.focus();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
              optionRefs.current[Math.max(active - 1, 0)]?.focus();
            } else if (e.key === "Home") {
              e.preventDefault();
              setActive(0);
              optionRefs.current[0]?.focus();
            } else if (e.key === "End") {
              e.preventDefault();
              setActive(options.length - 1);
              optionRefs.current[options.length - 1]?.focus();
            } else if (e.key === "Enter") {
              e.preventDefault();
              const opt = options[active] ?? options[selectedIdx] ?? options[0];
              onChange(opt.value);
              setIsOpen(false);
              onEnter?.(e.shiftKey ? -1 : 1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setIsOpen(false);
            } else if (e.key === "Tab") {
              e.preventDefault();
              setIsOpen(false);
              onEnter?.(e.shiftKey ? -1 : 1);
            }
          }}
        >
          {options.map((option, i) => (
            <button
              key={option.value}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={[
                "w-full text-left px-3 py-1.5 text-sm transition-all duration-100 outline-none",
                i === active
                  ? // Active (keyboard): brand gradient highlight
                    "bg-gradient-to-r from-[rgba(32,183,255,0.18)] to-[rgba(176,38,255,0.14)] text-[var(--kyn-text)] border-l-2 border-[var(--kyn-primary)]"
                  : value === option.value
                    ? // Selected (current value): subtle primary tint
                      "bg-[rgba(32,183,255,0.08)] text-[var(--kyn-primary)] border-l-2 border-[var(--kyn-primary)]"
                    : // Default
                      "text-[var(--kyn-text-soft)] hover:bg-[var(--kyn-surface-3)] hover:text-[var(--kyn-text)] border-l-2 border-transparent",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
