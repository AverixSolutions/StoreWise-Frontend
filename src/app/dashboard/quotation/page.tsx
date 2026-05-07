// src/app/dashboard/quotation/page.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { platform } from "@/platform";
import QuotationsTable from "@/components/quotations/QuotationsTable";
import QuotationFormModal from "@/components/quotations/QuotationFormModal";
import QuotationViewModal from "@/components/quotations/QuotationViewModal";
import { FileText } from "lucide-react";

export default function QuotationPage() {
  const licenseId =
    typeof window !== "undefined"
      ? (localStorage.getItem("licenseId") ?? "")
      : "";

  const [customers, setCustomers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!licenseId) return;
    platform.listCustomers?.(licenseId, {}).then((res) => {
      setCustomers(
        (res?.customers || []).map((c: any) => ({ id: c.id, name: c.name })),
      );
    });
  }, [licenseId]);

  const handleNew = useCallback(() => {
    setEditId(null);
    setShowForm(true);
  }, []);

  const handleView = useCallback((id: string) => {
    setViewId(id);
  }, []);

  const handleEdit = useCallback((id: string) => {
    setViewId(null);
    setEditId(id);
    setShowForm(true);
  }, []);

  const handleSaved = useCallback(() => {
    setShowForm(false);
    setEditId(null);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleDeleted = useCallback(() => {
    setViewId(null);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleConverted = useCallback((_saleId: string) => {
    setViewId(null);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      {/* ── Hero — matches Settings / other dashboard pages ── */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_8px_20px_rgba(7,12,24,0.10)] md:px-6 mb-5">
        <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative">
          <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
            KYNFLOW • QUOTATIONS
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-[28px]">
            Quotations &{" "}
            <span className="kyn-brand-text">proforma invoices.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Create, send and convert quotations to sales in one click.
          </p>
        </div>
      </section>

      <QuotationsTable
        licenseId={licenseId}
        onNew={handleNew}
        onView={handleView}
        refreshKey={refreshKey}
      />

      <QuotationFormModal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditId(null);
        }}
        licenseId={licenseId}
        editId={editId}
        onSaved={handleSaved}
        customers={customers}
      />

      <QuotationViewModal
        isOpen={!!viewId}
        onClose={() => setViewId(null)}
        quotationId={viewId}
        licenseId={licenseId}
        onConvertSuccess={handleConverted}
        onEdit={handleEdit}
        onDeleted={handleDeleted}
      />
    </>
  );
}
