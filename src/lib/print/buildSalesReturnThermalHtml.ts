import type { ShopSettingsRecord } from "@/platform/types";
import type { SalesReturnPrintCustomization } from "./salesReturnPrintCustomization";

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function money(value: unknown) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}
export function buildSalesReturnThermalHtml(args: {
  saleReturn: any;
  items: any[];
  shop?: ShopSettingsRecord;
  customization: SalesReturnPrintCustomization;
}) {
  const { saleReturn: sr, items, shop, customization: c } = args;
  const total = Math.max(
    0,
    Number(sr.totalAmount || 0) - Number(sr.discount || 0),
  );
  const rows = items
    .map(
      (it) =>
        `<div class="item"><div><b>${esc(it.productName || it.name || it.productId)}</b>${c.showBatch && it.batchNo ? `<span>Batch ${esc(it.batchNo)}</span>` : ""}</div><div class="calc">${Number(it.quantity || 0)} ${esc(it.unit || "")} x ${money(it.rate)}<b>${money(it.billedValue ?? it.totalCost ?? Number(it.rate || 0) * Number(it.quantity || 0))}</b></div></div>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:3mm 4mm}*{box-sizing:border-box}body{width:68mm;margin:0;font:11px Arial,sans-serif;color:#000}.center{text-align:center}.rule{border-top:1px dashed #000;margin:6px 0}.meta{display:flex;justify-content:space-between;gap:6px}.item{padding:4px 0;border-bottom:1px dotted #aaa}.item span{display:block;font-size:9px}.calc{display:flex;justify-content:space-between;gap:4px;margin-top:2px}.total{font-size:14px;font-weight:800}.wrap{overflow-wrap:anywhere}</style></head><body><div class="center wrap"><b>${esc(shop?.shopName || "KYNFLOW")}</b><div>${esc([shop?.addressLine1, shop?.city, shop?.mobile].filter(Boolean).join(" | "))}</div><div class="rule"></div><b>${esc(c.title)}</b><div>Return # ${esc(sr.slNo ?? "-")}</div><div>${esc(new Date(sr.returnDate || Date.now()).toLocaleString("en-IN"))}</div>${c.showCustomer ? `<div>Customer: ${esc(sr.customerName || "Cash Customer")}</div>` : ""}${c.showSourceSale && sr.saleId ? `<div>Sale Bill: ${esc(sr.billNo || sr.saleId)}</div>` : ""}</div><div class="rule"></div>${rows}<div class="rule"></div><div class="meta"><span>Subtotal</span><b>${money(sr.totalAmount)}</b></div>${c.showDiscount ? `<div class="meta"><span>Discount</span><b>${money(sr.discount)}</b></div>` : ""}<div class="meta total"><span>RETURN</span><span>${money(total)}</span></div><div class="rule"></div><div class="center wrap">${esc(c.footerText || shop?.footerNote || "")}</div></body></html>`;
}
