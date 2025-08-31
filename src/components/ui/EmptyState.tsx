// src/components/ui/EmptyState.tsx
"use client";

import { PackageX } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400">
        {icon || <PackageX size={32} />}
      </div>
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      <p className="text-gray-500 max-w-md">{description}</p>
      {action}
    </div>
  );
}
