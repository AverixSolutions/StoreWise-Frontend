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

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", {
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
    offerSavings = 0,
    offerSummary = [],
    grandTotal,
    notes,
  } = input;

  // ── Derived values ────────────────────────────────────────────────────────
  const addrParts = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join(" - "),
  ].filter(Boolean);

  const totalTax = items.reduce((sum, it) => {
    const pct =
      it.taxPercent === "NT"
        ? 0
        : Number(String(it.taxPercent ?? "0").replace("P", "")) || 0;
    if (!pct) return sum;
    return sum + (it.rate - it.rate / (1 + pct / 100)) * it.qty;
  }, 0);

  // ── Meta rows (right panel) ───────────────────────────────────────────────
  const metaRows: [string, string][] = [];
  metaRows.push(["DATE", fmtDate(doc.date)]);
  const t = fmtTime(doc.time);
  if (t) metaRows.push(["TIME", t]);
  if (doc.billNo) metaRows.push(["BILL NO.", doc.billNo]);
  if (doc.entryNo != null) metaRows.push(["ENTRY NO.", String(doc.entryNo)]);
  if (doc.typeLabel) metaRows.push(["TYPE", doc.typeLabel]);
  if (doc.department) metaRows.push(["DEPT.", doc.department]);

  const metaHtml = metaRows
    .map(
      ([label, value]) => `
    <tr>
      <td class="ml">${esc(label)}</td>
      <td class="mv">${esc(value)}</td>
    </tr>`,
    )
    .join("");

  // ── Item rows ─────────────────────────────────────────────────────────────
  const itemRowsHtml = items
    .map((it, idx) => {
      const taxLabel =
        it.taxPercent === "NT"
          ? "NT"
          : it.taxPercent != null
            ? `${it.taxPercent}%`
            : "—";
      const subLine = [
        it.batchNo ? `Batch: ${it.batchNo}` : "",
        it.expiryDate ? `Exp: ${fmtExpiry(it.expiryDate)}` : "",
        it.barcode ? `${it.barcode}` : "",
      ]
        .filter(Boolean)
        .join("  ·  ");

      const offerLine = it.offerName
        ? `${it.offerType ? `${it.offerType}: ` : "Offer: "}${it.offerName}${
            it.offerDiscountAmount
              ? ` (Saved â‚¹${money(it.offerDiscountAmount)})`
              : ""
          }`
        : "";

      return `
    <tr class="${idx % 2 === 0 ? "row-even" : "row-odd"}">
      <td class="c-no">${esc(it.lineNo)}</td>
      <td class="c-name">
        <div class="iname">${esc(it.name || "")}</div>
        ${subLine ? `<div class="isub">${esc(subLine)}</div>` : ""}
        ${offerLine ? `<div class="isub offer-line">${esc(offerLine)}</div>` : ""}
      </td>
      <td class="c-r">${esc(it.qty)}${it.unit ? `<span class="unit"> ${esc(it.unit)}</span>` : ""}</td>
      <td class="c-r">₹${money(it.rate)}</td>
      <td class="c-r c-tax">${taxLabel}</td>
      <td class="c-r c-amt">₹${money(it.amount)}</td>
    </tr>`;
    })
    .join("");

  const footerNote =
    shop.footerNote ||
    notes ||
    "Thank you for your business. This is a computer-generated document.";
  const signatory = esc(shop.authorizedSignatory || "Authorized Signatory");
  const offerSummaryHtml = offerSummary.length
    ? `<div class="offer-summary"><b>Offers:</b> ${esc(offerSummary.join(", "))}</div>`
    : "";

  // ── HTML ──────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(doc.title)} — ${esc(shop.name)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --navy:   #1e3a5f;
  --navy2:  #2d5282;
  --ink:    #111827;
  --ink-mid:#374151;
  --ink-dim:#6b7280;
  --ink-lt: #9ca3af;
  --rule:   #e5e7eb;
  --stripe: #f1f5f9;
  --tint:   #f0f6ff;
  --white:  #ffffff;
  --red:    #dc2626;
}

