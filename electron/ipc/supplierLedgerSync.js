// electron/ipc/supplierLedgerSync.js
const { ipcMain } = require("electron");
const db = require("../db");

function registerSupplierLedgerSyncHandlers() {
  // ── GET DIRTY SUPPLIER TRANSACTIONS ─────────────────────────────────────────
  // Embeds bill settlements as a JSON string so they piggyback on the tx push.

  ipcMain.handle(
    "get-dirty-supplier-transactions",
    (event, licenseId, limit = 200) => {
      const rows = db
        .prepare(
          `
      SELECT
        st.id, st.licenseId, st.supplierId, st.kind,
        st.refId, st.refNo, st.date, st.amount, st.sign, st.notes,
        st.paymentStatus, st.paymentMode, st.chequeNo, st.chequeIssueDate, st.chequeClearanceDate,
        st.createdAt, st.updatedAt, st.deletedAt, st.isSynced, st.syncedAt,
        (
          SELECT json_group_array(json_object(
            'id',          sbs.id,
            'licenseId',   sbs.licenseId,
            'supplierId',  sbs.supplierId,
            'purchaseId',  sbs.purchaseId,
            'amount',      sbs.amount,
            'createdAt',   sbs.createdAt
          ))
          FROM supplier_bill_settlements sbs
          WHERE sbs.paymentTxId = st.id
        ) AS settlementsJson
      FROM supplier_transactions st
      WHERE st.licenseId = ?
        AND (st.isSynced = 0 OR st.isSynced IS NULL)
      ORDER BY st.updatedAt ASC
      LIMIT ?
    `,
        )
        .all(licenseId, limit);

      return { success: true, records: rows };
    },
  );

  // ── MARK SUPPLIER TRANSACTIONS SYNCED ────────────────────────────────────────

  ipcMain.handle(
    "mark-supplier-transactions-synced",
    (event, ids, serverSyncedAt) => {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true };
      const ts = serverSyncedAt || new Date().toISOString();

      db.transaction((ids) => {
        const stmt = db.prepare(
          `UPDATE supplier_transactions SET isSynced = 1, syncedAt = ? WHERE id = ?`,
        );
        ids.forEach((id) => stmt.run(ts, id));
      })(ids);

      return { success: true, syncedAt: ts };
    },
  );

  // ── BULK UPSERT SUPPLIER TRANSACTIONS FROM SERVER ────────────────────────────
  // Also upserts embedded settlements so the local outstanding-bills view stays correct.

  ipcMain.handle("bulk-upsert-supplier-transactions", (event, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = new Date().toISOString();

    const upsertTx = db.prepare(`
      INSERT INTO supplier_transactions (
        id, licenseId, supplierId, kind,
        refId, refNo, date, amount, sign, notes,
        paymentStatus, paymentMode, chequeNo, chequeIssueDate, chequeClearanceDate,
        createdAt, updatedAt, deletedAt, isSynced, syncedAt
      ) VALUES (
        @id, @licenseId, @supplierId, @kind,
        @refId, @refNo, @date, @amount, @sign, @notes,
        @paymentStatus, @paymentMode, @chequeNo, @chequeIssueDate, @chequeClearanceDate,
        @createdAt, @updatedAt, @deletedAt, 1, @syncedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        kind                = excluded.kind,
        refId               = excluded.refId,
        refNo               = excluded.refNo,
        date                = excluded.date,
        amount              = excluded.amount,
        sign                = excluded.sign,
        notes               = excluded.notes,
        paymentStatus       = excluded.paymentStatus,
        paymentMode         = excluded.paymentMode,
        chequeNo            = excluded.chequeNo,
        chequeIssueDate     = excluded.chequeIssueDate,
        chequeClearanceDate = excluded.chequeClearanceDate,
        updatedAt           = excluded.updatedAt,
        deletedAt           = excluded.deletedAt,
        isSynced            = 1,
        syncedAt            = excluded.syncedAt
      WHERE excluded.updatedAt > supplier_transactions.updatedAt
         OR supplier_transactions.updatedAt IS NULL
    `);

    const upsertSettlement = db.prepare(`
      INSERT INTO supplier_bill_settlements (
        id, licenseId, supplierId, paymentTxId, purchaseId, amount, createdAt
      ) VALUES (
        @id, @licenseId, @supplierId, @paymentTxId, @purchaseId, @amount, @createdAt
      )
      ON CONFLICT(id) DO UPDATE SET
        amount = excluded.amount
    `);

    db.transaction((records) => {
      for (const r of records) {
        upsertTx.run({
          id: r.id,
          licenseId: r.licenseId,
          supplierId: r.supplierId,
          kind: r.kind,
          refId: r.refId ?? null,
          refNo: r.refNo ?? null,
          date: r.date instanceof Date ? r.date.toISOString() : r.date,
          amount: Number(r.amount || 0),
          sign: Number(r.sign || 0),
          notes: r.notes ?? null,
          paymentStatus: r.paymentStatus ?? null,
          paymentMode: r.paymentMode ?? null,
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

        // Upsert embedded settlements (only present on PAYMENT records)
        const settlements = Array.isArray(r.settlements) ? r.settlements : [];
        for (const s of settlements) {
          try {
            upsertSettlement.run({
              id: s.id,
              licenseId: s.licenseId || r.licenseId,
              supplierId: s.supplierId || r.supplierId,
              paymentTxId: r.id,
              purchaseId: s.purchaseId,
              amount: Number(s.amount || 0),
              createdAt: s.createdAt ?? now,
            });
          } catch (e) {
            // If the referenced purchase doesn't exist locally yet, skip gracefully
            console.warn(
              `[supplierLedgerSync] skipping settlement ${s.id}:`,
              e.message,
            );
          }
        }
      }
    })(records);

    return { success: true, upserted: records.length };
  });
}

module.exports = { registerSupplierLedgerSyncHandlers };
