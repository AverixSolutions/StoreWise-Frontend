// electron/ipc/SupplierSync.js (Fixed)
const { ipcMain } = require("electron");
const db = require("../db");

function registerSupplierSyncHandlers() {
  ipcMain.handle("get-dirty-suppliers", (event, licenseId, limit = 200) => {
    // console.log(
    //   `Getting dirty suppliers for license: ${licenseId}, limit: ${limit}`
    // );

    const result = db
      .prepare(
        `
        SELECT *
        FROM suppliers
        WHERE licenseId = ?
          AND (
            syncedAt IS NULL
            OR updatedAt > syncedAt
            OR (deletedAt IS NOT NULL AND (syncedAt IS NULL OR deletedAt > syncedAt))
          )
        ORDER BY updatedAt ASC, id ASC
        LIMIT ?
      `
      )
      .all(licenseId, limit);

    // console.log(`Found ${result.length} dirty suppliers`);
    return result;
  });

  ipcMain.handle("mark-suppliers-synced", (event, ids, serverSyncedAt) => {
    console.log(`Marking ${ids.length} suppliers as synced`);
    const ts = serverSyncedAt || new Date().toISOString();

    const trx = db.transaction((ids) => {
      const stmt = db.prepare(`
        UPDATE suppliers
        SET isSynced = 1,
            syncedAt = ?
        WHERE id = ?
      `);
      ids.forEach((id) => {
        const result = stmt.run(ts, id);
        console.log(`Updated supplier ${id}, changes: ${result.changes}`);
      });
    });

    trx(ids);
    console.log(`Successfully marked ${ids.length} suppliers as synced`);
    return { success: true, syncedAt: ts };
  });

  // Upsert-in-bulk from server
  ipcMain.handle("bulk-upsert-suppliers", (event, items = []) => {
    console.log(`Bulk upserting ${items.length} suppliers`);

    const trx = db.transaction((rows) => {
      const insertOrReplace = db.prepare(`
        INSERT INTO suppliers (
          id, licenseId, code, codeNumber, name, phone, email, gstin, department,
          addressLine1, addressLine2, city, state, pincode,
          category, native, language, aadhaar, pan, license1, license2,
          settlementDays, creditLimit, openingBalance, notes,
          createdAt, updatedAt, deletedAt, isSynced, syncedAt
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?, 1, COALESCE(?, datetime('now')))
        ON CONFLICT(id) DO UPDATE SET
          code=excluded.code,
          codeNumber=excluded.codeNumber,
          name=excluded.name,
          phone=excluded.phone,
          email=excluded.email,
          gstin=excluded.gstin,
          department=excluded.department,
          addressLine1=excluded.addressLine1,
          addressLine2=excluded.addressLine2,
          city=excluded.city,
          state=excluded.state,
          pincode=excluded.pincode,
          category=excluded.category,
          native=excluded.native,
          language=excluded.language,
          aadhaar=excluded.aadhaar,
          pan=excluded.pan,
          license1=excluded.license1,
          license2=excluded.license2,
          settlementDays=excluded.settlementDays,
          creditLimit=excluded.creditLimit,
          openingBalance=excluded.openingBalance,
          notes=excluded.notes,
          updatedAt=excluded.updatedAt,
          deletedAt=excluded.deletedAt,
          isSynced=1,
          syncedAt=excluded.syncedAt
      `);

      const upsertSeq = db.prepare(`
        INSERT INTO supplier_sequence (licenseId, lastCodeNumber)
        VALUES (?, ?)
        ON CONFLICT(licenseId) DO UPDATE SET
          lastCodeNumber = MAX(lastCodeNumber, excluded.lastCodeNumber)
      `);

      let processed = 0;
      for (const r of rows) {
        try {
          insertOrReplace.run(
            r.id,
            r.licenseId,
            r.code ?? null,
            r.codeNumber ?? null,
            r.name,
            r.phone ?? null,
            r.email ?? null,
            r.gstin ?? null,
            r.department ?? null,
            r.addressLine1 ?? null,
            r.addressLine2 ?? null,
            r.city ?? null,
            r.state ?? null,
            r.pincode ?? null,
            r.category ?? null,
            r.native ?? null,
            r.language ?? null,
            r.aadhaar ?? null,
            r.pan ?? null,
            r.license1 ?? null,
            r.license2 ?? null,
            r.settlementDays ?? null,
            r.creditLimit != null ? Number(r.creditLimit) : null,
            r.openingBalance != null ? Number(r.openingBalance) : 0,
            r.notes ?? null,
            r.createdAt,
            r.updatedAt,
            r.deletedAt ?? null,
            r.syncedAt
          );

          if (r.codeNumber != null) {
            upsertSeq.run(r.licenseId, r.codeNumber);
          }
          processed++;
        } catch (error) {
          console.error(`Error upserting supplier ${r.id}:`, error);
          throw error;
        }
      }
      console.log(`Successfully processed ${processed} suppliers`);
    });

    trx(items);
    return { success: true, count: items.length };
  });
}

module.exports = { registerSupplierSyncHandlers };
