import type {
  MutationResult,
  OfferListFilters,
  OfferListResult,
  OfferMutationResult,
  OfferRecord,
  OfferSavePayload,
  OfferTargetListResult,
  OfferTargetSavePayload,
} from "../types";

function api() {
  if (typeof window === "undefined" || !window.electronAPI) {
    throw new Error("Electron API is not available in this runtime");
  }
  return window.electronAPI as any;
}

export async function desktopListOffers(
  licenseId: string,
  filters?: OfferListFilters,
): Promise<OfferListResult> {
  return api().listOffers(licenseId, filters ?? {});
}

export async function desktopListActiveOffers(
  licenseId: string,
  saleDateTime?: string,
): Promise<OfferListResult> {
  return api().listActiveOffers(licenseId, saleDateTime);
}

export async function desktopGetOffer(
  id: string,
  licenseId?: string,
): Promise<OfferRecord | null> {
  const res = await api().getOffer(id, licenseId);
  return res?.offer ?? res ?? null;
}

export async function desktopSaveOffer(
  payload: OfferSavePayload,
): Promise<OfferMutationResult> {
  return api().saveOffer(payload);
}

export async function desktopDeleteOffer(
  id: string,
  licenseId: string,
): Promise<MutationResult> {
  return api().deleteOffer(id, licenseId);
}

export async function desktopToggleOffer(
  id: string,
  licenseId: string,
  isActive: boolean,
): Promise<MutationResult> {
  return api().toggleOffer(id, licenseId, isActive);
}

export async function desktopListOfferTargetProducts(
  offerId: string,
): Promise<OfferTargetListResult> {
  return api().listOfferTargetProducts(offerId);
}

export async function desktopSaveOfferTargetProducts(
  payload: OfferTargetSavePayload,
): Promise<OfferMutationResult> {
  return api().saveOfferTargetProducts(payload);
}
