import {
  AlertTriangle,
  BadgePercent,
  Gift,
  PackagePlus,
  Power,
  X,
} from "lucide-react";
import type {
  EligibleRationBenefit,
  OfferEngineResult,
  OfferSummary,
} from "./offerEngine";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  result: OfferEngineResult;
  disabledOfferIds: string[];
  onToggleOffer: (offerId: string, enabled: boolean) => void;
  onAddRationProduct: (productId: string, suggestedQty?: number | null) => void;
};

function typeLabel(type: string) {
  if (type === "SPECIAL_PRICE") return "Special Offer";
  if (type === "HOURLY_DISCOUNT") return "Hourly Discount";
  if (type === "RATION") return "Ration Offer";
  return "Offer";
}

function OfferRow({
  offer,
  disabled,
  onToggle,
}: {
  offer: OfferSummary;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">
              {offer.offerName}
            </span>
            <span className="shrink-0 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
              {typeLabel(String(offer.offerType))}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {offer.message || "Available in this bill"}
          </p>
          {offer.savings > 0 && (
            <p className="mt-1 text-xs font-semibold text-emerald-600">
              Saved ₹{offer.savings.toFixed(2)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onToggle(disabled)}
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
            disabled
              ? "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
          }`}
          title={disabled ? "Use in this bill" : "Disable for this bill"}
        >
          <Power className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RationBenefitRow({
  benefit,
  onAdd,
}: {
  benefit: EligibleRationBenefit;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {benefit.productName || benefit.productId}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Eligible through {benefit.offerName}
            {benefit.maxQty ? ` • up to ${benefit.maxQty}` : ""}
            {benefit.unit ? ` ${benefit.unit}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 text-xs font-semibold text-white hover:bg-[#16304f]"
        >
          <PackagePlus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}

export default function SalesOffersPanel({
  isOpen,
  onOpenChange,
  result,
  disabledOfferIds,
  onToggleOffer,
  onAddRationProduct,
}: Props) {
  const disabled = new Set(disabledOfferIds);
  const appliedCount = result.appliedOffers.length;
  const eligibleCount = result.eligibleOffers.filter((o) => !o.disabled).length;
  const warningCount = result.rationWarnings.length;
  const disabledOffers = result.eligibleOffers.filter((o) => o.disabled);

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={`px-2 sm:px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
          warningCount
            ? "bg-rose-500/20 border-rose-300/40 text-rose-100 hover:bg-rose-500/30"
            : appliedCount || eligibleCount
              ? "bg-emerald-500/20 border-emerald-300/40 text-emerald-100 hover:bg-emerald-500/30"
              : "bg-white/10 border-white/20 text-white/90 hover:bg-white/20"
        }`}
        title="Offers"
      >
        {warningCount ? (
          <AlertTriangle className="h-3.5 w-3.5" />
        ) : (
          <Gift className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">
          {appliedCount > 0
            ? `${appliedCount} Applied`
            : eligibleCount > 0
              ? "Ration Eligible"
              : "Offers"}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => onOpenChange(false)}
            aria-label="Close offers"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-slate-50 shadow-[-18px_0_40px_rgba(15,23,42,0.22)]">
            <div className="shrink-0 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_60%,#16213d_100%)] px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/20 text-cyan-200">
                    <BadgePercent className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Current Bill
                    </p>
                    <h3 className="text-base font-semibold">Offers</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/10 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">
                    Applied
                  </p>
                  <p className="text-lg font-semibold">{appliedCount}</p>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">
                    Eligible
                  </p>
                  <p className="text-lg font-semibold">{eligibleCount}</p>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">
                    Savings
                  </p>
                  <p className="text-lg font-semibold">
                    ₹{result.totalOfferSavings.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {result.rationWarnings.length > 0 && (
                <section className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                  {result.rationWarnings.map((warning) => (
                    <p key={warning} className="text-sm font-medium text-rose-700">
                      {warning}
                    </p>
                  ))}
                </section>
              )}

              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Applied Offers
                </h4>
                <div className="space-y-2">
                  {result.appliedOffers.length ? (
                    result.appliedOffers.map((offer) => (
                      <OfferRow
                        key={offer.offerId}
                        offer={offer}
                        disabled={disabled.has(offer.offerId)}
                        onToggle={(currentlyDisabled) =>
                          onToggleOffer(offer.offerId, currentlyDisabled)
                        }
                      />
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                      No offer is applied to this bill yet.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Eligible Ration Items
                </h4>
                <div className="space-y-2">
                  {result.eligibleRationBenefits.length ? (
                    result.eligibleRationBenefits.map((benefit) => (
                      <RationBenefitRow
                        key={`${benefit.offerId}:${benefit.productId}`}
                        benefit={benefit}
                        onAdd={() =>
                          onAddRationProduct(benefit.productId, benefit.maxQty)
                        }
                      />
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                      No additional ration product is available for this bill.
                    </div>
                  )}
                </div>
              </section>

              {disabledOffers.length > 0 && (
                <section>
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Disabled For This Bill
                  </h4>
                  <div className="space-y-2">
                    {disabledOffers.map((offer) => (
                      <OfferRow
                        key={offer.offerId}
                        offer={offer}
                        disabled
                        onToggle={() => onToggleOffer(offer.offerId, true)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
