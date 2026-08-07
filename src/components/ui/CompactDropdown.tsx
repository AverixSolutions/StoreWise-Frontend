// src/components/ui/CompactDropdown.tsx
"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type React from "react";

interface CompactDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  selectedLabel?: string;
  className?: string;
  menuClassName?: string;
  menuPortal?: boolean;
  menuMinWidth?: number;
  hideMenuScrollbar?: boolean;
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
  selectedLabel,
  className = "",
  menuClassName = "",
  menuPortal = false,
  menuMinWidth = 0,
  hideMenuScrollbar = false,
  buttonProps = {},
  onEnter,
  autoOpenOnFocus = true,
}: CompactDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const wasPointerDown = useRef(false);

  const {
    className: buttonClassName,
    onKeyDown: externalOnKeyDown,
    ...restButtonProps
  } = buttonProps;

  const selectedIdx = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedOption = options.find((option) => option.value === value);

  function closeAndMove(direction: 1 | -1) {
    setIsOpen(false);
    window.setTimeout(() => onEnter?.(direction), 0);
  }

  function closeAndRefocus() {
    setIsOpen(false);
    window.setTimeout(
      () => buttonRef.current?.focus({ preventScroll: true }),
      0,
    );
  }

  function recalcPortalPosition() {
    if (!menuPortal) return;
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const viewportPadding = 8;
    const desiredWidth = Math.min(
      Math.max(rect.width, menuMinWidth),
      Math.max(120, window.innerWidth - viewportPadding * 2),
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openAbove = spaceBelow < 144 && spaceAbove > spaceBelow;
    const availableHeight = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(96, Math.min(240, availableHeight - 4));
    const left = Math.max(
      viewportPadding,
      Math.min(rect.left, window.innerWidth - desiredWidth - viewportPadding),
    );

    setMenuStyle(
      openAbove
        ? {
            position: "fixed",
            bottom: window.innerHeight - rect.top + 4,
            left,
            width: desiredWidth,
            maxHeight,
            zIndex: 99999,
          }
        : {
            position: "fixed",
            top: rect.bottom + 4,
            left,
            width: desiredWidth,
            maxHeight,
            zIndex: 99999,
          },
    );
  }

  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      const target = event.target as Node | null;
      if (
        (dropdownRef.current && dropdownRef.current.contains(target)) ||
        (menuRef.current && menuRef.current.contains(target))
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

  useLayoutEffect(() => {
    if (!isOpen || !menuPortal) return;
    recalcPortalPosition();
    const onViewportChange = () => recalcPortalPosition();
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [isOpen, menuPortal, menuMinWidth]);

  useEffect(() => {
    if (!isOpen) return;
    setActive(selectedIdx >= 0 ? selectedIdx : 0);
    requestAnimationFrame(() => {
      const element = optionRefs.current[selectedIdx] || optionRefs.current[0];
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: "nearest" });
    });
  }, [isOpen, selectedIdx]);

  useEffect(() => {
    if (!isOpen) return;
    const element = optionRefs.current[active];
    element?.scrollIntoView({ block: "nearest" });
  }, [active, isOpen]);

  function handleButtonKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
  ): boolean {
    if (
      (event.key === "Enter" || event.key === "NumpadEnter") &&
      event.shiftKey &&
      onEnter
    ) {
      event.preventDefault();
      event.stopPropagation();
      closeAndMove(-1);
      return true;
    }

    if (event.key === "Tab" && onEnter) {
      event.preventDefault();
      event.stopPropagation();
      closeAndMove(event.shiftKey ? -1 : 1);
      return true;
    }

    if (isOpen) return false;

    if (
      event.key === "Enter" ||
      event.key === "NumpadEnter" ||
      event.key === "ArrowDown" ||
      event.key === " "
    ) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(true);
      return true;
    }

    return false;
  }

  const menu = isOpen ? (
    <div
      ref={menuRef}
      style={menuPortal ? menuStyle : undefined}
      className={[
        menuPortal
          ? "fixed z-[99999]"
          : "absolute left-0 right-0 top-full z-[9999] mt-1",
        "max-h-60 overflow-y-auto rounded-md",
        hideMenuScrollbar
          ? "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "",
        "border border-[var(--kyn-border)] bg-[var(--kyn-surface-2)]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_var(--kyn-glow-primary)]",
        menuClassName,
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          const next = Math.min(active + 1, options.length - 1);
          setActive(next);
          optionRefs.current[next]?.focus();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          const next = Math.max(active - 1, 0);
          setActive(next);
          optionRefs.current[next]?.focus();
        } else if (event.key === "Home") {
          event.preventDefault();
          setActive(0);
          optionRefs.current[0]?.focus();
        } else if (event.key === "End") {
          event.preventDefault();
          const next = Math.max(0, options.length - 1);
          setActive(next);
          optionRefs.current[next]?.focus();
        } else if (event.key === "Enter" || event.key === "NumpadEnter") {
          event.preventDefault();
          event.stopPropagation();
          const option = options[active] ?? options[selectedIdx] ?? options[0];
          if (!option) return;
          onChange(option.value);
          closeAndMove(event.shiftKey ? -1 : 1);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeAndRefocus();
        } else if (event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          closeAndMove(event.shiftKey ? -1 : 1);
        }
      }}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            optionRefs.current[index] = element;
          }}
          type="button"
          title={option.label}
          onClick={() => {
            onChange(option.value);
            closeAndRefocus();
          }}
          className={[
            "w-full px-3 py-1.5 text-left text-sm outline-none transition-all duration-100",
            index === active
              ? "border-l-2 border-[var(--kyn-primary)] bg-gradient-to-r from-[rgba(32,183,255,0.18)] to-[rgba(176,38,255,0.14)] text-[var(--kyn-text)]"
              : value === option.value
                ? "border-l-2 border-[var(--kyn-primary)] bg-[rgba(32,183,255,0.08)] text-[var(--kyn-primary)]"
                : "border-l-2 border-transparent text-[var(--kyn-text-soft)] hover:bg-[var(--kyn-surface-3)] hover:text-[var(--kyn-text)]",
          ].join(" ")}
        >
          <span className="block truncate">{option.label}</span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        {...restButtonProps}
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onMouseDown={() => {
          wasPointerDown.current = true;
          setTimeout(() => (wasPointerDown.current = false), 0);
        }}
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => {
          if (autoOpenOnFocus && !wasPointerDown.current) setIsOpen(true);
        }}
        className={[
          "flex w-full min-w-0 items-center justify-between",
          "rounded-md px-3 py-1.5 text-sm",
          "border border-[var(--kyn-border)] bg-[var(--kyn-surface-2)]",
          "text-[var(--kyn-text-soft)]",
          "outline-none transition-all duration-150",
          isOpen
            ? "border-[var(--kyn-primary)] shadow-[0_0_0_2px_var(--kyn-glow-primary)]"
            : "hover:border-[rgba(93,135,201,0.35)] hover:shadow-[0_0_0_1px_var(--kyn-glow-primary)]",
          buttonClassName || "",
        ]
          .filter(Boolean)
          .join(" ")}
        onKeyDown={(event) => {
          const handled = handleButtonKeyDown(event);
          if (!handled) externalOnKeyDown?.(event);
        }}
      >
        <span
          className={[
            "min-w-0 flex-1 truncate pr-2 text-left",
            selectedOption
              ? "text-[var(--kyn-text)]"
              : "text-[var(--kyn-text-muted)]",
          ].join(" ")}
          title={selectedLabel || selectedOption?.label || placeholder}
        >
          {selectedLabel || selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[var(--kyn-text-muted)] transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[var(--kyn-primary)]" : ""
          }`}
        />
      </button>

      {menuPortal && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}
