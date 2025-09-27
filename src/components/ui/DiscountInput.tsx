// src/components/ui/DiscountInput.tsx
"use client";
import CompactDropdown from "./CompactDropdown";
import { DiscountType } from "../purchase/types";

interface DiscountInputProps {
  discountType: DiscountType;
  discount: number;
  onDiscountTypeChange: (type: DiscountType) => void;
  onDiscountChange: (value: number) => void;
}

export default function DiscountInput({
  discountType,
  discount,
  onDiscountTypeChange,
  onDiscountChange,
}: DiscountInputProps) {
  const discountOptions = [
    { value: "ABS", label: "₹" },
    { value: "PCT", label: "%" },
  ];

  return (
    <div className="flex items-center gap-1">
      <CompactDropdown
        value={discountType}
        onChange={(val) => onDiscountTypeChange(val as DiscountType)}
        options={discountOptions}
        className="w-12 flex-shrink-0"
      />
      <input
        className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:border-averix-red-dark focus:ring-1 focus:ring-averix-red-dark/20 outline-none transition-colors"
        type="number"
        value={discount || ""}
        onChange={(e) => onDiscountChange(Number(e.target.value))}
        min="0"
        step="0.01"
        placeholder="0"
      />
    </div>
  );
}
