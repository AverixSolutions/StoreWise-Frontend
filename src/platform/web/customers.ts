// src/platform/web/customers.ts
import { getActiveToken } from "@/lib/session/runtimeSession";
import type {
  CustomerListFilters,
  CustomerListResult,
  MutationResult,
} from "../types";

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

export async function webListCustomers(
  licenseId: string,
  filters: CustomerListFilters = {},
): Promise<CustomerListResult> {
  const q = new URLSearchParams();
  q.append("licenseId", licenseId);
  if (filters.q) q.append("q", filters.q);
  if (filters.page) q.append("page", String(filters.page));
  if (filters.pageSize) q.append("pageSize", String(filters.pageSize));
  return apiFetch(`/api/customers?${q.toString()}`);
}

export async function webGetCustomer(id: string) {
  return apiFetch(`/api/customers/${id}`);
}

export async function webSaveCustomer(
  payload: any,
): Promise<
  MutationResult & { id?: string; code?: string; codeNumber?: number }
> {
  if (payload.id) {
    return apiFetch(`/api/customers/${payload.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }
  return apiFetch("/api/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function webDeleteCustomer(
  id: string,
  licenseId: string,
): Promise<MutationResult> {
  return apiFetch(
    `/api/customers/${id}?licenseId=${encodeURIComponent(licenseId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function webPeekNextCustomerCode(
  licenseId: string,
): Promise<{ nextCodeNumber: number; suggestedCode: string }> {
  return apiFetch(
    `/api/customers/next-code?licenseId=${encodeURIComponent(licenseId)}`,
  );
}

export async function webGetCustomerCount(
  licenseId: string,
  params?: { q?: string },
): Promise<{ count: number }> {
  const q = new URLSearchParams({ licenseId });
  if (params?.q) q.append("q", params.q);
  return apiFetch(`/api/customers/count?${q.toString()}`);
}

export async function webGetCustomerDistincts(
  licenseId: string,
): Promise<{
  names: string[];
  categories: string[];
  cities: string[];
  states: string[];
}> {
  return apiFetch(
    `/api/customers/distincts?licenseId=${encodeURIComponent(licenseId)}`,
  );
}
