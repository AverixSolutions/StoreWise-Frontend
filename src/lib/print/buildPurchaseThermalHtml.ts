import type {
  PurchasePrintInput,
  PurchasePrintItem,
} from "./buildPurchaseInvoiceHtml";

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: unknown): string {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function quantity(value: unknown): string {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed)
    ? String(parsed)
    : parsed.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatExpiry(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

function taxRate(value?: string | number | null): number {
  if (value == null || value === "" || value === "NT") return 0;
  return Number(String(value).replace("P", "").replace("%", "")) || 0;
}

function includedTax(item: PurchasePrintItem): number {
  const rate = taxRate(item.taxPercent);
  if (!rate) return 0;

  const total = Number(item.amount || 0);
  return total - total / (1 + rate / 100);
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
      return `${convert(Math.floor(value / 1000))}Thousand ${convert(
        value % 1000,
      )}`;
    }
    if (value < 10000000) {
      return `${convert(Math.floor(value / 100000))}Lakh ${convert(
        value % 100000,
      )}`;
    }
    return `${convert(Math.floor(value / 10000000))}Crore ${convert(
      value % 10000000,
    )}`;
  }

  const safe = Math.max(0, Number(amount || 0));
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  const rupeeWords = convert(rupees).trim() || "Zero";
  const paiseWords = paise > 0 ? ` and ${convert(paise).trim()} Paise` : "";

  return `${rupeeWords} Rupees${paiseWords} Only`;
}

function receiptRow(label: string, value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";

  return `
    <div class="receipt-row">
      <span class="row-label">${esc(label)}</span>
      <strong class="row-value">${esc(text)}</strong>
    </div>
  `;
}

function itemDetail(label: string, value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";

  return `<span><b>${esc(label)}</b> ${esc(text)}</span>`;
}

function itemRows(input: PurchasePrintInput): string {
  const { items, options } = input;

  if (!items.length) {
    return '<div class="empty">No purchase items</div>';
  }

  return items
    .map((item, index) => {
      const unit = options.showUnit && item.unit ? ` ${esc(item.unit)}` : "";
      const details = [
        options.showBatchNo ? itemDetail("Batch", item.batchNo) : "",
        options.showExpiryDate
          ? itemDetail("Exp", formatExpiry(item.expiryDate))
          : "",
        options.showBarcode ? itemDetail("Barcode", item.barcode) : "",
      ]
        .filter(Boolean)
        .join("");

      const rate = taxRate(item.taxPercent);
      const tax = includedTax(item);
      const taxText =
        options.showTax && rate
          ? `Tax ${quantity(rate)}% (incl. Rs. ${money(tax)})`
          : "";

      return `
        <article class="receipt-item">
          <div class="item-top">
            <strong class="item-name"><span class="line-number">${esc(
              item.lineNo || index + 1,
            )}.</span> ${esc(item.name)}</strong>
            <strong class="item-amount">Rs. ${money(item.amount)}</strong>
          </div>
          <div class="item-math">
            <span>${esc(quantity(item.qty))}${unit} x Rs. ${money(
              item.rate,
            )}</span>
            ${taxText ? `<span>${esc(taxText)}</span>` : ""}
          </div>
          ${details ? `<div class="item-extra">${details}</div>` : ""}
        </article>
      `;
    })
    .join("");
}

