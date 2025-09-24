// src/bootstrap/suppliers.ts
import api from "@/lib/axios";

type BootstrapSuppliersResponse = {
  serverTime: string;
  suppliers: Array<{
    id: string;
    licenseId: string;
    code: string | null;
    codeNumber: number | null;
    name: string;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    department: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    category: string | null;
    native: string | null;
    language: string | null;
    aadhaar: string | null;
    pan: string | null;
    license1: string | null;
    license2: string | null;
    settlementDays: number | null;
    creditLimit: string | null;
    openingBalance: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
  }>;
};

export async function bootstrapSuppliers() {
  const res = await api.get<BootstrapSuppliersResponse>(
    "/sync/suppliers/bootstrap"
  );

  await (window as any).electronAPI.bulkUpsertSuppliers(
    res.data.suppliers.map((s) => ({
      ...s,
      creditLimit: s.creditLimit != null ? Number(s.creditLimit) : null,
      openingBalance: Number(s.openingBalance || "0"),
      syncedAt: res.data.serverTime,
    }))
  );

  await (window as any).electronAPI.setSyncState("suppliers", {
    lastPulledAt: res.data.serverTime,
  });
}