html,body{
  font-family:'Segoe UI',Arial,sans-serif;
  font-size:9.5pt;color:var(--ink);
  background:#f0f0f0;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}

/* ── Screen toolbar ── */
.no-print{
  position:fixed;top:12px;right:16px;display:flex;gap:8px;z-index:999;
}
.btn{
  background:var(--navy);color:#fff;border:none;
  padding:8px 20px;font-size:12px;font-weight:600;
  border-radius:6px;cursor:pointer;
  box-shadow:0 2px 8px rgba(30,58,95,.35);
}
.btn:hover{background:var(--navy2);}
.btn-close{background:#4b5563;}
.btn-close:hover{background:#1f2937;}

/* ── Page shell ── */
.page{
  width:210mm;max-width:210mm;
  min-height:297mm;margin:12px auto;
  background:var(--white);
  border:1.5px solid var(--navy);
  display:flex;flex-direction:column;
}

@page{size:A4;margin:8mm;}
@media print{
  html,body{background:var(--white);}
  .no-print{display:none!important;}
  .page{margin:0;width:100%;max-width:100%;min-height:auto;border:1.5px solid var(--navy);}
  thead{display:table-header-group;}
  tr{page-break-inside:avoid;}
}

/* ── Inner padding wrapper ── */
.inner{padding:10mm 11mm;display:flex;flex-direction:column;flex:1;}

/* ── Top header ── */
.inv-hdr{
  display:grid;
  grid-template-columns:1fr auto;
  gap:8px;
  align-items:start;
  margin-bottom:8mm;
}

/* Left: logo + shop info */
.shop-block{display:flex;flex-direction:column;gap:3px;}
.shop-logo-wrap{margin-bottom:4px;}
.shop-logo{height:52px;width:auto;max-width:120px;object-fit:contain;}
.shop-name{
  font-size:17pt;font-weight:800;color:var(--navy);
  letter-spacing:-0.02em;line-height:1.1;
}
.shop-detail{font-size:8pt;color:var(--ink-mid);line-height:1.6;}
.shop-gstin{
  font-size:7.5pt;color:var(--ink-dim);
  font-family:monospace;letter-spacing:.03em;margin-top:1px;
}

/* Right: INVOICE title + meta */
.doc-block{text-align:right;min-width:180px;}
.doc-title{
  font-size:20pt;font-weight:900;color:var(--navy);
  letter-spacing:.08em;line-height:1;
  margin-bottom:6px;
}
.meta-tbl{border-collapse:collapse;width:100%;}
.ml{
  font-size:7.5pt;font-weight:600;
  text-transform:uppercase;letter-spacing:.05em;
  color:var(--ink-dim);
  padding:1.5px 10px 1.5px 0;
  text-align:left;white-space:nowrap;
}
.mv{
  font-size:8.5pt;font-weight:600;color:var(--ink);
  text-align:right;padding:1.5px 0;
  font-variant-numeric:tabular-nums;
}

/* ── Bill To band ── */
.party-hdr{
  background:var(--navy);color:var(--white);
  font-size:8pt;font-weight:700;
  text-transform:uppercase;letter-spacing:.1em;
  padding:4px 10px;
  margin-bottom:0;
  display:inline-block;
}
.party-body{
  border:1px solid var(--rule);border-top:none;
  padding:7px 10px 8px;margin-bottom:7mm;
  min-height:22mm;
}
.p-name{font-size:10pt;font-weight:700;color:var(--navy);margin-bottom:2px;}
.p-detail{font-size:8pt;color:var(--ink-mid);line-height:1.6;}

/* ── Items table ── */
.items-tbl{width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:0;}

.items-tbl thead tr{background:var(--navy);color:var(--white);}
.items-tbl thead th{
  padding:5.5px 8px;
  font-size:7.5pt;font-weight:700;
  text-transform:uppercase;letter-spacing:.06em;
  text-align:right;white-space:nowrap;
  border-right:1px solid rgba(255,255,255,.15);
}
.items-tbl thead th:last-child{border-right:none;}
.items-tbl thead th.th-l{text-align:left;}

.items-tbl tbody tr{border-bottom:1px solid var(--rule);}
.row-even{background:var(--white);}
.row-odd {background:var(--stripe);}

/* Fixed-height empty rows for a GimBooks-style grid effect */
.items-tbl tbody tr.empty-row td{height:15px;border-bottom:1px solid var(--rule);}

.c-no  {width:26px;text-align:center;padding:5px 6px;color:var(--ink-dim);font-size:8pt;}
.c-name{text-align:left;padding:5px 8px;}
.c-r   {text-align:right;padding:5px 8px;font-variant-numeric:tabular-nums;white-space:nowrap;}
.c-tax {color:var(--ink-dim);font-size:8pt;}
.c-amt {font-weight:700;}
.unit  {font-size:7.5pt;color:var(--ink-lt);}
.iname {font-size:9pt;font-weight:600;color:var(--ink);line-height:1.3;}
.isub  {font-size:7pt;color:var(--ink-lt);margin-top:1px;}
.offer-line{color:#047857;font-weight:700;}

/* Column borders */
.items-tbl td{border-right:1px solid var(--rule);}
.items-tbl td:last-child{border-right:none;}
.items-tbl th{border-right:1px solid rgba(255,255,255,.15);}
.items-tbl th:last-child{border-right:none;}

/* ── Bottom section ── */
.bottom{
  display:grid;
  grid-template-columns:1fr 220px;
  gap:12px;
  margin-top:auto;
  padding-top:6mm;
  align-items:start;
}

/* Terms left */
.terms-wrap{}
.terms-hdr{
  background:var(--navy);color:var(--white);
  font-size:7.5pt;font-weight:700;
  text-transform:uppercase;letter-spacing:.08em;
  padding:3.5px 10px;
  display:inline-block;
  margin-bottom:0;
}
.terms-body{
  border:1px solid var(--rule);border-top:none;
  padding:7px 10px;
  font-size:7.5pt;color:var(--ink-mid);
  line-height:1.7;
}

.words-wrap{
  margin-top:8px;
  border:1px solid var(--rule);
  border-radius:3px;
  padding:6px 10px;
  font-size:7.5pt;color:var(--ink-mid);
  font-style:italic;line-height:1.5;
  background:var(--tint);
}
.words-lbl{
  font-size:6.5pt;font-style:normal;font-weight:700;
  text-transform:uppercase;letter-spacing:.07em;
  color:var(--ink-lt);display:block;margin-bottom:1px;
}
.offer-summary{
  margin-top:8px;
  border:1px solid var(--rule);
  border-radius:3px;
  padding:6px 10px;
  font-size:7.5pt;
  color:#047857;
  background:#ecfdf5;
}

/* Totals right */
.tot-tbl{width:100%;border-collapse:collapse;}
.tot-tbl td{
  padding:3.5px 0;font-size:9pt;
  vertical-align:middle;
}
.tl{color:var(--ink-mid);text-align:left;padding-right:14px;white-space:nowrap;}
.tv{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.tr-sep td{border-top:1px solid var(--rule);padding-top:4px;}
.tr-disc td{color:var(--red);}
.tr-tax  td{color:var(--ink-dim);font-size:8.5pt;}
.tr-grand td{
  border-top:2px solid var(--navy);
  padding-top:5px;
  font-size:11pt;font-weight:800;color:var(--navy);
}

/* ── Signature ── */
.sig-row{
  display:flex;justify-content:flex-end;
  margin-top:10mm;padding-top:6mm;
  border-top:1px solid var(--rule);
}
.sig-blk{text-align:center;min-width:140px;}
.sig-space{height:28px;}
.sig-line{
  border-top:1px solid var(--ink-mid);
  padding-top:4px;font-size:8pt;font-weight:600;
  color:var(--ink-mid);white-space:nowrap;
}
.sig-for{font-size:7pt;color:var(--ink-lt);text-transform:uppercase;letter-spacing:.05em;margin-top:1px;}

/* ── Footer thank-you bar ── */
.inv-footer{
  background:var(--navy);color:var(--white);
  text-align:center;
  padding:7px 12px;
  font-size:8.5pt;font-weight:700;
  font-style:italic;
  letter-spacing:.04em;
  margin-top:6mm;
}
.inv-footer-sub{font-size:7.5pt;font-weight:400;font-style:normal;opacity:.7;margin-top:1px;}
</style>
</head>
<body>

<div class="no-print">
  <button class="btn" onclick="(function(){var t=document.title;document.title='__KYNFLOW_PRINT__';setTimeout(function(){document.title=t;},300);})()">🖨 Print</button>
  <button class="btn btn-close" onclick="window.close()">✕ Close</button>
</div>

<div class="page">
<div class="inner">

  <!-- ══ HEADER ══ -->
  <header class="inv-hdr">

    <!-- Left: shop identity -->
    <div class="shop-block">
      ${
        shop.logoUrl
          ? `
      <div class="shop-logo-wrap">
        <img src="${esc(shop.logoUrl)}" alt="logo" class="shop-logo" crossorigin="anonymous"/>
      </div>`
          : ""
      }
      <div class="shop-name">${esc(shop.name)}</div>
      ${
        addrParts.length
          ? `<div class="shop-detail">${addrParts.map(esc).join("<br/>")}</div>`
          : ""
      }
      ${shop.mobile ? `<div class="shop-detail">Phone: ${esc(shop.mobile)}</div>` : ""}
      ${shop.email ? `<div class="shop-detail">Email: ${esc(shop.email)}</div>` : ""}
      ${shop.gstin ? `<div class="shop-gstin">GSTIN: ${esc(shop.gstin)}</div>` : ""}
    </div>

    <!-- Right: INVOICE + meta -->
    <div class="doc-block">
      <div class="doc-title">${esc(doc.title.toUpperCase())}</div>
      <table class="meta-tbl">
        <tbody>${metaHtml}</tbody>
      </table>
    </div>

  </header>

  <!-- ══ BILL TO / SUPPLIER ══ -->
  <div>
    <div class="party-hdr">${esc(party.label)}</div>
    <div class="party-body">
      ${party.name ? `<div class="p-name">${esc(party.name)}</div>` : ""}
      ${
        party.address ? `<div class="p-detail">${esc(party.address)}</div>` : ""
      }
      ${
        party.mobile
          ? `<div class="p-detail">Phone: ${esc(party.mobile)}</div>`
          : ""
      }
      ${
        party.gstin
          ? `<div class="p-detail">GSTIN: ${esc(party.gstin)}</div>`
          : ""
      }
      ${!party.name ? `<div class="p-detail" style="color:var(--ink-lt)">—</div>` : ""}
    </div>
  </div>

  <!-- ══ ITEMS TABLE ══ -->
  <table class="items-tbl">
    <thead>
      <tr>
        <th class="th-l" style="width:26px;text-align:center">No.</th>
        <th class="th-l">Item Description</th>
        <th style="width:60px">Qty</th>
        <th style="width:80px">Rate (₹)</th>
        <th style="width:50px">Tax</th>
        <th style="width:90px">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml || `<tr class="row-even"><td colspan="6" style="text-align:center;padding:16px;color:var(--ink-lt)">No items</td></tr>`}
      ${
        /* Pad to at least 10 visible rows for a grid feel */
        (() => {
          const MIN = 10;
          const filled = items.length;
          const needed = Math.max(0, MIN - filled);
          return Array.from({ length: needed })
            .map(
              (
                _,
                i,
              ) => `<tr class="empty-row ${(filled + i) % 2 === 0 ? "row-even" : "row-odd"}">
              <td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>`,
            )
            .join("");
        })()
      }
    </tbody>
  </table>

  <!-- ══ BOTTOM: Terms + Totals ══ -->
  <div class="bottom">

    <!-- Left: Terms + amount in words -->
    <div>
      <div class="terms-wrap">
        <div class="terms-hdr">Terms &amp; Conditions</div>
        <div class="terms-body">
          ${esc(footerNote)}
        </div>
      </div>
      <div class="words-wrap">
        <span class="words-lbl">Amount in Words</span>
        ${amountToWords(grandTotal)}
      </div>
      ${offerSummaryHtml}
    </div>

    <!-- Right: Totals -->
    <table class="tot-tbl">
      <tbody>
        <tr>
          <td class="tl">Subtotal</td>
          <td class="tv">₹&nbsp;${money(subTotal)}</td>
        </tr>
        ${
          offerSavings > 0
            ? `
        <tr class="tr-disc">
          <td class="tl">Offer savings</td>
          <td class="tv">â‚¹&nbsp;${money(offerSavings)}</td>
        </tr>`
            : ""
        }
        ${
          discount > 0
            ? `
        <tr class="tr-disc">
          <td class="tl">Bill discount</td>
          <td class="tv">−&nbsp;₹&nbsp;${money(discount)}</td>
        </tr>`
            : ""
        }
        ${
          totalTax > 0
            ? `
        <tr class="tr-tax">
          <td class="tl">Tax Amount</td>
          <td class="tv">₹&nbsp;${money(totalTax)}</td>
        </tr>`
            : ""
        }
        <tr class="tr-grand">
          <td class="tl">TOTAL</td>
          <td class="tv">₹&nbsp;${money(grandTotal)}</td>
        </tr>
      </tbody>
    </table>

  </div>

  <!-- ══ SIGNATURE ══ -->
  <div class="sig-row">
    <div class="sig-blk">
      <div class="sig-space"></div>
      <div class="sig-line">${signatory}</div>
      <div class="sig-for">For ${esc(shop.name)}</div>
    </div>
  </div>

</div><!-- /inner -->

  <!-- ══ THANK YOU FOOTER BAR ══ -->
  <div class="inv-footer">
    Thank You For Your Business!
    <div class="inv-footer-sub">
      ${shop.mobile ? `Phone: ${esc(shop.mobile)}` : ""}
      ${shop.mobile && shop.email ? "  ·  " : ""}
      ${shop.email ? `${esc(shop.email)}` : ""}
    </div>
  </div>

</div><!-- /page -->
</body>
</html>`;
}
