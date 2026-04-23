// src/components/ui/Pagination.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
};

export default function Pagination({
  page,
  total,
  pageSize,
  onPageChange,
  className = "",
  itemLabel = "items",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  const getPages = (): (number | "…")[] => {
    const pages: (number | "…")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (page > 3) pages.push("…");

    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      pages.push(i);
    }

    if (page < totalPages - 2) pages.push("…");

    pages.push(totalPages);

    return pages;
  };

  const btnBase =
    "flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2.5 text-sm font-medium transition select-none";

  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={`flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row ${className}`}
    >
      <span className="text-xs text-slate-400">
        Showing {from}–{to} of{" "}
        <span className="font-semibold text-slate-600">{total}</span>{" "}
        {itemLabel}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${btnBase} gap-1 border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>

        {getPages().map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`${btnBase} ${
                p === page
                  ? "bg-[#1e3a5f] text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} gap-1 border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
