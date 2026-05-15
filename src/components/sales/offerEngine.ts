import type {
  OfferRecord,
  OfferTargetProductRecord,
  OfferType,
} from "@/platform/types";
import type { Customer, HeaderForm, ItemRow } from "./types";
import { calcRow, round2 } from "./utils";

export type OfferEngineInput = {
  header: HeaderForm;
  rows: ItemRow[];
  offers: OfferRecord[];
  targets: OfferTargetProductRecord[];
  saleDateTime?: string;
  customer?: Customer | null;
  disabledOfferIds?: string[];
};

export type OfferSummary = {
  offerId: string;
  offerName: string;
  offerType: OfferType | string;
  savings: number;
  rowIndexes?: number[];
  message?: string;
  disabled?: boolean;
};

export type EligibleRationBenefit = {
  offerId: string;
  offerName: string;
  productId: string;
  productName?: string | null;
  targetRole: string;
  maxQty?: number | null;
  unit?: string | null;
};

export type OfferEngineResult = {
  rows: ItemRow[];
  appliedOffers: OfferSummary[];
  eligibleOffers: OfferSummary[];
  eligibleRationBenefits: EligibleRationBenefit[];
  rationWarnings: string[];
  validationWarnings: string[];
  totalOfferSavings: number;
};

type Candidate = {
  offer: OfferRecord;
  appliedRate: number;
  savings: number;
  message: string;
  specificity: number;
  meta?: Record<string, any>;
};

