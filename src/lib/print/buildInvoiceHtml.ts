// src/lib/print/buildInvoiceHtml.ts
import {
  DEFAULT_SALES_PRINT_CUSTOMIZATION,
  type SalesPrintCustomization,
} from "./salesPrintCustomization";

export type InvoiceParty = {
  label: string;
  name?: string | null;
  address?: string | null;
  mobile?: string | null;
  gstin?: string | null;
};

export type InvoiceItem = {
  lineNo: number;
  name?: string | null;
  barcode?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  qty: number;
  unit?: string | null;
  rate: number;
  taxPercent?: string | number | null;
  mrp?: number | null;
  salePrice?: number | null;
  offerName?: string | null;
  offerType?: string | null;
  offerDiscountAmount?: number | null;
  amount: number;
};

export type InvoiceDocument = {
  title: string;
  entryNo?: number | string | null;
  billNo?: string | null;
  date?: string | null;
  time?: string | null;
  saleType?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  typeLabel?: string | null;
};

export type ShopProfile = {
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

export type InvoiceHtmlInput = {
  shop: ShopProfile;
  document: InvoiceDocument;
  party: InvoiceParty;
  items: InvoiceItem[];
  subTotal: number;
  discount: number;
  offerSavings?: number;
  offerSummary?: string[];
  grandTotal: number;
  notes?: string | null;
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

function taxAmount(item: InvoiceItem): number {
  const percent = taxPercent(item.taxPercent);
  if (!percent) return 0;
  const amount = Number(item.amount || 0);
  return amount - amount / (1 + percent / 100);
}

function amountToWords(amount: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convert(value: number): string {
    if (value === 0) return "";
    if (value < 20) return `${ones[value]} `;
    if (value < 100) {
      return `${tens[Math.floor(value / 10)]} ${ones[value % 10]} `;
    }
    if (value < 1000) {
      return `${ones[Math.floor(value / 100)]} Hundred ${convert(value % 100)}`;
    }
    if (value < 100000) {
      return `${convert(Math.floor(value / 1000))}Thousand ${convert(value % 1000)}`;
    }
    if (value < 10000000) {
      return `${convert(Math.floor(value / 100000))}Lakh ${convert(value % 100000)}`;
    }
    return `${convert(Math.floor(value / 10000000))}Crore ${convert(value % 10000000)}`;
  }

  const rupees = Math.floor(Number(amount || 0));
  const paise = Math.round((Number(amount || 0) - rupees) * 100);
  let result = `${convert(rupees).trim() || "Zero"} Rupees`;
  if (paise > 0) result += ` and ${convert(paise).trim()} Paise`;
  return `${result} Only`;
}

function metaRow(label: string, value: unknown): string {
  if (value == null || String(value).trim() === "") return "";
  return `<div class="meta-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

export function buildInvoiceHtml(input: InvoiceHtmlInput): string {
  const options = {
    ...DEFAULT_SALES_PRINT_CUSTOMIZATION,
    ...(input.options || {}),
  };
  const { shop, document, party, items } = input;
  const accent = options.headingColor;
  const modern = options.a4Style === "modern";
  const address = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(", ");
  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const totalTax = items.reduce((sum, item) => sum + taxAmount(item), 0);
  const title = options.documentTitle || document.title || "Sales Invoice";

  const shopContact = [
    options.showShopPhone && shop.mobile ? `Phone: ${esc(shop.mobile)}` : "",
    options.showShopEmail && shop.email ? `Email: ${esc(shop.email)}` : "",
    options.showShopGstin && shop.gstin ? `GSTIN: ${esc(shop.gstin)}` : "",
  ].filter(Boolean);

  const documentMeta = [
    options.showEntryNo ? metaRow("Entry No.", document.entryNo) : "",
    options.showBillNo ? metaRow("Bill No.", document.billNo) : "",
    options.showSaleDate ? metaRow("Date", formatDate(document.date)) : "",
    options.showEntryTime ? metaRow("Time", formatTime(document.time)) : "",
    options.showSaleType ? metaRow("Sale Type", document.saleType) : "",
    options.showTransactionType
      ? metaRow("Transaction", document.typeLabel)
      : "",
    options.showDepartment ? metaRow("Department", document.department) : "",
    options.showDebitAccount
      ? metaRow("Debit Account", document.debitAccount)
      : "",
    options.showNatureOfEntry ? metaRow("Nature", document.natureOfEntry) : "",
  ]
    .filter(Boolean)
    .join("");

  const customerLines = [
    options.showCustomerName && party.name
      ? `<div class="party-name">${esc(party.name)}</div>`
      : "",
    options.showCustomerAddress && party.address
      ? `<div>${esc(party.address)}</div>`
      : "",
    options.showCustomerPhone && party.mobile
      ? `<div>Phone: ${esc(party.mobile)}</div>`
      : "",
    options.showCustomerGstin && party.gstin
      ? `<div>GSTIN: ${esc(party.gstin)}</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const itemRows = items
    .map((item) => {
      const details = [
        options.showBarcode && item.barcode
          ? `Barcode: ${esc(item.barcode)}`
          : "",
        options.showBatchNo && item.batchNo
          ? `Batch: ${esc(item.batchNo)}`
          : "",
        options.showExpiryDate && item.expiryDate
          ? `Exp: ${esc(formatDate(item.expiryDate))}`
          : "",
      ].filter(Boolean);
      const offer =
        options.showOffers && item.offerName
          ? `<div class="offer">${esc(item.offerName)}${
              Number(item.offerDiscountAmount || 0) > 0
                ? ` - Saved Rs. ${money(item.offerDiscountAmount)}`
                : ""
            }</div>`
          : "";
      const qtyText = `${quantity(item.qty)}${
        options.showUnit && item.unit ? ` ${esc(item.unit)}` : ""
      }`;
      return `
        <tr>
          <td class="center">${esc(item.lineNo)}</td>
          <td>
            <div class="item-name">${esc(item.name || "Item")}</div>
            ${details.length ? `<div class="item-meta">${details.join(" | ")}</div>` : ""}
            ${offer}
          </td>
          ${options.showMrp ? `<td class="right">${item.mrp == null ? "-" : money(item.mrp)}</td>` : ""}
          <td class="center">${qtyText}</td>
          <td class="right">${money(item.rate)}</td>
          ${
            options.showTax
              ? `<td class="right">${taxPercent(item.taxPercent) ? `${money(taxAmount(item))}<small>${taxPercent(item.taxPercent)}%</small>` : "-"}</td>`
              : ""
          }
          <td class="right strong">${money(item.amount)}</td>
        </tr>`;
    })
    .join("");

  const offerSummary =
    options.showOffers && input.offerSummary?.length
      ? `<div class="offer-summary"><strong>Offers:</strong> ${esc(
          input.offerSummary.join(", "),
        )}</div>`
      : "";

  const totals = [
    options.showSubTotal
      ? `<div><span>Subtotal</span><strong>Rs. ${money(input.subTotal)}</strong></div>`
      : "",
    options.showOfferSavings && Number(input.offerSavings || 0) > 0
      ? `<div class="saving"><span>Offer savings</span><strong>- Rs. ${money(input.offerSavings)}</strong></div>`
      : "",
    options.showBillDiscount && Number(input.discount || 0) > 0
      ? `<div><span>Bill discount</span><strong>- Rs. ${money(input.discount)}</strong></div>`
      : "",
    options.showTax && totalTax > 0
      ? `<div><span>Included tax</span><strong>Rs. ${money(totalTax)}</strong></div>`
      : "",
    `<div class="grand"><span>Grand Total</span><strong>Rs. ${money(input.grandTotal)}</strong></div>`,
  ]
    .filter(Boolean)
    .join("");

  const footerNote = String(shop.footerNote || input.notes || "").trim();
  const signatory = shop.authorizedSignatory || "Authorized Signatory";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 11mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #172033; font-family: "Segoe UI", Arial, sans-serif; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .invoice { width: 100%; min-height: 274mm; border: ${modern ? "0" : "1px solid #d8deea"}; border-radius: ${modern ? "0" : "12px"}; overflow: hidden; }
  .topbar { height: ${modern ? "8px" : "5px"}; background: ${accent}; }
  .header { display: grid; grid-template-columns: 1fr auto; gap: 24px; padding: ${modern ? "24px 26px" : "20px 22px"}; background: ${modern ? `linear-gradient(135deg, ${accent} 0%, #111827 100%)` : "#fff"}; color: ${modern ? "#fff" : "#172033"}; border-bottom: 1px solid #d8deea; }
  .brand { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }
  .logo { width: 58px; height: 58px; object-fit: contain; border-radius: 10px; background: #fff; padding: 4px; border: 1px solid #d8deea; }
  .shop-name { font-size: 22px; line-height: 1.08; font-weight: 800; letter-spacing: -.02em; }
  .shop-info { margin-top: 5px; max-width: 520px; font-size: 10px; line-height: 1.55; color: ${modern ? "rgba(255,255,255,.76)" : "#5f6b7c"}; }
  .doc-title { text-align: right; min-width: 180px; }
  .doc-title h1 { margin: 0; color: ${modern ? "#fff" : accent}; font-size: 24px; line-height: 1; text-transform: uppercase; letter-spacing: .07em; }
  .doc-title p { margin: 7px 0 0; font-size: 10px; color: ${modern ? "rgba(255,255,255,.65)" : "#6b7280"}; }
  .summary { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(270px, .85fr); gap: 16px; padding: 16px 22px; border-bottom: 1px solid #d8deea; background: #f8fafc; }
  .block-title { margin-bottom: 7px; color: ${accent}; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .13em; }
  .party { min-height: 88px; border: 1px solid #e1e6ef; border-radius: 10px; background: #fff; padding: 12px; font-size: 10px; line-height: 1.55; }
  .party-name { margin-bottom: 3px; font-size: 13px; font-weight: 800; color: #172033; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 12px; align-content: start; }
  .meta-row { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #dce2eb; font-size: 9px; }
  .meta-row span { color: #6b7280; }
  .meta-row strong { text-align: right; color: #263247; }
  .items { padding: 16px 22px 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { padding: 8px 7px; background: ${accent}; color: #fff; font-size: 8px; text-transform: uppercase; letter-spacing: .08em; text-align: left; }
  td { padding: 8px 7px; border-bottom: 1px solid #e5e9f0; font-size: 9px; vertical-align: top; overflow-wrap: anywhere; }
  tbody tr:nth-child(even) { background: #fafbfc; }
  .center { text-align: center; }
  .right { text-align: right; }
  .strong { font-weight: 800; }
  .item-name { font-weight: 700; color: #172033; }
  .item-meta { margin-top: 3px; color: #6b7280; font-size: 7.5px; }
  .offer { margin-top: 3px; color: #047857; font-size: 7.5px; font-weight: 700; }
  td small { display: block; margin-top: 2px; color: #6b7280; font-size: 7px; }
  .bottom { display: grid; grid-template-columns: 1fr 300px; gap: 18px; padding: 16px 22px 22px; }
  .offer-summary { margin-bottom: 10px; border: 1px solid #b7ead3; border-radius: 8px; background: #ecfdf5; padding: 8px 10px; color: #047857; font-size: 8.5px; line-height: 1.45; }
  .words { border-left: 3px solid ${accent}; background: #f8fafc; padding: 10px 12px; font-size: 9px; line-height: 1.5; }
  .words strong { display: block; margin-bottom: 3px; color: ${accent}; font-size: 8px; text-transform: uppercase; letter-spacing: .08em; }
  .totals { border: 1px solid #d8deea; border-radius: 10px; overflow: hidden; }
  .totals > div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 10px; border-bottom: 1px solid #e6eaf0; font-size: 9px; }
  .totals > div:last-child { border-bottom: 0; }
  .totals .saving { color: #047857; }
  .totals .grand { padding: 11px 10px; background: ${accent}; color: #fff; font-size: 12px; }
  .footer { margin: 0 22px 18px; display: grid; grid-template-columns: 1fr 210px; gap: 22px; align-items: end; border-top: 1px solid #d8deea; padding-top: 18px; }
  .terms { color: #5f6b7c; font-size: 8px; line-height: 1.55; white-space: pre-wrap; }
  .signature { text-align: center; font-size: 9px; color: #4b5563; }
  .signature::before { content: ""; display: block; width: 150px; margin: 28px auto 6px; border-top: 1px solid #667085; }
  .kynflow { margin: 8px 22px 14px; text-align: center; color: #9aa3b2; font-size: 7px; letter-spacing: .12em; text-transform: uppercase; }
</style>
</head>
<body>
<div class="invoice">
  <div class="topbar"></div>
  <header class="header">
    <div class="brand">
      ${options.showLogo && shop.logoUrl ? `<img class="logo" src="${esc(shop.logoUrl)}" alt="Logo" />` : ""}
      <div>
        ${options.showShopName ? `<div class="shop-name">${esc(shop.name || "Business")}</div>` : ""}
        <div class="shop-info">
          ${options.showShopAddress && address ? `<div>${esc(address)}</div>` : ""}
          ${shopContact.length ? `<div>${shopContact.join(" | ")}</div>` : ""}
        </div>
      </div>
    </div>
    <div class="doc-title">
      <h1>${esc(title)}</h1>
      <p>Original customer copy</p>
    </div>
  </header>

  <section class="summary">
    <div>
      <div class="block-title">${esc(party.label || "Customer")}</div>
      <div class="party">${customerLines || '<span style="color:#98a2b3">Cash customer</span>'}</div>
    </div>
    <div>
      <div class="block-title">Document details</div>
      <div class="meta">${documentMeta || '<span style="color:#98a2b3;font-size:9px">No optional details selected</span>'}</div>
    </div>
  </section>

  <section class="items">
    <table>
      <colgroup>
        <col style="width:34px" />
        <col />
        ${options.showMrp ? '<col style="width:72px" />' : ""}
        <col style="width:74px" />
        <col style="width:82px" />
        ${options.showTax ? '<col style="width:76px" />' : ""}
        <col style="width:92px" />
      </colgroup>
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Item</th>
          ${options.showMrp ? '<th class="right">MRP</th>' : ""}
          <th class="center">Qty</th>
          <th class="right">Rate</th>
          ${options.showTax ? '<th class="right">Tax</th>' : ""}
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows || '<tr><td colspan="7" class="center">No items</td></tr>'}</tbody>
    </table>
  </section>

  <section class="bottom">
    <div>
      ${offerSummary}
      ${
        options.showAmountInWords
          ? `<div class="words"><strong>Amount in words</strong>${esc(amountToWords(input.grandTotal))}</div>`
          : ""
      }
    </div>
    <div class="totals">${totals}</div>
  </section>

  ${
    options.showTerms || options.showAuthorizedSignatory
      ? `<footer class="footer">
          <div class="terms">${options.showTerms && footerNote ? esc(footerNote) : ""}</div>
          <div class="signature">${options.showAuthorizedSignatory ? esc(signatory) : ""}</div>
        </footer>`
      : ""
  }
  ${options.showKynflowFooter ? '<div class="kynflow">Generated by KYNFLOW</div>' : ""}
</div>
</body>
</html>`;
}
