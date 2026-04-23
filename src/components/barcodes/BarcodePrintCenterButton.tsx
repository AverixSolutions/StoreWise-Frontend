// src/components/barcode/BarcodePrintCenterButton.tsx
"use client";

import { useState } from "react";
import { Tags } from "lucide-react";
import BarcodePrintCenterModal from "./BarcodePrintCenterModal";
import type { PrintCenterItemRow } from "@/lib/barcode/printCenterTypes";

type Props = {
  licenseId: string;
  initialRows?: PrintCenterItemRow[];
  buttonText?: string;
  className?: string;
  defaultShopName?: string;
};

export default function BarcodePrintCenterButton({
  licenseId,
  initialRows = [],
  buttonText = "Print Barcodes",
  className = "",
  defaultShopName,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition hover:bg-white/[0.12] cursor-pointer"
        }
      >
        <Tags className="h-4 w-4" />
        {buttonText}
      </button>

      <BarcodePrintCenterModal
        open={open}
        onClose={() => setOpen(false)}
        licenseId={licenseId}
        initialRows={initialRows}
        defaultShopName={defaultShopName}
      />
    </>
  );
}
