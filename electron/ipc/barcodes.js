// electron/ipc/barcodes.js

const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { canUseBarcode, barcodeDisabledResult } = require("../licenseFeatures");

function nowISO() {
  return new Date().toISOString();
}

// ─── Core sequence helpers (also exported for use in purchases.js) ───────────

/**
 * Get the maximum numeric barcode actually stored in product_batches.
 * Checks only numeric barcodes (no letters, no special chars).
 */
function getLiveMaxBarcodeNumber(licenseId) {
  const row = db
    .prepare(
      `
      SELECT MAX(CAST(barcode AS INTEGER)) AS mx
      FROM product_batches
      WHERE licenseId = ?
        AND isSystemGeneratedBarcode = 1
        AND barcode IS NOT NULL
        AND length(barcode) = 5
        AND barcode GLOB '[0-9][0-9][0-9][0-9][0-9]'
        AND COALESCE(deletedAt,'') = ''
    `,
    )
    .get(licenseId);

  return Number(row?.mx || 0);
}

/**
 * Get the last barcode number from the barcode_sequence table.
 */
function getSequenceBarcodeNumber(licenseId) {
  const seq = db
    .prepare(`SELECT lastBarcodeNumber FROM barcode_sequence WHERE licenseId=?`)
    .get(licenseId);

  return Number(seq?.lastBarcodeNumber || 0);
}

/**
 * Get the safe current barcode number by taking the max of:
 * - The sequence table value
 * - The actual max live barcode in product_batches
 * This ensures we never skip barcodes even if the sequence gets out of sync.
 */
function getSafeCurrentBarcodeNumber(licenseId) {
  const fromSeq = getSequenceBarcodeNumber(licenseId);
  const fromLive = getLiveMaxBarcodeNumber(licenseId);
  return Math.max(fromSeq, fromLive);
}

/**
 * Peek next barcode number without committing it.
 * UI ONLY - Do not treat as guaranteed.
 */
function peekNextBarcodeNumber(licenseId) {
  if (!canUseBarcode(licenseId)) {
    throw new Error("Barcode Support is disabled for this license.");
  }

  const current = getSafeCurrentBarcodeNumber(licenseId);
  const next = current + 1;

  console.log(
    "[barcode:peekNext]",
    "licenseId=",
    licenseId,
    "safeCurrent=",
    current,
    "next=",
    next,
  );

  return next;
}

/**
 * Atomically reserve `count` barcodes via a true transaction.
 */
const reserveBarcodesTx = db.transaction((licenseId, count = 1) => {
  const safeCount = Math.max(1, Number(count) || 1);

  const current = getSafeCurrentBarcodeNumber(licenseId);
  const next = current + safeCount;

  db.prepare(
    `INSERT INTO barcode_sequence (licenseId, lastBarcodeNumber)
     VALUES (?, ?)
     ON CONFLICT(licenseId) DO UPDATE SET lastBarcodeNumber=excluded.lastBarcodeNumber`,
  ).run(licenseId, next);

  const result = [];
  for (let i = current + 1; i <= next; i++) {
    result.push(String(i).padStart(5, "0"));
  }

  console.log(
    "[barcode:reserve]",
    "licenseId=",
    licenseId,
    "current=",
    current,
    "next=",
    next,
    "reserved=",
    result,
  );

  return result;
});

function reserveBarcodes(licenseId, count = 1) {
  if (!licenseId) throw new Error("licenseId required");
  if (!canUseBarcode(licenseId)) {
    throw new Error("Barcode Support is disabled for this license.");
  }
  return reserveBarcodesTx(licenseId, count);
}

/**
 * Reserve exactly one barcode and return it as a string.
 */
function reserveOneBarcode(licenseId) {
  return reserveBarcodes(licenseId, 1)[0];
}

/**
 * Rebuild a product's stock from its batches.
 * Note: Assumes product_batches is the absolute source of truth for stock.
 */
