// src/app/purchase/page.tsx
"use client";
import { useEffect, useState } from "react";

// Import modular components
import PurchaseHeader from "@/components/purchase/PurchaseHeader";
import PurchaseItemForm from "@/components/purchase/PurchaseItemForm";
import PurchaseSummary from "@/components/purchase/PurchaseSummary";

interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
  tax: string;
  costPrice: number;
  salePrice?: number;
  barcode?: string;
}

interface HeaderForm {
  billNo: string;
  supplierName: string;
  department: string;
  debitAccount: string;
  natureOfEntry: string;
  purchaseDate: string;
  entryTime: string;
  discount: number;
}

export default function PurchasePage() {
  const licenseId = localStorage.getItem("licenseId")!;
  const userId = localStorage.getItem("userName") || "U1";

  const [products, setProducts] = useState<Product[]>([]);
  const [header, setHeader] = useState<HeaderForm>({
    billNo: "",
    supplierName: "",
    department: "",
    debitAccount: "",
    natureOfEntry: "",
    purchaseDate: new Date().toISOString(),
    entryTime: new Date().toISOString(),
    discount: 0,
  });

  const [item, setItem] = useState<any>({
    productId: "",
    barcode: "",
    quantity: 1,
    unit: "",
    rate: 0,
    mrp: 0,
    taxPercent: "NT",
    profitPercent: 0,
    discount: 0,
    salePrice: 0,
    profit: 0,
    billedValue: 0,
  });

  const [subtotal, setSubtotal] = useState(0);

  // Fetch product list
  useEffect(() => {
    (async () => {
      const res = await window.electronAPI.getProducts(licenseId, {
        page: 1,
        pageSize: 50,
      });
      setProducts(res.products);
    })();
  }, [licenseId]);

  // Handle product select
  const handleProductSelect = async (productId: string) => {
    const product = await window.electronAPI.getProduct(productId);
    if (product) {
      setItem((prev: any) => ({
        ...prev,
        productId,
        barcode: product.barcode || product.code,
        unit: product.unit,
        taxPercent: product.tax,
        rate: product.costPrice,
        salePrice: product.salePrice || 0,
      }));
    }
  };

  // Auto-calculations
  useEffect(() => {
    const taxValue = parseInt(item.taxPercent.replace("P", "")) || 0;
    const taxAmount = item.rate * item.quantity * (taxValue / 100);
    const totalCost = item.rate * item.quantity + taxAmount;

    let salePrice = item.salePrice;
    if (item.profitPercent) {
      salePrice =
        (item.rate + taxAmount / item.quantity) *
        (1 + item.profitPercent / 100);
    }

    const profit = salePrice
      ? salePrice - (item.rate + taxAmount / item.quantity)
      : 0;
    const billedValue = totalCost - (item.discount || 0);

    setItem((prev: any) => ({
      ...prev,
      taxAmount,
      profit,
      salePrice,
      totalCost,
      billedValue,
    }));

    setSubtotal(billedValue);
  }, [
    item.quantity,
    item.rate,
    item.taxPercent,
    item.profitPercent,
    item.discount,
  ]);

  // Save purchase
  const handleSave = async () => {
    const purchase = { ...header, licenseId, userId };
    const result = await window.electronAPI.createPurchase(purchase, [item]);
    if (result.success) {
      alert(`✅ Saved! SlNo: ${result.slNo}, Total: ${result.totalAmount}`);
      resetForm();
    }
  };

  const resetForm = () => {
    setHeader({
      billNo: "",
      supplierName: "",
      department: "",
      debitAccount: "",
      natureOfEntry: "",
      purchaseDate: new Date().toISOString(),
      entryTime: new Date().toISOString(),
      discount: 0,
    });
    setItem({
      productId: "",
      barcode: "",
      quantity: 1,
      unit: "",
      rate: 0,
      mrp: 0,
      taxPercent: "NT",
      profitPercent: 0,
      discount: 0,
      salePrice: 0,
      profit: 0,
      billedValue: 0,
    });
    setSubtotal(0);
  };

  return (
    <div className="p-6 space-y-6">
      <PurchaseHeader header={header} setHeader={setHeader} />
      <PurchaseItemForm
        products={products}
        item={item}
        setItem={setItem}
        onSelect={handleProductSelect}
      />
      <PurchaseSummary
        subtotal={subtotal}
        discount={header.discount}
        finalTotal={subtotal - (header.discount || 0)}
      />
      <button
        onClick={handleSave}
        className="bg-averix-red-vivid text-white px-6 py-2 rounded-lg shadow hover:bg-averix-red-dark"
      >
        Save Purchase
      </button>
    </div>
  );
}
