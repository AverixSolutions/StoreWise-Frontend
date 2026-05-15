// src/lib/print/buildThermalReceiptHtml.ts
type ReceiptShop = {
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

type ReceiptItem = {
  lineNo: number;
  name: string;
  qty: number;
  rate: number;
  total: number;
  offerLabel?: string | null;
  offerSavings?: number | null;
};

type ReceiptInput = {
  shop: ReceiptShop;
  billNo?: string | number | null;
  date?: string | null;
  time?: string | null;
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
};

function esc(v: unknown) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(v: unknown) {
  return Number(v || 0).toFixed(2);
}

function fmtDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB");
}

function fmtTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function amountInWords(n: number) {
  const value = Math.round(Number(n || 0));
  return `${value} Only`;
}

export function buildThermalReceiptHtml(input: ReceiptInput) {
  const {
    shop,
    billNo,
    date,
    time,
    customerName,
    customerPhone,
    customerGstin,
    customerAddress,
    items,
    totalQty,
    subTotal,
    offerSavings = 0,
    offerSummary = [],
    discount = 0,
    grandTotal,
    notes = [],
  } = input;

  const address = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join("-"),
  ]
    .filter(Boolean)
    .join(", ");

  const rows = items
    .map(
      (it) => `
      <tr>
        <td class="item-cell">
          <div class="item-name">${esc(it.lineNo)}. ${esc(it.name)}</div>
          <div class="item-meta">
            ${esc(it.qty)} × ${money(it.rate)}
            ${
              it.offerLabel
                ? `<span class="offer-note"> • ${esc(it.offerLabel)}${
                    it.offerSavings ? ` Saved ${money(it.offerSavings)}` : ""
                  }</span>`
                : ""
            }
          </div>
        </td>
        <td class="amount-cell">${money(it.total)}</td>
      </tr>
    `,
    )
    .join("");

  const notesHtml = notes
    .map((note) => `<div class="note">* ${esc(note)}</div>`)
    .join("");
  const offerSummaryHtml = offerSummary.length
    ? `<div class="note">* Offers: ${esc(offerSummary.join(", "))}</div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Sale Receipt</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      width: 64mm;
      max-width: 64mm;
      margin: 0 auto;
      overflow: hidden;
    }

    .receipt {
      width: 60mm;
      max-width: 60mm;
      margin: 0 auto;
      padding: 4px 0 8px;
      font-size: 10px;
      line-height: 1.2;
      overflow: hidden;
    }

    .center { text-align: center; }
    .left { text-align: left; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .title { font-size: 13px; font-weight: 700; }
    .shop {
      font-size: 17px;
      font-weight: 800;
      line-height: 1.08;
      word-break: break-word;
    }
    .mid {
      font-size: 10.5px;
      font-weight: 700;
      word-break: break-word;
    }
    .small { font-size: 10px; }

    .sep {
      border-top: 1px solid #000;
      margin: 8px 0;
    }

    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 4px;
      margin: 2px 0;
      width: 100%;
    }

    .row > div {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    table {
      width: 100%;
      max-width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      margin-top: 6px;
      overflow: hidden;
    }

    th, td {
      padding: 3px 0;
      vertical-align: top;
      font-size: 10px;
      overflow: hidden;
    }

    thead th {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      font-size: 10px;
    }

    .l { text-align: left; }
    .c { text-align: center; }
    .r { text-align: right; }

    .item-cell {
      width: 66%;
      max-width: 66%;
      text-align: left;
      word-break: break-word;
      overflow-wrap: anywhere;
      padding-right: 3px;
    }

    .amount-cell {
      width: 34%;
      max-width: 34%;
      text-align: right;
      white-space: nowrap;
      font-weight: 700;
      font-size: 9.5px;
      overflow: hidden;
    }

    .item-name {
      font-weight: 700;
      line-height: 1.2;
    }

    .item-meta {
      margin-top: 2px;
      font-size: 10px;
      font-weight: 600;
    }

    .summary-row td {
      border-top: 1px solid #000;
    }

    .offer-note {
      font-size: 10px;
      font-weight: 700;
    }

    .total-box {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 6px 0;
      margin: 7px 0;
    }

    .grand {
      font-size: 13px;
      font-weight: 800;
      white-space: nowrap;
    }

    .note {
      margin: 2px 0;
      font-weight: 700;
      letter-spacing: 0.2px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center title">INVOICE</div>
    ${shop.gstin ? `<div class="center mid">GSTIN : ${esc(shop.gstin)}</div>` : ""}
    <div class="center shop">${esc(shop.name)}</div>
    ${address ? `<div class="center mid">${esc(address)}</div>` : ""}
    ${shop.mobile ? `<div class="center mid">MOB:${esc(shop.mobile)}</div>` : ""}

    <div class="sep"></div>

    <div class="row">
      <div><span class="bold">Bill No</span> ${esc(billNo ?? "")}</div>
      <div class="right">
        <div><span class="bold">Date</span> ${esc(fmtDate(date))}</div>
        <div><span class="bold">Time</span> ${esc(fmtTime(time))}</div>
      </div>
    </div>

    ${
      customerName || customerPhone || customerGstin || customerAddress
        ? `<div style="margin:6px 0 4px;">
            ${customerName ? `<div><span class="bold">Customer:</span> ${esc(customerName)}</div>` : ""}
            ${customerPhone ? `<div><span class="bold">Mobile:</span> ${esc(customerPhone)}</div>` : ""}
            ${customerGstin ? `<div><span class="bold">GSTIN:</span> ${esc(customerGstin)}</div>` : ""}
            ${customerAddress ? `<div><span class="bold">Address:</span> ${esc(customerAddress)}</div>` : ""}
          </div>`
        : ""
    }

    <table>
      <colgroup>
        <col style="width:66%" />
        <col style="width:34%" />
      </colgroup>
      <thead>
        <tr>
          <th class="l">Item</th>
          <th class="r">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="summary-row">
          <td class="right bold">Total Qty: ${esc(totalQty)}</td>
          <td class="r bold">${money(subTotal)}</td>
        </tr>
        ${
          offerSavings > 0
            ? `
            <tr class="summary-row">
              <td class="right bold">Offer savings</td>
              <td class="r bold">${money(offerSavings)}</td>
            </tr>
          `
            : ""
        }
        ${
          discount > 0
            ? `
            <tr class="summary-row">
              <td class="right bold">Bill discount</td>
              <td class="r bold">-${money(discount)}</td>
            </tr>
          `
            : ""
        }
      </tbody>
    </table>

    <div class="total-box">
      <div class="row">
        <div class="bold">Bill Amount:</div>
        <div class="grand right">${money(grandTotal)}</div>
      </div>
      <div class="center">${esc(amountInWords(grandTotal))}</div>
    </div>

    ${
      notesHtml || offerSummaryHtml
        ? `<div style="margin-top:8px;">${offerSummaryHtml}${notesHtml}</div>`
        : ""
    }
  </div>
</body>
</html>
`;
}
