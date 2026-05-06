// electron/ipc/customerLedger.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

function registerCustomerLedgerHandlers() {
  // ── CUSTOMER LEDGER LIST ──────────────────────────────────────────────────
  ipcMain.handle(
    "customer-ledger:list",
    (
      e,
      {
        licenseId,
        customerId,
        dateFrom = null,
        dateTo = null,
        page = 1,
        pageSize = 50,
      },
    ) => {
      if (!licenseId || !customerId)
        return { success: false, error: "licenseId & customerId required" };

      const where = [
        "licenseId=@licenseId",
        "customerId=@customerId",
        "COALESCE(deletedAt,'')=''",
        "kind IN ('OPENING','SALE','RETURN','RECEIPT','ADJUSTMENT')",
      ];
      const params = { licenseId, customerId };

      if (dateFrom) {
        where.push("date >= @dateFrom");
        params.dateFrom = dateFrom;
      }
      if (dateTo) {
        where.push("date < @dateTo");
        params.dateTo = dateTo;
      }

      const base = `FROM customer_transactions WHERE ${where.join(" AND ")}`;
      const total = db
        .prepare(`SELECT COUNT(*) AS cnt ${base}`)
        .get(params).cnt;

      const rows = db
        .prepare(
          `
        SELECT id, kind, refId, refNo, date, amount, sign, notes, createdAt,
               paymentStatus, chequeNo, chequeIssueDate, chequeClearanceDate
        ${base}
        ORDER BY datetime(date) DESC, datetime(createdAt) DESC
        LIMIT @limit OFFSET @offset
      `,
        )
        .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

      const sum = db
        .prepare(
          `
        SELECT COALESCE(SUM(sign * amount), 0) AS txSum
        FROM customer_transactions
        WHERE licenseId=@licenseId AND customerId=@customerId
          AND COALESCE(deletedAt,'')=''
          AND kind IN ('OPENING','SALE','RETURN','RECEIPT','ADJUSTMENT')
          AND (kind != 'RECEIPT' OR COALESCE(paymentStatus,'CLEARED') = 'CLEARED')
      `,
        )
        .get(params).txSum;

      return {
        success: true,
        total,
        page,
        pageSize,
        rows,
        openingBalance: 0,
        balance: Number(sum || 0),
      };
    },
  );

  // ── OUTSTANDING CREDIT SALES ──────────────────────────────────────────────
  ipcMain.handle(
    "customer:outstanding-sales",
    (e, { licenseId, customerId, q = "", page = 1, pageSize = 50 }) => {
      if (!licenseId || !customerId)
        return { success: false, error: "licenseId & customerId required" };

      const like = `%${q.trim()}%`;

      const baseRows = db
        .prepare(
          `
        SELECT s.id, s.slNo, s.billNo, s.saleDate, s.totalAmount, s.discount, s.saleType
        FROM sales s
        WHERE s.licenseId = ? AND s.customerId = ? AND COALESCE(s.deletedAt,'') = ''
          AND s.saleType = 'CREDIT'
          AND (COALESCE(s.billNo,'') LIKE ? OR COALESCE(s.customerName,'') LIKE ?)
        ORDER BY datetime(s.saleDate) DESC, s.slNo DESC
        LIMIT ? OFFSET ?
      `,
        )
        .all(
          licenseId,
          customerId,
          like,
          like,
          pageSize,
          (page - 1) * pageSize,
        );

      const total = db
        .prepare(
          `
        SELECT COUNT(*) AS cnt
        FROM sales s
        WHERE s.licenseId = ? AND s.customerId = ? AND COALESCE(s.deletedAt,'') = ''
          AND s.saleType = 'CREDIT'
          AND (COALESCE(s.billNo,'') LIKE ? OR COALESCE(s.customerName,'') LIKE ?)
      `,
        )
        .get(licenseId, customerId, like, like).cnt;

      const rows = baseRows.map((r) => {
        const grand = Math.max(
          0,
          Number(r.totalAmount || 0) - Number(r.discount || 0),
        );
        const paid = db
          .prepare(
            `
          SELECT COALESCE(SUM(amount), 0) AS paid
          FROM customer_bill_settlements
          WHERE licenseId=? AND saleId=?
        `,
          )
          .get(licenseId, r.id).paid;
        const remaining = Math.max(0, grand - Number(paid || 0));
        return {
          ...r,
          grandAmount: grand,
          paidAmount: Number(paid || 0),
          remainingDue: remaining,
        };
      });

      return {
        success: true,
        page,
        pageSize,
        total,
        rows: rows.filter((r) => r.remainingDue > 0),
      };
    },
  );

  // ── CREATE CUSTOMER RECEIPT ───────────────────────────────────────────────
  ipcMain.handle(
    "customer-ledger:receipt:create",
    (
      e,
      {
        licenseId,
        customerId,
        amount,
        date,
        mode = "CASH",
        notes = null,
        allocations = [],
        chequeNo = null,
        chequeIssueDate = null,
        chequeClearanceDate = null,
      },
    ) => {
      if (!licenseId || !customerId || !amount || Number(amount) <= 0)
        return {
          success: false,
          error: "licenseId, customerId and positive amount required",
        };

      if (mode === "CHEQUE" && !chequeClearanceDate)
        return { success: false, error: "Cheque clearance date is required" };

      const now = new Date().toISOString();
      const txId = uuidv4();
      const payAmt = Number(amount);
      const isCheque = mode === "CHEQUE";
      const paymentStatus = isCheque ? "PENDING_CHEQUE" : "CLEARED";

      let allocSum = 0;
      for (const a of allocations || []) {
        const v = Number(a?.amount || 0);
        if (v < 0)
          return { success: false, error: "Allocation amount must be >= 0" };
        allocSum += v;

        const sr = db
          .prepare(
            `
          SELECT licenseId, customerId, totalAmount, discount, deletedAt, saleType
          FROM sales WHERE id=?
        `,
          )
          .get(a.saleId);

        if (
          !sr ||
          sr.licenseId !== licenseId ||
          sr.customerId !== customerId ||
          sr.deletedAt
        )
          return {
            success: false,
            error: `Invalid saleId in allocation: ${a.saleId}`,
          };
        if (sr.saleType !== "CREDIT")
          return {
            success: false,
            error: `Cannot allocate to non-CREDIT sale: ${a.saleId}`,
          };
      }

      if (allocSum > payAmt)
        return {
          success: false,
          error: "Sum of allocations exceeds receipt amount",
        };

      const trx = db.transaction(() => {
        db.prepare(
          `
          INSERT INTO customer_transactions
          (id, licenseId, customerId, kind, refId, refNo, date, amount, sign, notes,
           paymentStatus, chequeNo, chequeIssueDate, chequeClearanceDate,
           createdAt, updatedAt, isSynced)
          VALUES(?, ?, ?, 'RECEIPT', NULL, NULL, ?, ?, -1, ?,
                 ?, ?, ?, ?, ?, ?, 0)
        `,
        ).run(
          txId,
          licenseId,
          customerId,
          date || now,
          payAmt,
          notes || (isCheque ? "Cheque Receipt" : "Receipt"),
          paymentStatus,
          chequeNo || null,
          chequeIssueDate || null,
          chequeClearanceDate || null,
          now,
          now,
        );

        for (const a of allocations || []) {
          if (Number(a.amount || 0) <= 0) continue;
          db.prepare(
            `
            INSERT INTO customer_bill_settlements
            (id, licenseId, customerId, receiptTxId, saleId, amount, createdAt)
            VALUES(?, ?, ?, ?, ?, ?, ?)
          `,
          ).run(
            uuidv4(),
            licenseId,
            customerId,
            txId,
            a.saleId,
            Number(a.amount),
            now,
          );
        }

        if (!isCheque && (mode === "CASH" || mode === "BANK")) {
          db.prepare(
            `
            INSERT INTO cash_transactions
            (id, licenseId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
            VALUES (?,?,?,?,?,?,?,?,?,?,?, 0)
          `,
          ).run(
            uuidv4(),
            licenseId,
            "RECEIPT",
            txId,
            null,
            date || now,
            payAmt,
            1,
            mode === "CASH"
              ? "Customer Receipt (Cash)"
              : "Customer Receipt (Bank)",
            now,
            now,
          );
        }
      });

      try {
        trx();
        return {
          success: true,
          id: txId,
          allocated: allocSum,
          unallocated: payAmt - allocSum,
          paymentStatus,
        };
      } catch (err) {
        return { success: false, error: String(err?.message || err) };
      }
    },
  );

  // ── MARK CHEQUE RECEIPT AS CLEARED ────────────────────────────────────────
  ipcMain.handle("customer-cheque:mark-received", (e, { licenseId, txId }) => {
    if (!licenseId || !txId)
      return { success: false, error: "licenseId and txId required" };

    const now = new Date().toISOString();
    const tx = db
      .prepare(
        `
      SELECT * FROM customer_transactions
      WHERE id = ? AND licenseId = ? AND kind = 'RECEIPT'
    `,
      )
      .get(txId, licenseId);

    if (!tx) return { success: false, error: "Transaction not found" };
    if (tx.paymentStatus !== "PENDING_CHEQUE")
      return { success: false, error: "Transaction is not a pending cheque" };

    try {
      db.transaction(() => {
        db.prepare(
          `
          UPDATE customer_transactions
          SET paymentStatus = 'CLEARED', updatedAt = ?, isSynced = 0
          WHERE id = ?
        `,
        ).run(now, txId);

        db.prepare(
          `
          INSERT INTO cash_transactions
          (id, licenseId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES (?,?,?,?,?,?,?,?,?,?,?, 0)
        `,
        ).run(
          uuidv4(),
          licenseId,
          "RECEIPT",
          txId,
          tx.chequeNo || null,
          now,
          Number(tx.amount),
          1,
          `Cheque Cleared${tx.chequeNo ? " - " + tx.chequeNo : ""}`,
          now,
          now,
        );
      })();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  // ── LIST RECEIPTS ─────────────────────────────────────────────────────────
  ipcMain.handle(
    "receipts:list",
    (
      e,
      {
        licenseId,
        customerId = null,
        q = "",
        dateFrom = null,
        dateTo = null,
        page = 1,
        pageSize = 50,
      },
    ) => {
      if (!licenseId) return { success: false, error: "licenseId required" };

      const where = [
        "ct.licenseId = @licenseId",
        "COALESCE(ct.deletedAt,'')=''",
        "ct.kind = 'RECEIPT'",
      ];
      const params = {
        licenseId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };

      if (customerId) {
        where.push("ct.customerId = @customerId");
        params.customerId = customerId;
      }
      if (dateFrom) {
        where.push("ct.date >= @dateFrom");
        params.dateFrom = dateFrom;
      }
      if (dateTo) {
        where.push("ct.date < @dateTo");
        params.dateTo = dateTo;
      }
      if (q && q.trim()) {
        where.push(
          "(COALESCE(c.name,'') LIKE @q OR COALESCE(ct.notes,'') LIKE @q)",
        );
        params.q = `%${q.trim()}%`;
      }

      const base = `
        FROM customer_transactions ct
        LEFT JOIN customers c ON c.id = ct.customerId
        LEFT JOIN cash_transactions cash
          ON cash.licenseId = ct.licenseId
         AND cash.refId = ct.id
         AND cash.kind = 'RECEIPT'
        WHERE ${where.join(" AND ")}
      `;

      const total = db
        .prepare(`SELECT COUNT(*) AS cnt ${base}`)
        .get(params).cnt;

      const rows = db
        .prepare(
          `
        SELECT
          ct.id, ct.customerId,
          COALESCE(c.name,'') AS customerName,
          ct.date, ct.amount, ct.notes, ct.createdAt,
          ct.paymentStatus, ct.chequeNo,
          CASE
            WHEN ct.chequeNo IS NOT NULL OR ct.paymentStatus IS NOT NULL THEN 'CHEQUE'
            WHEN LOWER(COALESCE(cash.notes,'')) LIKE '%bank%' THEN 'BANK'
            ELSE 'CASH'
          END AS mode,
          (SELECT COALESCE(SUM(amount),0)
             FROM customer_bill_settlements b
            WHERE b.licenseId = ct.licenseId AND b.receiptTxId = ct.id) AS allocated
        ${base}
        ORDER BY datetime(ct.date) DESC, datetime(ct.createdAt) DESC
        LIMIT @limit OFFSET @offset
      `,
        )
        .all(params);

      const billStmt = db.prepare(`
        SELECT b.saleId,
               COALESCE(s.billNo, printf('SL-%d', s.slNo)) AS billRef
          FROM customer_bill_settlements b
          LEFT JOIN sales s ON s.id = b.saleId
         WHERE b.licenseId = ? AND b.receiptTxId = ?
         ORDER BY datetime(s.saleDate) DESC, s.slNo DESC
      `);

      const mapped = rows.map((r) => {
        const bills = billStmt.all(licenseId, r.id) || [];
        const allocated = Number(r.allocated || 0);
        return {
          ...r,
          allocated,
          unallocated: Math.max(0, Number(r.amount || 0) - allocated),
          bills: bills.map((x) => ({
            saleId: x.saleId,
            billRef: x.billRef || x.saleId,
          })),
        };
      });

      return { success: true, total, page, pageSize, rows: mapped };
    },
  );

  // ── SYNC HANDLERS ─────────────────────────────────────────────────────────
  ipcMain.handle(
    "get-dirty-customer-transactions",
    (event, licenseId, limit = 200) => {
      const rows = db
        .prepare(
          `
      SELECT
        ct.id, ct.licenseId, ct.customerId, ct.kind,
        ct.refId, ct.refNo, ct.date, ct.amount, ct.sign, ct.notes,
        ct.paymentStatus, ct.chequeNo, ct.chequeIssueDate, ct.chequeClearanceDate,
        ct.createdAt, ct.updatedAt, ct.deletedAt, ct.isSynced, ct.syncedAt,
        (
          SELECT json_group_array(json_object(
            'id', cbs.id, 'licenseId', cbs.licenseId,
            'customerId', cbs.customerId, 'saleId', cbs.saleId,
            'amount', cbs.amount, 'createdAt', cbs.createdAt
          ))
          FROM customer_bill_settlements cbs
          WHERE cbs.receiptTxId = ct.id
        ) AS settlementsJson
      FROM customer_transactions ct
      WHERE ct.licenseId = ?
        AND (ct.isSynced = 0 OR ct.isSynced IS NULL)
      ORDER BY ct.updatedAt ASC
      LIMIT ?
    `,
        )
        .all(licenseId, limit);
      return { success: true, records: rows };
    },
  );

  ipcMain.handle(
    "mark-customer-transactions-synced",
    (event, ids, serverSyncedAt) => {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true };
      const ts = serverSyncedAt || new Date().toISOString();
      db.transaction((ids) => {
        const stmt = db.prepare(
          `UPDATE customer_transactions SET isSynced = 1, syncedAt = ? WHERE id = ?`,
        );
        ids.forEach((id) => stmt.run(ts, id));
      })(ids);
      return { success: true, syncedAt: ts };
    },
  );

  ipcMain.handle("bulk-upsert-customer-transactions", (event, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = new Date().toISOString();

    const upsertTx = db.prepare(`
      INSERT INTO customer_transactions (
        id, licenseId, customerId, kind, refId, refNo, date, amount, sign, notes,
        paymentStatus, chequeNo, chequeIssueDate, chequeClearanceDate,
        createdAt, updatedAt, deletedAt, isSynced, syncedAt
      ) VALUES (
        @id, @licenseId, @customerId, @kind, @refId, @refNo, @date, @amount, @sign, @notes,
        @paymentStatus, @chequeNo, @chequeIssueDate, @chequeClearanceDate,
        @createdAt, @updatedAt, @deletedAt, 1, @syncedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind, refId = excluded.refId, refNo = excluded.refNo,
        date = excluded.date, amount = excluded.amount, sign = excluded.sign,
        notes = excluded.notes, paymentStatus = excluded.paymentStatus,
        chequeNo = excluded.chequeNo, chequeIssueDate = excluded.chequeIssueDate,
        chequeClearanceDate = excluded.chequeClearanceDate,
        updatedAt = excluded.updatedAt, deletedAt = excluded.deletedAt,
        isSynced = 1, syncedAt = excluded.syncedAt
      WHERE excluded.updatedAt > customer_transactions.updatedAt
         OR customer_transactions.updatedAt IS NULL
    `);

    const upsertSettlement = db.prepare(`
      INSERT INTO customer_bill_settlements
        (id, licenseId, customerId, receiptTxId, saleId, amount, createdAt)
      VALUES (@id, @licenseId, @customerId, @receiptTxId, @saleId, @amount, @createdAt)
      ON CONFLICT(id) DO UPDATE SET amount = excluded.amount
    `);

    db.transaction((records) => {
      for (const r of records) {
        upsertTx.run({
          id: r.id,
          licenseId: r.licenseId,
          customerId: r.customerId,
          kind: r.kind,
          refId: r.refId ?? null,
          refNo: r.refNo ?? null,
          date: r.date instanceof Date ? r.date.toISOString() : r.date,
          amount: Number(r.amount || 0),
          sign: Number(r.sign || 0),
          notes: r.notes ?? null,
          paymentStatus: r.paymentStatus ?? null,
          chequeNo: r.chequeNo ?? null,
          chequeIssueDate: r.chequeIssueDate
            ? r.chequeIssueDate instanceof Date
              ? r.chequeIssueDate.toISOString()
              : r.chequeIssueDate
            : null,
          chequeClearanceDate: r.chequeClearanceDate
            ? r.chequeClearanceDate instanceof Date
              ? r.chequeClearanceDate.toISOString()
              : r.chequeClearanceDate
            : null,
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : (r.createdAt ?? now),
          updatedAt:
            r.updatedAt instanceof Date
              ? r.updatedAt.toISOString()
              : (r.updatedAt ?? now),
          deletedAt:
            r.deletedAt instanceof Date
              ? r.deletedAt.toISOString()
              : (r.deletedAt ?? null),
          syncedAt:
            r.syncedAt instanceof Date
              ? r.syncedAt.toISOString()
              : (r.syncedAt ?? now),
        });

        const settlements = Array.isArray(r.settlements) ? r.settlements : [];
        for (const s of settlements) {
          try {
            upsertSettlement.run({
              id: s.id,
              licenseId: s.licenseId || r.licenseId,
              customerId: s.customerId || r.customerId,
              receiptTxId: r.id,
              saleId: s.saleId,
              amount: Number(s.amount || 0),
              createdAt: s.createdAt ?? now,
            });
          } catch (e) {
            console.warn(
              `[customerLedger] skipping settlement ${s.id}:`,
              e.message,
            );
          }
        }
      }
    })(records);

    return { success: true, upserted: records.length };
  });
}

module.exports = { registerCustomerLedgerHandlers };
