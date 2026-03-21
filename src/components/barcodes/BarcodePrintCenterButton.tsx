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
          "inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
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
