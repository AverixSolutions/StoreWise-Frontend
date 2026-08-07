import type { PurchaseReturnPrintInput } from "./buildPurchaseReturnInvoiceHtml";
import { buildPurchaseThermalHtml } from "./buildPurchaseThermalHtml";

function relabelPurchaseReturnThermalHtml(html: string): string {
  return html
    .replaceAll("Purchase Bill", "Purchase Return")
    .replaceAll("Purchase bill", "Purchase return")
    .replaceAll("PURCHASE BILL", "PURCHASE RETURN")
    .replaceAll("Purchase Date", "Return Date")
    .replaceAll("Purchase date", "Return date")
    .replaceAll("Purchase Type", "Return Type")
    .replaceAll("Purchase type", "Return type")
    .replaceAll("Purchase Details", "Return Details")
    .replaceAll("Purchase details", "Return details")
    .replaceAll("Purchase Entry", "Purchase Return");
}

export function buildPurchaseReturnThermalHtml(
  input: PurchaseReturnPrintInput,
): string {
  return relabelPurchaseReturnThermalHtml(buildPurchaseThermalHtml(input));
}
