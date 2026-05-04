// src/lib/print/buildInvoiceHtml.ts

// ── Types (backward-compatible with all callers) ──────────────────────────────

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

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
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
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
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
    if (n < 1000)
      return ones[Math.floor(n / 100)] + " Hundred " + convert(n % 100);
    if (n < 100000)
      return convert(Math.floor(n / 1000)) + "Thousand " + convert(n % 1000);
    if (n < 10000000)
      return convert(Math.floor(n / 100000)) + "Lakh " + convert(n % 100000);
    return convert(Math.floor(n / 10000000)) + "Crore " + convert(n % 10000000);
  }
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
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
    grandTotal,
    notes,
  } = input;

  // Address
  const addrParts = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join(", "),
  ].filter(Boolean);

  // Tax total extracted from inclusive rates
  const totalTax = items.reduce((sum, it) => {
    const pct =
      it.taxPercent === "NT"
        ? 0
        : Number(String(it.taxPercent ?? "0").replace("P", "")) || 0;
    if (!pct) return sum;
    const baseRate = it.rate / (1 + pct / 100);
    return sum + (it.rate - baseRate) * it.qty;
  }, 0);

  // Right-panel meta rows
  const metaRows: [string, string][] = [];
  if (doc.entryNo != null) metaRows.push(["Entry No.", String(doc.entryNo)]);
  if (doc.billNo) metaRows.push(["Bill No.", doc.billNo]);
  metaRows.push(["Date", fmtDate(doc.date)]);
  const t = fmtTime(doc.time);
  if (t) metaRows.push(["Time", t]);
  if (doc.typeLabel) metaRows.push(["Type", doc.typeLabel]);
  if (doc.department) metaRows.push(["Dept.", doc.department]);
  if (doc.debitAccount) metaRows.push(["Debit A/c", doc.debitAccount]);
  if (doc.natureOfEntry) metaRows.push(["Nature", doc.natureOfEntry]);

  const metaHtml = metaRows
    .map(
      ([label, value]) =>
        `<tr><td class="ml">${esc(label)}</td><td class="mv">${esc(value)}</td></tr>`,
    )
    .join("");

  // Item rows
  const itemRowsHtml = items
    .map((it) => {
      const taxLabel =
        it.taxPercent === "NT"
          ? "NT"
          : it.taxPercent != null
            ? `${it.taxPercent}%`
            : "—";
      const sub = [
        it.batchNo ? `Batch: ${it.batchNo}` : "",
        it.expiryDate ? `Exp: ${fmtExpiry(it.expiryDate)}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `
        <tr>
          <td class="c-no">${esc(it.lineNo)}</td>
          <td class="c-name">
            <div class="iname">${esc(it.name || "")}</div>
            ${sub ? `<div class="isub">${esc(sub)}</div>` : ""}
            ${it.barcode ? `<div class="isub">Barcode: ${esc(it.barcode)}</div>` : ""}
          </td>
          <td class="c-r">${money(it.rate)}</td>
          <td class="c-r">${esc(it.qty)}${it.unit ? ` <span class="unit">${esc(it.unit)}</span>` : ""}</td>
          <td class="c-r c-tax">${taxLabel}</td>
          <td class="c-r">${it.mrp != null ? money(it.mrp) : "—"}</td>
          <td class="c-r">${it.salePrice != null ? money(it.salePrice) : "—"}</td>
          <td class="c-r c-amt">${money(it.amount)}</td>
        </tr>`;
    })
    .join("");

  const footerNote =
    shop.footerNote ||
    notes ||
    "Thank you for your business. This is a computer-generated document.";

  const signatory = esc(shop.authorizedSignatory || "Authorized Signatory");

  const stripParts = [
    doc.title.toUpperCase(),
    doc.entryNo != null ? `#${doc.entryNo}` : "",
    doc.billNo || "",
    fmtDate(doc.date),
  ]
    .filter(Boolean)
    .join("  ·  ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(doc.title)} — ${esc(shop.name)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,400&family=Inter:wght@400;500;600;700&display=swap');

:root{
  --ink:#0d1520;--ink-mid:#374151;--ink-dim:#6b7280;--ink-faint:#9ca3af;
  --rule:#e5e7eb;--rule-dk:#cbd5e1;
  --accent:#1e3a5f;--accent2:#2d5282;
  --bg-soft:#f8fafc;--bg-tint:#eef4ff;
  --red:#dc2626;--white:#fff;
}

html,body{
  font-family:'Inter','Segoe UI',sans-serif;
  font-size:10pt;color:var(--ink);
  background:var(--white);line-height:1.45;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}

/* ── Print controls (screen only) ── */
.no-print{position:fixed;top:12px;right:16px;display:flex;gap:8px;z-index:999;}
.btn{background:var(--accent);color:#fff;border:none;padding:8px 20px;
     font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;
     box-shadow:0 2px 10px rgba(30,58,95,.28);font-family:'Inter',sans-serif;}
.btn:hover{background:var(--accent2);}
.btn-close{background:#374151;}.btn-close:hover{background:#1f2937;}

/* ── Page ── */
.page{
  width:210mm;max-width:210mm;margin:0 auto;
  padding:10mm 12mm 12mm;background:var(--white);
  min-height:297mm;display:flex;flex-direction:column;
}

@page{size:A4;margin:10mm 12mm;}
@media print{
  html,body{background:var(--white);}
  .no-print{display:none!important;}
  .page{padding:0;width:100%;max-width:100%;}
  thead{display:table-header-group;}
  tr{page-break-inside:avoid;}
}

/* ── Header ── */
.inv-hdr{
  display:grid;grid-template-columns:1fr 160px;gap:16px;
  padding-bottom:10px;border-bottom:2.5px solid var(--accent);
  margin-bottom:10px;align-items:start;
}
.shop-id{display:flex;align-items:flex-start;gap:12px;}
.shop-logo{height:54px;width:auto;max-width:110px;object-fit:contain;
           flex-shrink:0;border-radius:4px;}
.shop-name{font-family:'Lora',Georgia,serif;font-size:18pt;font-weight:600;
           color:var(--accent);letter-spacing:-.02em;line-height:1.15;}
.shop-addr{font-size:8pt;color:var(--ink-mid);margin-top:3px;line-height:1.55;}
.shop-contact{font-size:8pt;color:var(--ink-dim);margin-top:3px;
              display:flex;flex-wrap:wrap;gap:0 12px;}
.shop-gstin{font-size:7.5pt;color:var(--ink-dim);margin-top:4px;
            font-family:monospace;letter-spacing:.04em;}

/* ── Doc meta ── */
.doc-blk{text-align:right;}
.doc-title{font-family:'Lora',Georgia,serif;font-size:12pt;font-weight:600;
           color:var(--accent);text-transform:uppercase;letter-spacing:.06em;
           border-bottom:1.5px solid var(--accent);padding-bottom:4px;margin-bottom:6px;}
.mt{border-collapse:collapse;width:100%;}
.ml{font-size:7.5pt;color:var(--ink-faint);text-transform:uppercase;
    letter-spacing:.06em;padding:1.5px 10px 1.5px 0;white-space:nowrap;text-align:left;}
.mv{font-size:8.5pt;font-weight:500;color:var(--ink);text-align:right;padding:1.5px 0;}

/* ── Party ── */
.party-band{background:var(--bg-tint);border:1px solid var(--rule-dk);
            border-radius:5px;padding:7px 12px;margin-bottom:10px;
            display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.p-lbl{font-size:7.5pt;font-weight:600;text-transform:uppercase;
       letter-spacing:.08em;color:var(--ink-faint);white-space:nowrap;}
.p-sep{width:1px;height:16px;background:var(--rule-dk);flex-shrink:0;}
.p-name{font-size:10pt;font-weight:600;color:var(--accent);}
.p-detail{font-size:8pt;color:var(--ink-dim);}

/* ── Items table ── */
.items-tbl{width:100%;border-collapse:collapse;font-size:9pt;}
.items-tbl thead tr{background:var(--accent);color:var(--white);}
.items-tbl thead th{padding:6px 7px;font-size:7.5pt;font-weight:600;
                    text-transform:uppercase;letter-spacing:.07em;
                    text-align:right;white-space:nowrap;border:none;}
.items-tbl thead th.th-l{text-align:left;}
.items-tbl tbody tr{border-bottom:1px solid var(--rule);}
.items-tbl tbody tr:last-child{border-bottom:1.5px solid var(--rule-dk);}
.items-tbl tbody tr:nth-child(even){background:#fafbfc;}
.c-no{font-size:8pt;color:var(--ink-faint);text-align:left;width:22px;padding:5px 6px;}
.c-name{text-align:left;padding:5px 7px;}
.c-r{text-align:right;padding:5px 7px;font-variant-numeric:tabular-nums;white-space:nowrap;}
.c-tax{color:var(--ink-dim);font-size:8pt;}
.c-amt{font-weight:600;}
.unit{font-size:7.5pt;color:var(--ink-faint);}
.iname{font-size:9.5pt;font-weight:500;color:var(--ink);line-height:1.3;}
.isub{font-size:7.5pt;color:var(--ink-faint);margin-top:1px;}

/* ── Totals ── */
.totals-sec{display:grid;grid-template-columns:1fr auto;gap:12px;
            margin-top:10px;align-items:end;}
.amt-words{font-size:8.5pt;color:var(--ink-mid);font-style:italic;
           padding:8px 10px;background:var(--bg-tint);
           border-radius:5px;border:1px solid var(--rule);
           max-width:320px;align-self:end;line-height:1.5;}
.amt-words strong{display:block;font-size:7.5pt;font-style:normal;
                  text-transform:uppercase;letter-spacing:.06em;
                  color:var(--ink-faint);margin-bottom:2px;}
.tot-tbl{border-collapse:collapse;min-width:200px;}
.tot-tbl td{padding:3px 0 3px 14px;font-size:9pt;vertical-align:middle;}
.tl{color:var(--ink-mid);text-align:left;padding-left:0;padding-right:18px;white-space:nowrap;}
.tv{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.tr-disc td{color:var(--red);}
.tr-tax td{color:var(--ink-dim);}
.tr-grand{border-top:2px solid var(--accent);}
.tr-grand td{padding-top:5px;font-size:11pt;font-weight:700;color:var(--accent);}

/* ── Footer ── */
.inv-ftr{margin-top:auto;padding-top:12px;border-top:1px solid var(--rule);
         display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end;}
.ftr-note{font-size:8pt;color:var(--ink-dim);line-height:1.6;max-width:360px;}
.ftr-note strong{display:block;font-size:7.5pt;text-transform:uppercase;
                 letter-spacing:.06em;color:var(--ink-faint);margin-bottom:2px;}
.sig-blk{text-align:center;min-width:130px;}
.sig-line{border-top:1px solid var(--ink-mid);padding-top:4px;font-size:8pt;
          font-weight:500;color:var(--ink-mid);white-space:nowrap;}
.sig-lbl{font-size:7pt;color:var(--ink-faint);text-transform:uppercase;
         letter-spacing:.06em;margin-top:2px;}
.strip{background:var(--accent);color:rgba(255,255,255,.5);font-size:6.5pt;
       letter-spacing:.1em;text-align:center;padding:3px 8px;
       border-radius:0 0 4px 4px;margin-top:8px;user-select:none;}
</style>
</head>
<body>

<div class="no-print">
  <button class="btn" onclick="window.print()">🖨 Print</button>
  <button class="btn btn-close" onclick="window.close()">✕ Close</button>
</div>

<div class="page">

  <!-- ── Header ── -->
  <header class="inv-hdr">
    <div class="shop-id">
      ${
        shop.logoUrl
          ? `<img src="${esc(shop.logoUrl)}" alt="logo" class="shop-logo"/>`
          : ""
      }
      <div>
        <div class="shop-name">${esc(shop.name)}</div>
        ${
          addrParts.length
            ? `<div class="shop-addr">${addrParts.map(esc).join("<br/>")}</div>`
            : ""
        }
        ${
          shop.mobile || shop.email
            ? `<div class="shop-contact">
               ${shop.mobile ? `<span>📞 ${esc(shop.mobile)}</span>` : ""}
               ${shop.email ? `<span>✉ ${esc(shop.email)}</span>` : ""}
             </div>`
            : ""
        }
        ${
          shop.gstin
            ? `<div class="shop-gstin">GSTIN: ${esc(shop.gstin)}</div>`
            : ""
        }
      </div>
    </div>

    <div class="doc-blk">
      <div class="doc-title">${esc(doc.title)}</div>
      <table class="mt"><tbody>${metaHtml}</tbody></table>
    </div>
  </header>

  <!-- ── Party ── -->
  ${
    party.name
      ? `<div class="party-band">
         <span class="p-lbl">${esc(party.label)}</span>
         <div class="p-sep"></div>
         <span class="p-name">${esc(party.name)}</span>
         ${party.mobile ? `<span class="p-detail">📞 ${esc(party.mobile)}</span>` : ""}
         ${party.gstin ? `<span class="p-detail">GSTIN: ${esc(party.gstin)}</span>` : ""}
         ${party.address ? `<span class="p-detail">${esc(party.address)}</span>` : ""}
       </div>`
      : ""
  }

  <!-- ── Items ── -->
  <table class="items-tbl">
    <thead>
      <tr>
        <th class="th-l" style="width:22px">#</th>
        <th class="th-l">Item Description</th>
        <th>Rate (₹)</th>
        <th>Qty</th>
        <th>Tax</th>
        <th>MRP (₹)</th>
        <th>Sale Price (₹)</th>
        <th>Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${
        itemRowsHtml ||
        `<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--ink-dim)">No items</td></tr>`
      }
    </tbody>
  </table>

  <!-- ── Totals ── -->
  <div class="totals-sec">
    <div class="amt-words">
      <strong>Amount in Words</strong>
      ${amountToWords(grandTotal)}
    </div>
    <table class="tot-tbl">
      <tbody>
        <tr>
          <td class="tl">Sub Total</td>
          <td class="tv">₹&nbsp;${money(subTotal)}</td>
        </tr>
        ${
          totalTax > 0
            ? `<tr class="tr-tax">
               <td class="tl">Tax Included</td>
               <td class="tv">₹&nbsp;${money(totalTax)}</td>
             </tr>`
            : ""
        }
        ${
          discount > 0
            ? `<tr class="tr-disc">
               <td class="tl">Discount</td>
               <td class="tv">−&nbsp;₹&nbsp;${money(discount)}</td>
             </tr>`
            : ""
        }
        <tr class="tr-grand">
          <td class="tl">Grand Total</td>
          <td class="tv">₹&nbsp;${money(grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ── Footer ── -->
  <footer class="inv-ftr">
    <div class="ftr-note">
      <strong>Terms &amp; Conditions</strong>
      ${esc(footerNote)}
    </div>
    <div class="sig-blk">
      <div style="height:36px"></div>
      <div class="sig-line">${signatory}</div>
      <div class="sig-lbl">For ${esc(shop.name)}</div>
    </div>
  </footer>

  <div class="strip">${esc(stripParts)}</div>

</div>
</body>
</html>`;
}
