// src/lib/barcode/printBarcodeHtml.ts
"use client";

import JsBarcode from "jsbarcode";
import {
  BarcodePrintItem,
  BarcodePrintOptions,
  expandCopies,
} from "./barcodeTemplates";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeBarcodeSvg(code: string, height: number) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  JsBarcode(svg, code, {
    format: "CODE128",
    displayValue: true,
    height,
    margin: 0,
    fontSize: 12,
    width: 1.6,
    textMargin: 2,
  });

  return svg.outerHTML;
}

export function buildBarcodePrintHtml(
  items: BarcodePrintItem[],
  options: BarcodePrintOptions = {},
) {
  const rows = expandCopies(items);

  const {
    shopName = "My Shop",
    pageTitle = "Barcode Print",
    labelWidthMm = 50,
    labelHeightMm = 30,
    columns = 4,
    showShopName = true,
    showName = true,
    showSalePrice = true,
    showMrp = true,
    barcodeHeight = 32,
    fontSizeShop = 11,
    fontSizeName = 10,
    fontSizeMeta = 9,
  } = options;

  const labels = rows
    .map((item) => {
      const svg = makeBarcodeSvg(item.code, barcodeHeight);

      const metaParts: string[] = [];
      if (showSalePrice && item.salePrice != null) {
        metaParts.push(`SP: ₹${Number(item.salePrice).toFixed(2)}`);
      }
      if (showMrp && item.mrp != null) {
        metaParts.push(`MRP: ₹${Number(item.mrp).toFixed(2)}`);
      }

      return `
        <div class="label">
          ${
            showShopName
              ? `<div class="shop" style="font-size:${fontSizeShop}px">${escapeHtml(shopName)}</div>`
              : ""
          }
          ${
            showName
              ? `<div class="name" style="font-size:${fontSizeName}px">${escapeHtml(item.name || "")}</div>`
              : ""
          }
          <div class="barcode-wrap">${svg}</div>
          ${
            metaParts.length
              ? `<div class="meta" style="font-size:${fontSizeMeta}px">${escapeHtml(metaParts.join("   "))}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    @page {
      size: A4;
      margin: 6mm;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background: #fff;
      color: #000;
    }

    .sheet {
      display: grid;
      grid-template-columns: repeat(${columns}, ${labelWidthMm}mm);
      grid-auto-rows: ${labelHeightMm}mm;
      gap: 2mm;
      justify-content: start;
      align-content: start;
      padding: 2mm;
    }

    .label {
      border: 1px solid #ddd;
      width: ${labelWidthMm}mm;
      height: ${labelHeightMm}mm;
      padding: 2mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      text-align: center;
    }

    .shop {
      font-weight: 700;
      line-height: 1.1;
      margin-bottom: 1mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    .name {
      line-height: 1.1;
      margin-bottom: 1mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    .barcode-wrap {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      flex: 1;
      overflow: hidden;
    }

    .barcode-wrap svg {
      max-width: 100%;
      max-height: 100%;
      height: auto;
    }

    .meta {
      margin-top: 1mm;
      font-weight: 600;
      line-height: 1.1;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${labels}
  </div>
</body>
</html>
  `;
}
