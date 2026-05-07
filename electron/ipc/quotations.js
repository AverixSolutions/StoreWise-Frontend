// electron/ipc/quotations.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

// ── helpers ──────────────────────────────────────────────────────────────────

function getNextQuotationSlNo(licenseId) {
  const seq = db
    .prepare(`SELECT lastSlNo FROM quotation_sequence WHERE licenseId = ?`)
    .get(licenseId);
  const next = seq ? seq.lastSlNo + 1 : 1;
  db.prepare(
    `INSERT INTO quotation_sequence (licenseId, lastSlNo)
     VALUES (?, ?)
     ON CONFLICT(licenseId) DO UPDATE SET lastSlNo = excluded.lastSlNo`,
  ).run(licenseId, next);
  return next;
}

function formatQuotationNo(slNo) {
  return `QT-${String(slNo).padStart(4, "0")}`;
}

function getItemsForQuotation(quotationId) {
  return db
    .prepare(
      `SELECT productId, quantity, isFree, batchId
       FROM quotation_items
       WHERE quotationId = ? AND COALESCE(deletedAt,'') = ''`,
    )
    .all(quotationId);
}

function rebuildProductStock(productId) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(stock),0) AS qty
       FROM product_batches
       WHERE productId=? AND COALESCE(deletedAt,'')=''`,
    )
    .get(productId);
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE products SET stock=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE id=?`,
  ).run(Number(row?.qty || 0), now, productId);
}

