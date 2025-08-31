// src/components/ui/Dropdown.tsx
"use client";
import { useState, useRef, useEffect, forwardRef } from "react";
import { ChevronDown } from "lucide-react";

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
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState<number>(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
          setHighlightIndex(-1);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find((option) => option.value === value);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "Enter") {
          e.preventDefault();
          setIsOpen(true);
          setHighlightIndex(0);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const option =
          highlightIndex >= 0 ? options[highlightIndex] : options[0];
        if (option) {
          onChange(option.value);
        }
        setIsOpen(false);
        setHighlightIndex(-1);
        onEnter?.();
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    };

    return (
      <div className={`relative w-full ${className}`} ref={dropdownRef}>
        {/* Trigger */}
        <button
          ref={ref} // 👈 forward the ref here
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full flex items-center justify-between border-2 rounded-lg px-3 py-3 bg-white focus:outline-none transition-colors ${
            error
              ? "border-red-300 focus:border-red-500"
              : "border-gray-200 focus:border-averix-red-dark"
          }`}
        >
          <span
            className={`${selectedOption ? "text-gray-800" : "text-gray-400"}`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={`ml-2 h-4 w-4 text-gray-500 transition-transform duration-200 ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>

        {/* Dropdown list */}
        {isOpen && (
          <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
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
                  className={`w-full text-left px-3 py-3 cursor-pointer transition-colors ${
                    idx === highlightIndex
                      ? "bg-averix-red-dark text-white"
                      : value === option.value
                      ? "bg-averix-red-light text-white"
                      : "text-gray-700 hover:bg-averix-red-light hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default Dropdown;
