// src/components/ui/RoleDropdown.tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface RoleDropdownProps {
  value: "admin" | "supervisor" | "user" | null;
  onChange: (val: "admin" | "supervisor" | "user") => void;
}

export default function RoleDropdown({ value, onChange }: RoleDropdownProps) {
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

  const options: ("admin" | "supervisor" | "user")[] = [
    "user",
    "supervisor",
    "admin",
  ];

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border rounded-xl px-4 py-3 shadow-md bg-white focus:ring-2 focus:ring-averix-red-light outline-none transition ${
          value ? "border-gray-300" : "border-red-300"
        }`}
      >
        <span
          className={`capitalize ${
            value ? "text-gray-800" : "text-gray-400 italic"
          }`}
        >
          {value ? value : "Select a Role"}
        </span>
        <ChevronDown
          className={`ml-2 text-gray-500 transition-transform duration-300 ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      {/* Dropdown list */}
      {isOpen && (
        <ul className="absolute mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-fadeIn z-10">
          {options.map((option) => (
            <li
              key={option}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              className={`px-4 py-3 cursor-pointer transition hover:bg-red-300 hover:text-white ${
                value === option
                  ? "bg-averix-red-vivid text-white"
                  : "text-gray-700"
              }`}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
