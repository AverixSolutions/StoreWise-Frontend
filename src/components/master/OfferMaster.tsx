"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  CalendarClock,
  Check,
  Edit3,
  Gift,
  PackageSearch,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { platform } from "@/platform";
import type {
  OfferApplyScope,
  OfferBenefitKind,
  OfferBenefitQtyMode,
  OfferBenefitTarget,
  OfferRecord,
  OfferSavePayload,
  OfferTargetProductRecord,
  OfferTargetRole,
  OfferTriggerKind,
  OfferTriggerScope,
  OfferType,
} from "@/platform/types";

type Props = {
  onBack?: () => void;
};

type DraftTarget = {
  productId: string;
  targetRole: OfferTargetRole;
};

type ProductOption = {
  id: string;
  name: string;
  code?: string | null;
  unit?: string | null;
};

type FormState = OfferSavePayload & {
  discountMode?: "PCT" | "AMOUNT";
};

const tabs: Array<{ type: OfferType; label: string; icon: any }> = [
  { type: "SPECIAL_PRICE", label: "Special Offers", icon: Gift },
  { type: "RATION", label: "Ration Offers", icon: Tags },
  { type: "HOURLY_DISCOUNT", label: "Hourly Discounts", icon: BadgePercent },
];

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/15";
const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500";

function getLicenseId() {
  if (typeof window === "undefined") return "demo-license";
  return localStorage.getItem("licenseId") || "demo-license";
}

function emptyForm(type: OfferType, licenseId: string): FormState {
  return {
    licenseId,
    name: "",
    type,
    isActive: 1,
    applyScope: "ALL_PRODUCTS",
    priority: 0,
    startsAt: null,
    endsAt: null,
    timeStart: null,
    timeEnd: null,
    minQty: type === "SPECIAL_PRICE" ? 1 : null,
    maxQty: null,
    fixedUnitPrice: type === "SPECIAL_PRICE" ? 0 : null,
    discountPercent: type === "HOURLY_DISCOUNT" ? 0 : null,
    discountAmount: null,
    triggerKind: type === "RATION" ? "BILL_AMOUNT" : null,
    triggerScope: type === "RATION" ? "ALL_PRODUCTS" : null,
    minAmount: type === "RATION" ? 0 : null,
    maxAmount: null,
    unit: null,
    benefitTarget: type === "RATION" ? "SAME_ELIGIBLE_ITEMS" : null,
    benefitKind: type === "RATION" ? "FIXED_UNIT_PRICE" : null,
    benefitQtyMode: type === "RATION" ? "ALL_ELIGIBLE_QTY" : null,
    fixedBenefitQty: null,
    maxBenefitQty: null,
    maxBenefitAmount: null,
    customerRequired: type === "RATION" ? 1 : 0,
    oncePerBill: type === "RATION" ? 1 : 0,
    notes: "",
    discountMode: "PCT",
  };
}

