import { platform } from "@/platform";
import { getTaskPref } from "./printPreferences";
import { buildSalesReturnInvoiceHtml } from "./buildSalesReturnInvoiceHtml";
import { buildSalesReturnThermalHtml } from "./buildSalesReturnThermalHtml";
import { loadSalesReturnPrintCustomization } from "./salesReturnPrintCustomization";

export async function printSalesReturn(returnId: string, licenseId: string) {
  const response = await platform.getSaleReturnFull?.(returnId);
  if (!response?.success || !response.saleReturn) {
    throw new Error(
      response?.error || "Sales Return could not be loaded for printing.",
    );
  }

  const shopResult = await platform
    .getShopSettings(licenseId)
    .catch(() => ({ success: false }) as any);
  const shop = shopResult?.settings;
  const pref = getTaskPref("salesReturn");
  const customization = loadSalesReturnPrintCustomization();
  const isThermal = pref.paperSize === "thermal";

  const html = isThermal
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

  const saleReturn = response.saleReturn as any;
  const documentTitle =
    String(customization.title || "").trim() || "SALES RETURN";
  const title = `${documentTitle} - ${
    saleReturn.slNo ?? saleReturn.entryNo ?? ""
  }`;
  const paperLabel = isThermal ? "80mm Thermal" : "A4";

  const electron =
    typeof window !== "undefined" ? (window as any).electronAPI : undefined;

  if (electron?.printHtml) {
    // Same contract already used by working Sales/Purchase printing.
    // Chromium needs a custom micron object for thermal paper; "80mm" is not
    // a supported named pageSize.
    const pageSize = isThermal ? { width: 80000, height: 200000 } : "A4";

    const result = await electron.printHtml(html, {
      preview: pref.preview,
      pageSize,
      title,
      paperLabel,
      printerName: pref.printer || "",
    });

    if (!result?.success) {
      throw new Error(result?.error || "Sales Return print failed.");
    }
    return result;
  }

  if (typeof window === "undefined") {
    throw new Error("Printing is not available in this runtime.");
  }

  const width = isThermal ? 620 : 1120;
  const popup = window.open(
    "",
    "_blank",
    `width=${width},height=860,resizable=yes,scrollbars=yes`,
  );
  if (!popup) {
    throw new Error("Print preview was blocked by the browser.");
  }

  popup.document.open();
  popup.document.write(html);
  popup.document.close();

  if (pref.preview) {
    popup.focus();
    return { success: true, preview: true };
  }

  popup.focus();
  popup.print();
  return { success: true, preview: false };
}
