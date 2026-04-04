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
import { ChevronDown, Search } from "lucide-react";
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
  onEnter?: (dir: 1 | -1) => void;
  autoOpenOnFocus?: boolean;
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
      autoOpenOnFocus = true,
      buttonProps,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

    useEffect(() => {
      if (!ref) return;
      if (typeof ref === "function") ref(buttonRef.current);
      else (ref as any).current = buttonRef.current;
    }, [ref]);

    const selectedLabel =
      options.find((opt) => opt.value === value)?.label || placeholder;

    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    useEffect(() => {
      const el = optionRefs.current[active];
      if (el) el.scrollIntoView({ block: "nearest" });
    }, [active, isOpen, filteredOptions.length]);

    const createFromSearch = () => {
      const v = searchTerm.trim();
      if (!v) return;
      onChange(v);
      onCreate?.(v);
      setIsOpen(false);
      onEnter?.(1);
    };

    useEffect(() => {
      function onFocusIn(e: FocusEvent) {
        const t = e.target as Node | null;
        if (
          (rootRef.current && rootRef.current.contains(t)) ||
          (menuRef.current && menuRef.current.contains(t))
        )
          return;
        setIsOpen(false);
      }
      document.addEventListener("focusin", onFocusIn);
      return () => document.removeEventListener("focusin", onFocusIn);
    }, []);

    useEffect(() => {
      function handleClickOutside(e: PointerEvent) {
        const t = e.target as Node | null;
        if (
          (rootRef.current && rootRef.current.contains(t)) ||
          (menuRef.current && menuRef.current.contains(t))
        )
          return;
        setIsOpen(false);
      }
      document.addEventListener("pointerdown", handleClickOutside);
      return () =>
        document.removeEventListener("pointerdown", handleClickOutside);
    }, []);

    useEffect(() => {
      if (isOpen) {
        setSearchTerm("");
        setActive(0);
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          const el = searchInputRef.current;
          if (el) el.setSelectionRange(el.value.length, el.value.length);
        });
      }
    }, [isOpen]);

    const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (isOpen) return false;
      if (e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
        return true;
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen(true);
        requestAnimationFrame(() => {
          setSearchTerm(e.key);
          searchInputRef.current?.focus();
        });
        return true;
      } else if (e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        return true;
      }
      return false;
    };

    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const recalcPosition = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const maxHeight = Math.min(260, window.innerHeight - rect.bottom - 8);
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: Math.max(
          8,
          Math.min(rect.left, window.innerWidth - rect.width - 8),
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
      window.addEventListener("scroll", onAnyScroll, true);
      window.addEventListener("resize", recalcPosition);
      return () => {
        window.removeEventListener("scroll", onAnyScroll, true);
        window.removeEventListener("resize", recalcPosition);
      };
    }, [isOpen]);

    const hasValue = !!value;

    return (
      <div className={`relative ${className}`} ref={rootRef}>
        <button
          ref={buttonRef}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onFocus={() => {
            if (autoOpenOnFocus) setIsOpen(true);
          }}
          onClick={() => setIsOpen((p) => !p)}
          onKeyDown={(e) => {
            const handled = handleButtonKeyDown(e);
            if (!handled) buttonProps?.onKeyDown?.(e);
          }}
          {...buttonProps}
          className={[
            "w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5",
            "bg-white/80 text-sm outline-none transition",
            "focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10",
            hasValue
              ? "border-cyan-300/60 text-slate-900"
              : "border-slate-200 text-slate-400",
            buttonProps?.className || "",
          ].join(" ")}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? "sd-menu" : undefined}
          aria-haspopup="listbox"
        >
          <span
            className={`truncate text-left text-sm ${hasValue ? "text-slate-900" : "text-slate-400"}`}
          >
            {selectedLabel}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ml-2 shrink-0 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen &&
          createPortal(
            <div
              ref={menuRef}
              onPointerDown={(e) => e.stopPropagation()}
              style={menuStyle}
              className={[
                "overflow-hidden rounded-[16px] border border-slate-200 bg-white",
                "shadow-[0_20px_50px_rgba(3,10,24,0.14)]",
                "flex flex-col z-[9999]",
                menuClassName,
              ].join(" ")}
            >
              {/* Search input */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-3 pt-3 pb-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search…"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setActive(0);
                    }}
                    className={[
                      "w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs",
                      "text-slate-900 placeholder:text-slate-400 outline-none",
                      "focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10 transition",
                      inputClassName,
                    ].join(" ")}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActive((a) =>
                          Math.min(
                            a + 1,
                            Math.max(0, filteredOptions.length - 1),
                          ),
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActive((a) => Math.max(a - 1, 0));
                      } else if (e.key === "Home") {
                        e.preventDefault();
                        setActive(0);
                      } else if (e.key === "End") {
                        e.preventDefault();
                        setActive(Math.max(0, filteredOptions.length - 1));
                      } else if (e.key === "PageDown") {
                        e.preventDefault();
                        setActive((a) =>
                          Math.min(
                            a + 10,
                            Math.max(0, filteredOptions.length - 1),
                          ),
                        );
                      } else if (e.key === "PageUp") {
                        e.preventDefault();
                        setActive((a) => Math.max(a - 10, 0));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        if (filteredOptions.length) {
                          const opt =
                            filteredOptions[active] ?? filteredOptions[0];
                          onChange(opt.value);
                          setIsOpen(false);
                          onEnter?.(e.shiftKey ? -1 : 1);
                        } else if (allowCustom) {
                          createFromSearch();
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setIsOpen(false);
                      } else if (e.key === "Tab") {
                        setIsOpen(false);
                      }
                    }}
                    role="combobox"
                    aria-controls="sd-menu"
                    aria-autocomplete="list"
                    aria-expanded={true}
                  />
                </div>
              </div>

              <div id="sd-menu" role="listbox" className="overflow-y-auto">
                {/* Clear option */}
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      setIsOpen(false);
                    }}
                    className="w-full cursor-pointer border-b border-slate-100 px-3.5 py-2 text-left text-xs font-medium text-slate-400 transition hover:bg-slate-50"
                  >
                    Clear selection
                  </button>
                )}

                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt, i) => (
                    <button
                      key={opt.value}
                      ref={(el) => {
                        optionRefs.current[i] = el;
                      }}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={[
                        "w-full cursor-pointer px-3.5 py-2.5 text-left text-sm transition-colors",
                        i === active
                          ? "bg-slate-900 text-white font-medium"
                          : value === opt.value
                            ? "bg-cyan-50 text-cyan-800 font-medium"
                            : "text-slate-700 hover:bg-slate-50",
                        optionClassName,
                      ].join(" ")}
                      role="option"
                      aria-selected={i === active}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onChange(opt.value);
                          setIsOpen(false);
                          onEnter?.(e.shiftKey ? -1 : 1);
                        }
                      }}
                    >
                      {opt.label}
                    </button>
                  ))
                ) : (
                  <div className="px-3.5 py-4 text-center text-sm text-slate-400">
                    No results found
                  </div>
                )}

                {allowCustom && searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={createFromSearch}
                    className={[
                      "w-full cursor-pointer border-t border-slate-100 px-3.5 py-2.5 text-left text-sm",
                      "text-cyan-600 font-medium transition hover:bg-cyan-50",
                      optionClassName,
                    ].join(" ")}
                  >
                    Use &ldquo;{searchTerm.trim()}&rdquo;
                  </button>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  },
);

SearchableDropdown.displayName = "SearchableDropdown";
export default SearchableDropdown;
