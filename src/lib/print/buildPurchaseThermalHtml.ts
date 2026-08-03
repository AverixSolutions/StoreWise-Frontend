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
  return Number(value || 0).toFixed(2);
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
  return date.toLocaleDateString("en-GB");
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

function itemRows(items: PurchasePrintItem[]): string {
  if (!items.length) {
    return `<div class="empty">No purchase items</div>`;
  }

  return items
    .map((item, index) => {
      const details = [
        item.batchNo ? `Batch ${item.batchNo}` : "",
        item.expiryDate ? `Exp ${formatExpiry(item.expiryDate)}` : "",
        item.barcode ? `BC ${item.barcode}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const tax = taxRate(item.taxPercent);

      return `
        <section class="item">
          <div class="item-title">${index + 1}. ${esc(item.name)}</div>
          ${details ? `<div class="item-detail">${esc(details)}</div>` : ""}
          <div class="item-line">
            <span>${esc(quantity(item.qty))} ${esc(item.unit || "")} × ${money(item.rate)}${
              tax ? ` · GST ${money(tax).replace(".00", "")}%` : ""
            }</span>
            <strong>${money(item.amount)}</strong>
          </div>
        </section>`;
    })
    .join("");
}

export function buildPurchaseThermalHtml(input: PurchasePrintInput): string {
  const { shop, bill, items, subTotal, discount, grandTotal } = input;

  const address = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(", ");

  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  const references = [
    bill.department ? `Department: ${bill.department}` : "",
    bill.debitAccount ? `Debit: ${bill.debitAccount}` : "",
    bill.natureOfEntry ? `Nature: ${bill.natureOfEntry}` : "",
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light" />
  <title>Purchase Bill - ${esc(bill.billNo || bill.entryNo || "")}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
    }

    .receipt {
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 3mm 0 5mm;
      font-size: 10.5px;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 800; }
    .mono { font-variant-numeric: tabular-nums; }

    .doc-label {
      margin-bottom: 2px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.18em;
    }

    .shop-name {
      font-size: 17px;
      line-height: 1.08;
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    .shop-line {
      margin-top: 2px;
      font-size: 9.5px;
      line-height: 1.25;
    }

    .rule {
      margin: 7px 0;
      border-top: 1px dashed #000;
    }

    .rule-solid {
      margin: 7px 0;
      border-top: 1px solid #000;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 8px;
    }

    .meta {
      min-width: 0;
      font-size: 9.7px;
    }

    .meta.right {
      text-align: right;
    }

    .party {
      margin: 6px 0;
    }

    .party-label {
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .party-name {
      margin-top: 2px;
      font-size: 11px;
      font-weight: 900;
    }

    .reference {
      margin-top: 2px;
      font-size: 9px;
    }

    .items-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 0;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .item {
      padding: 5px 0;
      border-bottom: 1px dotted #777;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .item-title {
      font-size: 10.5px;
      font-weight: 900;
      line-height: 1.2;
    }

    .item-detail {
      margin-top: 2px;
      color: #333;
      font-size: 8.7px;
      line-height: 1.2;
    }

    .item-line {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin-top: 3px;
      font-size: 9.8px;
      font-variant-numeric: tabular-nums;
    }

    .item-line span {
      min-width: 0;
    }

    .item-line strong {
      flex: 0 0 auto;
      white-space: nowrap;
      font-size: 10.2px;
    }

    .empty {
      padding: 12px 0;
      text-align: center;
    }

    .summary {
      margin-top: 6px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 3px 0;
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }

    .summary-row strong {
      white-space: nowrap;
    }

    .discount {
      font-weight: 800;
    }

    .grand {
      margin-top: 6px;
      padding: 6px 0;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      font-size: 14px;
      font-weight: 900;
    }

    .footer {
      margin-top: 9px;
      text-align: center;
      font-size: 9px;
      line-height: 1.3;
    }

    @media screen {
      body {
        background: #e5e7eb;
        padding: 14px 0;
      }

      .receipt {
        background: #fff;
        padding: 5mm 4mm 6mm;
        box-shadow: 0 14px 38px rgba(15, 23, 42, 0.16);
      }
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
      }

      .receipt {
        width: 72mm;
        max-width: 72mm;
        padding: 2mm 0 4mm;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <main class="receipt">
    <div class="center doc-label">PURCHASE BILL</div>
    <div class="center shop-name">${esc(shop.name)}</div>
    ${address ? `<div class="center shop-line">${esc(address)}</div>` : ""}
    ${shop.mobile ? `<div class="center shop-line">Phone: ${esc(shop.mobile)}</div>` : ""}
    ${shop.gstin ? `<div class="center shop-line">GSTIN: ${esc(shop.gstin)}</div>` : ""}

    <div class="rule"></div>

    <section class="meta-grid">
      <div class="meta"><span class="bold">Entry:</span> ${esc(bill.entryNo || "—")}</div>
      <div class="meta right"><span class="bold">Bill:</span> ${esc(bill.billNo || "—")}</div>
      <div class="meta"><span class="bold">Date:</span> ${esc(formatDate(bill.date))}</div>
      <div class="meta right"><span class="bold">Time:</span> ${esc(formatTime(bill.time))}</div>
      <div class="meta"><span class="bold">Type:</span> ${esc(bill.purchaseType || "Purchase")}</div>
    </section>

    <section class="party">
      <div class="party-label">Supplier</div>
      <div class="party-name">${esc(bill.supplierName || "Cash Purchase")}</div>
      ${references.map((reference) => `<div class="reference">${esc(reference)}</div>`).join("")}
    </section>

    <div class="items-head">
      <span>Item / Qty × Rate</span>
      <span>Amount</span>
    </div>

    ${itemRows(items)}

    <section class="summary">
      <div class="summary-row">
        <span>Total quantity</span>
        <strong>${esc(quantity(totalQty))}</strong>
      </div>
      <div class="summary-row">
        <span>Sub total</span>
        <strong>${money(subTotal)}</strong>
      </div>
      ${
        discount > 0
          ? `<div class="summary-row discount"><span>Bill discount</span><strong>- ${money(discount)}</strong></div>`
          : ""
      }
      <div class="summary-row grand">
        <span>GRAND TOTAL</span>
        <strong>${money(grandTotal)}</strong>
      </div>
    </section>

    <footer class="footer">
      ${shop.footerNote ? `<div>${esc(shop.footerNote)}</div>` : ""}
      <div class="rule-solid"></div>
      <div>Generated by KYNFLOW</div>
    </footer>
  </main>
</body>
</html>`;
}
