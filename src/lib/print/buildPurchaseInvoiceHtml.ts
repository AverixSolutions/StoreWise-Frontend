import type { ShopProfile } from "./buildInvoiceHtml";
import type { PurchasePrintCustomization } from "./purchasePrintCustomization";

export type PurchasePrintItem = {
  lineNo: number;
  name: string;
  barcode?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  qty: number;
  unit?: string | null;
  rate: number;
  taxPercent?: string | number | null;
  mrp?: number | null;
  salePrice?: number | null;
  amount: number;
};

export type PurchasePrintInput = {
  shop: ShopProfile;
  options: PurchasePrintCustomization;
  bill: {
    entryNo?: number | string | null;
    billNo?: string | null;
    date?: string | null;
    time?: string | null;
    supplierName?: string | null;
    supplierAddress?: string | null;
    supplierPhone?: string | null;
    supplierEmail?: string | null;
    supplierGstin?: string | null;
    department?: string | null;
    debitAccount?: string | null;
    natureOfEntry?: string | null;
    purchaseType?: string | null;
    transactionType?: string | null;
  };
  items: PurchasePrintItem[];
  subTotal: number;
  discount: number;
  grandTotal: number;
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
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) ? String(parsed) : money(parsed);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string | null): string {
  if (!value) return "—";
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

function safeHex(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : "#1e3a5f";
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

function infoRow(label: string, value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";

  return `
    <div class="info-row">
      <span>${esc(label)}</span>
      <strong>${esc(text)}</strong>
    </div>
  `;
}

function reference(label: string, value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";

  return `<div class="reference"><strong>${esc(label)}:</strong> ${esc(text)}</div>`;
}

export function buildPurchaseInvoiceHtml(input: PurchasePrintInput): string {
  const { shop, bill, items, subTotal, discount, grandTotal, options } = input;
  const accent = safeHex(options.headingColor);
  const isClassic = options.a4Style === "classic";
  const logo = options.showLogo ? shop.logoUrl : null;

  const shopAddress = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(", ");

  const shopContact = [
    options.showShopPhone && shop.mobile ? `Phone: ${shop.mobile}` : "",
    options.showShopEmail && shop.email ? `Email: ${shop.email}` : "",
  ]
    .filter(Boolean)
    .join("  •  ");

  const shopMeta = [
    options.showShopAddress && shopAddress
      ? `<div class="business-meta">${esc(shopAddress)}</div>`
      : "",
    shopContact ? `<div class="business-meta">${esc(shopContact)}</div>` : "",
    options.showShopGstin && shop.gstin
      ? `<div class="business-meta"><strong>GSTIN:</strong> ${esc(
          shop.gstin,
        )}</div>`
      : "",
  ].join("");

  const supplierRows = [
    options.showSupplierName
      ? infoRow("Supplier", bill.supplierName || "Cash Purchase")
      : "",
    options.showSupplierAddress ? infoRow("Address", bill.supplierAddress) : "",
    options.showSupplierPhone ? infoRow("Phone", bill.supplierPhone) : "",
    options.showSupplierEmail ? infoRow("Email", bill.supplierEmail) : "",
    options.showSupplierGstin ? infoRow("GSTIN", bill.supplierGstin) : "",
  ]
    .filter(Boolean)
    .join("");

  const documentRows = [
    options.showEntryNo ? infoRow("Entry No", bill.entryNo) : "",
    options.showBillNo ? infoRow("Supplier Bill No", bill.billNo) : "",
    options.showPurchaseDate
      ? infoRow("Purchase Date", formatDate(bill.date))
      : "",
    options.showEntryTime ? infoRow("Entry Time", formatTime(bill.time)) : "",
    options.showPurchaseType ? infoRow("Purchase Type", bill.purchaseType) : "",
    options.showTransactionType
      ? infoRow("Transaction Type", bill.transactionType)
      : "",
  ]
    .filter(Boolean)
    .join("");

  const infoPanels = [
    supplierRows
      ? `<div class="info-panel"><h3>Supplier details</h3>${supplierRows}</div>`
      : "",
    documentRows
      ? `<div class="info-panel"><h3>Document details</h3>${documentRows}</div>`
      : "",
  ].filter(Boolean);

  const infoGrid = infoPanels.length
    ? `<section class="info-grid" style="grid-template-columns: ${
        infoPanels.length === 1 ? "1fr" : "1.12fr 0.88fr"
      }">${infoPanels.join("")}</section>`
    : "";

  const references = [
    options.showDepartment ? reference("Department", bill.department) : "",
    options.showDebitAccount
      ? reference("Debit account", bill.debitAccount)
      : "",
    options.showNatureOfEntry
      ? reference("Nature of entry", bill.natureOfEntry)
      : "",
  ]
    .filter(Boolean)
    .join("");

  const optionalColumns = [
    options.showUnit ? "unit" : "",
    options.showTax ? "tax" : "",
  ].filter(Boolean);

  const columnCount = 5 + optionalColumns.length;
  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const totalTax = items.reduce((sum, item) => sum + includedTax(item), 0);

  const itemRows =
    items.length > 0
      ? items
          .map((item, index) => {
            const details = [
              options.showBatchNo && item.batchNo
                ? `Batch ${item.batchNo}`
                : "",
              options.showExpiryDate && item.expiryDate
                ? `Exp ${formatExpiry(item.expiryDate)}`
                : "",
              options.showBarcode && item.barcode
                ? `Barcode ${item.barcode}`
                : "",
            ]
              .filter(Boolean)
              .join("  •  ");

            const rate = taxRate(item.taxPercent);
            const tax = includedTax(item);

            return `
              <tr>
                <td class="number center">${esc(item.lineNo || index + 1)}</td>
                <td class="particular">
                  <strong>${esc(item.name)}</strong>
                  ${details ? `<span>${esc(details)}</span>` : ""}
                </td>
                <td class="number right">${esc(quantity(item.qty))}</td>
                ${
                  options.showUnit
                    ? `<td class="center">${esc(item.unit || "—")}</td>`
                    : ""
                }
                <td class="number right">₹ ${money(item.rate)}</td>
                ${
                  options.showTax
                    ? `<td class="number right">${
                        rate
                          ? `<strong>₹ ${money(tax)}</strong><span>${money(
                              rate,
                            ).replace(".00", "")}%</span>`
                          : "—"
                      }</td>`
                    : ""
                }
                <td class="number right row-total">₹ ${money(item.amount)}</td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="${columnCount}" class="empty">No purchase items</td></tr>`;

  const businessName = options.showShopName && shop.name ? esc(shop.name) : "";
  const documentTitle =
    String(options.documentTitle || "").trim() || "Purchase Bill";
  const showBusinessBlock = Boolean(logo || businessName || shopMeta);

  if (isClassic) {
    const classicDocumentRows = [
      documentRows,
      options.showDepartment ? infoRow("Department", bill.department) : "",
      options.showDebitAccount
        ? infoRow("Debit Account", bill.debitAccount)
        : "",
      options.showNatureOfEntry
        ? infoRow("Nature of Entry", bill.natureOfEntry)
        : "",
    ]
      .filter(Boolean)
      .join("");

    const classicColumnCount =
      6 + (options.showUnit ? 1 : 0) + (options.showTax ? 1 : 0);
    const classicDocumentNumber =
      options.showBillNo && bill.billNo
        ? `Bill No: ${bill.billNo}`
        : options.showEntryNo && bill.entryNo
          ? `Entry No: ${bill.entryNo}`
          : bill.purchaseType || "Purchase";
    const classicGeneratedAt = [
      options.showPurchaseDate ? formatDate(bill.date) : "",
      options.showEntryTime ? formatTime(bill.time) : "",
    ]
      .filter(Boolean)
      .join(", ");
    const classicHeaderMeta = [
      options.showShopAddress && shopAddress
        ? `<p class="classic-business-meta">${esc(shopAddress)}</p>`
        : "",
      shopContact
        ? `<p class="classic-business-meta">${esc(shopContact)}</p>`
        : "",
    ].join("");

    const classicItemRows =
      items.length > 0
        ? items
            .map((item, index) => {
              const details = [
                options.showBatchNo && item.batchNo
                  ? `Batch ${item.batchNo}`
                  : "",
                options.showExpiryDate && item.expiryDate
                  ? `Exp ${formatExpiry(item.expiryDate)}`
                  : "",
                options.showBarcode && item.barcode
                  ? `Barcode ${item.barcode}`
                  : "",
              ]
                .filter(Boolean)
                .join(" • ");

              const rate = taxRate(item.taxPercent);
              const tax = includedTax(item);

              return `
                <tr>
                  <td class="classic-center classic-number">${esc(
                    item.lineNo || index + 1,
                  )}</td>
                  <td class="classic-date">${esc(formatDate(bill.date))}</td>
                  <td class="classic-particular">
                    <strong>${esc(item.name)}</strong>
                    ${details ? `<span>${esc(details)}</span>` : ""}
                  </td>
                  <td class="classic-right classic-number">${esc(
                    quantity(item.qty),
                  )}</td>
                  ${
                    options.showUnit
                      ? `<td class="classic-center">${esc(item.unit || "—")}</td>`
                      : ""
                  }
                  <td class="classic-right classic-number">₹ ${money(
                    item.rate,
                  )}</td>
                  ${
                    options.showTax
                      ? `<td class="classic-right classic-number">${
                          rate
                            ? `<strong>₹ ${money(tax)}</strong><span>${money(
                                rate,
                              ).replace(".00", "")}%</span>`
                            : "—"
                        }</td>`
                      : ""
                  }
                  <td class="classic-right classic-number classic-row-total">₹ ${money(
                    item.amount,
                  )}</td>
                </tr>
              `;
            })
            .join("")
        : `<tr><td colspan="${classicColumnCount}" class="classic-empty">No purchase items</td></tr>`;

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
      size: A4 portrait;
      margin: 7mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    body {
      color: #111827;
      font: 9.7px/1.35 "Manrope", "Segoe UI", Arial, Helvetica, sans-serif;
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    h1,
    h2,
    h3,
    p {
      margin: 0;
    }

    table {
      border-spacing: 0;
    }

    .classic-bill {
      width: 196mm;
      margin: 0 auto;
      overflow: hidden;
      border: 0.35mm solid #111827;
      background: #ffffff;
    }

    .classic-top-strip {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      min-height: 8.5mm;
      align-items: center;
      gap: 8mm;
      padding: 1.8mm 4mm;
      border-bottom: 0.35mm solid #111827;
      background: #ffffff;
      color: #111827;
      font-size: 8.8px;
      font-weight: 900;
      letter-spacing: 0.045em;
      text-transform: uppercase;
    }

    .classic-top-strip span:last-child {
      text-align: right;
      white-space: nowrap;
    }

    .classic-header-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border-bottom: 0.35mm solid #111827;
    }

    .classic-header-table td {
      height: 26mm;
      padding: 4mm;
      vertical-align: middle;
    }

    .classic-logo-cell {
      width: 24mm;
      padding-right: 0 !important;
      text-align: center;
    }

    .classic-logo {
      display: block;
      width: 21mm;
      max-height: 18mm;
      margin: 0 auto;
      object-fit: contain;
    }

    .classic-business-cell {
      min-width: 0;
      text-align: ${logo ? "left" : "center"};
    }

    .classic-business-cell h1 {
      color: ${esc(accent)};
      font-size: ${logo ? "24px" : "29px"};
      font-weight: 900;
      letter-spacing: 0.015em;
      line-height: 1;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }

    .classic-business-meta {
      margin-top: 1.25mm;
      color: #1f2937;
      font-size: 9.8px;
      font-weight: 800;
      line-height: 1.35;
    }

    .classic-gstin-cell {
      width: 50mm;
      border-left: 0.35mm solid #111827;
      text-align: right;
    }

    .classic-gstin-cell span {
      display: block;
      color: #6b7280;
      font-size: 8.6px;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .classic-gstin-cell strong {
      display: block;
      margin-top: 1mm;
      color: #111827;
      font-size: 11.5px;
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    .classic-document-title {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      border-bottom: 0.35mm solid #111827;
    }

    .classic-document-title::before,
    .classic-document-title::after {
      content: "";
      height: 0.25mm;
      background: #111827;
    }

    .classic-document-title h2 {
      padding: 2mm 7mm;
      color: #111827;
      font-size: 13.5px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-align: center;
      text-transform: uppercase;
    }

    .classic-info-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border-bottom: 0.35mm solid #111827;
    }

    .classic-info-table > tbody > tr > td {
      width: 50%;
      min-height: 31mm;
      padding: 3mm 4mm;
      vertical-align: top;
    }

    .classic-info-table > tbody > tr > td + td {
      border-left: 0.35mm solid #111827;
    }

    .classic-info-table h3 {
      margin-bottom: 1.8mm;
      color: #111827;
      font-size: 9.4px;
      font-weight: 900;
      letter-spacing: 0.055em;
      text-transform: uppercase;
    }

    .info-row {
      display: grid;
      grid-template-columns: 30mm minmax(0, 1fr);
      gap: 2mm;
      min-height: 4.7mm;
      align-items: start;
      padding: 0.65mm 0;
      border-bottom: 0.2mm solid #94a3b8;
    }

    .info-row span {
      color: #64748b;
      font-size: 8.4px;
      font-weight: 900;
      letter-spacing: 0.015em;
      text-transform: uppercase;
    }

    .info-row strong {
      min-width: 0;
      color: #111827;
      font-size: 9.5px;
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    .classic-items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .classic-items thead {
      display: table-header-group;
    }

    .classic-items th {
      padding: 1.9mm 1.1mm;
      border-right: 0.25mm solid #111827;
      border-bottom: 0.35mm solid #111827;
      background: ${esc(accent)};
      color: #ffffff;
      font-size: 8.3px;
      font-weight: 900;
      letter-spacing: 0.035em;
      text-align: left;
      text-transform: uppercase;
    }

    .classic-items td {
      padding: 2.2mm 1.1mm;
      border-right: 0.22mm solid #111827;
      border-bottom: 0.22mm solid #111827;
      color: #111827;
      font-size: 9.1px;
      vertical-align: top;
    }

    .classic-items th:last-child,
    .classic-items td:last-child {
      border-right: 0;
    }

    .classic-items tbody tr:last-child td {
      border-bottom-width: 0.35mm;
    }

    .classic-center {
      text-align: center;
    }

    .classic-right {
      text-align: right;
    }

    .classic-number {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .classic-date {
      white-space: nowrap;
      font-size: 8.7px !important;
    }

    .classic-particular strong {
      display: block;
      color: #111827;
      font-size: 9.7px;
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    .classic-particular span,
    .classic-items td > span {
      display: block;
      margin-top: 0.55mm;
      color: #64748b;
      font-size: 8px;
      font-weight: 700;
      line-height: 1.3;
      white-space: normal;
    }

    .classic-row-total {
      font-weight: 900;
    }

    .classic-empty {
      padding: 10mm !important;
      text-align: center;
      color: #64748b !important;
      font-weight: 900;
    }

    .classic-bottom-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .classic-bottom-table > tbody > tr > td {
      min-height: 30mm;
      padding: 0;
      vertical-align: top;
    }

    .classic-bottom-table > tbody > tr > td + td {
      width: 58mm;
      border-left: 0.35mm solid #111827;
    }

    .classic-bottom-left {
      min-height: 30mm;
      padding: 3mm 4mm;
    }

    .classic-section-label {
      color: #111827;
      font-size: 8.6px;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .classic-note {
      margin-top: 1.25mm;
      color: #334155;
      font-size: 8.9px;
      font-weight: 700;
      line-height: 1.42;
      white-space: pre-wrap;
    }

    .classic-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7mm;
      margin-top: 9mm;
    }

    .classic-signature {
      border-top: 0.25mm solid #111827;
      padding-top: 1.3mm;
      color: #111827;
      font-size: 8.4px;
      font-weight: 900;
      text-align: center;
      text-transform: uppercase;
    }

    .classic-totals {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .classic-totals td {
      height: 7mm;
      padding: 1.7mm 3mm;
      border-bottom: 0.22mm solid #111827;
      color: #111827;
      font-size: 9.2px;
      font-weight: 900;
    }

    .classic-totals td:last-child {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .classic-totals .classic-discount td {
      color: #7f1d1d;
    }

    .classic-totals .classic-grand td {
      border-bottom: 0;
      background: ${esc(accent)};
      color: #ffffff;
      font-size: 10.8px;
    }

    .classic-footer {
      display: flex;
      min-height: 7mm;
      align-items: center;
      justify-content: space-between;
      gap: 4mm;
      padding: 1.7mm 4mm;
      border-top: 0.35mm solid #111827;
      color: #374151;
      font-size: 8.5px;
      font-weight: 800;
    }

    @media print {
      .classic-bill {
        width: auto;
        margin: 0;
      }

      tr,
      .classic-info-table,
      .classic-bottom-table {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <main class="classic-bill">
    <section class="classic-top-strip">
      <span>Original • Purchase document</span>
      <span>${esc(classicDocumentNumber)}</span>
    </section>

    ${
      showBusinessBlock || options.showShopGstin
        ? `<table class="classic-header-table">
            <colgroup>
              ${logo ? '<col style="width: 24mm" />' : ""}
              <col />
              ${options.showShopGstin ? '<col style="width: 50mm" />' : ""}
            </colgroup>
            <tbody>
              <tr>
                ${
                  logo
                    ? `<td class="classic-logo-cell"><img class="classic-logo" src="${esc(
                        logo,
                      )}" alt="Business logo" /></td>`
                    : ""
                }
                <td class="classic-business-cell">
                  ${businessName ? `<h1>${businessName}</h1>` : ""}
                  ${classicHeaderMeta}
                </td>
                ${
                  options.showShopGstin
                    ? `<td class="classic-gstin-cell">
                        <span>GSTIN</span>
                        <strong>${shop.gstin ? esc(shop.gstin) : "—"}</strong>
                      </td>`
                    : ""
                }
              </tr>
            </tbody>
          </table>`
        : ""
    }

    <section class="classic-document-title">
      <h2>${esc(documentTitle)}</h2>
    </section>

    <table class="classic-info-table">
      <tbody>
        <tr>
          <td>
            <h3>Supplier Details</h3>
            ${supplierRows}
          </td>
          <td>
            <h3>Bill Details</h3>
            ${classicDocumentRows}
          </td>
        </tr>
      </tbody>
    </table>

    <table class="classic-items">
      <colgroup>
        <col style="width: 8mm" />
        <col style="width: 22mm" />
        <col />
        <col style="width: 12mm" />
        ${options.showUnit ? '<col style="width: 14mm" />' : ""}
        <col style="width: 22mm" />
        ${options.showTax ? '<col style="width: 22mm" />' : ""}
        <col style="width: 25mm" />
      </colgroup>
      <thead>
        <tr>
          <th class="classic-center">Sl</th>
          <th>Date</th>
          <th>Particulars</th>
          <th class="classic-right">Qty</th>
          ${options.showUnit ? '<th class="classic-center">Unit</th>' : ""}
          <th class="classic-right">Rate</th>
          ${options.showTax ? '<th class="classic-right">Tax</th>' : ""}
          <th class="classic-right">Total</th>
        </tr>
      </thead>
      <tbody>${classicItemRows}</tbody>
    </table>

    <table class="classic-bottom-table">
      <colgroup>
        <col />
        <col style="width: 58mm" />
      </colgroup>
      <tbody>
        <tr>
          <td>
            <div class="classic-bottom-left">
              ${
                options.showAmountInWords
                  ? `<p class="classic-section-label">Amount in words</p>
                     <p class="classic-note">${esc(
                       amountToWords(grandTotal),
                     )}</p>`
                  : ""
              }
              ${
                options.showTerms && shop.footerNote
                  ? `<p class="classic-section-label" style="margin-top: 2.5mm">Terms & Notes</p>
                     <p class="classic-note">${esc(shop.footerNote)}</p>`
                  : ""
              }
              ${
                options.showAuthorizedSignatory
                  ? `<div class="classic-signatures">
                      <div class="classic-signature">Prepared by</div>
                      <div class="classic-signature">${esc(
                        shop.authorizedSignatory || "Authorized Signatory",
                      )}</div>
                    </div>`
                  : ""
              }
            </div>
          </td>
          <td>
            <table class="classic-totals">
              <tbody>
                <tr>
                  <td>Subtotal</td>
                  <td>₹ ${money(subTotal)}</td>
                </tr>
                ${
                  options.showTax
                    ? `<tr><td>Tax Included</td><td>₹ ${money(
                        totalTax,
                      )}</td></tr>`
                    : ""
                }
                <tr class="${discount > 0 ? "classic-discount" : ""}">
                  <td>Discount</td>
                  <td>${discount > 0 ? "- " : ""}₹ ${money(discount)}</td>
                </tr>
                <tr class="classic-grand">
                  <td>Grand Total</td>
                  <td>₹ ${money(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>

    ${
      options.showKynflowFooter
        ? `<footer class="classic-footer">
            <span>${esc(
              shop.footerNote || "Thank you for your business.",
            )}</span>
            <span>${
              classicGeneratedAt
                ? `Generated: ${esc(classicGeneratedAt)}`
                : "Generated by KYNFLOW"
            }</span>
          </footer>`
        : ""
    }
  </main>
</body>
</html>`;
  }

  const modernDocumentNumber =
    (options.showBillNo && bill.billNo ? String(bill.billNo) : "") ||
    (options.showEntryNo && bill.entryNo ? String(bill.entryNo) : "");
  const modernDocumentDate =
    options.showPurchaseDate && bill.date ? formatDate(bill.date) : "";
  const modernDocumentTime =
    options.showEntryTime && bill.time ? formatTime(bill.time) : "";
  const modernSupplierName =
    options.showSupplierName && bill.supplierName
      ? esc(bill.supplierName)
      : options.showSupplierName
        ? "Cash Purchase"
        : "";
  const modernSupplierDetails = [
    options.showSupplierAddress && bill.supplierAddress
      ? `<p>${esc(bill.supplierAddress)}</p>`
      : "",
    options.showSupplierPhone && bill.supplierPhone
      ? `<p>${esc(bill.supplierPhone)}</p>`
      : "",
    options.showSupplierEmail && bill.supplierEmail
      ? `<p>${esc(bill.supplierEmail)}</p>`
      : "",
    options.showSupplierGstin && bill.supplierGstin
      ? `<p><strong>GSTIN:</strong> ${esc(bill.supplierGstin)}</p>`
      : "",
  ].join("");
  const modernContact = [
    options.showShopPhone && shop.mobile ? shop.mobile : "",
    options.showShopEmail && shop.email ? shop.email : "",
  ]
    .filter(Boolean)
    .join("  •  ");

  const modernMetaCells = [
    modernDocumentNumber
      ? `<div>
          <span>Invoice number</span>
          <strong>${esc(modernDocumentNumber)}</strong>
          ${
            options.showEntryNo &&
            bill.entryNo &&
            String(bill.entryNo) !== modernDocumentNumber
              ? `<small>Entry ${esc(bill.entryNo)}</small>`
              : ""
          }
        </div>`
      : "",
    modernDocumentDate || modernDocumentTime
      ? `<div>
          <span>Date information</span>
          ${modernDocumentDate ? `<strong>${esc(modernDocumentDate)}</strong>` : ""}
          ${modernDocumentTime ? `<small>${esc(modernDocumentTime)}</small>` : ""}
        </div>`
      : "",
    options.showPurchaseType && bill.purchaseType
      ? `<div>
          <span>Purchase type</span>
          <strong>${esc(bill.purchaseType)}</strong>
        </div>`
      : "",
    options.showTransactionType && bill.transactionType
      ? `<div>
          <span>Transaction type</span>
          <strong>${esc(bill.transactionType)}</strong>
        </div>`
      : "",
  ]
    .filter(Boolean)
    .slice(0, 2);
  const modernMetaCard = modernMetaCells.length
    ? `<div class="modern-meta-card" style="grid-template-columns: repeat(${modernMetaCells.length}, minmax(0, 1fr))">${modernMetaCells.join("")}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light only" />
  <title>${esc(documentTitle)}${
    modernDocumentNumber ? ` - ${esc(modernDocumentNumber)}` : ""
  }</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 7mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    body {
      color: #111827;
      font: 10px/1.42 "Manrope", "Segoe UI", Arial, Helvetica, sans-serif;
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    h1,
    h2,
    h3,
    p {
      margin: 0;
    }

    .modern-invoice {
      width: 196mm;
      min-height: 0;
      margin: 0 auto;
      padding: 6mm 7mm 5mm;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 8mm 24mm rgba(15, 23, 42, 0.08);
    }

    .modern-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.18fr) minmax(54mm, 0.82fr);
      gap: 7mm;
      align-items: start;
      min-height: 24mm;
    }

    .modern-brand {
      display: flex;
      min-width: 0;
      align-items: flex-start;
      gap: 3mm;
    }

    .modern-logo,
    .modern-logo-mark {
      width: 14mm;
      height: 14mm;
      flex: 0 0 14mm;
      border-radius: 1.2mm;
    }

    .modern-logo {
      object-fit: contain;
    }

    .modern-logo-mark {
      display: grid;
      place-items: center;
      background: ${esc(accent)};
      color: #ffffff;
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
    }

    .modern-brand-copy {
      min-width: 0;
      padding-top: 0.7mm;
    }

    .modern-brand-copy h1 {
      color: #111827;
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.01em;
      line-height: 1.05;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }

    .modern-brand-copy .business-meta {
      margin-top: 1mm;
      color: #64748b;
      font-size: 8.6px;
      font-weight: 700;
      line-height: 1.35;
    }

    .modern-title {
      text-align: right;
    }

    .modern-title .eyebrow {
      color: ${esc(accent)};
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .modern-title h2 {
      margin-top: 1mm;
      color: #111827;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 0.025em;
      line-height: 1;
      text-transform: uppercase;
    }

    .modern-title .number {
      margin-top: 1.5mm;
      color: #64748b;
      font-size: 8.8px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .modern-rule {
      height: 0.45mm;
      margin: 3mm 0 3.5mm;
      background: linear-gradient(
        90deg,
        ${esc(accent)} 0 22%,
        #94a3b8 22% 100%
      );
    }

    .modern-overview {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 78mm;
      gap: 6mm;
      align-items: stretch;
      margin-bottom: 3mm;
    }

    .modern-kicker {
      margin-bottom: 2mm;
      color: #111827;
      font-size: 8.4px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .modern-supplier {
      min-height: 20mm;
      padding-top: 0.5mm;
    }

    .modern-supplier h3 {
      color: #111827;
      font-size: 11.2px;
      font-weight: 900;
      line-height: 1.2;
    }

    .modern-supplier p {
      margin-top: 0.7mm;
      color: #475569;
      font-size: 8.8px;
      font-weight: 700;
      line-height: 1.35;
    }

    .modern-meta-card {
      position: relative;
      display: grid;
      min-height: 20mm;
      overflow: hidden;
      border: 0.25mm solid #64748b;
      padding-left: 1.8mm;
      background: #ffffff;
    }

    .modern-meta-card::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 1.8mm;
      background: ${esc(accent)};
    }

    .modern-meta-card > div {
      padding: 2.8mm 3mm;
    }

    .modern-meta-card > div + div {
      border-left: 0.25mm solid #94a3b8;
    }

    .modern-meta-card span {
      display: block;
      color: #64748b;
      font-size: 7.5px;
      font-weight: 900;
      letter-spacing: 0.055em;
      text-transform: uppercase;
    }

    .modern-meta-card strong {
      display: block;
      margin-top: 1.2mm;
      color: #111827;
      font-size: 9.2px;
      font-weight: 900;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .modern-meta-card small {
      display: block;
      margin-top: 0.7mm;
      color: #64748b;
      font-size: 7.5px;
      font-weight: 700;
    }

    .modern-reference-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 1mm;
      margin: 0 0 2.5mm;
    }

    .modern-reference-strip .reference {
      padding: 0.8mm 1.5mm;
      border: 0.2mm solid #94a3b8;
      border-radius: 0.8mm;
      background: #ffffff;
      color: #475569;
      font-size: 7.5px;
      font-weight: 700;
    }

    .modern-items {
      width: 100%;
      border: 0.25mm solid #64748b;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .modern-items thead {
      display: table-header-group;
    }

    .modern-items th {
      padding: 2mm 1.5mm;
      background: ${esc(accent)};
      color: #ffffff;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.055em;
      text-align: left;
      text-transform: uppercase;
    }

    .modern-items th:first-child {
      border-radius: 0;
    }

    .modern-items th:last-child {
      border-radius: 0;
    }

    .modern-items th + th {
      border-left: 0.2mm solid rgba(255, 255, 255, 0.38);
    }

    .modern-items td {
      height: 9mm;
      padding: 1.8mm 1.5mm;
      border-right: 0.2mm solid #cbd5e1;
      border-bottom: 0.25mm solid #94a3b8;
      vertical-align: middle;
      color: #334155;
      font-size: 8.7px;
    }

    .modern-items tbody tr:nth-child(odd) {
      background: #ffffff;
    }

    .modern-items tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    .modern-items td:last-child {
      border-right: 0;
    }

    .modern-items tbody tr:last-child td {
      border-bottom: 0;
    }

    .modern-items .center {
      text-align: center;
    }

    .modern-items .right {
      text-align: right;
    }

    .modern-items .number {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .modern-items .particular strong {
      display: block;
      color: #111827;
      font-size: 9.2px;
      font-weight: 900;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .modern-items .particular span,
    .modern-items td > span {
      display: block;
      margin-top: 0.6mm;
      color: #64748b;
      font-size: 7.4px;
      font-weight: 700;
      white-space: normal;
    }

    .modern-items .row-total {
      color: #111827;
      font-weight: 900;
    }

    .modern-items .empty {
      height: 24mm;
      text-align: center;
      color: #64748b;
      font-weight: 800;
    }

    .modern-items .table-total td {
      height: auto;
      padding: 1.8mm 1.5mm;
      border-top: 0.3mm solid #475569;
      background: #ffffff;
      color: #111827;
      font-weight: 900;
    }

    .modern-closing {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 61mm;
      gap: 6mm;
      align-items: start;
      margin-top: 4mm;
    }

    .modern-notes-grid {
      display: grid;
      grid-template-columns: 0.8fr 1.2fr;
      gap: 4mm;
    }

    .modern-section-label {
      color: #111827;
      font-size: 8.2px;
      font-weight: 900;
      letter-spacing: 0.055em;
      text-transform: uppercase;
    }

    .modern-note {
      margin-top: 1.2mm;
      color: #475569;
      font-size: 8px;
      font-weight: 700;
      line-height: 1.35;
      white-space: pre-wrap;
    }

    .modern-signature {
      width: 38mm;
      margin-top: 7mm;
      border-top: 0.3mm solid #475569;
      padding-top: 1.2mm;
      color: #111827;
      font-size: 8px;
      font-weight: 900;
      text-align: center;
      text-transform: uppercase;
    }

    .modern-totals {
      width: 100%;
      border-collapse: collapse;
    }

    .modern-totals td {
      padding: 1.2mm 0;
      color: #111827;
      font-size: 8.4px;
      font-weight: 900;
    }

    .modern-totals td:last-child {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .modern-totals .discount td {
      color: #b42318;
    }

    .modern-totals .grand td {
      padding: 2.1mm 2.6mm;
      background: ${esc(accent)};
      color: #ffffff;
      font-size: 10px;
    }

    .modern-totals .grand td:first-child {
      border-radius: 1.1mm 0 0 1.1mm;
    }

    .modern-totals .grand td:last-child {
      border-radius: 0 1.1mm 1.1mm 0;
    }

    .modern-footer {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6mm;
      align-items: end;
      margin-top: 5mm;
      padding-top: 2.8mm;
      border-top: 0.3mm solid #94a3b8;
    }

    .modern-footer .system-note {
      color: #94a3b8;
      font-size: 7.5px;
      font-weight: 700;
    }

    .modern-footer .thank-you {
      color: ${esc(accent)};
      font-size: 11px;
      font-weight: 900;
      text-align: right;
    }

    .modern-footer .contact {
      margin-top: 1mm;
      color: #64748b;
      font-size: 7.5px;
      font-weight: 700;
      text-align: right;
    }

    @media print {
      .modern-invoice {
        width: auto;
        min-height: auto;
        box-shadow: none;
      }

      tr,
      .modern-overview,
      .modern-closing {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <main class="modern-invoice">
    <header class="modern-hero">
      <div class="modern-brand">
        ${
          logo
            ? `<img class="modern-logo" src="${esc(logo)}" alt="Business logo" />`
            : options.showLogo && showBusinessBlock
              ? `<div class="modern-logo-mark">${esc(
                  String(shop.name || "K").slice(0, 1),
                )}</div>`
              : ""
        }
        ${
          showBusinessBlock
            ? `<div class="modern-brand-copy">
                ${businessName ? `<h1>${businessName}</h1>` : ""}
                ${shopMeta}
              </div>`
            : ""
        }
      </div>

      <div class="modern-title">
        <span class="eyebrow">Purchase document</span>
        <h2>${esc(documentTitle)}</h2>
        ${
          modernDocumentNumber
            ? `<p class="number">#${esc(modernDocumentNumber)}</p>`
            : ""
        }
      </div>
    </header>

    <div class="modern-rule"></div>

    <section
      class="modern-overview"
      style="grid-template-columns: ${
        modernMetaCard ? "minmax(0, 1fr) 78mm" : "1fr"
      }"
    >
      <div class="modern-supplier">
        <div class="modern-kicker">Purchase from</div>
        ${modernSupplierName ? `<h3>${modernSupplierName}</h3>` : ""}
        ${modernSupplierDetails}
      </div>

      ${modernMetaCard}
    </section>

    ${
      references
        ? `<section class="modern-reference-strip">${references}</section>`
        : ""
    }

    <table class="modern-items">
      <colgroup>
        <col style="width: 11mm" />
        <col />
        <col style="width: 18mm" />
        ${options.showUnit ? '<col style="width: 16mm" />' : ""}
        <col style="width: 23mm" />
        ${options.showTax ? '<col style="width: 23mm" />' : ""}
        <col style="width: 28mm" />
      </colgroup>
      <thead>
        <tr>
          <th class="center">No</th>
          <th>Item description</th>
          <th class="right">Qty</th>
          ${options.showUnit ? '<th class="center">Unit</th>' : ""}
          <th class="right">Price</th>
          ${options.showTax ? '<th class="right">Tax</th>' : ""}
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr class="table-total">
          <td></td>
          <td>Total</td>
          <td class="right number">${esc(quantity(totalQty))}</td>
          ${options.showUnit ? "<td></td>" : ""}
          <td></td>
          ${
            options.showTax
              ? `<td class="right number">₹ ${money(totalTax)}</td>`
              : ""
          }
          <td class="right number">₹ ${money(subTotal)}</td>
        </tr>
      </tbody>
    </table>

    <section class="modern-closing">
      <div>
        <div class="modern-notes-grid">
          <div>
            <div class="modern-section-label">Purchase information</div>
            <div class="modern-note">${
              [
                options.showPurchaseType && bill.purchaseType
                  ? `Type: ${bill.purchaseType}`
                  : "",
                options.showTransactionType && bill.transactionType
                  ? `Transaction: ${bill.transactionType}`
                  : "",
              ]
                .filter(Boolean)
                .map((line) => esc(line))
                .join("<br />") || "Purchase document"
            }</div>
          </div>

          <div>
            ${
              options.showAmountInWords
                ? `<div class="modern-section-label">Amount in words</div>
                   <div class="modern-note">${esc(
                     amountToWords(grandTotal),
                   )}</div>`
                : ""
            }
            ${
              options.showTerms && shop.footerNote
                ? `<div class="modern-section-label" style="margin-top: 3mm">Terms & conditions</div>
                   <div class="modern-note">${esc(shop.footerNote)}</div>`
                : ""
            }
          </div>
        </div>

        ${
          options.showAuthorizedSignatory
            ? `<div class="modern-signature">${esc(
                shop.authorizedSignatory || "Authorized Signatory",
              )}</div>`
            : ""
        }
      </div>

      <table class="modern-totals">
        <tbody>
          <tr>
            <td>Sub total</td>
            <td>₹ ${money(subTotal)}</td>
          </tr>
          ${
            options.showTax && totalTax > 0
              ? `<tr><td>Tax included</td><td>₹ ${money(totalTax)}</td></tr>`
              : ""
          }
          ${
            discount > 0
              ? `<tr class="discount"><td>Bill discount</td><td>- ₹ ${money(
                  discount,
                )}</td></tr>`
              : ""
          }
          <tr class="grand">
            <td>Grand total</td>
            <td>₹ ${money(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <footer class="modern-footer">
      <div class="system-note">
        ${options.showKynflowFooter ? "Generated by KYNFLOW" : ""}
      </div>
      <div>
        <div class="thank-you">Thank you for your business!</div>
        ${modernContact ? `<div class="contact">${esc(modernContact)}</div>` : ""}
      </div>
    </footer>
  </main>
</body>
</html>`;
}
