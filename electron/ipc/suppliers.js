// electron/ipc/suppliers.js
const { v4: uuidv4 } = require("uuid");
const { ipcMain } = require("electron");
const db = require("../db");

function registerSupplierHandlers() {
  ipcMain.handle("supplier:get-next-code", (e, licenseId) => {
    const seq = db
      .prepare("SELECT lastCodeNumber FROM supplier_sequence WHERE licenseId=?")
      .get(licenseId);
    const nextNo = seq ? seq.lastCodeNumber + 1 : 1;
    return {
      codeNumber: nextNo,
      code: `SUP${String(nextNo).padStart(5, "0")}`,
    };
  });

  ipcMain.handle("supplier:create", (e, payload) => {
    const now = new Date().toISOString();
    const id = payload.id || uuidv4();

    let codeNumber = payload.codeNumber;
    let code = payload.code;

    if (!codeNumber || !code) {
      const seq = db
        .prepare(
          "SELECT lastCodeNumber FROM supplier_sequence WHERE licenseId=?"
        )
        .get(payload.licenseId);
      codeNumber = seq ? seq.lastCodeNumber + 1 : 1;
      code = `SUP${String(codeNumber).padStart(5, "0")}`;
    }

    db.prepare(
      `
    INSERT INTO supplier_sequence (licenseId, lastCodeNumber)
    VALUES (?, ?)
    ON CONFLICT(licenseId) DO UPDATE SET
      lastCodeNumber = CASE
        WHEN excluded.lastCodeNumber > supplier_sequence.lastCodeNumber
        THEN excluded.lastCodeNumber
        ELSE supplier_sequence.lastCodeNumber
      END
  `
    ).run(payload.licenseId, codeNumber);

    db.prepare(
      `
    INSERT INTO suppliers (
      id, licenseId, code, codeNumber, name, phone, email, gstin, department, addressLine1, addressLine2, city, state, pincode,
      category, native, language, aadhaar, pan, license1, license2,
      settlementDays, creditLimit, openingBalance, notes,
      createdAt, updatedAt, isSynced
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?, ?, 0)
  `
    ).run(
      id,
      payload.licenseId,
      code,
      codeNumber,
      payload.name,
      payload.phone || null,
      payload.email || null,
      payload.gstin || null,
      payload.department || null,
      payload.addressLine1 || null,
      payload.addressLine2 || null,
      payload.city || null,
      payload.state || null,
      payload.pincode || null,
      payload.category || null,
      payload.native || null,
      payload.language || null,
      payload.aadhaar || null,
      payload.pan || null,
      payload.license1 || null,
      payload.license2 || null,
      payload.settlementDays ?? null,
      payload.creditLimit != null ? Number(payload.creditLimit) : null,
      Number(payload.openingBalance || 0),
      payload.notes || null,
      now,
      now
    );

    if (Number(payload.openingBalance || 0) !== 0) {
      db.prepare(
        `
      INSERT INTO supplier_transactions
      (id, licenseId, supplierId, kind, refId, refNo, date, amount, sign, notes, createdAt, updatedAt, isSynced)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 0)
    `
      ).run(
        uuidv4(),
        payload.licenseId,
        id,
        "OPENING",
        null,
        null,
        now,
        Math.abs(Number(payload.openingBalance)),
        Number(payload.openingBalance) >= 0 ? 1 : -1,
        "Opening balance",
        now,
        now
      );
    }

    return { success: true, id, code, codeNumber };
  });

  ipcMain.handle("supplier:update", (e, id, changes) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE suppliers SET
      name=?, phone=?, email=?, gstin=?, department=?, addressLine1=?, addressLine2=?, city=?, state=?, pincode=?,
      category=?, native=?, language=?, aadhaar=?, pan=?, license1=?, license2=?,
      settlementDays=?, creditLimit=?, openingBalance=?, notes=?,
      updatedAt=?, isSynced=0, syncedAt=NULL
      WHERE id=?
    `);
    const info = stmt.run(
      changes.name,
      changes.phone || null,
      changes.email || null,
      changes.gstin || null,
      changes.department || null,
      changes.addressLine1 || null,
      changes.addressLine2 || null,
      changes.city || null,
      changes.state || null,
      changes.pincode || null,
      changes.category || null,
      changes.native || null,
      changes.language || null,
      changes.aadhaar || null,
      changes.pan || null,
      changes.license1 || null,
      changes.license2 || null,
      changes.settlementDays ?? null,
      changes.creditLimit != null ? Number(changes.creditLimit) : null,
      Number(changes.openingBalance ?? 0),
      changes.notes || null,
      now,
      id
    );
    if (!info.changes) throw new Error("Supplier not found");
    return { success: true };
  });

  ipcMain.handle("supplier:delete", (e, id) => {
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE suppliers SET deletedAt=?, updatedAt=?, isSynced=0, syncedAt=NULL WHERE id=?`
    ).run(now, now, id);
    return { success: true };
  });

  ipcMain.handle("supplier:get", (e, id) => {
    return (
      db
        .prepare(`SELECT * FROM suppliers WHERE id=? AND deletedAt IS NULL`)
        .get(id) || null
    );
  });

  ipcMain.handle("supplier:summary", (e, licenseId, supplierId) => {
    const s = db
      .prepare(`SELECT openingBalance FROM suppliers WHERE id=?`)
      .get(supplierId);
    const sum = db
      .prepare(
        `
    SELECT COALESCE(SUM(sign*amount),0) AS txSum
    FROM supplier_transactions
    WHERE licenseId=? AND supplierId=? AND deletedAt IS NULL
      AND kind IN ('OPENING','PURCHASE','PAYMENT','ADJUSTMENT')
  `
      )
      .get(licenseId, supplierId).txSum;

    const balance = Number(s?.openingBalance || 0) + Number(sum || 0); // >0 we owe them
    const purchased = db
      .prepare(
        `
      SELECT COALESCE(SUM(totalAmount),0) AS total
      FROM purchases WHERE licenseId=? AND supplierId=? AND deletedAt IS NULL
    `
      )
      .get(licenseId, supplierId).total;

    return { balance, purchased };
  });

  ipcMain.handle("supplier:count", (e, licenseId, { q = "" } = {}) => {
    const like = `%${q}%`;
    const row = db
      .prepare(
        `
      SELECT COUNT(*) AS cnt
      FROM suppliers
      WHERE licenseId=? AND deletedAt IS NULL
        AND (name LIKE ? OR phone LIKE ? OR gstin LIKE ?)
    `
      )
      .get(licenseId, like, like, like);
    return { count: row.cnt || 0 };
  });

  ipcMain.handle(
    "supplier:list",
    (
      e,
      licenseId,
      { q = "", name = "", category = "", page = 1, pageSize = 20 } = {}
    ) => {
      const offset = (page - 1) * pageSize;
      const like = `%${q}%`;

      let where = `licenseId=? AND deletedAt IS NULL`;
      const params = [licenseId];

      if (q) {
        where += ` AND (name LIKE ? OR phone LIKE ? OR gstin LIKE ?)`;
        params.push(like, like, like);
      }
      if (name) {
        where += ` AND name = ?`;
        params.push(name);
      }
      if (category) {
        where += ` AND COALESCE(category,'') = ?`;
        params.push(category);
      }

      const rows = db
        .prepare(
          `
        SELECT * FROM suppliers
        WHERE ${where}
        ORDER BY name ASC
        LIMIT ? OFFSET ?
      `
        )
        .all(...params, pageSize, offset);

      const total = db
        .prepare(
          `
        SELECT COUNT(*) as cnt FROM suppliers
        WHERE ${where}
      `
        )
        .get(...params).cnt;

      return { suppliers: rows, total };
    }
  );

  ipcMain.handle("supplier:distinct", (e, licenseId) => {
    const pick = (rows) => rows.map((r) => r.v).filter(Boolean);

    const names = pick(
      db
        .prepare(
          `
    SELECT DISTINCT name AS v
    FROM suppliers
    WHERE licenseId=? AND deletedAt IS NULL AND COALESCE(name,'') <> ''
    ORDER BY v
  `
        )
        .all(licenseId)
    );

    const categories = pick(
      db
        .prepare(
          `
    SELECT DISTINCT category AS v
    FROM suppliers
    WHERE licenseId=? AND deletedAt IS NULL AND COALESCE(category,'') <> ''
    ORDER BY v
  `
        )
        .all(licenseId)
    );

    const departments = pick(
      db
        .prepare(
          `
    SELECT DISTINCT department AS v
    FROM suppliers
    WHERE licenseId=? AND deletedAt IS NULL AND COALESCE(department,'') <> ''
    ORDER BY v
  `
        )
        .all(licenseId)
    );

    const cities = pick(
      db
        .prepare(
          `
    SELECT DISTINCT city AS v
    FROM suppliers
    WHERE licenseId=? AND deletedAt IS NULL AND COALESCE(city,'') <> ''
    ORDER BY v
  `
        )
        .all(licenseId)
    );

    const states = pick(
      db
        .prepare(
          `
    SELECT DISTINCT state AS v
    FROM suppliers
    WHERE licenseId=? AND deletedAt IS NULL AND COALESCE(state,'') <> ''
    ORDER BY v
  `
        )
        .all(licenseId)
    );

    const languages = pick(
      db
        .prepare(
          `
    SELECT DISTINCT language AS v
    FROM suppliers
    WHERE licenseId=? AND deletedAt IS NULL AND COALESCE(language,'') <> ''
    ORDER BY v
  `
        )
        .all(licenseId)
    );

    return { names, categories, departments, cities, states, languages };
  });
}

module.exports = { registerSupplierHandlers };