export function buildPurchaseThermalHtml(input: PurchasePrintInput): string {
  const { shop, bill, options, subTotal, discount, grandTotal, items } = input;
  const logo = options.showLogo ? shop.logoUrl : null;
  const documentTitle =
    String(options.documentTitle || "").trim() || "Purchase Bill";

  const address = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(", ");

  const shopLines = [
    options.showShopAddress && address ? `<div>${esc(address)}</div>` : "",
    options.showShopPhone && shop.mobile
      ? `<div>Phone: ${esc(shop.mobile)}</div>`
      : "",
    options.showShopEmail && shop.email
      ? `<div>Email: ${esc(shop.email)}</div>`
      : "",
    options.showShopGstin && shop.gstin
      ? `<div>GSTIN ${esc(shop.gstin)}</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const documentRows = [
    options.showEntryNo ? receiptRow("Entry", bill.entryNo) : "",
    options.showBillNo ? receiptRow("Bill No", bill.billNo) : "",
    options.showPurchaseDate ? receiptRow("Date", formatDate(bill.date)) : "",
    options.showEntryTime ? receiptRow("Time", formatTime(bill.time)) : "",
    options.showPurchaseType ? receiptRow("Type", bill.purchaseType) : "",
    options.showTransactionType
      ? receiptRow("Transaction", bill.transactionType)
      : "",
    options.showDepartment ? receiptRow("Department", bill.department) : "",
    options.showDebitAccount ? receiptRow("Debit", bill.debitAccount) : "",
    options.showNatureOfEntry ? receiptRow("Nature", bill.natureOfEntry) : "",
  ]
    .filter(Boolean)
    .join("");

  const supplierRows = [
    options.showSupplierName
      ? receiptRow("Supplier", bill.supplierName || "Cash Purchase")
      : "",
    options.showSupplierAddress
      ? receiptRow("Address", bill.supplierAddress)
      : "",
    options.showSupplierPhone ? receiptRow("Phone", bill.supplierPhone) : "",
    options.showSupplierEmail ? receiptRow("Email", bill.supplierEmail) : "",
    options.showSupplierGstin ? receiptRow("GSTIN", bill.supplierGstin) : "",
  ]
    .filter(Boolean)
    .join("");

  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const totalTax = items.reduce((sum, item) => sum + includedTax(item), 0);
  const hasIdentity =
    Boolean(logo) ||
    Boolean(options.showShopName && shop.name) ||
    Boolean(shopLines);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light only" />
  <title>${esc(documentTitle)} - ${esc(
    bill.billNo || bill.entryNo || "",
  )}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      min-width: 0;
      margin: 0;
      background: #ffffff;
      color: #000000;
    }

    html {
      overflow-x: hidden;
    }

    body {
      padding: 12px;
      overflow-x: hidden;
      font: 10px/1.32 ui-monospace, SFMono-Regular, Consolas,
        "Liberation Mono", "Courier New", monospace;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .thermal-receipt {
      width: 68mm;
      max-width: calc(100vw - 24px);
      margin: 0 auto;
      padding: 1.2mm 1.8mm 3.5mm 0.8mm;
      overflow: hidden;
    }

    .thermal-receipt,
    .thermal-receipt * {
      min-width: 0;
      max-width: 100%;
    }

    .identity {
      text-align: center;
    }

    .logo {
      display: block;
      width: auto;
      max-width: 22mm;
      height: auto;
      max-height: 14mm;
      margin: 0 auto 1.4mm;
      object-fit: contain;
      filter: grayscale(1) contrast(1.2);
    }

    .shop-name {
      margin: 0;
      font-size: 15px;
      font-weight: 900;
      line-height: 1.15;
      text-transform: uppercase;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .shop-meta {
      margin-top: 1mm;
      font-size: 9.5px;
      font-weight: 600;
      line-height: 1.35;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .receipt-rule {
      width: 100%;
      margin: 1.8mm 0;
      border-top: 1px dashed #000000;
    }

    .receipt-rule.strong {
      border-top-style: solid;
      border-top-width: 1.5px;
    }

    .document-title {
      margin: 0;
      text-align: center;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.06em;
      line-height: 1.2;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }

    .meta-section {
      display: grid;
      gap: 0.75mm;
    }

    .receipt-row {
      display: grid;
      grid-template-columns: 18mm minmax(0, 1fr);
      column-gap: 1.2mm;
      align-items: start;
      font-size: 9.2px;
      line-height: 1.32;
    }

    .row-label {
      color: #333333;
      font-weight: 700;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }

    .row-value {
      text-align: left;
      font-weight: 800;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .items-heading {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 23mm;
      column-gap: 1.2mm;
      align-items: end;
      padding: 0 0 1mm;
      border-bottom: 1.5px solid #000000;
      font-size: 8.8px;
      font-weight: 900;
      text-transform: uppercase;
    }

    .items-heading span:last-child {
      text-align: right;
    }

    .receipt-item {
      width: 100%;
      padding: 1.5mm 0;
      border-bottom: 1px dashed #000000;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .item-top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 23mm;
      column-gap: 1.2mm;
      align-items: start;
      width: 100%;
      font-size: 10.2px;
      line-height: 1.3;
    }

    .item-name {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .line-number {
      font-weight: 700;
    }

    .item-amount {
      text-align: right;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }

    .item-math {
      display: grid;
      gap: 0.35mm;
      margin-top: 0.65mm;
      color: #333333;
      font-size: 8.8px;
      line-height: 1.3;
    }

    .item-math span {
      display: block;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .item-extra {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4mm 2mm;
      margin-top: 0.65mm;
      color: #333333;
      font-size: 9px;
      line-height: 1.3;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .item-extra span {
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .item-extra b {
      color: #000000;
      font-weight: 800;
    }

    .summary {
      margin-top: 1.3mm;
    }

    .summary-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 28mm;
      column-gap: 1.2mm;
      align-items: start;
      padding: 0.6mm 0;
      font-size: 9.8px;
      line-height: 1.3;
    }

    .summary-row span {
      overflow-wrap: anywhere;
    }

    .summary-row strong {
      text-align: right;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }

    .grand-total {
      margin-top: 0.8mm;
      padding: 1.35mm 0;
      border-top: 1.5px solid #000000;
      border-bottom: 1.5px solid #000000;
      font-size: 12px;
      font-weight: 900;
    }

    .amount-words {
      width: 100%;
      margin-top: 2mm;
      padding-top: 1.5mm;
      border-top: 1px dashed #000000;
      text-align: center;
    }

    .amount-words-label {
      display: block;
      font-size: 8.4px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-align: center;
      text-transform: uppercase;
    }

    .amount-words-value {
      display: block;
      width: 100%;
      margin-top: 0.7mm;
      font-size: 9.2px;
      font-weight: 700;
      line-height: 1.4;
      text-align: center;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }

    .note-block {
      margin-top: 1.8mm;
      font-size: 9.2px;
      line-height: 1.4;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: pre-line;
    }

    .note-label {
      display: block;
      margin-bottom: 0.5mm;
      font-weight: 900;
      text-transform: uppercase;
    }

    .signatory {
      margin-top: 3mm;
      padding-top: 4mm;
      border-top: 1px dashed #000000;
      text-align: center;
      font-size: 9.5px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .receipt-footer {
      margin-top: 2mm;
      padding-top: 1.5mm;
      border-top: 1.5px solid #000000;
      text-align: center;
      font-size: 8.5px;
      font-weight: 700;
    }

    .empty {
      padding: 4mm 0;
      text-align: center;
      font-size: 10px;
    }

    @media print {
      html,
      body {
        width: 80mm !important;
        min-width: 80mm !important;
        max-width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
      }

      .thermal-receipt {
        width: 68mm !important;
        min-width: 68mm !important;
        max-width: 68mm !important;
        margin: 0 !important;
        padding: 1.2mm 1.8mm 4mm 0.8mm !important;
        overflow: hidden !important;
      }
    }
  </style>
</head>
<body>
  <main class="thermal-receipt">
    ${
      hasIdentity
        ? `<header class="identity">
             ${logo ? `<img class="logo" src="${esc(logo)}" alt="Business logo" />` : ""}
             ${
               options.showShopName && shop.name
                 ? `<h1 class="shop-name">${esc(shop.name)}</h1>`
                 : ""
             }
             ${shopLines ? `<div class="shop-meta">${shopLines}</div>` : ""}
           </header>
           <div class="receipt-rule strong"></div>`
        : ""
    }

    <h2 class="document-title">${esc(documentTitle)}</h2>

    ${
      documentRows
        ? `<div class="receipt-rule"></div>
           <section class="meta-section">${documentRows}</section>`
        : ""
    }

    ${
      supplierRows
        ? `<div class="receipt-rule"></div>
           <section class="meta-section">${supplierRows}</section>`
        : ""
    }

    <div class="receipt-rule"></div>

    <div class="items-heading">
      <span>Item / Qty x Rate</span>
      <span>Amount</span>
    </div>

    ${itemRows(input)}

    <section class="summary">
      <div class="summary-row">
        <span>Total quantity</span>
        <strong>${esc(quantity(totalQty))}</strong>
      </div>
      <div class="summary-row">
        <span>Sub total</span>
        <strong>Rs. ${money(subTotal)}</strong>
      </div>
      ${
        options.showTax && totalTax > 0
          ? `<div class="summary-row">
               <span>Tax included</span>
               <strong>Rs. ${money(totalTax)}</strong>
             </div>`
          : ""
      }
      ${
        discount > 0
          ? `<div class="summary-row">
               <span>Bill discount</span>
               <strong>- Rs. ${money(discount)}</strong>
             </div>`
          : ""
      }
      <div class="summary-row grand-total">
        <span>Grand total</span>
        <strong>Rs. ${money(grandTotal)}</strong>
      </div>
    </section>

    ${
      options.showAmountInWords
        ? `<div class="amount-words">
             <span class="amount-words-label">Amount in words</span>
             <strong class="amount-words-value">${esc(
               amountToWords(grandTotal),
             )}</strong>
           </div>`
        : ""
    }

    ${
      options.showTerms && shop.footerNote
        ? `<div class="note-block">
             <span class="note-label">Terms / Note</span>
             ${esc(shop.footerNote)}
           </div>`
        : ""
    }

    ${
      options.showAuthorizedSignatory
        ? `<div class="signatory">
             ${esc(shop.authorizedSignatory || "Authorized Signatory")}
           </div>`
        : ""
    }

    ${
      options.showKynflowFooter
        ? `<footer class="receipt-footer">Generated by KYNFLOW</footer>`
        : ""
    }
  </main>
</body>
</html>`;
}
