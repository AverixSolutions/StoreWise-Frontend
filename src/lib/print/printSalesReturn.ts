import { platform } from "@/platform";
import { getTaskPref } from "./printPreferences";
import { buildSalesReturnInvoiceHtml } from "./buildSalesReturnInvoiceHtml";
import { buildSalesReturnThermalHtml } from "./buildSalesReturnThermalHtml";
import { loadSalesReturnPrintCustomization } from "./salesReturnPrintCustomization";

export async function printSalesReturn(returnId: string, licenseId: string) {
  const response = await platform.getSaleReturnFull?.(returnId);
  if (!response?.success || !response.saleReturn)
    throw new Error(
      response?.error || "Sales Return could not be loaded for printing.",
    );
  const shopResult = await platform
    .getShopSettings(licenseId)
    .catch(() => ({ success: false }) as any);
  const shop = shopResult?.settings;
  const pref = getTaskPref("salesReturn");
  const customization = loadSalesReturnPrintCustomization();
  const html =
    pref.paperSize === "thermal"
      ? buildSalesReturnThermalHtml({
          saleReturn: response.saleReturn,
          items: response.items || [],
          shop,
          customization,
        })
      : buildSalesReturnInvoiceHtml({
          saleReturn: response.saleReturn,
          items: response.items || [],
          shop,
          customization,
        });

  const electron =
    typeof window !== "undefined" ? window.electronAPI : undefined;
  if (electron?.printHtml) {
    const result = await electron.printHtml(html, {
      preview: pref.preview,
      pageSize: pref.paperSize === "thermal" ? "80mm" : "A4",
      printerName: pref.printer || undefined,
      deviceName: pref.printer || undefined,
    });
    if (!result?.success)
      throw new Error(result?.error || "Sales Return print failed.");
    return result;
  }

  if (typeof window === "undefined")
    throw new Error("Printing is not available in this runtime.");
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) throw new Error("Print preview was blocked by the browser.");
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
  return { success: true };
}
