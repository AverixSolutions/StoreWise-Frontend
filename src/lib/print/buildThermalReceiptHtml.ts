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
};

type ReceiptInput = {
  shop: ReceiptShop;
  billNo?: string | number | null;
  date?: string | null;
  time?: string | null;
  customerPhone?: string | null;
  items: ReceiptItem[];
  totalQty: number;
  subTotal: number;
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
    customerPhone,
    items,
    totalQty,
    subTotal,
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
          <td class="c">${esc(it.lineNo)}</td>
          <td class="l name">${esc(it.name)}</td>
          <td class="c">${esc(it.qty)}</td>
          <td class="r">${money(it.rate)}</td>
          <td class="r">${money(it.total)}</td>
        </tr>
      `,
    )
    .join("");

  const notesHtml = notes
    .map((note) => `<div class="note">* ${esc(note)}</div>`)
    .join("");

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

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      width: 80mm;
    }

    .receipt {
      width: 72mm;
      margin: 0 auto;
      padding: 8px 0 12px;
      font-size: 12px;
      line-height: 1.25;
    }

    .center { text-align: center; }
    .left { text-align: left; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .title { font-size: 15px; font-weight: 700; }
    .shop { font-size: 22px; font-weight: 800; line-height: 1.05; }
    .mid { font-size: 13px; font-weight: 700; }
    .small { font-size: 11px; }

    .sep {
      border-top: 1px solid #000;
      margin: 8px 0;
    }

    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin: 2px 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }

    th, td {
      padding: 4px 2px;
      vertical-align: top;
      font-size: 12px;
    }

    thead th {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      font-size: 11px;
    }

    .l { text-align: left; }
    .c { text-align: center; }
    .r { text-align: right; }

    .name {
      width: 44%;
      font-weight: 700;
      word-break: break-word;
    }

    .total-box {
      border: 1px solid #000;
      border-radius: 6px;
      padding: 8px;
      margin: 8px 0;
    }

    .grand {
      font-size: 16px;
      font-weight: 800;
    }

    .gst-row {
      display: grid;
      grid-template-columns: 0.8fr 1.2fr 1fr 1fr;
      gap: 6px;
      margin: 2px 0;
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

    ${customerPhone ? `<div style="margin:6px 0 4px;"><span class="bold">To :</span> ${esc(customerPhone)}</div>` : ""}

    <table>
      <thead>
        <tr>
          <th class="c">#</th>
          <th class="l">Name</th>
          <th class="c">Qty</th>
          <th class="r">Rate</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td colspan="2" class="right bold">Total</td>
          <td class="c bold">${esc(totalQty)}</td>
          <td></td>
          <td class="r bold">${money(subTotal)}</td>
        </tr>
        ${
          discount > 0
            ? `
            <tr>
              <td colspan="4" class="right bold">Discount</td>
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
        <div class="grand">${money(grandTotal)}</div>
      </div>
      <div class="center">${esc(amountInWords(grandTotal))}</div>
    </div>

    <div class="gst-row bold">
      <div>GST %</div>
      <div>Taxable</div>
      <div>CGST Amt</div>
      <div>SGST Amt</div>
    </div>
    <div class="gst-row">
      <div>5%</div>
      <div>${money(grandTotal)}</div>
      <div>0.00</div>
      <div>0.00</div>
    </div>

    ${notesHtml ? `<div style="margin-top:8px;">${notesHtml}</div>` : ""}
  </div>
</body>
</html>
`;
}
