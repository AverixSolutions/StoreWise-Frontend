// src/platform/web/suppliers.ts
import { getActiveToken } from "@/lib/session/runtimeSession";
import { SyncManager } from "@/sync/SyncManager";

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

function triggerSupplierPull() {
  if (typeof window === "undefined") return;
  SyncManager.pullNow("supplier").catch(() => {});
}

export async function webCreateSupplier(payload: any) {
  try {
    const res = await apiFetch("/api/suppliers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.success) triggerSupplierPull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webUpdateSupplier(id: string, changes: any) {
  try {
    const res = await apiFetch(`/api/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(changes),
    });
    if (res.success) triggerSupplierPull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

export async function webDeleteSupplier(id: string) {
  try {
    const res = await apiFetch(`/api/suppliers/${id}`, { method: "DELETE" });
    if (res.success) triggerSupplierPull();
    return res;
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}
