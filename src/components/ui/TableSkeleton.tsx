// src/components/ui/TableSkeleton.tsx
"use client";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export default function TableSkeleton({
  columns,
  rows = 5,
}: TableSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
      <table className="w-full text-sm text-gray-700">
        <thead className="bg-gray-100">
          <tr>
            {Array.from({ length: columns }).map((_, idx) => (
              <th
                key={idx}
                className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-400"
              >
                <div className="h-4 w-20 bg-gray-200 animate-pulse rounded"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="bg-white">
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
