// src/platform/web/supplierLedger.ts
import { getActiveToken } from "@/lib/session/runtimeSession";

const API_BASE =
  process.env.NEXT_PUBLIC_KYNFLOW_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getActiveToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status} ${path}`);
  }
  return res.json();
}

export async function webGetSupplierLedger(params: {
  licenseId: string;
  supplierId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  query.append("licenseId", params.licenseId);
  query.append("supplierId", params.supplierId);
  if (params.dateFrom) query.append("dateFrom", params.dateFrom);
  if (params.dateTo) query.append("dateTo", params.dateTo);
  if (params.page) query.append("page", String(params.page));
  if (params.pageSize) query.append("pageSize", String(params.pageSize));
  return apiFetch(`/api/supplier-ledger?${query.toString()}`);
}

export async function webGetSupplierOutstandingBills(params: {
  licenseId: string;
  supplierId: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  query.append("licenseId", params.licenseId);
  query.append("supplierId", params.supplierId);
  if (params.q) query.append("q", params.q);
  if (params.page) query.append("page", String(params.page));
  if (params.pageSize) query.append("pageSize", String(params.pageSize));
  return apiFetch(`/api/supplier-outstanding-bills?${query.toString()}`);
}

export async function webCreateSupplierPayment(payload: {
  licenseId: string;
  supplierId: string;
  amount: number;
  date: string;
  mode: "CASH" | "BANK" | "CHEQUE";
  notes?: string | null;
  chequeNo?: string | null;
  chequeIssueDate?: string | null;
  chequeClearanceDate?: string | null;
  allocations?: Array<{ purchaseId: string; amount: number }>;
}) {
  return apiFetch("/api/supplier-payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function webListPayments(params: {
  licenseId: string;
  supplierId?: string | null;
  q?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  query.append("licenseId", params.licenseId);
  if (params.supplierId) query.append("supplierId", params.supplierId);
  if (params.q) query.append("q", params.q);
  if (params.dateFrom) query.append("dateFrom", params.dateFrom);
  if (params.dateTo) query.append("dateTo", params.dateTo);
  if (params.page) query.append("page", String(params.page));
  if (params.pageSize) query.append("pageSize", String(params.pageSize));
  return apiFetch(`/api/payments?${query.toString()}`);
}

export async function webMarkChequeReceived(licenseId: string, txId: string) {
  return apiFetch("/api/supplier-cheque/mark-received", {
    method: "POST",
    body: JSON.stringify({ licenseId, txId }),
  });
}
