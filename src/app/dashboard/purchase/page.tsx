// src/app/dashboard/purchase/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PurchaseNavigation from "@/components/purchase/PurchaseNavigation";
import BillDetailsSection from "@/components/purchase/BillDetailsSection";
import ItemsTableSection from "@/components/purchase/ItemsTableSection";
import SupplierFormModal from "@/components/suppliers/SupplierFormModal";
import { HeaderForm, ItemRow, Product } from "@/components/purchase/types";
import {
  createEmptyRow,
  calcRow,
  validateBill,
  mapItems,
  round2,
} from "@/components/purchase/utils";

export default function PurchasePage() {
  const router = useRouter();

  const licenseId =
    typeof window !== "undefined" ? localStorage.getItem("licenseId")! : "";
  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("userName") || "U1"
      : "U1";

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const [header, setHeader] = useState<HeaderForm>({
    billNo: "",
    supplier: null,
    department: "",
    debitAccount: "",
    natureOfEntry: "",
    purchaseDate: new Date().toISOString(),
    entryTime: new Date().toISOString(),
    discount: 0,
    purchaseType: "CREDIT",
  });

  const [rows, setRows] = useState<ItemRow[]>([createEmptyRow(1)]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await (window as any).electronAPI.getProducts(licenseId, {
        page: 1,
        pageSize: 200,
      });
      setProducts(res.products);
    })();
  }, [licenseId]);

  useEffect(() => {
    loadSuppliers();
  }, [showSupplierModal]);

  const loadSuppliers = async () => {
    const { suppliers: sups } = await (window as any).electronAPI.listSuppliers(
      licenseId,
      { q: "", page: 1, pageSize: 100 }
    );
    setSuppliers(sups.map((s: any) => ({ id: s.id, name: s.name })));
  };

  const handleSelectProduct = async (rowIndex: number, productId: string) => {
    const product = await (window as any).electronAPI.getProduct(productId);
    if (!product) return;

    setRows((prev) =>
      prev.map((r, i) =>
        i !== rowIndex
          ? r
          : {
              ...r,
              productId,
              code: product.code,
              name: product.name,
              unit: product.unit,
              taxPercent: product.tax,
              barcode: product.barcode || product.code,
              rate: Number(product.costPrice) || 0,
              salePrice:
                r.profitPercent && r.profitPercent > 0
                  ? r.salePrice
                  : product.salePrice != null
                  ? Number(product.salePrice)
                  : 0,
            }
      )
    );
  };

  useEffect(() => {
    setRows((prev) => prev.map(calcRow));
  }, [
    JSON.stringify(
      rows.map((r) => ({
        q: r.quantity,
        rate: r.rate,
        tax: r.taxPercent,
        dType: r.discountType,
        d: r.discount,
        profitPercent: r.profitPercent,
      }))
    ),
  ]);

  const subTotal = useMemo(
    () => rows.reduce((s, r) => s + (r.billedValue || 0), 0),
    [rows]
  );
  const grandTotal = useMemo(
    () => Math.max(0, subTotal - (header.discount || 0)),
    [subTotal, header.discount]
  );

  const addRow = () =>
    setRows((prev) => [...prev, createEmptyRow(prev.length + 1)]);
  const removeRow = (index: number) =>
    setRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, lineNo: i + 1 }))
    );

  const priceUpdateSettings = {
    updatePricesAfterSave: true,
    updateCostFromPurchase: true,
    updateUnitFromPurchase: true,
  };

  const handleSave = async () => {
    const items = mapItems(rows);
    const errs = validateBill(header, items);
    if (errs.length) {
      alert("Please fix the following:\n\n• " + errs.join("\n• "));
      return false;
    }

    const purchase = {
      billNo: header.billNo || null,
      supplierId: header.supplier!.id,
      supplierName: header.supplier!.name,
      department: header.department || null,
      debitAccount: header.debitAccount || null,
      natureOfEntry: header.natureOfEntry || null,
      purchaseDate: header.purchaseDate,
      entryTime: header.entryTime,
      discount: header.discount || 0,
      licenseId,
      userId,
      purchaseType: header.purchaseType,
    };

    const res = await (window as any).electronAPI.createPurchase(
      purchase,
      items
    );

    if (res?.success) {
      alert(`✅ Saved! SlNo: ${res.slNo}, Total: ${res.totalAmount}`);

      if (priceUpdateSettings.updatePricesAfterSave) {
        const priceUpdates = rows
          .filter(
            (r) =>
              r.productId &&
              (priceUpdateSettings.updateCostFromPurchase ||
                (typeof r.salePrice === "number" && r.salePrice > 0) ||
                (r.profitPercent ?? 0) > 0)
          )
          .map((r) => {
            let sale = r.salePrice ?? 0;

            if ((r.profitPercent ?? 0) > 0) {
              const taxPct =
                r.taxPercent === "NT"
                  ? 0
                  : Number(String(r.taxPercent).replace("P", "")) || 0;
              const perUnitTax = r.rate * (taxPct / 100);
              const basePerUnit = r.rate + perUnitTax;
              sale = round2(
                basePerUnit * (1 + (Number(r.profitPercent) || 0) / 100)
              );
            } else if (typeof r.salePrice === "number") {
              sale = round2(r.salePrice);
            }

            return {
              productId: r.productId,
              salePrice: sale > 0 ? sale : undefined,
              costPrice: priceUpdateSettings.updateCostFromPurchase
                ? round2(r.rate)
                : undefined,
              unit: priceUpdateSettings.updateUnitFromPurchase
                ? r.unit
                : undefined,
            };
          });

        if (priceUpdates.length > 0) {
          try {
            await (window as any).electronAPI.bulkUpdateProductPrices(
              priceUpdates
            );
          } catch (e) {
            console.error("Failed to update product fields:", e);
          }
        }
      }
      resetAll();
      return true;
    }
    return false;
  };

  const handleCancel = () => {
    const ok = confirm("Discard current bill?");
    if (ok) resetAll();
  };

  useEffect(() => {
    setIsDirty(true);
  }, [
    JSON.stringify(header),
    JSON.stringify(
      rows.map((r) => ({
        productId: r.productId,
        unit: r.unit,
        rate: r.rate,
        quantity: r.quantity,
        mrp: r.mrp,
        taxPercent: r.taxPercent,
        discountType: r.discountType,
        discount: r.discount,
        profitPercent: r.profitPercent,
        salePrice: r.salePrice,
        batchNo: r.batchNo,
        mfgDate: r.mfgDate,
        expiryDate: r.expiryDate,
      }))
    ),
  ]);

  function resetAll() {
    setHeader({
      billNo: "",
      supplier: null,
      department: "",
      debitAccount: "",
      natureOfEntry: "",
      purchaseDate: new Date().toISOString(),
      entryTime: new Date().toISOString(),
      discount: 0,
      purchaseType: "CREDIT",
    });
    setRows([createEmptyRow(1)]);
    setIsDirty(false);
  }

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function updateRow(index: number, patch: Partial<ItemRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  async function tryNavigate(path: string) {
    if (!isDirty) {
      router.push(path);
      return;
    }

    const save = window.confirm(
      "You have unsaved changes.\n\nOK = Save & Exit\nCancel = Choose without saving"
    );
    if (save) {
      const ok = await handleSave();
      if (ok) router.push(path);
    } else {
      const exit = window.confirm("Exit without saving?");
      if (exit) {
        resetAll();
        router.push(path);
      }
    }
  }

  return (
    <div className="h-[calc(100vh-72px)] flex flex-col bg-gray-50">
      <PurchaseNavigation onNavigate={tryNavigate} />

      <div className="flex-1 overflow-hidden p-6">
        <div className="grid h-full grid-cols-12 gap-6">
          <BillDetailsSection
            header={header}
            setHeader={setHeader}
            suppliers={suppliers}
            setShowSupplierModal={setShowSupplierModal}
            subTotal={subTotal}
            grandTotal={grandTotal}
            onSave={handleSave}
            onCancel={handleCancel}
          />

          <ItemsTableSection
            rows={rows}
            products={products}
            onSelectProduct={handleSelectProduct}
            onUpdateRow={updateRow}
            onAddRow={addRow}
            onRemoveRow={removeRow}
            subTotal={subTotal}
            grandTotal={grandTotal}
            headerDiscount={header.discount}
          />
        </div>
      </div>

      {showSupplierModal && (
        <SupplierFormModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          onSuccess={() => {
            setShowSupplierModal(false);
            loadSuppliers();
          }}
        />
      )}
    </div>
  );
}