function isLive(offer: OfferRecord, saleAt: Date) {
  if (offer.deletedAt || offer.isActive === 0) return false;
  if (offer.startsAt && saleAt < new Date(offer.startsAt)) return false;
  if (offer.endsAt && saleAt > new Date(offer.endsAt)) return false;
  if (offer.type !== "HOURLY_DISCOUNT") return true;
  if (!offer.timeStart || !offer.timeEnd) return true;

  const minutes = saleAt.getHours() * 60 + saleAt.getMinutes();
  const [sh, sm] = offer.timeStart.split(":").map(Number);
  const [eh, em] = offer.timeEnd.split(":").map(Number);
  const start = (sh || 0) * 60 + (sm || 0);
  const end = (eh || 0) * 60 + (em || 0);
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

function targetsFor(
  targets: OfferTargetProductRecord[],
  offerId: string,
  roles: string[],
) {
  return targets.filter(
    (t) =>
      t.offerId === offerId &&
      !t.deletedAt &&
      (roles.includes(t.targetRole) || t.targetRole === "BOTH"),
  );
}

function productMatches(
  offer: OfferRecord,
  targets: OfferTargetProductRecord[],
  productId: string,
  roles: string[] = ["BOTH", "QUALIFIER"],
) {
  if (offer.applyScope !== "SELECTED_PRODUCTS") return true;
  return targetsFor(targets, offer.id, roles).some((t) => t.productId === productId);
}

function baseRate(row: ItemRow) {
  return Number(row.originalRate ?? row.rate ?? 0);
}

function clearOffer(row: ItemRow): ItemRow {
  const restoredRate = Number(row.originalRate ?? row.rate ?? 0);
  return calcRow({
    ...row,
    rate: restoredRate,
    originalRate: null,
    originalSalePrice: null,
    appliedRate: null,
    offerId: null,
    offerName: null,
    offerType: null,
    offerDiscountAmount: 0,
    offerMessage: null,
    offerMeta: null,
  });
}

function candidateWithRate(
  offer: OfferRecord,
  row: ItemRow,
  appliedRate: number,
  message: string,
  specificity: number,
  meta?: Record<string, any>,
): Candidate | null {
  const qty = Math.max(0, Number(row.quantity || 0));
  const current = baseRate(row);
  const nextRate = Math.max(0, round2(appliedRate));
  const savings = round2(Math.max(0, current - nextRate) * qty);
  if (qty <= 0 || savings <= 0) return null;
  return { offer, appliedRate: nextRate, savings, message, specificity, meta };
}

function specialCandidate(
  offer: OfferRecord,
  row: ItemRow,
  targets: OfferTargetProductRecord[],
): Candidate | null {
  if (!productMatches(offer, targets, row.productId)) return null;
  const qty = Number(row.quantity || 0);
  if (qty < Number(offer.minQty || 0)) return null;
  if (offer.maxQty != null && qty > Number(offer.maxQty)) return null;
  if (offer.fixedUnitPrice == null) return null;
  return candidateWithRate(
    offer,
    row,
    Number(offer.fixedUnitPrice),
    "Special Offer",
    offer.applyScope === "SELECTED_PRODUCTS" ? 1 : 0,
  );
}

function hourlyCandidate(
  offer: OfferRecord,
  row: ItemRow,
  targets: OfferTargetProductRecord[],
): Candidate | null {
  if (!productMatches(offer, targets, row.productId)) return null;
  const current = baseRate(row);
  let appliedRate = current;
  if (offer.discountPercent != null) {
    appliedRate = current * (1 - Math.max(0, Number(offer.discountPercent)) / 100);
  } else if (offer.discountAmount != null) {
    appliedRate = current - Math.max(0, Number(offer.discountAmount));
  } else {
    return null;
  }
  return candidateWithRate(
    offer,
    row,
    appliedRate,
    "Hourly Discount",
    offer.applyScope === "SELECTED_PRODUCTS" ? 1 : 0,
  );
}

function qualifierRows(
  offer: OfferRecord,
  rows: ItemRow[],
  targets: OfferTargetProductRecord[],
) {
  const selected =
    offer.triggerScope === "SELECTED_PRODUCTS" ||
    offer.applyScope === "SELECTED_PRODUCTS";
  if (!selected) return rows.filter((r) => r.productId);
  const ids = new Set(
    targetsFor(targets, offer.id, ["QUALIFIER", "BOTH"]).map((t) => t.productId),
  );
  return rows.filter((r) => ids.has(r.productId));
}

function isRationEligible(
  offer: OfferRecord,
  rows: ItemRow[],
  targets: OfferTargetProductRecord[],
) {
  const qRows = qualifierRows(offer, rows, targets);
  if (offer.triggerKind === "BILL_AMOUNT") {
    const amount = qRows.reduce(
      (sum, r) => sum + baseRate(r) * Number(r.quantity || 0),
      0,
    );
    if (offer.minAmount != null && amount < Number(offer.minAmount)) return false;
    if (offer.maxAmount != null && amount > Number(offer.maxAmount)) return false;
    return amount > 0;
  }
  if (offer.triggerKind === "UNIT_QTY") {
    const qty = qRows
      .filter((r) => String(r.unit || "") === String(offer.unit || ""))
      .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    if (offer.minQty != null && qty < Number(offer.minQty)) return false;
    if (offer.maxQty != null && qty > Number(offer.maxQty)) return false;
    return qty > 0;
  }
  const qty = qRows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  if (offer.minQty != null && qty < Number(offer.minQty)) return false;
  if (offer.maxQty != null && qty > Number(offer.maxQty)) return false;
  return qty > 0;
}

function benefitRows(
  offer: OfferRecord,
  rows: ItemRow[],
  targets: OfferTargetProductRecord[],
) {
  if (offer.benefitTarget !== "SELECTED_RATION_PRODUCTS") {
    return qualifierRows(offer, rows, targets);
  }
  const benefitIds = new Set(
    targetsFor(targets, offer.id, ["BENEFIT", "BOTH"]).map((t) => t.productId),
  );
  return rows.filter((r) => benefitIds.has(r.productId));
}

function benefitQty(offer: OfferRecord, row: ItemRow, remainingCap: number) {
  const qty = Math.max(0, Number(row.quantity || 0));
  let eligible = qty;
  if (offer.benefitQtyMode === "QTY_ABOVE_THRESHOLD") {
    eligible = Math.max(0, qty - Number(offer.minQty || 0));
  } else if (offer.benefitQtyMode === "FIXED_QTY") {
    eligible = Math.min(qty, Number(offer.fixedBenefitQty || 0));
  } else if (offer.benefitQtyMode === "LIMITED_QTY") {
    eligible = Math.min(qty, Number(offer.maxBenefitQty || 0));
  }
  if (Number.isFinite(remainingCap)) eligible = Math.min(eligible, remainingCap);
  return Math.max(0, eligible);
}

function rationCandidate(
  offer: OfferRecord,
  row: ItemRow,
  eligibleBenefitQty: number,
): Candidate | null {
  const qty = Number(row.quantity || 0);
  if (qty <= 0 || eligibleBenefitQty <= 0) return null;
  const current = baseRate(row);
  let benefitRate = current;
  if (offer.benefitKind === "FIXED_UNIT_PRICE") {
    benefitRate = Number(offer.fixedUnitPrice ?? current);
  } else if (offer.benefitKind === "PERCENT_DISCOUNT") {
    benefitRate = current * (1 - Number(offer.discountPercent || 0) / 100);
  } else if (offer.benefitKind === "AMOUNT_DISCOUNT") {
    benefitRate = current - Number(offer.discountAmount || 0);
  } else if (offer.benefitKind === "FREE") {
    benefitRate = 0;
  } else {
    return null;
  }
  const blended =
    (benefitRate * eligibleBenefitQty + current * (qty - eligibleBenefitQty)) /
    qty;
  const candidate = candidateWithRate(
    offer,
    row,
    blended,
    "Ration Price",
    2,
    { benefitQty: eligibleBenefitQty },
  );
  if (!candidate) return null;
  if (
    offer.maxBenefitAmount != null &&
    candidate.savings > Number(offer.maxBenefitAmount)
  ) {
    const cappedRate = current - Number(offer.maxBenefitAmount) / qty;
    return candidateWithRate(offer, row, cappedRate, "Ration Price", 2, {
      benefitQty: eligibleBenefitQty,
      capped: true,
    });
  }
  return candidate;
}

function chooseBest(candidates: Candidate[]) {
  return candidates.sort((a, b) => {
    if (b.specificity !== a.specificity) return b.specificity - a.specificity;
    if ((b.offer.priority ?? 0) !== (a.offer.priority ?? 0)) {
      return (b.offer.priority ?? 0) - (a.offer.priority ?? 0);
    }
    return b.savings - a.savings;
  })[0];
}

export function calculateOffers(input: OfferEngineInput): OfferEngineResult {
  const saleAt = new Date(input.saleDateTime || input.header.saleDate || Date.now());
  const disabled = new Set(input.disabledOfferIds || []);
  const liveOffers = input.offers.filter((o) => isLive(o, saleAt));
  const cleanRows = input.rows.map(clearOffer);
  const candidatesByRow = new Map<number, Candidate[]>();
  const eligibleOffers: OfferSummary[] = [];
  const eligibleRationBenefits: EligibleRationBenefit[] = [];
  const rationWarnings: string[] = [];
  const validationWarnings: string[] = [];

  for (const offer of liveOffers) {
    if (disabled.has(offer.id)) {
      eligibleOffers.push({
        offerId: offer.id,
        offerName: offer.name,
        offerType: offer.type,
        savings: 0,
        disabled: true,
        message: "Disabled for this bill",
      });
      continue;
    }

    if (offer.type === "SPECIAL_PRICE") {
      cleanRows.forEach((row, idx) => {
        const c = specialCandidate(offer, row, input.targets);
        if (c) candidatesByRow.set(idx, [...(candidatesByRow.get(idx) || []), c]);
      });
      continue;
    }

    if (offer.type === "HOURLY_DISCOUNT") {
      cleanRows.forEach((row, idx) => {
        const c = hourlyCandidate(offer, row, input.targets);
        if (c) candidatesByRow.set(idx, [...(candidatesByRow.get(idx) || []), c]);
      });
      continue;
    }

    if (offer.type === "RATION") {
      const eligible = isRationEligible(offer, cleanRows, input.targets);
      if (!eligible) continue;
      eligibleOffers.push({
        offerId: offer.id,
        offerName: offer.name,
        offerType: offer.type,
        savings: 0,
        message: "Ration eligible",
      });
      if ((offer.customerRequired ?? 1) && !input.customer) {
        const msg = `Customer is required for ration offer: ${offer.name}`;
        rationWarnings.push(msg);
        validationWarnings.push(msg);
      }

      if (offer.benefitTarget === "SELECTED_RATION_PRODUCTS") {
        const benefitTargets = targetsFor(input.targets, offer.id, [
          "BENEFIT",
          "BOTH",
        ]);
        for (const t of benefitTargets) {
          if (!cleanRows.some((r) => r.productId === t.productId)) {
            eligibleRationBenefits.push({
              offerId: offer.id,
              offerName: offer.name,
              productId: t.productId,
              productName: t.productName,
              targetRole: t.targetRole,
              maxQty: offer.maxBenefitQty ?? offer.fixedBenefitQty ?? null,
              unit: offer.unit ?? null,
            });
          }
        }
      }

      let remainingCap =
        offer.oncePerBill && offer.maxBenefitQty != null
          ? Number(offer.maxBenefitQty)
          : Number.POSITIVE_INFINITY;
      for (const row of benefitRows(offer, cleanRows, input.targets)) {
        const idx = cleanRows.indexOf(row);
        const qty = benefitQty(offer, row, remainingCap);
        if (Number.isFinite(remainingCap)) remainingCap -= qty;
        const c = rationCandidate(offer, row, qty);
        if (c) candidatesByRow.set(idx, [...(candidatesByRow.get(idx) || []), c]);
      }
    }
  }

  const appliedOffers = new Map<string, OfferSummary>();
  const calculatedRows = cleanRows.map((row, idx) => {
    const best = chooseBest(candidatesByRow.get(idx) || []);
    if (!best) return row;
    const next = calcRow({
      ...row,
      originalRate: baseRate(row),
      originalSalePrice: row.originalSalePrice ?? row.salePrice ?? null,
      rate: best.appliedRate,
      appliedRate: best.appliedRate,
      offerId: best.offer.id,
      offerName: best.offer.name,
      offerType: best.offer.type,
      offerDiscountAmount: best.savings,
      offerMessage: best.message,
      offerMeta: JSON.stringify(best.meta || {}),
    });
    const existing = appliedOffers.get(best.offer.id);
    appliedOffers.set(best.offer.id, {
      offerId: best.offer.id,
      offerName: best.offer.name,
      offerType: best.offer.type,
      savings: round2((existing?.savings || 0) + best.savings),
      rowIndexes: [...(existing?.rowIndexes || []), idx],
      message: best.message,
    });
    return next;
  });

  const applied = Array.from(appliedOffers.values());
  const totalOfferSavings = round2(
    applied.reduce((sum, offer) => sum + offer.savings, 0),
  );

  return {
    rows: calculatedRows,
    appliedOffers: applied,
    eligibleOffers,
    eligibleRationBenefits,
    rationWarnings,
    validationWarnings,
    totalOfferSavings,
  };
}
