// src/components/products/ProductFormModal.tsx
"use client";

import ProductFormPanel from "@/components/products/ProductFormPanel";
import type { CategoryRecord, ProductSummary } from "@/platform/types";

type Product = ProductSummary;

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProduct?: Product | null;
  existingCategories?: string[];
  existingBrands?: string[];
  categoryRecords?: CategoryRecord[];
  initialTab?: "single" | "bulk";
}

export default function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  editProduct,
  existingCategories = [],
  existingBrands = [],
  categoryRecords = [],
  initialTab = "single",
}: ProductFormModalProps) {
  if (!isOpen) return null;

  return (
    <ProductFormPanel
      mode="modal"
      formId="product-form-modal"
      initialTab={initialTab}
      onCancel={onClose}
      onClear={onClose}
      onSuccess={onSuccess}
      editProduct={editProduct}
      existingCategories={existingCategories}
      existingBrands={existingBrands}
      categoryRecords={categoryRecords}
    />
  );
}
