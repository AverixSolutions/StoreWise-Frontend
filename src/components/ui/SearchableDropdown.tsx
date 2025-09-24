// src/components/ui/SearchableDropdown.tsx
"use client";
import { useState, useRef, useEffect, forwardRef } from "react";
import { ChevronDown } from "lucide-react";

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
  allowCustom?: boolean;
  onCreate?: (value: string) => void;
  onEnter?: () => void;
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
      allowCustom,
      onCreate,
      onEnter,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

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
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      }
      document.addEventListener("pointerdown", handleClickOutside);
      return () => {
        document.removeEventListener("pointerdown", handleClickOutside);
      };
    }, []);

    useEffect(() => {
      if (isOpen) {
        setSearchTerm("");
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          const el = searchInputRef.current;
          if (el) el.setSelectionRange(el.value.length, el.value.length);
        });
      }
    }, [isOpen]);

    const handleOptionClick = (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
      onEnter?.();
    };

    const handleClearSelection = () => {
      onChange("");
      setIsOpen(false);
      onEnter?.();
    };

    const handleButtonKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (
      e
    ) => {
      if (isOpen) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          return;
        }
        setIsOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const ch = e.key;
        setIsOpen(true);
        requestAnimationFrame(() => {
          setSearchTerm(ch);
          searchInputRef.current?.focus();
        });
      } else if (e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };

    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          ref={ref}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setIsOpen((prev) => {
              const next = !prev;
              if (next) {
                requestAnimationFrame(() => searchInputRef.current?.focus());
              }
              return next;
            });
          }}
          onKeyDown={handleButtonKeyDown}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-averix-red-light focus:border-transparent flex items-center justify-between bg-white hover:border-gray-400 transition-colors"
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

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden">
            <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-averix-red-light focus:border-transparent"
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (
                    allowCustom &&
                    e.key === "Enter" &&
                    !filteredOptions.length
                  ) {
                    e.preventDefault();
                    createFromSearch();
                  }
                }}
              />
            </div>

            <div className="max-h-40 overflow-y-auto">
              {value && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 border-b border-gray-100 cursor-pointer"
                >
                  Clear selection
                </button>
              )}

              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleOptionClick(opt.value)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 cursor-pointer ${
                      value === opt.value
                        ? "bg-averix-red-light text-white font-medium"
                        : "text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-gray-400 text-sm text-center">
                  No results found
                </div>
              )}

              {allowCustom && searchTerm.trim() && (
                <button
                  type="button"
                  onClick={createFromSearch}
                  className="w-full text-left px-3 py-2 text-sm text-averix-red-dark hover:bg-averix-red-light/10 border-t border-gray-100 cursor-pointer"
                >
                  Use "{searchTerm.trim()}"
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

SearchableDropdown.displayName = "SearchableDropdown";

export default SearchableDropdown;
