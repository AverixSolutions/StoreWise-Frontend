// src/components/barcode/PrintLabelsButton.tsx
"use client";

import { useMemo, useState } from "react";
import PrintLabelsModal from "./PrintLabelsModal";
import { buildLabelRowsFromBatches } from "@/lib/barcode/buildLabelRows";

type BatchLike = {
  id: string;
  productId: string;
  barcode?: string | null;
  batchNo?: string | null;
  salePrice?: number | null;
  mrp?: number | null;
  productName?: string | null;
  name?: string | null;
};

type Props = {
  licenseId: string;
  selectedBatches: BatchLike[];
  buttonText?: string;
  className?: string;
};

export default function PrintLabelsButton({
  licenseId,
  selectedBatches,
  buttonText = "Print Labels",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);

  const rows = useMemo(
    () => buildLabelRowsFromBatches(selectedBatches, 1),
    [selectedBatches],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!rows.length}
        className={
          className ||
          "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {buttonText}
      </button>

      <PrintLabelsModal
        open={open}
        onClose={() => setOpen(false)}
        licenseId={licenseId}
        rows={rows}
      />
    </>
  );
}
