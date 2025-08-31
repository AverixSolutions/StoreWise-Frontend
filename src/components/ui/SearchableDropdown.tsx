// src/components/ui/SearchableDropdown.tsx
"use client";

import { useState, useRef, useEffect } from "react";
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
}

export default function SearchableDropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || placeholder;

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setSearchTerm("");
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleClearSelection = () => {
    onChange("");
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="border border-gray-200 rounded-lg px-4 py-2 w-56 flex items-center justify-between bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-averix-red-light focus:border-averix-red-light transition-all duration-200"
      >
        <span
          className={`truncate max-w-[85%] text-left ${
            value ? "text-gray-900" : "text-gray-500"
          }`}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transform transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {/* Search input */}
          <div className="sticky top-0 bg-white p-3 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-averix-red-light focus:border-averix-red-light"
            />
          </div>

          {/* Options list */}
          <div className="max-h-40 overflow-y-auto no-scrollbar">
            {/* Clear option (if there's a selected value) */}
            {value && (
              <>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 border-b border-gray-100 cursor-pointer"
                >
                  Clear selection
                </button>
              </>
            )}

            {/* Filtered options */}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleOptionClick(opt.value)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 cursor-pointer ${
                    value === opt.value
                      ? "bg-averix-red-light text-white font-medium"
                      : "text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-gray-400 text-sm text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