function asDateInput(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function typeBadge(type: OfferType) {
  if (type === "SPECIAL_PRICE") return "Special";
  if (type === "RATION") return "Ration";
  return "Hourly";
}

function toForm(offer: OfferRecord): FormState {
  return {
    ...offer,
    licenseId: offer.licenseId,
    isActive: offer.isActive ?? 1,
    applyScope: offer.applyScope || "ALL_PRODUCTS",
    priority: Number(offer.priority || 0),
    customerRequired: offer.customerRequired ?? (offer.type === "RATION" ? 1 : 0),
    oncePerBill: offer.oncePerBill ?? (offer.type === "RATION" ? 1 : 0),
    discountMode: offer.discountAmount != null ? "AMOUNT" : "PCT",
  };
}

function needsMapping(form: FormState) {
  return (
    form.applyScope === "SELECTED_PRODUCTS" ||
    form.triggerScope === "SELECTED_PRODUCTS" ||
    form.benefitTarget === "SELECTED_RATION_PRODUCTS"
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function MappingModal({
  isOpen,
  products,
  type,
  initialTargets,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  products: ProductOption[];
  type: OfferType;
  initialTargets: DraftTarget[];
  onClose: () => void;
  onSave: (targets: DraftTarget[]) => void;
}) {
  const [q, setQ] = useState("");
  const [targets, setTargets] = useState<DraftTarget[]>([]);

  useEffect(() => {
    if (isOpen) setTargets(initialTargets);
  }, [isOpen, initialTargets]);

  if (!isOpen) return null;

  const byProduct = new Map(targets.map((t) => [t.productId, t.targetRole]));
  const filtered = products.filter((p) => {
    const hay = `${p.name} ${p.code || ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const isRation = type === "RATION";

  function setProductRole(productId: string, role: OfferTargetRole | "") {
    setTargets((prev) => {
      if (!role) return prev.filter((t) => t.productId !== productId);
      const next = prev.filter((t) => t.productId !== productId);
      next.push({ productId, targetRole: role });
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[990] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between bg-[#1e3a5f] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Offer Products
            </p>
            <h3 className="text-base font-semibold">Product Mapping</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className={`${inputCls} pl-9`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products"
            />
          </div>
          {isRation && (
            <p className="mt-2 text-xs text-slate-500">
              Use Qualifier for trigger products and Benefit for ration products.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filtered.map((product) => {
              const role = byProduct.get(product.id) || "";
              return (
                <div
                  key={product.id}
                  className={`rounded-xl border p-3 ${
                    role
                      ? "border-cyan-200 bg-cyan-50/70"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setProductRole(
                          product.id,
                          role ? "" : isRation ? "QUALIFIER" : "BOTH",
                        )
                      }
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        role
                          ? "border-cyan-500 bg-cyan-500 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {role && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[product.code, product.unit].filter(Boolean).join(" • ")}
                      </p>
                      {role && isRation && (
                        <select
                          className="mt-2 h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                          value={role}
                          onChange={(e) =>
                            setProductRole(
                              product.id,
                              e.target.value as OfferTargetRole,
                            )
                          }
                        >
                          <option value="QUALIFIER">Qualifier</option>
                          <option value="BENEFIT">Benefit</option>
                          <option value="BOTH">Both</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4">
          <span className="text-sm font-medium text-slate-500">
            {targets.length} products mapped
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(targets)}
              className="rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-5 py-2 text-sm font-semibold text-white"
            >
              Save Mapping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OfferMaster({ onBack }: Props) {
  const [licenseId, setLicenseId] = useState("demo-license");
  const [activeType, setActiveType] = useState<OfferType>("SPECIAL_PRICE");
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [targetCounts, setTargetCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm("SPECIAL_PRICE", licenseId));
  const [draftTargets, setDraftTargets] = useState<DraftTarget[]>([]);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [deleteOffer, setDeleteOffer] = useState<OfferRecord | null>(null);

  useEffect(() => {
    setLicenseId(getLicenseId());
  }, []);

  useEffect(() => {
    setForm((prev) => ({ ...prev, licenseId }));
  }, [licenseId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [offerRes, productRes] = await Promise.all([
        platform.listOffers?.(licenseId, {
          includeInactive: true,
          includeDeleted: false,
        }),
        platform.getProducts(licenseId, { page: 1, pageSize: 500 }),
      ]);
      const rows = offerRes?.rows || [];
      setOffers(rows);
      setProducts(
        (productRes?.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          unit: p.unit,
        })),
      );

      const counts: Record<string, number> = {};
      await Promise.all(
        rows.map(async (offer) => {
          const res = await platform.listOfferTargetProducts?.(offer.id);
          counts[offer.id] = res?.rows?.length || 0;
        }),
      );
      setTargetCounts(counts);
    } catch (e) {
      console.error("Failed to load offers", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [licenseId]);

  const filteredOffers = useMemo(() => {
    const text = q.trim().toLowerCase();
    return offers
      .filter((offer) => offer.type === activeType && !offer.deletedAt)
      .filter((offer) =>
        text
          ? `${offer.name} ${offer.notes || ""}`.toLowerCase().includes(text)
          : true,
      )
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  }, [offers, activeType, q]);

  function openAdd(type = activeType) {
    setForm(emptyForm(type, licenseId));
    setDraftTargets([]);
    setFormOpen(true);
  }

  async function openEdit(offer: OfferRecord) {
    setForm(toForm(offer));
    const targetRes = await platform.listOfferTargetProducts?.(offer.id);
    setDraftTargets(
      (targetRes?.rows || []).map((target: OfferTargetProductRecord) => ({
        productId: target.productId,
        targetRole: target.targetRole,
      })),
    );
    setFormOpen(true);
  }

  async function saveOffer() {
    const payload: OfferSavePayload = {
      ...form,
      name: form.name.trim(),
      licenseId,
      isActive: form.isActive ? 1 : 0,
      priority: Number(form.priority || 0),
      minQty: form.minQty == null ? null : Number(form.minQty),
      maxQty: form.maxQty == null ? null : Number(form.maxQty),
      minAmount: form.minAmount == null ? null : Number(form.minAmount),
      maxAmount: form.maxAmount == null ? null : Number(form.maxAmount),
      fixedUnitPrice:
        form.fixedUnitPrice == null ? null : Number(form.fixedUnitPrice),
      discountPercent:
        form.discountMode === "PCT"
          ? Number(form.discountPercent || 0)
          : null,
      discountAmount:
        form.discountMode === "AMOUNT"
          ? Number(form.discountAmount || 0)
          : null,
      fixedBenefitQty:
        form.fixedBenefitQty == null ? null : Number(form.fixedBenefitQty),
      maxBenefitQty:
        form.maxBenefitQty == null ? null : Number(form.maxBenefitQty),
      maxBenefitAmount:
        form.maxBenefitAmount == null ? null : Number(form.maxBenefitAmount),
      customerRequired: form.customerRequired ? 1 : 0,
      oncePerBill: form.oncePerBill ? 1 : 0,
    };
    delete (payload as any).discountMode;

    if (!payload.name) return alert("Offer name is required.");
    if (payload.type === "SPECIAL_PRICE" && !payload.fixedUnitPrice) {
      return alert("Fixed unit price is required for special offers.");
    }
    if (payload.type === "HOURLY_DISCOUNT" && !payload.discountPercent && !payload.discountAmount) {
      return alert("Enter a percentage or amount discount.");
    }

    const res = await platform.saveOffer?.(payload);
    if (!res?.success || !res.id) {
      return alert(res?.error || "Failed to save offer.");
    }
    if (needsMapping(form)) {
      await platform.saveOfferTargetProducts?.({
        offerId: res.id,
        licenseId,
        rows: draftTargets,
      });
    }
    setFormOpen(false);
    await loadAll();
  }

  async function toggleOffer(offer: OfferRecord) {
    const res = await platform.toggleOffer?.(
      offer.id,
      licenseId,
      !(offer.isActive ?? 1),
    );
    if (!res?.success) alert(res?.error || "Failed to update offer.");
    await loadAll();
  }

  async function confirmDelete() {
    if (!deleteOffer) return;
    const res = await platform.deleteOffer?.(deleteOffer.id, licenseId);
    if (!res?.success) alert(res?.error || "Failed to delete offer.");
    setDeleteOffer(null);
    await loadAll();
  }

  const activeTab = tabs.find((tab) => tab.type === activeType) || tabs[0];
  const ActiveIcon = activeTab.icon;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 pb-10 md:pb-0">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_58%,#16213d_100%)] px-5 py-4 text-white shadow-[0_8px_20px_rgba(7,12,24,0.10)] md:px-6 md:py-5">
        <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              KYNFLOW • OFFER MASTER
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-[30px]">
              Offer Master
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Configure automatic special prices, ration benefits and hourly discounts.
            </p>
          </div>
          <div className="flex gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => openAdd()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(32,183,255,0.22)]"
            >
              <Plus className="h-4 w-4" />
              New Offer
            </button>
          </div>
        </div>
      </section>

      <section className="min-h-0 flex-1 rounded-[26px] border border-slate-200 bg-slate-50/70 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] md:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.type === activeType;
              const count = offers.filter((o) => o.type === tab.type && !o.deletedAt).length;
              return (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() => setActiveType(tab.type)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-[#1e3a5f] bg-[#1e3a5f] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`${inputCls} pl-9`}
              placeholder={`Search ${activeTab.label.toLowerCase()}`}
            />
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
          <ActiveIcon className="h-4 w-4 text-[#1e3a5f]" />
          <span>
            {filteredOffers.length} {activeTab.label.toLowerCase()}
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading offers...
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <PackageSearch className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              No offers yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Create the first rule for this offer type.
            </p>
            <button
              type="button"
              onClick={() => openAdd()}
              className="mt-4 rounded-xl bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white"
            >
              Add Offer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredOffers.map((offer) => (
              <article
                key={offer.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {offer.name}
                      </h3>
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                        {typeBadge(offer.type)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          offer.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {offer.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>Priority {offer.priority || 0}</span>
                      <span>{offer.applyScope === "ALL_PRODUCTS" ? "All products" : `${targetCounts[offer.id] || 0} mapped`}</span>
                      {offer.startsAt || offer.endsAt ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {asDateInput(offer.startsAt) || "Any"} to {asDateInput(offer.endsAt) || "Any"}
                        </span>
                      ) : null}
                    </div>
                    {offer.notes && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                        {offer.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => toggleOffer(offer)}
                      className={`h-8 rounded-lg px-3 text-xs font-semibold ${
                        offer.isActive
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {offer.isActive ? "On" : "Off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(offer)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      title="Edit"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteOffer(offer)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-[980] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:rounded-[24px]">
            <div className="flex items-center justify-between bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  {typeBadge(form.type)} Rule
                </p>
                <h3 className="text-base font-semibold">
                  {form.id ? "Edit Offer" : "New Offer"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Offer Name" className="md:col-span-2">
                  <input
                    className={inputCls}
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Example: Soap box special"
                  />
                </Field>
                <Field label="Offer Type">
                  <select
                    className={inputCls}
                    value={form.type}
                    disabled={Boolean(form.id)}
                    onChange={(e) => {
                      const nextType = e.target.value as OfferType;
                      setForm(emptyForm(nextType, licenseId));
                      setDraftTargets([]);
                    }}
                  >
                    <option value="SPECIAL_PRICE">Special Offer</option>
                    <option value="RATION">Ration Offer</option>
                    <option value="HOURLY_DISCOUNT">Hourly Discount</option>
                  </select>
                </Field>

                <Field label="Apply Scope">
                  <select
                    className={inputCls}
                    value={form.applyScope}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        applyScope: e.target.value as OfferApplyScope,
                      }))
                    }
                  >
                    <option value="ALL_PRODUCTS">All products</option>
                    <option value="SELECTED_PRODUCTS">Selected products</option>
                  </select>
                </Field>
                <Field label="Priority">
                  <input
                    className={inputCls}
                    type="number"
                    value={form.priority ?? 0}
                    onChange={(e) => setForm((s) => ({ ...s, priority: Number(e.target.value || 0) }))}
                  />
                </Field>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, isActive: s.isActive ? 0 : 1 }))}
                    className={`h-[42px] w-full rounded-xl border px-4 text-sm font-semibold ${
                      form.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    {form.isActive ? "Active" : "Inactive"}
                  </button>
                </div>

                <Field label="Start Date">
                  <input
                    className={inputCls}
                    type="date"
                    value={asDateInput(form.startsAt)}
                    onChange={(e) => setForm((s) => ({ ...s, startsAt: e.target.value || null }))}
                  />
                </Field>
                <Field label="End Date">
                  <input
                    className={inputCls}
                    type="date"
                    value={asDateInput(form.endsAt)}
                    onChange={(e) => setForm((s) => ({ ...s, endsAt: e.target.value || null }))}
                  />
                </Field>

                {needsMapping(form) && (
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => setMappingOpen(true)}
                      className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-cyan-700 hover:bg-cyan-100"
                    >
                      <PackageSearch className="h-4 w-4" />
                      Product Mapping ({draftTargets.length})
                    </button>
                  </div>
                )}
              </div>

              {form.type === "SPECIAL_PRICE" && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">
                    Special Offer Rule
                  </h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field label="Minimum Qty">
                      <input className={inputCls} type="number" min={0} value={form.minQty ?? 0} onChange={(e) => setForm((s) => ({ ...s, minQty: Number(e.target.value || 0) }))} />
                    </Field>
                    <Field label="Maximum Qty">
                      <input className={inputCls} type="number" min={0} value={form.maxQty ?? ""} onChange={(e) => setForm((s) => ({ ...s, maxQty: e.target.value ? Number(e.target.value) : null }))} />
                    </Field>
                    <Field label="Fixed Unit Price">
                      <input className={inputCls} type="number" min={0} step="0.01" value={form.fixedUnitPrice ?? 0} onChange={(e) => setForm((s) => ({ ...s, fixedUnitPrice: Number(e.target.value || 0) }))} />
                    </Field>
                  </div>
                </div>
              )}

              {form.type === "HOURLY_DISCOUNT" && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">
                    Hourly Discount Rule
                  </h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Field label="Start Time">
                      <input className={inputCls} type="time" value={form.timeStart || ""} onChange={(e) => setForm((s) => ({ ...s, timeStart: e.target.value || null }))} />
                    </Field>
                    <Field label="End Time">
                      <input className={inputCls} type="time" value={form.timeEnd || ""} onChange={(e) => setForm((s) => ({ ...s, timeEnd: e.target.value || null }))} />
                    </Field>
                    <Field label="Discount Type">
                      <select className={inputCls} value={form.discountMode || "PCT"} onChange={(e) => setForm((s) => ({ ...s, discountMode: e.target.value as any, discountPercent: e.target.value === "PCT" ? s.discountPercent ?? 0 : null, discountAmount: e.target.value === "AMOUNT" ? s.discountAmount ?? 0 : null }))}>
                        <option value="PCT">Percentage</option>
                        <option value="AMOUNT">Amount per unit</option>
                      </select>
                    </Field>
                    <Field label="Discount Value">
                      <input className={inputCls} type="number" min={0} step="0.01" value={form.discountMode === "AMOUNT" ? form.discountAmount ?? 0 : form.discountPercent ?? 0} onChange={(e) => setForm((s) => s.discountMode === "AMOUNT" ? { ...s, discountAmount: Number(e.target.value || 0), discountPercent: null } : { ...s, discountPercent: Number(e.target.value || 0), discountAmount: null })} />
                    </Field>
                  </div>
                </div>
              )}

              {form.type === "RATION" && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-slate-900">
                      Eligibility Trigger
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Field label="Trigger Kind">
                        <select className={inputCls} value={form.triggerKind || "BILL_AMOUNT"} onChange={(e) => setForm((s) => ({ ...s, triggerKind: e.target.value as OfferTriggerKind }))}>
                          <option value="BILL_AMOUNT">Bill amount</option>
                          <option value="PRODUCT_QTY">Product quantity</option>
                          <option value="UNIT_QTY">Unit quantity</option>
                        </select>
                      </Field>
                      <Field label="Trigger Scope">
                        <select className={inputCls} value={form.triggerScope || "ALL_PRODUCTS"} onChange={(e) => setForm((s) => ({ ...s, triggerScope: e.target.value as OfferTriggerScope }))}>
                          <option value="ALL_PRODUCTS">All products qualify</option>
                          <option value="SELECTED_PRODUCTS">Selected products qualify</option>
                        </select>
                      </Field>
                      <Field label="Exact Unit">
                        <input className={inputCls} value={form.unit || ""} onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value || null }))} placeholder="KG, NOS, LTR" />
                      </Field>
                      <Field label="Minimum Amount">
                        <input className={inputCls} type="number" min={0} step="0.01" value={form.minAmount ?? ""} onChange={(e) => setForm((s) => ({ ...s, minAmount: e.target.value ? Number(e.target.value) : null }))} />
                      </Field>
                      <Field label="Minimum Qty">
                        <input className={inputCls} type="number" min={0} value={form.minQty ?? ""} onChange={(e) => setForm((s) => ({ ...s, minQty: e.target.value ? Number(e.target.value) : null }))} />
                      </Field>
                      <Field label="Maximum Qty">
                        <input className={inputCls} type="number" min={0} value={form.maxQty ?? ""} onChange={(e) => setForm((s) => ({ ...s, maxQty: e.target.value ? Number(e.target.value) : null }))} />
                      </Field>
                    </div>
                    {form.triggerKind === "UNIT_QTY" && (
                      <p className="mt-2 text-xs text-slate-500">
                        Unit matching uses exact unit names.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-slate-900">
                      Benefit
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Field label="Benefit Target">
                        <select className={inputCls} value={form.benefitTarget || "SAME_ELIGIBLE_ITEMS"} onChange={(e) => setForm((s) => ({ ...s, benefitTarget: e.target.value as OfferBenefitTarget }))}>
                          <option value="SAME_ELIGIBLE_ITEMS">Same eligible items</option>
                          <option value="SELECTED_RATION_PRODUCTS">Selected ration products</option>
                        </select>
                      </Field>
                      <Field label="Benefit Kind">
                        <select className={inputCls} value={form.benefitKind || "FIXED_UNIT_PRICE"} onChange={(e) => setForm((s) => ({ ...s, benefitKind: e.target.value as OfferBenefitKind }))}>
                          <option value="FIXED_UNIT_PRICE">Fixed unit price</option>
                          <option value="PERCENT_DISCOUNT">Percent discount</option>
                          <option value="AMOUNT_DISCOUNT">Amount discount</option>
                          <option value="FREE">Free</option>
                        </select>
                      </Field>
                      <Field label="Benefit Qty Mode">
                        <select className={inputCls} value={form.benefitQtyMode || "ALL_ELIGIBLE_QTY"} onChange={(e) => setForm((s) => ({ ...s, benefitQtyMode: e.target.value as OfferBenefitQtyMode }))}>
                          <option value="ALL_ELIGIBLE_QTY">All eligible qty</option>
                          <option value="QTY_ABOVE_THRESHOLD">Qty above threshold</option>
                          <option value="FIXED_QTY">Fixed qty</option>
                          <option value="LIMITED_QTY">Limited qty</option>
                        </select>
                      </Field>
                      <Field label="Fixed Unit Price">
                        <input className={inputCls} type="number" min={0} step="0.01" value={form.fixedUnitPrice ?? ""} onChange={(e) => setForm((s) => ({ ...s, fixedUnitPrice: e.target.value ? Number(e.target.value) : null }))} />
                      </Field>
                      <Field label="Discount Percent">
                        <input className={inputCls} type="number" min={0} step="0.01" value={form.discountPercent ?? ""} onChange={(e) => setForm((s) => ({ ...s, discountPercent: e.target.value ? Number(e.target.value) : null }))} />
                      </Field>
                      <Field label="Discount Amount">
                        <input className={inputCls} type="number" min={0} step="0.01" value={form.discountAmount ?? ""} onChange={(e) => setForm((s) => ({ ...s, discountAmount: e.target.value ? Number(e.target.value) : null }))} />
                      </Field>
                      <Field label="Fixed Benefit Qty">
                        <input className={inputCls} type="number" min={0} value={form.fixedBenefitQty ?? ""} onChange={(e) => setForm((s) => ({ ...s, fixedBenefitQty: e.target.value ? Number(e.target.value) : null }))} />
                      </Field>
                      <Field label="Max Benefit Qty">
                        <input className={inputCls} type="number" min={0} value={form.maxBenefitQty ?? ""} onChange={(e) => setForm((s) => ({ ...s, maxBenefitQty: e.target.value ? Number(e.target.value) : null }))} />
                      </Field>
                      <Field label="Max Benefit Amount">
                        <input className={inputCls} type="number" min={0} step="0.01" value={form.maxBenefitAmount ?? ""} onChange={(e) => setForm((s) => ({ ...s, maxBenefitAmount: e.target.value ? Number(e.target.value) : null }))} />
                      </Field>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setForm((s) => ({ ...s, customerRequired: s.customerRequired ? 0 : 1 }))} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${form.customerRequired ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-500"}`}>
                        Customer required
                      </button>
                      <button type="button" onClick={() => setForm((s) => ({ ...s, oncePerBill: s.oncePerBill ? 0 : 1 }))} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${form.oncePerBill ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-500"}`}>
                        Once per bill
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <Field label="Notes" className="mt-5 block">
                <textarea
                  className={`${inputCls} min-h-[86px] resize-none`}
                  value={form.notes || ""}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Internal note for this offer"
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveOffer}
                className="rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-6 py-2.5 text-sm font-semibold text-white"
              >
                Save Offer
              </button>
            </div>
          </div>
        </div>
      )}

      <MappingModal
        isOpen={mappingOpen}
        products={products}
        type={form.type}
        initialTargets={draftTargets}
        onClose={() => setMappingOpen(false)}
        onSave={(targets) => {
          setDraftTargets(targets);
          setMappingOpen(false);
        }}
      />

      <ConfirmModal
        isOpen={Boolean(deleteOffer)}
        title="Delete offer?"
        message={
          deleteOffer
            ? `This will remove "${deleteOffer.name}" from future bills. Saved bills keep their offer snapshot.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOffer(null)}
      />
    </div>
  );
}
