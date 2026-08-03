import type { ShopProfile } from "./buildInvoiceHtml";

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
  bill: {
    entryNo?: number | string | null;
    billNo?: string | null;
    date?: string | null;
    time?: string | null;
    supplierName?: string | null;
    department?: string | null;
    debitAccount?: string | null;
    natureOfEntry?: string | null;
    purchaseType?: string | null;
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
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
      return `${convert(Math.floor(value / 1000))}Thousand ${convert(value % 1000)}`;
    }
    if (value < 10000000) {
      return `${convert(Math.floor(value / 100000))}Lakh ${convert(value % 100000)}`;
    }
    return `${convert(Math.floor(value / 10000000))}Crore ${convert(value % 10000000)}`;
  }

  const safe = Math.max(0, Number(amount || 0));
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  const rupeeWords = convert(rupees).trim() || "Zero";
  const paiseWords = paise > 0 ? ` and ${convert(paise).trim()} Paise` : "";
  return `${rupeeWords} Rupees${paiseWords} Only`;
}

export function buildPurchaseInvoiceHtml(input: PurchasePrintInput): string {
  const { shop, bill, items, subTotal, discount, grandTotal } = input;

  const address = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join(" - "),
  ].filter(Boolean);

  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const totalTax = items.reduce((sum, item) => sum + includedTax(item), 0);

  const references = [
    bill.department ? ["Department", bill.department] : null,
    bill.debitAccount ? ["Debit account", bill.debitAccount] : null,
    bill.natureOfEntry ? ["Nature of entry", bill.natureOfEntry] : null,
  ].filter(Boolean) as string[][];

  const itemRows =
    items.length > 0
      ? items
          .map((item, index) => {
            const details = [
              item.batchNo ? `Batch ${item.batchNo}` : "",
              item.expiryDate ? `Exp ${formatExpiry(item.expiryDate)}` : "",
              item.barcode ? `Barcode ${item.barcode}` : "",
            ]
              .filter(Boolean)
              .join(" · ");

            const rate = taxRate(item.taxPercent);
            const tax = includedTax(item);

            return `
              <tr>
                <td class="num center">${index + 1}</td>
                <td>
                  <div class="item-name">${esc(item.name)}</div>
                  ${details ? `<div class="item-detail">${esc(details)}</div>` : ""}
                </td>
                <td class="num right">${esc(quantity(item.qty))}</td>
                <td class="center">${esc(item.unit || "—")}</td>
                <td class="num right">₹ ${money(item.rate)}</td>
                <td class="num right">
                  ${
                    rate
                      ? `<div>₹ ${money(tax)}</div><div class="tax-rate">${money(rate).replace(".00", "")}%</div>`
                      : "—"
                  }
                </td>
                <td class="num right strong">₹ ${money(item.amount)}</td>
              </tr>`;
          })
          .join("")
      : `<tr><td colspan="7" class="empty">No purchase items</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light" />
  <title>Purchase Bill - ${esc(bill.billNo || bill.entryNo || "")}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      --navy: #0b1730;
      --navy-soft: #132746;
      --blue: #2477ff;
      --cyan: #20b7ff;
      --ink: #172033;
      --muted: #657188;
      --line: #dbe2ec;
      --line-soft: #edf1f6;
      --panel: #f6f8fb;
      --white: #ffffff;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #e9edf3;
      color: var(--ink);
      font-family: "Inter", "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.38;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 18px auto;
      padding: 12mm 12mm 10mm;
      background: var(--white);
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.14);
    }

    .brand-line {
      height: 3px;
      margin: -12mm -12mm 10mm;
      background: linear-gradient(90deg, var(--cyan), var(--blue), #8b5cf6);
    }

    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: start;
    }

    .identity {
      min-width: 0;
    }

    .shop-name {
      margin: 0 0 6px;
      color: var(--navy);
      font-size: 22px;
      line-height: 1.05;
      font-weight: 800;
      letter-spacing: -0.025em;
    }

    .shop-meta {
      margin: 2px 0;
      color: #475569;
      font-size: 10.5px;
    }

    .logo-wrap {
      width: 92px;
      height: 70px;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
    }

    .logo {
      max-width: 90px;
      max-height: 68px;
      object-fit: contain;
    }

    .title-band {
      margin: 18px 0 16px;
      padding: 10px 13px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border: 1px solid #d6dfeb;
      border-left: 4px solid var(--blue);
      background: linear-gradient(90deg, #f7faff, #ffffff);
    }

    .title {
      margin: 0;
      color: var(--navy);
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .type-pill {
      border: 1px solid #c8d5e7;
      border-radius: 999px;
      padding: 4px 9px;
      color: #334155;
      background: #ffffff;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 12px;
      margin-bottom: 15px;
    }

    .summary-card {
      min-height: 108px;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }

    .summary-head {
      padding: 6px 10px;
      background: var(--navy);
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }

    .summary-body {
      padding: 10px;
    }

    .party-name {
      margin-bottom: 7px;
      color: var(--navy);
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .muted {
      color: var(--muted);
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px 12px;
    }

    .meta-label {
      display: block;
      margin-bottom: 1px;
      color: #7a8599;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .meta-value {
      color: #1e293b;
      font-size: 10.5px;
      font-weight: 700;
      word-break: break-word;
    }

    .reference-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: -3px 0 13px;
    }

    .reference {
      padding: 5px 8px;
      border: 1px solid #dbe4ef;
      border-radius: 6px;
      background: var(--panel);
      color: #334155;
      font-size: 9px;
    }

    .reference strong {
      color: var(--navy);
    }

    .items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .items thead {
      display: table-header-group;
    }

    .items th {
      padding: 8px 7px;
      background: var(--navy);
      color: #fff;
      border-right: 1px solid rgba(255, 255, 255, 0.16);
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.055em;
      text-transform: uppercase;
      text-align: left;
    }

    .items th:last-child {
      border-right: 0;
    }

    .items td {
      padding: 8px 7px;
      border-bottom: 1px solid var(--line-soft);
      vertical-align: top;
      color: #1f2937;
    }

    .items tbody tr:nth-child(even) {
      background: #fbfcfe;
    }

    .center { text-align: center; }
    .right { text-align: right; }
    .num { font-variant-numeric: tabular-nums; }
    .strong { font-weight: 800; }

    .item-name {
      color: #172033;
      font-weight: 700;
      word-break: break-word;
    }

    .item-detail {
      margin-top: 2px;
      color: #7a8599;
      font-size: 8.7px;
      line-height: 1.25;
    }

    .tax-rate {
      margin-top: 1px;
      color: #7a8599;
      font-size: 8.5px;
    }

    .empty {
      padding: 24px !important;
      text-align: center;
      color: #7a8599 !important;
    }

    .table-total td {
      padding-top: 9px;
      padding-bottom: 9px;
      border-top: 1px solid #b8c4d5;
      border-bottom: 1px solid #b8c4d5;
      background: #f4f7fb;
      color: var(--navy);
      font-weight: 800;
    }

    .footer-grid {
      display: grid;
      grid-template-columns: 1fr 285px;
      gap: 28px;
      margin-top: 17px;
      align-items: start;
    }

    .section-title {
      margin-bottom: 5px;
      color: #5f6b7e;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .words,
    .terms {
      margin-bottom: 10px;
      padding: 8px 10px;
      border: 1px solid #e0e7f0;
      border-radius: 6px;
      background: var(--panel);
      color: #475569;
    }

    .words {
      color: #27364f;
      font-weight: 700;
    }

    .totals {
      width: 100%;
      border-collapse: collapse;
    }

    .totals td {
      padding: 5px 0;
      font-size: 10.5px;
    }

    .totals .value {
      text-align: right;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .discount td {
      color: #b42318;
    }

    .grand td {
      padding: 8px 9px;
      background: var(--navy);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
    }

    .signature {
      margin-top: 30px;
      text-align: center;
      color: #475569;
      font-size: 9.5px;
    }

    .signature-space {
      height: 38px;
    }

    .signature strong {
      color: var(--navy);
    }

    .footer-note {
      margin-top: 15px;
      padding-top: 8px;
      border-top: 1px solid var(--line);
      color: #7a8599;
      font-size: 8.5px;
      text-align: center;
    }

    @page {
      size: A4;
      margin: 8mm;
    }

    @media print {
      html, body {
        background: #fff;
      }

      .sheet {
        width: 100%;
        min-height: auto;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }

      .brand-line {
        margin: 0 0 10mm;
      }

      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <div class="brand-line"></div>

    <header class="header">
      <div class="identity">
        <h1 class="shop-name">${esc(shop.name)}</h1>
        ${address.map((line) => `<div class="shop-meta">${esc(line)}</div>`).join("")}
        ${shop.mobile ? `<div class="shop-meta">Phone: ${esc(shop.mobile)}</div>` : ""}
        ${shop.email ? `<div class="shop-meta">Email: ${esc(shop.email)}</div>` : ""}
        ${shop.gstin ? `<div class="shop-meta"><strong>GSTIN:</strong> ${esc(shop.gstin)}</div>` : ""}
      </div>
      <div class="logo-wrap">
        ${shop.logoUrl ? `<img class="logo" src="${esc(shop.logoUrl)}" alt="Business logo" />` : ""}
      </div>
    </header>

    <section class="title-band">
      <h2 class="title">Purchase Bill</h2>
      <span class="type-pill">${esc(bill.purchaseType || "Purchase")}</span>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <div class="summary-head">Supplier</div>
        <div class="summary-body">
          <div class="party-name">${esc(bill.supplierName || "Cash Purchase")}</div>
          <div class="muted">Supplier details recorded against this purchase transaction.</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-head">Document details</div>
        <div class="summary-body meta-grid">
          <div>
            <span class="meta-label">Entry no.</span>
            <span class="meta-value">${esc(bill.entryNo || "—")}</span>
          </div>
          <div>
            <span class="meta-label">Supplier bill no.</span>
            <span class="meta-value">${esc(bill.billNo || "—")}</span>
          </div>
          <div>
            <span class="meta-label">Purchase date</span>
            <span class="meta-value">${esc(formatDate(bill.date))}</span>
          </div>
          <div>
            <span class="meta-label">Entry time</span>
            <span class="meta-value">${esc(formatTime(bill.time) || "—")}</span>
          </div>
        </div>
      </div>
    </section>

    ${
      references.length
        ? `<section class="reference-strip">${references
            .map(
              ([label, value]) =>
                `<div class="reference"><strong>${esc(label)}:</strong> ${esc(value)}</div>`,
            )
            .join("")}</section>`
        : ""
    }

    <table class="items">
      <colgroup>
        <col style="width: 32px" />
        <col />
        <col style="width: 68px" />
        <col style="width: 54px" />
        <col style="width: 82px" />
        <col style="width: 78px" />
        <col style="width: 92px" />
      </colgroup>
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Item</th>
          <th class="right">Qty</th>
          <th class="center">Unit</th>
          <th class="right">Rate</th>
          <th class="right">GST</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr class="table-total">
          <td></td>
          <td>Total</td>
          <td class="right num">${esc(quantity(totalQty))}</td>
          <td></td>
          <td></td>
          <td class="right num">₹ ${money(totalTax)}</td>
          <td class="right num">₹ ${money(subTotal)}</td>
        </tr>
      </tbody>
    </table>

    <section class="footer-grid">
      <div>
        <div class="section-title">Amount in words</div>
        <div class="words">${esc(amountToWords(grandTotal))}</div>

        <div class="section-title">Terms & notes</div>
        <div class="terms">${esc(
          shop.footerNote || "Purchase recorded in KYNFLOW.",
        )}</div>
      </div>

      <div>
        <table class="totals">
          <tbody>
            <tr>
              <td>Sub total</td>
              <td class="value">₹ ${money(subTotal)}</td>
            </tr>
            ${
              totalTax > 0
                ? `<tr><td>GST included</td><td class="value">₹ ${money(totalTax)}</td></tr>`
                : ""
            }
            ${
              discount > 0
                ? `<tr class="discount"><td>Bill discount</td><td class="value">- ₹ ${money(discount)}</td></tr>`
                : ""
            }
            <tr class="grand">
              <td>Grand total</td>
              <td class="value">₹ ${money(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signature">
          <div>For <strong>${esc(shop.name)}</strong></div>
          <div class="signature-space"></div>
          <div>${esc(shop.authorizedSignatory || "Authorized Signatory")}</div>
        </div>
      </div>
    </section>

    <footer class="footer-note">
      ${esc(shop.footerNote || "Thank you for your business.")}
    </footer>
  </main>
</body>
</html>`;
}
