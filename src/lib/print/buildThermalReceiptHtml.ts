// src/lib/print/buildThermalReceiptHtml.ts
import {
  DEFAULT_SALES_PRINT_CUSTOMIZATION,
  type SalesPrintCustomization,
} from "./salesPrintCustomization";

export type ReceiptShop = {
  name: string;
  logoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  mobile?: string | null;
  email?: string | null;
  gstin?: string | null;
  footerNote?: string | null;
  authorizedSignatory?: string | null;
};

export type ReceiptItem = {
  lineNo: number;
  name: string;
  barcode?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  unit?: string | null;
  taxPercent?: string | number | null;
  mrp?: number | null;
  qty: number;
  rate: number;
  total: number;
  offerLabel?: string | null;
  offerSavings?: number | null;
};

export type ReceiptInput = {
  shop: ReceiptShop;
  billNo?: string | number | null;
  entryNo?: string | number | null;
  date?: string | null;
  time?: string | null;
  saleType?: string | null;
  transactionType?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerGstin?: string | null;
  customerAddress?: string | null;
  items: ReceiptItem[];
  totalQty: number;
  subTotal: number;
  offerSavings?: number;
  offerSummary?: string[];
  discount?: number;
  grandTotal: number;
  notes?: string[];
  options?: SalesPrintCustomization;
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: unknown): string {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function quantity(value: unknown): string {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : money(number);
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB");
}

function formatTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function taxPercent(value?: string | number | null): number {
  if (value == null || value === "" || value === "NT") return 0;
  return Number(String(value).replace("P", "").replace("%", "")) || 0;
}

function amountToWords(amount: number): string {
  const value = Math.round(Number(amount || 0));
  return `${value.toLocaleString("en-IN")} Rupees Only`;
}

export function buildThermalReceiptHtml(input: ReceiptInput): string {
  const options = {
    ...DEFAULT_SALES_PRINT_CUSTOMIZATION,
    ...(input.options || {}),
  };
  const address = [
    input.shop.addressLine1,
    input.shop.addressLine2,
    [input.shop.city, input.shop.state, input.shop.pincode]
      .filter(Boolean)
      .join(" - "),
  ]
    .filter(Boolean)
    .join(", ");
  const title = options.documentTitle || "Sales Invoice";

  const businessLines = [
    options.showShopAddress && address ? `<div>${esc(address)}</div>` : "",
    options.showShopPhone && input.shop.mobile
      ? `<div>Phone: ${esc(input.shop.mobile)}</div>`
      : "",
    options.showShopEmail && input.shop.email
      ? `<div>${esc(input.shop.email)}</div>`
      : "",
    options.showShopGstin && input.shop.gstin
      ? `<div>GSTIN: ${esc(input.shop.gstin)}</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const documentRows = [
    options.showEntryNo && input.entryNo
      ? `<div><span>Entry</span><strong>${esc(input.entryNo)}</strong></div>`
      : "",
    options.showBillNo && input.billNo
      ? `<div><span>Bill</span><strong>${esc(input.billNo)}</strong></div>`
      : "",
    options.showSaleDate && input.date
      ? `<div><span>Date</span><strong>${esc(formatDate(input.date))}</strong></div>`
      : "",
    options.showEntryTime && input.time
      ? `<div><span>Time</span><strong>${esc(formatTime(input.time))}</strong></div>`
      : "",
    options.showSaleType && input.saleType
      ? `<div><span>Type</span><strong>${esc(input.saleType)}</strong></div>`
      : "",
    options.showTransactionType && input.transactionType
      ? `<div><span>Txn</span><strong>${esc(input.transactionType)}</strong></div>`
      : "",
    options.showDepartment && input.department
      ? `<div><span>Dept</span><strong>${esc(input.department)}</strong></div>`
      : "",
    options.showDebitAccount && input.debitAccount
      ? `<div><span>Debit</span><strong>${esc(input.debitAccount)}</strong></div>`
      : "",
    options.showNatureOfEntry && input.natureOfEntry
      ? `<div><span>Nature</span><strong>${esc(input.natureOfEntry)}</strong></div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const customerLines = [
    options.showCustomerName && input.customerName
      ? `<div class="customer-name">${esc(input.customerName)}</div>`
      : "",
    options.showCustomerAddress && input.customerAddress
      ? `<div>${esc(input.customerAddress)}</div>`
      : "",
    options.showCustomerPhone && input.customerPhone
      ? `<div>Phone: ${esc(input.customerPhone)}</div>`
      : "",
    options.showCustomerGstin && input.customerGstin
      ? `<div>GSTIN: ${esc(input.customerGstin)}</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const itemRows = input.items
    .map((item) => {
      const details = [
        options.showBarcode && item.barcode ? `BC:${esc(item.barcode)}` : "",
        options.showBatchNo && item.batchNo ? `Batch:${esc(item.batchNo)}` : "",
        options.showExpiryDate && item.expiryDate
          ? `Exp:${esc(formatDate(item.expiryDate))}`
          : "",
        options.showMrp && item.mrp != null ? `MRP:${money(item.mrp)}` : "",
        options.showTax && taxPercent(item.taxPercent)
          ? `Tax:${taxPercent(item.taxPercent)}%`
          : "",
      ].filter(Boolean);
      const qtyText = `${quantity(item.qty)}${
        options.showUnit && item.unit ? ` ${esc(item.unit)}` : ""
      } x ${money(item.rate)}`;
      const offer =
        options.showOffers && item.offerLabel
          ? `<div class="offer">${esc(item.offerLabel)}${
              Number(item.offerSavings || 0) > 0
                ? ` | Saved Rs. ${money(item.offerSavings)}`
                : ""
            }</div>`
          : "";
      return `<tr>
        <td>
          <div class="item-name">${esc(item.lineNo)}. ${esc(item.name)}</div>
          <div class="item-calc">${qtyText}</div>
          ${details.length ? `<div class="item-meta">${details.join(" | ")}</div>` : ""}
          ${offer}
        </td>
        <td class="amount">${money(item.total)}</td>
      </tr>`;
    })
    .join("");

  const offerSummary =
    options.showOffers && input.offerSummary?.length
      ? `<div class="offers"><strong>Offers:</strong> ${esc(input.offerSummary.join(", "))}</div>`
      : "";

  const totals = [
    options.showSubTotal
      ? `<div><span>Subtotal</span><strong>${money(input.subTotal)}</strong></div>`
      : "",
    options.showOfferSavings && Number(input.offerSavings || 0) > 0
      ? `<div><span>Offer savings</span><strong>- ${money(input.offerSavings)}</strong></div>`
      : "",
    options.showBillDiscount && Number(input.discount || 0) > 0
      ? `<div><span>Bill discount</span><strong>- ${money(input.discount)}</strong></div>`
      : "",
    `<div class="grand"><span>GRAND TOTAL</span><strong>Rs. ${money(input.grandTotal)}</strong></div>`,
  ]
    .filter(Boolean)
    .join("");

  const notes = [
    ...(options.showTerms && input.shop.footerNote
      ? [input.shop.footerNote]
      : []),
    ...(options.showTerms ? input.notes || [] : []),
  ];

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
  body { width: 68mm; max-width: 68mm; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .receipt { width: 68mm; max-width: 68mm; padding: 3mm 2.5mm 4mm; font-size: 9.5px; line-height: 1.28; overflow: hidden; }
  .center { text-align: center; }
  .logo { display: block; width: 18mm; max-height: 14mm; margin: 0 auto 1.5mm; object-fit: contain; }
  .shop-name { font-size: 15px; line-height: 1.1; font-weight: 800; overflow-wrap: anywhere; }
  .business { margin-top: 1mm; font-size: 8.5px; line-height: 1.35; overflow-wrap: anywhere; }
  .title { margin-top: 2mm; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
  .rule { margin: 2mm 0; border-top: 1px dashed #000; }
  .document > div, .totals > div { display: flex; justify-content: space-between; gap: 4mm; margin: .6mm 0; }
  .document strong, .totals strong { text-align: right; overflow-wrap: anywhere; }
  .customer { font-size: 8.8px; line-height: 1.35; overflow-wrap: anywhere; }
  .customer-name { font-size: 10px; font-weight: 800; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; }
  th { padding: 1.5mm 0; border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 8.5px; text-align: left; }
  th:last-child { text-align: right; width: 22mm; }
  td { padding: 1.5mm 0; border-bottom: 1px dotted #777; vertical-align: top; overflow-wrap: anywhere; }
  td:first-child { padding-right: 2mm; }
  .amount { width: 22mm; text-align: right; white-space: nowrap; font-weight: 800; }
  .item-name { font-weight: 800; }
  .item-calc { margin-top: .5mm; font-size: 8.5px; }
  .item-meta { margin-top: .4mm; font-size: 7.5px; color: #222; }
  .offer, .offers { margin-top: .5mm; font-size: 7.8px; font-weight: 700; }
  .offers { border: 1px dashed #000; padding: 1.5mm; }
  .totals { margin-top: 1.5mm; }
  .grand { margin-top: 1.5mm !important; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5mm 0; font-size: 11px; font-weight: 800; }
  .words { margin-top: 1.5mm; text-align: center; font-size: 8px; line-height: 1.35; }
  .notes { margin-top: 2mm; text-align: center; font-size: 7.5px; line-height: 1.35; white-space: pre-wrap; }
  .signature { margin-top: 6mm; text-align: center; font-size: 8px; }
  .signature::before { content: ""; display: block; width: 34mm; margin: 0 auto 1.5mm; border-top: 1px solid #000; }
  .kynflow { margin-top: 2.5mm; text-align: center; font-size: 7px; letter-spacing: .08em; }
</style>
</head>
<body>
<div class="receipt">
  ${options.showLogo && input.shop.logoUrl ? `<img class="logo" src="${esc(input.shop.logoUrl)}" alt="Logo" />` : ""}
  ${options.showShopName ? `<div class="center shop-name">${esc(input.shop.name || "Business")}</div>` : ""}
  ${businessLines ? `<div class="center business">${businessLines}</div>` : ""}
  <div class="center title">${esc(title.toUpperCase())}</div>
  <div class="rule"></div>
  ${documentRows ? `<div class="document">${documentRows}</div><div class="rule"></div>` : ""}
  ${customerLines ? `<div class="customer">${customerLines}</div><div class="rule"></div>` : ""}
  <table>
    <thead><tr><th>Item / Qty x Rate</th><th>Amount</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="2">No items</td></tr>'}</tbody>
  </table>
  ${offerSummary}
  <div class="totals">${totals}</div>
  ${options.showAmountInWords ? `<div class="words">${esc(amountToWords(input.grandTotal))}</div>` : ""}
  ${notes.length ? `<div class="notes">${notes.map((note) => esc(note)).join("<br/>")}</div>` : ""}
  ${options.showAuthorizedSignatory ? `<div class="signature">${esc(input.shop.authorizedSignatory || "Authorized Signatory")}</div>` : ""}
  ${options.showKynflowFooter ? '<div class="kynflow">Generated by KYNFLOW</div>' : ""}
</div>
</body>
</html>`;
}
