// src/platform/web/customerLedger.ts
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

function triggerCustomerLedgerPull() {
  if (typeof window === "undefined") return;
  import("@/sync/SyncManager")
    .then(({ SyncManager }) => {
      SyncManager.pullNow("customerTransaction").catch(() => {});
      SyncManager.pullNow("cashTransaction").catch(() => {});
    })
    .catch(() => {});
}

export async function webGetCustomerLedger(params: {
  licenseId: string;
  customerId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams();
  q.append("licenseId", params.licenseId);
  q.append("customerId", params.customerId);
  if (params.dateFrom) q.append("dateFrom", params.dateFrom);
  if (params.dateTo) q.append("dateTo", params.dateTo);
  if (params.page) q.append("page", String(params.page));
  if (params.pageSize) q.append("pageSize", String(params.pageSize));
  return apiFetch(`/api/customer-ledger?${q.toString()}`);
}

export async function webGetCustomerOutstandingSales(params: {
  licenseId: string;
  customerId: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams();
  q.append("licenseId", params.licenseId);
  q.append("customerId", params.customerId);
  if (params.q) q.append("q", params.q);
  if (params.page) q.append("page", String(params.page));
  if (params.pageSize) q.append("pageSize", String(params.pageSize));
  return apiFetch(`/api/customer-outstanding-sales?${q.toString()}`);
}

export async function webCreateCustomerReceipt(payload: {
  licenseId: string;
  customerId: string;
  amount: number;
  date: string;
  mode: "CASH" | "BANK" | "CHEQUE";
  notes?: string | null;
  chequeNo?: string | null;
  chequeIssueDate?: string | null;
  chequeClearanceDate?: string | null;
  allocations?: Array<{ saleId: string; amount: number }>;
}) {
  const res = await apiFetch("/api/customer-receipts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if ((res as any)?.success) triggerCustomerLedgerPull();
  return res;
}

export async function webListReceipts(params: {
  licenseId: string;
  customerId?: string | null;
  q?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams();
  q.append("licenseId", params.licenseId);
  if (params.customerId) q.append("customerId", params.customerId);
  if (params.q) q.append("q", params.q);
  if (params.dateFrom) q.append("dateFrom", params.dateFrom);
  if (params.dateTo) q.append("dateTo", params.dateTo);
  if (params.page) q.append("page", String(params.page));
  if (params.pageSize) q.append("pageSize", String(params.pageSize));
  return apiFetch(`/api/receipts?${q.toString()}`);
}

export async function webMarkCustomerChequeReceived(
  licenseId: string,
  txId: string,
) {
  const res = await apiFetch("/api/customer-cheque/mark-received", {
    method: "POST",
    body: JSON.stringify({ licenseId, txId }),
  });
  if ((res as any)?.success) triggerCustomerLedgerPull();
  return res;
}