function bumpBatchAndProductStock({ batchId, productId, deltaQty }) {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE product_batches SET stock = COALESCE(stock,0) + ?, updatedAt = ? WHERE id = ?`,
  ).run(Number(deltaQty || 0), now, batchId);
  rebuildProductStock(productId);
}

// ── register ──────────────────────────────────────────────────────────────────

function registerQuotationHandlers() {
  // ── list ──────────────────────────────────────────────────────────────────
  ipcMain.handle("quotation:list", (evt, licenseId, filters = {}) => {
    const {
      q = "",
      customerId = null,
      status = null,
      dateFrom = null,
      dateTo = null,
      page = 1,
      pageSize = 50,
    } = filters;

    const where = ["licenseId = @licenseId", "COALESCE(deletedAt,'') = ''"];
    const params = { licenseId };

    if (customerId) {
      where.push("customerId = @customerId");
      params.customerId = customerId;
    }
    if (status) {
      where.push("status = @status");
      params.status = status;
    }
    if (dateFrom) {
      where.push("quotationDate >= @dateFrom");
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      where.push("quotationDate < @dateTo");
      params.dateTo = dateTo;
    }
    if (q && q.trim()) {
      where.push(
        `(COALESCE(quotationNo,'') LIKE @q OR COALESCE(customerName,'') LIKE @q)`,
      );
      params.q = `%${q.trim()}%`;
    }

    const base = `FROM quotations WHERE ${where.join(" AND ")}`;
    const total = db.prepare(`SELECT COUNT(*) AS cnt ${base}`).get(params).cnt;

    const rows = db
      .prepare(
        `SELECT id, slNo, quotationNo, customerId, customerName,
                quotationDate, entryTime, totalAmount, discount,
                status, notes, convertedSaleId, isSynced
         ${base}
         ORDER BY datetime(quotationDate) DESC, slNo DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

    // item count per quotation
    const itemCounts = {};
    if (rows.length > 0) {
      const ids = rows.map((r) => `'${r.id}'`).join(",");
      const counts = db
        .prepare(
          `SELECT quotationId, COUNT(*) as cnt
           FROM quotation_items
           WHERE quotationId IN (${ids}) AND COALESCE(deletedAt,'') = ''
           GROUP BY quotationId`,
        )
        .all();
      for (const c of counts) itemCounts[c.quotationId] = c.cnt;
    }

    return {
      success: true,
      total,
      page,
      pageSize,
      rows: rows.map((r) => ({ ...r, itemCount: itemCounts[r.id] || 0 })),
    };
  });

  // ── get ───────────────────────────────────────────────────────────────────
  ipcMain.handle("quotation:get", (evt, id) => {
    const q = db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(id);
    if (!q) return { success: false, error: "Not found" };
    const items = db
      .prepare(
        `SELECT qi.*, p.name as productName, p.code as productCode
         FROM quotation_items qi
         LEFT JOIN products p ON p.id = qi.productId
         WHERE qi.quotationId = ?
         ORDER BY COALESCE(qi.lineNo,0), qi.createdAt`,
      )
      .all(id);
    return { success: true, quotation: q, items };
  });

  // ── peek next slno ────────────────────────────────────────────────────────
  ipcMain.handle("quotation:peek-next-slno", (evt, licenseId) => {
    const seq = db
      .prepare(`SELECT lastSlNo FROM quotation_sequence WHERE licenseId = ?`)
      .get(licenseId);
    const next = seq ? seq.lastSlNo + 1 : 1;
    return { nextSlNo: next, nextQuotationNo: formatQuotationNo(next) };
  });

  // ── create ────────────────────────────────────────────────────────────────
  ipcMain.handle("quotation:create", (evt, header, items) => {
    const newId = header.id || uuidv4();
    const now = new Date().toISOString();

    const trx = db.transaction((header, items) => {
      const slNo = getNextQuotationSlNo(header.licenseId);
      const quotationNo = formatQuotationNo(slNo);

      db.prepare(
        `INSERT INTO quotations(
           id, slNo, quotationNo, userId, licenseId,
           customerId, customerName, department, debitAccount, natureOfEntry,
           quotationDate, entryTime, totalAmount, discount, status, notes,
           createdAt, updatedAt, isSynced
         ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,0)`,
      ).run(
        newId,
        slNo,
        quotationNo,
        header.userId || null,
        header.licenseId,
        header.customerId || null,
        header.customerName || null,
        header.department || null,
        header.debitAccount || null,
        header.natureOfEntry || null,
        header.quotationDate || now,
        header.entryTime || now,
        header.discount || 0,
        header.status || "DRAFT",
        header.notes || null,
        now,
        now,
      );

      const insItem = db.prepare(
        `INSERT INTO quotation_items(
           id, quotationId, productId, barcode, quantity, unit, rate, mrp,
           taxPercent, taxAmount, discount, discountType, salePrice, profit,
           totalCost, billedValue, effectiveUnitValue, batchNo, batchId,
           mfgDate, expiryDate, lineNo, isFree, createdAt, updatedAt, isSynced
         ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      );

      let totalAmount = 0;

      items.forEach((it, idx) => {
        const qty = Number(it.quantity || 0);
        const rate = Number(it.rate || 0);
        const taxPct =
          it.taxPercent === "NT"
            ? 0
            : parseInt(String(it.taxPercent).replace("P", "")) || 0;
        const taxAmount = it.isFree ? 0 : rate * qty * (taxPct / 100);
        const totalCost = it.isFree ? 0 : rate * qty + taxAmount;
        const discountAbs =
          it.discountType === "PCT"
            ? totalCost * (Math.max(0, Math.min(100, it.discount)) / 100)
            : Number(it.discount) || 0;
        const billedValue = it.isFree ? 0 : Math.max(0, totalCost - discountAbs);
        const effUnit = it.isFree ? 0 : qty > 0 ? billedValue / qty : 0;

        totalAmount += billedValue;

        insItem.run(
          uuidv4(),
          newId,
          it.productId,
          it.barcode || null,
          qty,
          it.unit,
          rate,
          it.mrp ?? null,
          it.taxPercent,
          taxAmount,
          discountAbs,
          it.discountType || "ABS",
          it.salePrice ?? null,
          it.profit ?? null,
          totalCost,
          billedValue,
          effUnit,
          it.batchNo || null,
          it.batchId || null,
          it.mfgDate || null,
          it.expiryDate || null,
          it.lineNo || idx + 1,
          it.isFree ? 1 : 0,
          now,
          now,
        );
      });

      db.prepare(
        `UPDATE quotations SET totalAmount=?, discount=? WHERE id=?`,
      ).run(totalAmount, header.discount || 0, newId);

      return { slNo, quotationNo, totalAmount };
    });

    try {
      const { slNo, quotationNo, totalAmount } = trx(header, items);
      return { success: true, quotationId: newId, slNo, quotationNo, totalAmount };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  // ── update ────────────────────────────────────────────────────────────────
  ipcMain.handle("quotation:update", (evt, payload) => {
    const { id, header, items } = payload;
    if (!id) return { success: false, error: "id required" };

    const trx = db.transaction(() => {
      const existing = db
        .prepare(`SELECT * FROM quotations WHERE id=?`)
        .get(id);
      if (!existing) throw new Error("Quotation not found");
      if (existing.status === "CONVERTED")
        throw new Error("Cannot edit a converted quotation");

      const now = new Date().toISOString();
      let totalAmount = 0;

      items.forEach((it) => {
        totalAmount += Number(it.billedValue || 0);
      });
      const grand = Math.max(0, totalAmount - Number(header.discount || 0));

      db.prepare(
        `UPDATE quotations SET
           customerId=@customerId, customerName=@customerName,
           department=@department, debitAccount=@debitAccount,
           natureOfEntry=@natureOfEntry, quotationDate=@quotationDate,
           entryTime=@entryTime, discount=@discount, totalAmount=@totalAmount,
           status=@status, notes=@notes, updatedAt=@now, isSynced=0
         WHERE id=@id`,
      ).run({
        id,
        customerId: header.customerId || null,
        customerName: header.customerName || null,
        department: header.department || null,
        debitAccount: header.debitAccount || null,
        natureOfEntry: header.natureOfEntry || null,
        quotationDate: header.quotationDate,
        entryTime: header.entryTime || header.quotationDate,
        discount: Number(header.discount || 0),
        totalAmount,
        status: header.status || existing.status,
        notes: header.notes || null,
        now,
      });

      db.prepare(`DELETE FROM quotation_items WHERE quotationId = ?`).run(id);

      const insItem = db.prepare(
        `INSERT INTO quotation_items(
           id, quotationId, productId, barcode, quantity, unit, rate, mrp,
           taxPercent, taxAmount, discount, discountType, salePrice, profit,
           totalCost, billedValue, effectiveUnitValue, batchNo, batchId,
           mfgDate, expiryDate, lineNo, isFree, createdAt, updatedAt, isSynced
         ) VALUES(
           lower(hex(randomblob(16))),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      );

      items.forEach((it, idx) => {
        const qty = Number(it.quantity || 0);
        const effUnit = qty > 0 ? Number(it.billedValue || 0) / qty : 0;
        insItem.run(
          id,
          it.productId,
          it.barcode ?? null,
          qty,
          it.unit,
          Number(it.rate || 0),
          it.mrp ?? null,
          it.taxPercent,
          Number(it.taxAmount || 0),
          Number(it.discount || 0),
          it.discountType || "ABS",
          it.salePrice ?? null,
          it.profit ?? null,
          Number(it.totalCost || 0),
          Number(it.billedValue || 0),
          effUnit,
          it.batchNo ?? null,
          it.batchId ?? null,
          it.mfgDate ?? null,
          it.expiryDate ?? null,
          it.lineNo ?? idx + 1,
          it.isFree ? 1 : 0,
          now,
          now,
        );
      });
    });

    try {
      trx();
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  // ── delete ────────────────────────────────────────────────────────────────
  ipcMain.handle("quotation:delete", (evt, id) => {
    const now = new Date().toISOString();
    try {
      const existing = db
        .prepare(`SELECT status FROM quotations WHERE id=?`)
        .get(id);
      if (!existing) return { success: false, error: "Not found" };
      if (existing.status === "CONVERTED")
        return {
          success: false,
          error: "Cannot delete a converted quotation",
        };

      db.prepare(
        `UPDATE quotations SET deletedAt=?, updatedAt=?, isSynced=0 WHERE id=?`,
      ).run(now, now, id);
      return { success: true, deletedAt: now };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });

  // ── convert to sale ───────────────────────────────────────────────────────
  ipcMain.handle("quotation:convert-to-sale", (evt, quotationId, overrides = {}) => {
    const trx = db.transaction(() => {
      const quot = db
        .prepare(`SELECT * FROM quotations WHERE id=?`)
        .get(quotationId);
      if (!quot) throw new Error("Quotation not found");
      if (quot.status === "CONVERTED")
        throw new Error("Already converted");
      if (quot.status === "EXPIRED")
        throw new Error("Cannot convert an expired quotation");

      const quotItems = db
        .prepare(
          `SELECT * FROM quotation_items
           WHERE quotationId=? AND COALESCE(deletedAt,'')=''
           ORDER BY lineNo`,
        )
        .all(quotationId);

      const now = new Date().toISOString();
      const saleId = uuidv4();

      // ── next sale slno ──
      const saleSeq = db
        .prepare(`SELECT lastSlNo FROM sale_sequence WHERE licenseId=?`)
        .get(quot.licenseId);
      const saleSlNo = saleSeq ? saleSeq.lastSlNo + 1 : 1;
      db.prepare(
        `INSERT INTO sale_sequence (licenseId, lastSlNo) VALUES (?,?)
         ON CONFLICT(licenseId) DO UPDATE SET lastSlNo = excluded.lastSlNo`,
      ).run(quot.licenseId, saleSlNo);

      const saleBillNo = overrides.billNo || null;
      const saleType = overrides.saleType || "CASH";

      db.prepare(
        `INSERT INTO sales(
           id, slNo, userId, licenseId, customerId, customerName, billNo,
           department, debitAccount, natureOfEntry, saleDate, entryTime,
           totalAmount, discount, saleType, createdAt, updatedAt, isSynced
         ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      ).run(
        saleId,
        saleSlNo,
        quot.userId,
        quot.licenseId,
        quot.customerId,
        quot.customerName,
        saleBillNo,
        quot.department,
        quot.debitAccount,
        quot.natureOfEntry,
        overrides.saleDate || quot.quotationDate,
        now,
        0,
        Number(quot.discount || 0),
        saleType,
        now,
        now,
      );

      let totalAmount = 0;

      for (const it of quotItems) {
        const qty = Number(it.quantity || 0);
        const billedValue = Number(it.billedValue || 0);
        totalAmount += billedValue;
        const effUnit = qty > 0 ? billedValue / qty : 0;

        db.prepare(
          `INSERT INTO sale_items(
             id, saleId, productId, barcode, quantity, unit, rate, mrp,
             taxPercent, taxAmount, discount, discountType, salePrice, profit,
             totalCost, billedValue, effectiveUnitValue, batchNo, batchId,
             mfgDate, expiryDate, lineNo, isFree, createdAt, updatedAt, isSynced
           ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
        ).run(
          uuidv4(),
          saleId,
          it.productId,
          it.barcode,
          qty,
          it.unit,
          it.rate,
          it.mrp,
          it.taxPercent,
          it.taxAmount,
          it.discount,
          it.discountType,
          it.salePrice,
          it.profit,
          it.totalCost,
          billedValue,
          effUnit,
          it.batchNo,
          it.batchId,
          it.mfgDate,
          it.expiryDate,
          it.lineNo,
          it.isFree,
          now,
          now,
        );

        // deduct stock
        if (!it.isFree && qty > 0) {
          if (it.batchId) {
            const batchRow = db
              .prepare(`SELECT stock FROM product_batches WHERE id=?`)
              .get(it.batchId);
            if (!batchRow) throw new Error(`Batch not found: ${it.batchId}`);
            if (Number(batchRow.stock || 0) < qty) {
              throw new Error(
                `Insufficient stock for product ${it.productId}. Available: ${batchRow.stock}, Required: ${qty}`,
              );
            }
            bumpBatchAndProductStock({
              batchId: it.batchId,
              productId: it.productId,
              deltaQty: -qty,
            });
          } else {
            db.prepare(
              `UPDATE products
               SET stock = COALESCE(stock,0) - ?, updatedAt=?, isSynced=0, syncedAt=NULL
               WHERE id=?`,
            ).run(qty, now, it.productId);
          }
        }
      }

      db.prepare(
        `UPDATE sales SET totalAmount=?, discount=? WHERE id=?`,
      ).run(totalAmount, Number(quot.discount || 0), saleId);

      // customer ledger entry for credit sales
      if (saleType !== "CASH" && quot.customerId) {
        const grand = Math.max(0, totalAmount - Number(quot.discount || 0));
        db.prepare(
          `INSERT INTO customer_transactions
           (id, licenseId, customerId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
           VALUES(?,?,?,'SALE',?,?,?,?,1,'Sale (from quotation)',?,?,0)`,
        ).run(
          uuidv4(),
          quot.licenseId,
          quot.customerId,
          saleId,
          saleBillNo,
          overrides.saleDate || quot.quotationDate,
          grand,
          now,
          now,
        );
      }

      // mark quotation converted
      db.prepare(
        `UPDATE quotations
         SET status='CONVERTED', convertedSaleId=?, updatedAt=?, isSynced=0
         WHERE id=?`,
      ).run(saleId, now, quotationId);

      return { saleId, saleSlNo, totalAmount };
    });

    try {
      const { saleId, saleSlNo, totalAmount } = trx();
      return { success: true, saleId, saleSlNo, totalAmount };
    } catch (e) {
      return { success: false, error: String(e.message || e) };
    }
  });
}

module.exports = { registerQuotationHandlers };
