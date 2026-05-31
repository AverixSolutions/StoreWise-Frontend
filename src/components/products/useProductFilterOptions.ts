// src/components/products/useProductFilterOptions.tsx
"use client";

import { useEffect, useState } from "react";
import { platform } from "@/platform";
import type { CategoryRecord } from "@/platform/types";

export function useProductFilterOptions({
  licenseId,
  refreshTrigger,
  enabled = true,
}: {
  licenseId: string;
  refreshTrigger: number;
  enabled?: boolean;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [categoryRecords, setCategoryRecords] = useState<CategoryRecord[]>([]);

  useEffect(() => {
    if (!enabled || !licenseId) return;

    Promise.all([
      platform.getProducts(licenseId, { page: 1, pageSize: 1000 }),
      platform.listCategories(licenseId),
      platform.listBrands(licenseId),
    ])
      .then(([productsResult, categoriesResult, brandsResult]) => {
        setProductNames(productsResult.products.map((p) => p.name));

        const productCategories = productsResult.products
          .map((p) => p.category)
          .filter((category): category is string => !!category);

        const productSubcategories = productsResult.products
          .map((p) => p.subcategory)
          .filter((subcategory): subcategory is string => !!subcategory);

        if (categoriesResult.success) {
          setCategoryRecords(categoriesResult.rows);

          const masterParentCategories = categoriesResult.rows
            .filter((row) => !row.parentId && !row.deletedAt)
            .map((row) => row.name);

          const masterSubcategories = categoriesResult.rows
            .filter((row) => !!row.parentId && !row.deletedAt)
            .map((row) => row.name);

          setCategories(
            Array.from(
              new Set([...masterParentCategories, ...productCategories]),
            ).sort((a, b) => a.localeCompare(b)),
          );

          setSubcategories(
            Array.from(
              new Set([...masterSubcategories, ...productSubcategories]),
            ).sort((a, b) => a.localeCompare(b)),
          );
        } else {
          setCategoryRecords([]);

          setCategories(
            Array.from(new Set(productCategories)).sort((a, b) =>
              a.localeCompare(b),
            ),
          );

          setSubcategories(
            Array.from(new Set(productSubcategories)).sort((a, b) =>
              a.localeCompare(b),
            ),
          );
        }

        const productBrands = productsResult.products
          .map((p) => p.brand)
          .filter((brand): brand is string => !!brand);

        const masterBrands = brandsResult.success
          ? brandsResult.rows.map((row) => row.name)
          : [];

        setBrands(
          Array.from(new Set([...masterBrands, ...productBrands])).sort(
            (a, b) => a.localeCompare(b),
          ),
        );
      })
      .catch(console.error);
  }, [enabled, licenseId, refreshTrigger]);

  return {
    categories,
    brands,
    subcategories,
    productNames,
    categoryRecords,
  };
}
