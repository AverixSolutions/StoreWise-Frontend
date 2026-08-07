import type { ShopSettingsRecord } from "@/platform/types";
import type { SalesReturnPrintCustomization } from "./salesReturnPrintCustomization";

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(value: unknown) {
  const n = Number(value || 0);
  return `Rs. ${n.toFixed(2)}`;
}

function fmtDate(value: unknown) {
  const d = value ? new Date(String(value)) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-IN") : "-";
}

function numberToWordsIndian(n: number) {
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
  const below100 = (x: number) =>
    x < 20
      ? ones[x]
      : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ""}`;
  const chunk = (x: number) =>
    x < 100
      ? below100(x)
      : `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${below100(x % 100)}` : ""}`;
  if (!Number.isFinite(n) || n <= 0) return "Zero Rupees Only";
  let x = Math.floor(n);
  const parts: string[] = [];
  const crore = Math.floor(x / 10000000);
  x %= 10000000;
  const lakh = Math.floor(x / 100000);
  x %= 100000;
  const thousand = Math.floor(x / 1000);
  x %= 1000;
  if (crore) parts.push(`${chunk(crore)} Crore`);
  if (lakh) parts.push(`${chunk(lakh)} Lakh`);
  if (thousand) parts.push(`${chunk(thousand)} Thousand`);
  if (x) parts.push(chunk(x));
  return `${parts.join(" ")} Rupees Only`;
}

