// src/components/ui/Pagination.tsx
"use client";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  page,
  total,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const delta = 2;
    const pages: (number | string)[] = [];

    for (
      let i = Math.max(1, page - delta);
      i <= Math.min(totalPages, page + delta);
      i++
    ) {
      pages.push(i);
    }

    if (page - delta > 2) {
      pages.unshift("...");
    }
    if (page + delta < totalPages - 1) {
      pages.push("...");
    }
    if (page > delta + 1) {
      pages.unshift(1);
    }
    if (page < totalPages - delta) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 py-4 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/50">
      <div className="text-sm text-gray-600 order-2 sm:order-1">
        <span className="font-medium text-gray-900">
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
        </span>
        <span className="mx-1">of</span>
        <span className="font-medium text-gray-900">
          {total.toLocaleString()}
        </span>
        <span className="ml-1">entries</span>
      </div>

      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          disabled={page === 1}
          onClick={() => onPageChange(1)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:shadow-none transition-all duration-200"
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:shadow-none transition-all duration-200"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 mx-2">
          {getVisiblePages().map((p, idx) =>
            typeof p === "number" ? (
              <button
                key={idx}
                onClick={() => onPageChange(p)}
                className={`min-w-[40px] h-10 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  page === p
                    ? "bg-averix-red-dark text-white shadow-md hover:bg-averix-red-accent transform hover:scale-105"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm"
                }`}
                title={`Go to page ${p}`}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="px-2 py-2 text-gray-400 text-sm">
                {p}
              </span>
            )
          )}
        </div>

        <button
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:shadow-none transition-all duration-200"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          disabled={page === totalPages}
          onClick={() => onPageChange(totalPages)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:shadow-none transition-all duration-200"
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