function rebuildStock(productId) {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(stock),0) AS qty
       FROM product_batches
       WHERE productId=? AND COALESCE(deletedAt,'')=''`,
    )
    .get(productId);
  const qty = Number(r?.qty || 0);
  const ts = nowISO();
  db.prepare(
    `UPDATE products SET stock=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE id=?`,
  ).run(qty, ts, productId);
  return qty;
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

function registerBarcodeHandlers() {
  // ── Peek next barcode (no commit) ──
  ipcMain.handle("barcode:peekNext", (e, licenseId) => {
    if (!licenseId) return { success: false, error: "licenseId required" };
    if (!canUseBarcode(licenseId)) return barcodeDisabledResult();
    try {
      const num = peekNextBarcodeNumber(licenseId);
      return {
        success: true,
        barcode: String(num).padStart(5, "0"),
        number: num,
      };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  // ── Reserve N barcodes (commits the sequence atomically) ──
  ipcMain.handle("barcode:reserve", (e, { licenseId, count = 1 }) => {
    if (!licenseId) return { success: false, error: "licenseId required" };
    if (!canUseBarcode(licenseId)) return barcodeDisabledResult();
    try {
      const barcodes = reserveBarcodes(licenseId, Math.max(1, Number(count)));
      return { success: true, barcodes };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  // ── List all barcodes/batches for a product ──
  ipcMain.handle("barcode:listForProduct", (e, { licenseId, productId }) => {
    if (!licenseId || !productId)
      return { success: false, error: "licenseId and productId required" };
    if (!canUseBarcode(licenseId)) {
      return { ...barcodeDisabledResult(), rows: [] };
    }
    try {
      const rows = db
        .prepare(
          `SELECT id, barcode, mrp, salePrice, costPrice, batchNo, purchaseBatchNo,
            mfgDate, expiryDate, receivedAt, stock, createdAt
     FROM product_batches
     WHERE productId=? AND licenseId=? AND COALESCE(deletedAt,'')=''
     ORDER BY 
       CASE WHEN stock > 0 THEN 0 ELSE 1 END,
       datetime(receivedAt) DESC,
       barcode ASC`,
        )
        .all(productId, licenseId);
      return { success: true, rows };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  // ── Create a barcode for a product (creates a zero-stock batch placeholder) ──
  ipcMain.handle("barcode:createForProduct", (e, payload) => {
    if (!payload?.licenseId || !payload?.productId)
      return { success: false, error: "licenseId and productId required" };
    if (!canUseBarcode(payload.licenseId)) return barcodeDisabledResult();

    const ts = nowISO();

    const trx = db.transaction(() => {
      let barcode = payload.barcode?.trim() || null;

      if (!barcode && payload.useGenerated) {
        barcode = reserveOneBarcode(payload.licenseId);
      }

      if (!barcode) {
        throw Object.assign(new Error("Barcode is required"), {
          code: "MISSING_BARCODE",
        });
      }

      // Format validation — allows short numeric barcodes like "1" or "22"
      if (!/^[A-Za-z0-9_-]{1,50}$/.test(barcode)) {
        throw Object.assign(new Error("Invalid barcode format"), {
          code: "INVALID_BARCODE",
        });
      }

      // Check uniqueness across the entire license
      const conflict = db
        .prepare(
          `SELECT id, productId FROM product_batches
           WHERE licenseId=? AND barcode=? AND COALESCE(deletedAt,'')=''
           LIMIT 1`,
        )
        .get(payload.licenseId, barcode);

      if (conflict) {
        if (conflict.productId !== payload.productId) {
          throw Object.assign(
            new Error(`Barcode ${barcode} is already used by another product`),
            { code: "BARCODE_IN_USE", existingProductId: conflict.productId },
          );
        }
        // Same product — return the existing batch
        console.log(
          "[barcode:createForProduct:reused]",
          "licenseId=",
          payload.licenseId,
          "productId=",
          payload.productId,
          "barcode=",
          barcode,
        );
        return {
          batch: db
            .prepare(`SELECT * FROM product_batches WHERE id=?`)
            .get(conflict.id),
          reused: true,
          barcode,
        };
      }

      const batchId = uuidv4();
      db.prepare(
        `INSERT INTO product_batches
  (id, licenseId, productId, barcode, mrp, salePrice, costPrice,
   batchNo, mfgDate, expiryDate, receivedAt, stock, createdAt, updatedAt, isSystemGeneratedBarcode)
VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 0, ?, ?, ?)`,
      ).run(
        batchId,
        payload.licenseId,
        payload.productId,
        barcode,
        payload.mrp ?? null,
        payload.salePrice ?? null,
        payload.costPrice ?? null,
        ts,
        ts,
        ts,
        payload.useGenerated ? 1 : 0,
      );

      console.log(
        "[barcode:createForProduct:new]",
        "licenseId=",
        payload.licenseId,
        "productId=",
        payload.productId,
        "barcode=",
        barcode,
        "batchId=",
        batchId,
      );

      const batch = db
        .prepare(`SELECT * FROM product_batches WHERE id=?`)
        .get(batchId);
      return { batch, reused: false, barcode };
    });

    try {
      const result = trx();
      return { success: true, ...result };
    } catch (err) {
      return {
        success: false,
        error: String(err?.message || err),
        code: err?.code || null,
        existingProductId: err?.existingProductId || null,
      };
    }
  });

  // ── Delete a barcode/batch (strict validation) ──
  ipcMain.handle("barcode:deleteForProduct", (e, { licenseId, batchId }) => {
    if (!licenseId || !batchId)
      return { success: false, error: "licenseId and batchId required" };
    if (!canUseBarcode(licenseId)) return barcodeDisabledResult();

    const ts = nowISO();

    try {
      const b = db
        .prepare(
          `SELECT id, productId, stock, licenseId FROM product_batches WHERE id=? AND COALESCE(deletedAt,'')=''`,
        )
        .get(batchId);

      if (!b) return { success: false, error: "NOT_FOUND" };

      if (b.licenseId !== licenseId) {
        return { success: false, error: "LICENSE_MISMATCH" };
      }

      if (Number(b.stock || 0) > 0) {
        return { success: false, error: "BARCODE_HAS_STOCK" };
      }

      db.prepare(
        `UPDATE product_batches SET deletedAt=?, updatedAt=? WHERE id=?`,
      ).run(ts, ts, batchId);

      rebuildStock(b.productId);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  // ── Get the next barcode for a purchase row ──
  ipcMain.handle("purchase:nextBarcodeForRow", (e, { licenseId }) => {
    if (!licenseId) return { success: false, error: "licenseId required" };
    if (!canUseBarcode(licenseId)) return barcodeDisabledResult();
    try {
      const num = peekNextBarcodeNumber(licenseId);
      return { success: true, barcode: String(num).padStart(5, "0") };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });
}

module.exports = {
  registerBarcodeHandlers,
  reserveOneBarcode,
  reserveBarcodes,
  peekNextBarcodeNumber,
  getLiveMaxBarcodeNumber,
  getSequenceBarcodeNumber,
  getSafeCurrentBarcodeNumber,
};
