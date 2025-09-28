// src/components/ui/SearchableDropdown.tsx
"use client";
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  forwardRef,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type React from "react";

interface Option {
  value: string;
  label: string;
}

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  controlClassName?: string;
  menuClassName?: string;
  inputClassName?: string;
  optionClassName?: string;
  allowCustom?: boolean;
  onCreate?: (value: string) => void;
  onEnter?: () => void;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> &
    Record<string, any>;
}

const SearchableDropdown = forwardRef<
  HTMLButtonElement,
  SearchableDropdownProps
>(
  (
    {
      value,
      onChange,
      options,
      placeholder = "Select...",
      className = "",
      controlClassName = "",
      menuClassName = "",
      inputClassName = "",
      optionClassName = "",
      allowCustom,
      onCreate,
      onEnter,
      buttonProps,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);

    useEffect(() => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(buttonRef.current);
      } else {
        (ref as any).current = buttonRef.current;
      }
    }, [ref]);

    const selectedLabel =
      options.find((opt) => opt.value === value)?.label || placeholder;

    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const createFromSearch = () => {
      const v = searchTerm.trim();
      if (!v) return;
      onChange(v);
      onCreate?.(v);
      setIsOpen(false);
      onEnter?.();
    };

    useEffect(() => {
      function handleClickOutside(e: PointerEvent) {
        const t = e.target as Node | null;
        if (
          (rootRef.current && rootRef.current.contains(t)) ||
          (menuRef.current && menuRef.current.contains(t))
        ) {
          return;
        }
        setIsOpen(false);
      }
      document.addEventListener("pointerdown", handleClickOutside);
      return () =>
        document.removeEventListener("pointerdown", handleClickOutside);
    }, []);

    useEffect(() => {
      if (isOpen) {
        setSearchTerm("");
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          const el = searchInputRef.current;
          if (el) el.setSelectionRange(el.value.length, el.value.length);
        });
        setActive(0);
      }
    }, [isOpen]);

    const handleButtonKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (
      e
    ) => {
      if (isOpen) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) return;
        setIsOpen(true);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen(true);
        requestAnimationFrame(() => {
          setSearchTerm(e.key);
          searchInputRef.current?.focus();
        });
      } else if (e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    // ====== PORTAL POSITIONING ======
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const recalcPosition = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const maxHeight = Math.min(240, window.innerHeight - rect.bottom - 8); // keep on screen
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: Math.max(
          8,
          Math.min(rect.left, window.innerWidth - rect.width - 8)
        ),
        width: rect.width,
        maxHeight,
        zIndex: 9999,
      } as React.CSSProperties);
    };

    useLayoutEffect(() => {
      if (!isOpen) return;
      recalcPosition();
      const onAnyScroll = () => recalcPosition();
      const onResize = () => recalcPosition();
      window.addEventListener("scroll", onAnyScroll, true);
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("scroll", onAnyScroll, true);
        window.removeEventListener("resize", onResize);
      };
    }, [isOpen]);

    return (
      <div className={`relative ${className}`} ref={rootRef}>
        <button
          ref={buttonRef}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsOpen((p) => !p)}
          onKeyDown={(e) => {
            buttonProps?.onKeyDown?.(e);
            handleButtonKeyDown(e);
          }}
          {...buttonProps}
          className={
            "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 " +
            "focus:ring-averix-red-light focus:border-transparent flex items-center " +
            "justify-between bg-white hover:border-gray-400 transition-colors " +
            controlClassName
          }
        >
          <span
            className={`truncate text-left ${
              value ? "text-gray-900" : "text-gray-500"
            }`}
          >
            {selectedLabel}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transform transition-transform duration-200 ml-2 flex-shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* ====== PORTAL MENU ====== */}
        {isOpen &&
          createPortal(
            <div
              ref={menuRef}
              onPointerDown={(e) => e.stopPropagation()}
              style={menuStyle}
              className={
                "bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden " +
                "max-h-60 flex flex-col " +
                "z-[9999] " +
                menuClassName
              }
            >
              <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={
                    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm " +
                    "focus:outline-none focus:ring-2 focus:ring-averix-red-light " +
                    "focus:border-transparent " +
                    inputClassName
                  }
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActive((a) =>
                        Math.min(a + 1, Math.max(0, filteredOptions.length - 1))
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((a) => Math.max(a - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (filteredOptions.length) {
                        const opt =
                          filteredOptions[active] ?? filteredOptions[0];
                        onChange(opt.value);
                        setIsOpen(false);
                        onEnter?.();
                      } else if (allowCustom) {
                        createFromSearch();
                      }
                    }
                  }}
                />
              </div>

              <div className="overflow-y-auto">
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      setIsOpen(false);
                      onEnter?.();
                    }}
                    className={
                      "w-full text-left px-3 py-2 text-sm text-gray-500 " +
                      "hover:bg-gray-100 border-b border-gray-100 cursor-pointer " +
                      optionClassName
                    }
                  >
                    Clear selection
                  </button>
                )}

                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt, i) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        onEnter?.();
                      }}
                      className={
                        "w-full text-left px-3 py-2 text-sm transition-colors duration-150 cursor-pointer " +
                        (i === active
                          ? "bg-averix-red-light text-white font-medium "
                          : value === opt.value
                          ? "bg-averix-red-light/20 text-gray-900"
                          : "text-gray-900 hover:bg-gray-100 ") +
                        optionClassName
                      }
                    >
                      {opt.label}
                    </button>
                  ))
                ) : (
                  <div
                    className={
                      "px-3 py-2 text-gray-400 text-sm text-center " +
                      optionClassName
                    }
                  >
                    No results found
                  </div>
                )}

                {allowCustom && searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={createFromSearch}
                    className={
                      "w-full text-left px-3 py-2 text-sm text-averix-red-dark " +
                      "hover:bg-averix-red-light/10 border-t border-gray-100 cursor-pointer " +
                      optionClassName
                    }
                  >
                    Use "{searchTerm.trim()}"
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }
);

SearchableDropdown.displayName = "SearchableDropdown";
export default SearchableDropdown;