export function buildSalesReturnInvoiceHtml(args: {
  saleReturn: any;
  items: any[];
  shop?: ShopSettingsRecord;
  customization: SalesReturnPrintCustomization;
}) {
  const { saleReturn: sr, items, shop, customization: c } = args;
  const modern = c.a4Template === "modern";
  const total = Math.max(
    0,
    Number(sr.totalAmount || 0) - Number(sr.discount || 0),
  );
  const logo = c.showLogo ? shop?.logoDataUrl || shop?.logoUrl || "" : "";
  const address = [
    shop?.addressLine1,
    shop?.addressLine2,
    shop?.city,
    shop?.state,
    shop?.pincode,
  ]
    .filter(Boolean)
    .join(", ");
  const itemRows = items
    .map(
      (it, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${esc(it.productName || it.name || it.productId)}</strong>${it.productCode ? `<div class="muted">${esc(it.productCode)}</div>` : ""}</td>
      ${c.showBatch ? `<td>${esc(it.batchNo || "-")}</td>` : ""}
      <td class="num">${Number(it.quantity || 0)
        .toFixed(3)
        .replace(/\.000$/, "")}</td>
      <td>${esc(it.unit || "")}</td>
      <td class="num">${money(it.rate)}</td>
      ${c.showRateType ? `<td>${esc(it.rateTypeName || it.rateTypeCode || (it.rateSource === "CUSTOM" ? "Custom" : "-"))}</td>` : ""}
      ${c.showTax ? `<td>${esc(it.taxPercent || "NT")}</td>` : ""}
      ${c.showDiscount ? `<td class="num">${money(it.discount || 0)}</td>` : ""}
      <td class="num"><strong>${money(it.billedValue ?? it.totalCost ?? Number(it.rate || 0) * Number(it.quantity || 0))}</strong></td>
    </tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.title)}</title><style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, Arial, sans-serif; color:#0f172a; font-size:12px; background:#fff; }
    .page { width:100%; min-height:270mm; display:flex; flex-direction:column; }
    .hero { padding:${modern ? "18px" : "0 0 14px"}; border:${modern ? "1px solid #dbeafe" : "0"}; border-bottom:${modern ? "0" : "2px solid #0f172a"}; border-radius:${modern ? "16px" : "0"}; background:${modern ? "#f8fbff" : "transparent"}; display:flex; justify-content:space-between; gap:20px; }
    .brand { display:flex; gap:12px; align-items:flex-start; } .logo { width:54px; height:54px; object-fit:contain; }
    h1 { margin:0; font-size:24px; letter-spacing:.08em; } h2 { margin:0; font-size:18px; } .muted { color:#64748b; font-size:10px; margin-top:2px; }
    .doc { text-align:right; min-width:220px; } .doc .bill { font-size:15px; font-weight:800; }
    .meta { display:grid; grid-template-columns:1.2fr 1fr; gap:12px; margin:14px 0; }
    .card { border:1px solid #e2e8f0; border-radius:12px; padding:11px 12px; background:#fff; }
    .card-title { color:#475569; font-size:10px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:5px; font-weight:700; }
    table { width:100%; border-collapse:collapse; table-layout:auto; }
    th { background:#0f172a; color:#fff; padding:7px 6px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.04em; }
    td { padding:7px 6px; border-bottom:1px solid #e2e8f0; vertical-align:top; } .num { text-align:right; white-space:nowrap; }
    .totals { margin:14px 0 0 auto; width:310px; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
    .totals div { display:flex; justify-content:space-between; padding:7px 10px; border-bottom:1px solid #e2e8f0; } .totals div:last-child { border:0; background:#0f172a; color:white; font-size:14px; font-weight:800; }
    .words { margin-top:12px; border:1px solid #e2e8f0; border-radius:10px; padding:9px 10px; text-align:center; font-weight:700; }
    .footer { margin-top:auto; padding-top:22px; display:flex; justify-content:space-between; gap:20px; align-items:flex-end; }
    .sign { min-width:180px; padding-top:38px; border-top:1px solid #94a3b8; text-align:center; }
  </style></head><body><main class="page">
    <section class="hero">
      <div class="brand">${logo ? `<img class="logo" src="${esc(logo)}"/>` : ""}<div><h2>${esc(shop?.shopName || "KYNFLOW")}</h2><div>${esc(address)}</div><div class="muted">${esc([shop?.mobile, shop?.email, shop?.gstin ? `GSTIN ${shop.gstin}` : ""].filter(Boolean).join(" | "))}</div></div></div>
      <div class="doc"><h1>${esc(c.title)}</h1><div class="muted">${esc(c.subtitle)}</div><div class="bill">Return # ${esc(sr.slNo ?? "-")}</div><div>Return date: ${esc(fmtDate(sr.returnDate))}</div></div>
    </section>
    <section class="meta">
      <div class="card"><div class="card-title">Customer</div>${c.showCustomer ? `<strong>${esc(sr.customerName || "Cash Customer")}</strong>` : "Hidden"}</div>
      <div class="card"><div class="card-title">Source Sale</div>${c.showSourceSale && sr.saleId ? `<strong>${esc(sr.billNo || sr.saleId)}</strong>` : esc(sr.billNo || "Manual return")}</div>
    </section>
    <table><thead><tr><th>#</th><th>Product</th>${c.showBatch ? "<th>Batch</th>" : ""}<th>Qty</th><th>Unit</th><th class="num">Return Rate</th>${c.showRateType ? "<th>Rate Type</th>" : ""}${c.showTax ? "<th>Tax</th>" : ""}${c.showDiscount ? '<th class="num">Discount</th>' : ""}<th class="num">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
    <div class="totals"><div><span>Subtotal</span><strong>${money(sr.totalAmount || 0)}</strong></div>${c.showDiscount ? `<div><span>Bill Discount</span><strong>${money(sr.discount || 0)}</strong></div>` : ""}<div><span>Return Total</span><span>${money(total)}</span></div></div>
    ${c.showAmountInWords ? `<div class="words">${esc(numberToWordsIndian(total))}</div>` : ""}
    <footer class="footer"><div><strong>${esc(c.footerText || shop?.footerNote || "")}</strong></div><div class="sign">${esc(c.signatoryLabel || shop?.authorizedSignatory || "Authorized Signatory")}</div></footer>
  </main></body></html>`;
}
