// src/lib/print/buildInvoiceHtml.ts

// ── Types ─────────────────────────────────────────────────────────────────────

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
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(v: unknown): string {
  return Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function qty(v: unknown): string {
  const n = Number(v || 0);
  return Number.isInteger(n) ? String(n) : money(n);
}

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtTime(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtExpiry(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

function taxPct(v?: string | number | null): number {
  if (v == null || v === "" || v === "NT") return 0;
  return Number(String(v).replace("P", "").replace("%", "")) || 0;
}

function lineTaxAmount(it: InvoiceItem): number {
  const pct = taxPct(it.taxPercent);
  if (!pct) return 0;

  const amount = Number(it.amount || 0);
  return amount - amount / (1 + pct / 100);
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

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + " " + ones[n % 10] + " ";
    if (n < 1000) {
      return ones[Math.floor(n / 100)] + " Hundred " + convert(n % 100);
    }
    if (n < 100000) {
      return convert(Math.floor(n / 1000)) + "Thousand " + convert(n % 1000);
    }
    if (n < 10000000) {
      return convert(Math.floor(n / 100000)) + "Lakh " + convert(n % 100000);
    }
    return convert(Math.floor(n / 10000000)) + "Crore " + convert(n % 10000000);
  }

  const rupees = Math.floor(Number(amount || 0));
  const paise = Math.round((Number(amount || 0) - rupees) * 100);

  let result = (convert(rupees).trim() || "Zero") + " Rupees";
  if (paise > 0) result += " and " + convert(paise).trim() + " Paise";

  return result + " Only";
}

// ── Main Builder ──────────────────────────────────────────────────────────────

export function buildInvoiceHtml(input: InvoiceHtmlInput): string {
  const {
    shop,
    document: doc,
    party,
    items,
    subTotal,
    discount,
    offerSavings = 0,
    offerSummary = [],
    grandTotal,
    notes,
  } = input;

  const theme = "#7c72dc";

  const shopAddress = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join(" - "),
  ].filter(Boolean);

  const shopStateLine = shop.state ? `State: ${shop.state}` : "";

  const totalQty = items.reduce((s, it) => s + Number(it.qty || 0), 0);
  const totalTax = items.reduce((s, it) => s + lineTaxAmount(it), 0);

  const docNo = doc.billNo || doc.entryNo || "—";
  const docDate = fmtDate(doc.date);
  const docTime = fmtTime(doc.time);

  const footerNote =
    shop.footerNote || notes || "Thanks for doing business with us!";

  const signatory = shop.authorizedSignatory || "Authorized Signatory";

  const itemRowsHtml =
    items.length > 0
      ? items
          .map((it, idx) => {
            const pct = taxPct(it.taxPercent);
            const taxAmt = lineTaxAmount(it);

            const subLine = [
              it.batchNo ? `Batch: ${it.batchNo}` : "",
              it.expiryDate ? `Exp: ${fmtExpiry(it.expiryDate)}` : "",
              it.barcode ? `Barcode: ${it.barcode}` : "",
            ]
              .filter(Boolean)
              .join("  •  ");

            const offerLine = it.offerName
              ? `${it.offerType ? `${it.offerType}: ` : "Offer: "}${it.offerName}${
                  it.offerDiscountAmount
                    ? ` | Saved ₹${money(it.offerDiscountAmount)}`
                    : ""
                }`
              : "";

            return `
              <tr>
                <td class="td-center">${esc(idx + 1)}</td>
                <td class="td-item">
                  <div class="item-name">${esc(it.name || "")}</div>
                  ${subLine ? `<div class="item-sub">${esc(subLine)}</div>` : ""}
                  ${offerLine ? `<div class="item-sub item-offer">${esc(offerLine)}</div>` : ""}
                </td>
                <td class="td-right">${esc(qty(it.qty))}</td>
                <td class="td-center">${esc(it.unit || "")}</td>
                <td class="td-right">₹ ${money(it.rate)}</td>
                <td class="td-right">
                  ${
                    pct
                      ? `<div>₹ ${money(taxAmt)}</div><div class="gst-rate">(${pct}%)</div>`
                      : `<div>—</div>`
                  }
                </td>
                <td class="td-right td-amount">₹ ${money(it.amount)}</td>
              </tr>
            `;
          })
          .join("")
      : `
        <tr>
          <td colspan="7" class="empty-cell">No items</td>
        </tr>
      `;

  const offerSummaryHtml = offerSummary.length
    ? `
      <div class="soft-box offer-box">
        <div class="box-title">OFFERS</div>
        <div>${esc(offerSummary.join(", "))}</div>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(doc.title)} - ${esc(shop.name)}</title>
<style>
  *, *::before, *::after {
    box-sizing: border-box;
  }

  :root {
    --theme: ${theme};
    --theme-dark: #655bc6;
    --ink: #171717;
    --muted: #4b5563;
    --muted-2: #71717a;
    --soft: #f6f6f7;
    --soft-2: #fafafa;
    --line: #d7d7dc;
    --line-light: #ececf0;
    --white: #ffffff;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #f3f4f6;
    color: var(--ink);
    font-family: "Inter", "Segoe UI", Arial, Helvetica, sans-serif;
    font-size: 11.2px;
    line-height: 1.35;
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .no-print {
    position: fixed;
    top: 12px;
    right: 16px;
    z-index: 9999;
    display: flex;
    gap: 8px;
  }

  .btn {
    border: 0;
    border-radius: 4px;
    padding: 8px 14px;
    background: #27272a;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn:hover {
    background: #111827;
  }

  .btn-close {
    background: #52525b;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 12px auto;
    background: var(--white);
    padding: 13mm 12mm 11mm;
    box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
  }

  .top {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 24px;
    align-items: start;
  }

  .shop-name {
    margin: 0 0 5px;
    color: #050505;
    font-size: 20px;
    line-height: 1.08;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .shop-line {
    margin: 0 0 3px;
    color: #252525;
    font-size: 11.2px;
    line-height: 1.35;
    font-weight: 400;
  }

  .logo-wrap {
    width: 88px;
    height: 72px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
  }

  .logo {
    max-width: 84px;
    max-height: 68px;
    object-fit: contain;
  }

  .doc-title {
    margin: 18px 0 19px;
    text-align: center;
    color: var(--theme);
    font-size: 21px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: -0.015em;
  }

  .bill-grid {
    display: grid;
    grid-template-columns: 1fr 250px;
    gap: 30px;
    margin-bottom: 17px;
    align-items: start;
  }

  .section-label {
    margin-bottom: 9px;
    color: #111;
    font-size: 12.5px;
    font-weight: 800;
  }

  .party-name {
    margin-bottom: 8px;
    color: #000;
    font-size: 12.6px;
    line-height: 1.28;
    font-weight: 800;
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }

  .party-line {
    margin: 0 0 5px;
    color: #1f2937;
    font-size: 11.2px;
    line-height: 1.35;
  }

  .meta {
    padding-top: 29px;
    text-align: right;
  }

  .meta-line {
    margin: 0 0 5px;
    color: #111827;
    font-size: 11.2px;
    line-height: 1.35;
  }

  .meta-line strong {
    font-size: 11.8px;
    font-weight: 800;
  }

  .items {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-top: 7px;
  }

  .items thead tr {
    background: var(--theme);
    color: #fff;
  }

  .items th {
    padding: 8px 7px;
    color: #fff;
    font-size: 11.3px;
    line-height: 1.15;
    font-weight: 800;
    text-align: left;
    border-right: 1px solid rgba(255, 255, 255, 0.22);
  }

  .items th:last-child {
    border-right: 0;
  }

  .items td {
    padding: 7px 7px;
    vertical-align: top;
    color: #111;
    font-size: 11.2px;
    line-height: 1.28;
    border-bottom: 1px solid var(--line-light);
  }

  .td-center {
    text-align: center;
  }

  .td-right {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .td-item {
    word-break: break-word;
  }

  .item-name {
    font-weight: 500;
    color: #111;
  }

  .item-sub {
    margin-top: 2px;
    color: #71717a;
    font-size: 9.6px;
    line-height: 1.25;
  }

  .item-offer {
    color: #047857;
    font-weight: 700;
  }

  .gst-rate {
    margin-top: 1px;
    color: #27272a;
    font-size: 10.2px;
  }

  .td-amount {
    white-space: nowrap;
    font-weight: 500;
  }

  .empty-cell {
    padding: 22px 8px !important;
    text-align: center;
    color: #71717a !important;
  }

  .total-row td {
    padding-top: 10px;
    padding-bottom: 10px;
    border-top: 1.2px solid #9ca3af;
    border-bottom: 1.2px solid #9ca3af;
    font-weight: 800;
  }

  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 36px;
    margin-top: 19px;
    align-items: start;
  }

  .soft-box {
    margin-bottom: 13px;
  }

  .box-title {
    margin-bottom: 5px;
    color: #5b5b62;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.045em;
    text-transform: uppercase;
  }

  .box-body {
    background: #f7f7f8;
    padding: 7px 9px;
    color: #5f6368;
    font-size: 11.2px;
    line-height: 1.35;
  }

  .offer-box {
    background: #f0fdf4;
    color: #047857;
    padding: 7px 9px;
    font-size: 11.2px;
    line-height: 1.35;
    border-left: 3px solid #16a34a;
  }

  .totals {
    width: 100%;
    border-collapse: collapse;
  }

  .totals td {
    padding: 4.5px 0;
    color: #111;
    font-size: 11.4px;
    line-height: 1.25;
  }

  .totals .label {
    text-align: left;
  }

  .totals .value {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .discount-row td {
    color: #b91c1c;
  }

  .grand-row td {
    padding: 7px 8px;
    background: var(--theme);
    color: #fff;
    font-size: 13px;
    font-weight: 800;
  }

  .after-total td {
    border-bottom: 1px solid var(--line);
  }

  .signature {
    margin-top: 23px;
    text-align: center;
    color: #111;
    font-size: 11.2px;
  }

  .signature-for {
    margin-bottom: 50px;
    color: #164e63;
    font-size: 11.2px;
  }

  @page {
    size: A4;
    margin: 8mm;
  }

  @media print {
    html,
    body {
      background: #fff;
    }

    .no-print {
      display: none !important;
    }

    .page {
      width: 100%;
      min-height: auto;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }

    thead {
      display: table-header-group;
    }

    tr {
      page-break-inside: avoid;
    }
  }
</style>
</head>
<body>
  <div class="no-print">
    <button class="btn" onclick="(function(){var t=document.title;document.title='__KYNFLOW_PRINT__';setTimeout(function(){document.title=t;},300);})()">Print</button>
    <button class="btn btn-close" onclick="window.close()">Close</button>
  </div>

  <main class="page">
    <section class="top">
      <div>
        <h1 class="shop-name">${esc(shop.name)}</h1>

        ${shop.mobile ? `<p class="shop-line">Phone no.: ${esc(shop.mobile)}</p>` : ""}
        ${shop.email ? `<p class="shop-line">Email: ${esc(shop.email)}</p>` : ""}
        ${shop.gstin ? `<p class="shop-line">GSTIN: ${esc(shop.gstin)}</p>` : ""}
        ${
          shopAddress.length
            ? `<p class="shop-line">${shopAddress.map(esc).join("<br/>")}</p>`
            : ""
        }
        ${shopStateLine ? `<p class="shop-line">${esc(shopStateLine)}</p>` : ""}
      </div>

      <div class="logo-wrap">
        ${
          shop.logoUrl
            ? `<img src="${esc(shop.logoUrl)}" alt="Logo" class="logo" />`
            : ""
        }
      </div>
    </section>

    <h2 class="doc-title">${esc(doc.title)}</h2>

    <section class="bill-grid">
      <div>
        <div class="section-label">Bill To:</div>

        ${
          party.name
            ? `<div class="party-name">${esc(party.name)}</div>`
            : `<div class="party-name">—</div>`
        }

        ${party.mobile ? `<p class="party-line">Contact No.: ${esc(party.mobile)}</p>` : ""}
        ${party.gstin ? `<p class="party-line">GSTIN Number: ${esc(party.gstin)}</p>` : ""}
        ${party.address ? `<p class="party-line">${esc(party.address)}</p>` : ""}
      </div>

      <div class="meta">
        ${shop.state ? `<p class="meta-line">Place of supply: ${esc(shop.state)}</p>` : ""}
        <p class="meta-line"><strong>Invoice No.: ${esc(docNo)}</strong></p>
        <p class="meta-line"><strong>Date: ${esc(docDate)}</strong></p>
        ${docTime ? `<p class="meta-line">Time: ${esc(docTime)}</p>` : ""}
        ${doc.typeLabel ? `<p class="meta-line">Type: ${esc(doc.typeLabel)}</p>` : ""}
      </div>
    </section>

    <table class="items">
      <colgroup>
        <col style="width: 32px" />
        <col />
        <col style="width: 78px" />
        <col style="width: 62px" />
        <col style="width: 92px" />
        <col style="width: 92px" />
        <col style="width: 96px" />
      </colgroup>

      <thead>
        <tr>
          <th style="text-align:center">#</th>
          <th>Item name</th>
          <th style="text-align:right">Quantity</th>
          <th style="text-align:center">Unit</th>
          <th style="text-align:right">Price / Unit</th>
          <th style="text-align:right">GST</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>

      <tbody>
        ${itemRowsHtml}

        <tr class="total-row">
          <td></td>
          <td>Total</td>
          <td class="td-right">${esc(qty(totalQty))}</td>
          <td></td>
          <td></td>
          <td class="td-right">₹ ${money(totalTax)}</td>
          <td class="td-right">₹ ${money(subTotal)}</td>
        </tr>
      </tbody>
    </table>

    <section class="bottom-grid">
      <div>
        <div class="soft-box">
          <div class="box-title">Invoice Amount In Words</div>
          <div class="box-body">${esc(amountToWords(grandTotal))}</div>
        </div>

        <div class="soft-box">
          <div class="box-title">Terms And Conditions</div>
          <div class="box-body">${esc(footerNote)}</div>
        </div>

        ${offerSummaryHtml}
      </div>

      <div>
        <table class="totals">
          <tbody>
            <tr>
              <td class="label">Sub Total</td>
              <td class="value">₹ ${money(subTotal)}</td>
            </tr>

            ${
              totalTax > 0
                ? `
                  <tr>
                    <td class="label">GST</td>
                    <td class="value">₹ ${money(totalTax)}</td>
                  </tr>
                `
                : ""
            }

            ${
              offerSavings > 0
                ? `
                  <tr class="discount-row">
                    <td class="label">Offer Savings</td>
                    <td class="value">- ₹ ${money(offerSavings)}</td>
                  </tr>
                `
                : ""
            }

            ${
              discount > 0
                ? `
                  <tr class="discount-row">
                    <td class="label">Discount</td>
                    <td class="value">- ₹ ${money(discount)}</td>
                  </tr>
                `
                : ""
            }

            <tr class="grand-row">
              <td class="label">Total</td>
              <td class="value">₹ ${money(grandTotal)}</td>
            </tr>

            <tr class="after-total">
              <td class="label">Received</td>
              <td class="value">₹ 0.00</td>
            </tr>

            <tr>
              <td class="label">Balance</td>
              <td class="value">₹ ${money(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signature">
          <div class="signature-for">For, ${esc(shop.name)}</div>
          <div>${esc(signatory)}</div>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;
}
