// electron/ipc/customers.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

function getNextCustomerCodeNo(licenseId) {
  const seq = db
    .prepare(`SELECT lastCodeNumber FROM customer_sequence WHERE licenseId=?`)
    .get(licenseId);
  const next = seq ? seq.lastCodeNumber + 1 : 1;
  db.prepare(
    `
    INSERT INTO customer_sequence(licenseId, lastCodeNumber)
    VALUES(?,?)
    ON CONFLICT(licenseId) DO UPDATE SET lastCodeNumber = excluded.lastCodeNumber
  `,
  ).run(licenseId, next);
  return next;
}

function registerCustomerHandlers() {
  // list/search with name and category filters
  ipcMain.handle(
    "customer:list",
    (
      evt,
      licenseId,
      { q = "", name = "", category = "", page = 1, pageSize = 50 } = {},
    ) => {
      const offset = (page - 1) * pageSize;

      let where = `licenseId=@licenseId AND COALESCE(deletedAt,'')=''`;
      const params = {
        licenseId,
        q: `%${q}%`,
        name,
        category,
        limit: pageSize,
        offset,
      };

      if (q) {
        where += ` AND (name LIKE @q OR COALESCE(phone,'') LIKE @q OR COALESCE(code,'') LIKE @q)`;
      }
      if (name) {
        where += ` AND name = @name`;
      }
      if (category) {
        where += ` AND COALESCE(category,'') = @category`;
      }

      const rows = db
        .prepare(
          `
      SELECT id, code, codeNumber, name, phone, email, gstin, category,
             city, state, openingBalance, createdAt, updatedAt
      FROM customers
      WHERE ${where}
      ORDER BY name COLLATE NOCASE
      LIMIT @limit OFFSET @offset
    `,
        )
        .all(params);

      const total = db
        .prepare(
          `
      SELECT COUNT(*) as count
      FROM customers
      WHERE ${where}
    `,
        )
        .get(params).count;

      return { success: true, customers: rows, total, page, pageSize };
    },
  );

  ipcMain.handle("customer:get", (evt, id) => {
    const c = db.prepare(`SELECT * FROM customers WHERE id=?`).get(id);
    if (!c) return { success: false, error: "NOT_FOUND" };
    return { success: true, customer: c };
  });

  // create/update
  ipcMain.handle("customer:save", (evt, payload) => {
    const now = new Date().toISOString();

    const trx = db.transaction((payload) => {
      const openingBalance = Number(payload.openingBalance || 0);

      if (payload.id) {
        db.prepare(
          `
        UPDATE customers SET
          name=@name,
          phone=@phone,
          email=@email,
          gstin=@gstin,
          category=@category,
          addressLine1=@addressLine1,
          addressLine2=@addressLine2,
          city=@city,
          state=@state,
          pincode=@pincode,
          openingBalance=@openingBalance,
          notes=@notes,
          updatedAt=@now,
          isSynced=0
        WHERE id=@id AND licenseId=@licenseId
      `,
        ).run({
          ...payload,
          openingBalance,
          now,
        });

        db.prepare(
          `
        DELETE FROM customer_transactions
        WHERE customerId=@customerId
          AND licenseId=@licenseId
          AND kind='OPENING'
      `,
        ).run({
          customerId: payload.id,
          licenseId: payload.licenseId,
        });

        if (openingBalance !== 0) {
          db.prepare(
            `
          INSERT INTO customer_transactions
          (id, licenseId, customerId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
          VALUES(?, ?, ?, 'OPENING', ?, ?, ?, ?, ?, 'Opening Balance', ?, ?, 0)
        `,
          ).run(
            uuidv4(),
            payload.licenseId,
            payload.id,
            null,
            null,
            now,
            Math.abs(openingBalance),
            openingBalance >= 0 ? 1 : -1,
            now,
            now,
          );
        }

        return { success: true, id: payload.id };
      }

      const id = uuidv4();
      const codeNumber = getNextCustomerCodeNo(payload.licenseId);
      const code = payload.code || `C${String(codeNumber).padStart(5, "0")}`;

      db.prepare(
        `
      INSERT INTO customers(
        id, licenseId, code, codeNumber, name, phone, email, gstin, category,
        addressLine1, addressLine2, city, state, pincode, openingBalance, notes, createdAt, updatedAt, isSynced
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
    `,
      ).run(
        id,
        payload.licenseId,
        code,
        codeNumber,
        payload.name,
        payload.phone || null,
        payload.email || null,
        payload.gstin || null,
        payload.category || null,
        payload.addressLine1 || null,
        payload.addressLine2 || null,
        payload.city || null,
        payload.state || null,
        payload.pincode || null,
        openingBalance,
        payload.notes || null,
        now,
        now,
      );

      if (openingBalance !== 0) {
        db.prepare(
          `
        INSERT INTO customer_transactions
        (id, licenseId, customerId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
        VALUES(?, ?, ?, 'OPENING', ?, ?, ?, ?, ?, 'Opening Balance', ?, ?, 0)
      `,
        ).run(
          uuidv4(),
          payload.licenseId,
          id,
          null,
          null,
          now,
          Math.abs(openingBalance),
          openingBalance >= 0 ? 1 : -1,
          now,
          now,
        );
      }

      return { success: true, id, code, codeNumber };
    });

    return trx(payload);
  });

  ipcMain.handle("customer:delete", (evt, id, licenseId) => {
    const now = new Date().toISOString();
    db.prepare(
      `
    UPDATE customers
    SET deletedAt=?, isSynced=0, updatedAt=?
    WHERE id=? AND licenseId=?
  `,
    ).run(now, now, id, licenseId);
    return { success: true, deletedAt: now };
  });

  ipcMain.handle("customer:peek-next-code", (evt, licenseId) => {
    const seq = db
      .prepare(`SELECT lastCodeNumber FROM customer_sequence WHERE licenseId=?`)
      .get(licenseId);
    const nextCodeNumber = seq ? seq.lastCodeNumber + 1 : 1;
    return {
      nextCodeNumber,
      suggestedCode: `C${String(nextCodeNumber).padStart(5, "0")}`,
    };
  });

  // COUNT (for dashboard tiles etc.)
  ipcMain.handle("customer:count", (evt, licenseId, { q = "" } = {}) => {
    const like = `%${q}%`;
    const row = db
      .prepare(
        `
      SELECT COUNT(*) AS cnt
      FROM customers
      WHERE licenseId=? AND COALESCE(deletedAt,'')=''
        AND (name LIKE ? OR COALESCE(phone,'') LIKE ? OR COALESCE(code,'') LIKE ?)
    `,
      )
      .get(licenseId, like, like, like);
    return { count: row?.cnt || 0 };
  });

  // DISTINCTS (for dropdowns in forms/filters)
  ipcMain.handle("customer:distinct", (evt, licenseId) => {
    const pick = (rows) => rows.map((r) => r.v).filter(Boolean);

    const names = pick(
      db
        .prepare(
          `
        SELECT DISTINCT name AS v
        FROM customers
        WHERE licenseId=? AND COALESCE(deletedAt,'')='' AND COALESCE(name,'')<>''
        ORDER BY v COLLATE NOCASE
      `,
        )
        .all(licenseId),
    );

    const categories = pick(
      db
        .prepare(
          `
        SELECT DISTINCT category AS v
        FROM customers
        WHERE licenseId=? AND COALESCE(deletedAt,'')='' AND COALESCE(category,'')<>''
        ORDER BY v COLLATE NOCASE
      `,
        )
        .all(licenseId),
    );

    const cities = pick(
      db
        .prepare(
          `
        SELECT DISTINCT city AS v
        FROM customers
        WHERE licenseId=? AND COALESCE(deletedAt,'')='' AND COALESCE(city,'')<>''
        ORDER BY v COLLATE NOCASE
      `,
        )
        .all(licenseId),
    );

    const states = pick(
      db
        .prepare(
          `
        SELECT DISTINCT state AS v
        FROM customers
        WHERE licenseId=? AND COALESCE(deletedAt,'')='' AND COALESCE(state,'')<>''
        ORDER BY v COLLATE NOCASE
      `,
        )
        .all(licenseId),
    );

    return { names, categories, cities, states };
  });

  // ── Sync: dirty fetch ────────────────────────────────────────────────────
  ipcMain.handle("customer:get-dirty", (evt, licenseId, limit = 200) => {
    const rows = db
      .prepare(
        `
      SELECT id, licenseId, code, codeNumber, name, phone, email, gstin,
             category, addressLine1, addressLine2, city, state, pincode,
             openingBalance, notes, createdAt, updatedAt, deletedAt, isSynced
      FROM customers
      WHERE licenseId = ?
        AND (isSynced = 0 OR isSynced IS NULL)
      ORDER BY updatedAt ASC
      LIMIT ?
    `,
      )
      .all(licenseId, limit);
    return { success: true, records: rows };
  });

  // ── Sync: mark synced ────────────────────────────────────────────────────
  ipcMain.handle("customer:mark-synced", (evt, ids, serverSyncedAt) => {
    if (!Array.isArray(ids) || ids.length === 0) return { success: true };
    const ts = serverSyncedAt || new Date().toISOString();
    db.transaction((ids) => {
      const stmt = db.prepare(
        `UPDATE customers SET isSynced = 1, syncedAt = ? WHERE id = ?`,
      );
      ids.forEach((id) => stmt.run(ts, id));
    })(ids);
    return { success: true, syncedAt: ts };
  });

  // ── Sync: bulk upsert from server ────────────────────────────────────────
  ipcMain.handle("customer:bulk-upsert", (evt, records) => {
    if (!Array.isArray(records) || records.length === 0)
      return { success: true, upserted: 0 };

    const now = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT INTO customers (
        id, licenseId, code, codeNumber, name, phone, email, gstin,
        category, addressLine1, addressLine2, city, state, pincode,
        openingBalance, notes, createdAt, updatedAt, deletedAt, isSynced, syncedAt
      ) VALUES (
        @id, @licenseId, @code, @codeNumber, @name, @phone, @email, @gstin,
        @category, @addressLine1, @addressLine2, @city, @state, @pincode,
        @openingBalance, @notes, @createdAt, @updatedAt, @deletedAt, 1, @syncedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        code          = excluded.code,
        codeNumber    = excluded.codeNumber,
        name          = excluded.name,
        phone         = excluded.phone,
        email         = excluded.email,
        gstin         = excluded.gstin,
        category      = excluded.category,
        addressLine1  = excluded.addressLine1,
        addressLine2  = excluded.addressLine2,
        city          = excluded.city,
        state         = excluded.state,
        pincode       = excluded.pincode,
        openingBalance= excluded.openingBalance,
        notes         = excluded.notes,
        updatedAt     = excluded.updatedAt,
        deletedAt     = excluded.deletedAt,
        isSynced      = 1,
        syncedAt      = excluded.syncedAt
      WHERE excluded.updatedAt > customers.updatedAt
         OR customers.updatedAt IS NULL
    `);

    db.transaction((records) => {
      for (const r of records) {
        upsert.run({
          id: r.id,
          licenseId: r.licenseId,
          code: r.code ?? null,
          codeNumber: r.codeNumber ?? null,
          name: r.name,
          phone: r.phone ?? null,
          email: r.email ?? null,
          gstin: r.gstin ?? null,
          category: r.category ?? null,
          addressLine1: r.addressLine1 ?? null,
          addressLine2: r.addressLine2 ?? null,
          city: r.city ?? null,
          state: r.state ?? null,
          pincode: r.pincode ?? null,
          openingBalance: Number(r.openingBalance ?? 0),
          notes: r.notes ?? null,
          createdAt: r.createdAt ?? now,
          updatedAt: r.updatedAt ?? now,
          deletedAt: r.deletedAt ?? null,
          syncedAt: r.syncedAt ?? now,
        });
      }
    })(records);

    // Keep sequence in sync
    const maxRow = db
      .prepare(
        `SELECT MAX(codeNumber) AS maxNo FROM customers WHERE licenseId = ?`,
      )
      .get(records[0]?.licenseId);
    if (maxRow?.maxNo) {
      db.prepare(
        `INSERT INTO customer_sequence (licenseId, lastCodeNumber)
         VALUES (?, ?)
         ON CONFLICT(licenseId) DO UPDATE SET
           lastCodeNumber = MAX(excluded.lastCodeNumber, customer_sequence.lastCodeNumber)`,
      ).run(records[0].licenseId, maxRow.maxNo);
    }

    return { success: true, upserted: records.length };
  });
}

module.exports = { registerCustomerHandlers };
