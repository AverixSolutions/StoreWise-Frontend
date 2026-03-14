// src/lib/print/buildInvoiceHtml.ts
export type InvoiceParty = {
  label: string; // Supplier / Customer
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
  taxPercent?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  amount: number;
};

export type InvoiceDocument = {
  title: string; // PURCHASE BILL / SALE BILL
  entryNo?: number | null;
  billNo?: string | null;
  date?: string | null;
  time?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  typeLabel?: string | null; // CASH/CREDIT
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
};

export type InvoiceHtmlInput = {
  shop: ShopProfile;
  document: InvoiceDocument;
  party: InvoiceParty;
  items: InvoiceItem[];
  subTotal: number;
  discount: number;
  grandTotal: number;
  notes?: string | null;
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
  return d.toLocaleDateString("en-IN");
}

function fmtDateTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN");
}

export function buildInvoiceHtml(input: InvoiceHtmlInput) {
  const {
    shop,
    document,
    party,
    items,
    subTotal,
    discount,
    grandTotal,
    notes,
  } = input;

  const fullAddress = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("<br/>");

  const rows = items
    .map(
      (it) => `
      <tr>
        <td>${esc(it.lineNo)}</td>
        <td>${esc(it.name || "")}</td>
        <td>${esc(it.barcode || "")}</td>
        <td>${esc(it.batchNo || "")}</td>
        <td>${esc(it.expiryDate ? fmtDate(it.expiryDate) : "")}</td>
        <td style="text-align:right">${esc(it.qty)}</td>
        <td>${esc(it.unit || "")}</td>
        <td style="text-align:right">${money(it.rate)}</td>
        <td>${esc(it.taxPercent || "")}</td>
        <td style="text-align:right">${it.mrp != null ? money(it.mrp) : ""}</td>
        <td style="text-align:right">${it.salePrice != null ? money(it.salePrice) : ""}</td>
        <td style="text-align:right">${money(it.amount)}</td>
      </tr>
    `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${esc(document.title)}</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }

    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      color: #111;
      margin: 0;
      font-size: 12px;
    }

    .page {
      width: 100%;
    }

    .header {
      display: flex;
      gap: 16px;
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }

    .logo-wrap {
      width: 80px;
      flex: 0 0 80px;
    }

    .logo-wrap img {
      width: 80px;
      height: 80px;
      object-fit: contain;
    }

    .shop-meta {
      flex: 1;
    }

    .shop-name {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .doc-title {
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 8px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    .box {
      border: 1px solid #999;
      padding: 8px;
      min-height: 96px;
    }

    .box-title {
      font-weight: 700;
      margin-bottom: 6px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }

    th, td {
      border: 1px solid #999;
      padding: 6px 5px;
      vertical-align: top;
      font-size: 11px;
    }

    th {
      background: #f3f3f3;
      text-align: left;
    }

    .totals {
      margin-top: 12px;
      margin-left: auto;
      width: 320px;
    }

    .totals table td {
      font-size: 12px;
    }

    .footer {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: end;
    }

    .signature {
      width: 220px;
      text-align: center;
      border-top: 1px solid #333;
      padding-top: 6px;
    }

    .muted {
      color: #555;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${
        shop.logoUrl
          ? `<div class="logo-wrap"><img src="${esc(shop.logoUrl)}" alt="logo" /></div>`
          : ""
      }
      <div class="shop-meta">
        <div class="shop-name">${esc(shop.name)}</div>
        <div>${fullAddress}</div>
        <div>
          ${shop.mobile ? `Mobile: ${esc(shop.mobile)}<br/>` : ""}
          ${shop.email ? `Email: ${esc(shop.email)}<br/>` : ""}
          ${shop.gstin ? `GSTIN: ${esc(shop.gstin)}` : ""}
        </div>
        <div class="doc-title">${esc(document.title)}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="box">
        <div class="box-title">${esc(party.label)} Details</div>
        <div><strong>Name:</strong> ${esc(party.name || "-")}</div>
        ${party.address ? `<div><strong>Address:</strong> ${esc(party.address)}</div>` : ""}
        ${party.mobile ? `<div><strong>Mobile:</strong> ${esc(party.mobile)}</div>` : ""}
        ${party.gstin ? `<div><strong>GSTIN:</strong> ${esc(party.gstin)}</div>` : ""}
      </div>

      <div class="box">
        <div class="box-title">Document Details</div>
        <div><strong>Entry No:</strong> ${esc(document.entryNo ?? "-")}</div>
        <div><strong>Bill No:</strong> ${esc(document.billNo || "-")}</div>
        <div><strong>Date:</strong> ${esc(fmtDate(document.date))}</div>
        <div><strong>Time:</strong> ${esc(fmtDateTime(document.time))}</div>
        <div><strong>Department:</strong> ${esc(document.department || "-")}</div>
        <div><strong>Debit A/c:</strong> ${esc(document.debitAccount || "-")}</div>
        <div><strong>Nature:</strong> ${esc(document.natureOfEntry || "-")}</div>
        <div><strong>Type:</strong> ${esc(document.typeLabel || "-")}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th>Barcode</th>
          <th>Batch</th>
          <th>Expiry</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>Rate</th>
          <th>Tax</th>
          <th>MRP</th>
          <th>Sale Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="12" style="text-align:center">No items</td></tr>`}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td><strong>Sub Total</strong></td>
          <td style="text-align:right">${money(subTotal)}</td>
        </tr>
        <tr>
          <td><strong>Discount</strong></td>
          <td style="text-align:right">${money(discount)}</td>
        </tr>
        <tr>
          <td><strong>Grand Total</strong></td>
          <td style="text-align:right"><strong>${money(grandTotal)}</strong></td>
        </tr>
      </table>
    </div>

    ${
      notes
        ? `<div style="margin-top:12px"><strong>Notes:</strong> ${esc(notes)}</div>`
        : ""
    }

    <div class="footer">
      <div class="muted">Computer generated bill</div>
      <div class="signature">Authorized Signature</div>
    </div>
  </div>
</body>
</html>
`;
}
