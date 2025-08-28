// src/components/ui/Dropdown.tsx
"use client";
import { useState, useRef, useEffect } from "react";
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
}

export default function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  required = false,
  className = "",
  error = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border-2 rounded-lg px-3 py-3 bg-white focus:outline-none transition-colors ${
          error
            ? "border-red-300 focus:border-red-500"
            : value
            ? "border-gray-200 focus:border-averix-red-dark"
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
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-3 cursor-pointer transition-colors hover:bg-averix-red-light hover:text-white ${
                  value === option.value
                    ? "bg-averix-red-dark text-white"
                    : "text-gray-700"
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
