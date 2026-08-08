// src/app/dashboard/quotation/page.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { platform } from "@/platform";
import QuotationsTable from "@/components/quotations/QuotationsTable";
import QuotationFormModal from "@/components/quotations/QuotationFormModal";
import QuotationViewModal from "@/components/quotations/QuotationViewModal";
import QuotationEntrySettingsModal from "@/components/quotations/QuotationEntrySettingsModal";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import { ArrowLeft, FileText, Plus, Settings } from "lucide-react";
import {
  loadQuotationUiSettings,
  saveQuotationUiSettings,
  type QuotationUiSettings,
} from "@/components/quotations/quotationUiSettings";

export default function QuotationPage() {
  const router = useRouter();

  const licenseId =
    typeof window !== "undefined"
      ? (localStorage.getItem("licenseId") ?? "")
      : "";

  const [customers, setCustomers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showForm, setShowForm] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [uiSettings, setUiSettings] = useState<QuotationUiSettings>(() =>
    loadQuotationUiSettings(),
  );

  const loadCustomers = useCallback(async () => {
    if (!licenseId) return;

    const res = await platform.listCustomers?.(licenseId, {
      q: "",
      page: 1,
      pageSize: 500,
    });

    setCustomers(
      (res?.customers || []).map((c: any) => ({
        id: c.id,
        name: c.name,
      })),
    );
  }, [licenseId]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleNew = useCallback(() => {
    setEditId(null);
    setShowForm(true);
  }, []);

  const openSettings = useCallback(() => {
    setUiSettings(loadQuotationUiSettings());
    setShowSettings(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showForm || showCustomerModal || viewId || showSettings) return;

      if (event.key === "F7") {
        event.preventDefault();
        openSettings();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleNew();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        router.push("/dashboard/entries");
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    handleNew,
    openSettings,
    router,
    showCustomerModal,
    showForm,
    showSettings,
    viewId,
  ]);

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

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_8px_20px_rgba(7,12,24,0.10)] md:px-6 mb-5">
        <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              KYNFLOW • QUOTATIONS
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-[28px]">
              Quotations &{" "}
              <span className="kyn-brand-text">proforma invoices.</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Create, send and load quotations into the Sales workflow.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => router.push("/dashboard/entries")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <button
              type="button"
              onClick={openSettings}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.12] cursor-pointer"
              title="Quotation settings (F7)"
            >
              <Settings className="h-4 w-4" />
              Settings
              <span className="rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/70">
                F7
              </span>
            </button>

            <button
              type="button"
              onClick={handleNew}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.12] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New Quotation
              <span className="rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/70">
                Ctrl+N
              </span>
            </button>
          </div>
        </div>
      </section>

      <QuotationsTable
        licenseId={licenseId}
        onView={handleView}
        onEdit={handleEdit}
        refreshKey={refreshKey}
      />

      <QuotationEntrySettingsModal
        open={showSettings}
        settings={uiSettings}
        onClose={() => setShowSettings(false)}
        onSave={(nextSettings) => {
          setUiSettings(nextSettings);
          saveQuotationUiSettings(nextSettings);
        }}
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
        onAddCustomer={() => setShowCustomerModal(true)}
      />

      <CustomerFormModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSuccess={() => {
          setShowCustomerModal(false);
          loadCustomers();
        }}
      />

      <QuotationViewModal
        isOpen={!!viewId}
        onClose={() => setViewId(null)}
        quotationId={viewId}
        onEdit={handleEdit}
        onDeleted={handleDeleted}
      />
    </>
  );
}
