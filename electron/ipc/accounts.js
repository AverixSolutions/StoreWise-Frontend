// electron/ipc/accounts.js
const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

function getIndiaFYStartISO(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0=Jan
  // If month < April (3), FY started previous calendar year
  const fyYear = m < 3 ? y - 1 : y;
  const dt = new Date(Date.UTC(fyYear, 3, 1, 0, 0, 0)); // Apr 1, 00:00:00Z
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
}

function seedDefaultGroupsOnce() {
  const hasAny = db.prepare(`SELECT 1 FROM account_groups LIMIT 1`).get();
  if (hasAny) return;

  const rows = [
    // Asset
    {
      id: "grp_cash_bank",
      name: "CASH AND BANK BALANCE",
      nature: "ASSET",
      code: "CB",
      section: "ASSET",
      sortOrder: 1,
      parentId: null,
      isSystem: 1,
    },
    {
      id: "grp_current_assets",
      name: "CURRENT ASSET",
      nature: "ASSET",
      code: "AA",
      section: "ASSET",
      sortOrder: 2,
      parentId: null,
      isSystem: 1,
    },
    {
      id: "grp_fixed_asset",
      name: "FIXED ASSET",
      nature: "ASSET",
      code: "FIX",
      section: "ASSET",
      sortOrder: 3,
      parentId: null,
      isSystem: 1,
    },

    // Liabilities
    {
      id: "grp_capital_fund",
      name: "CAPITAL FUND",
      nature: "LIABILITY",
      code: "CAPI",
      section: "LIABILITY",
      sortOrder: 4,
      parentId: null,
      isSystem: 1,
    },
    {
      id: "grp_current_liab",
      name: "CURRENT LIABILITIES",
      nature: "LIABILITY",
      code: "BB",
      section: "LIABILITY",
      sortOrder: 5,
      parentId: null,
      isSystem: 1,
    },
    {
      id: "grp_other_liab",
      name: "OTHER LIABILITIES",
      nature: "LIABILITY",
      code: "OT",
      section: "LIABILITY",
      sortOrder: 6,
      parentId: null,
      isSystem: 1,
    },

    // P&L / Trading
    {
      id: "grp_expenditure",
      name: "EXPENDITURE",
      nature: "EXPENSE",
      code: "EXE1",
      section: "PL",
      sortOrder: 7,
      parentId: null,
      isSystem: 1,
    },
    {
      id: "grp_income",
      name: "INCOME",
      nature: "INCOME",
      code: "INCOM",
      section: "PL",
      sortOrder: 8,
      parentId: null,
      isSystem: 1,
    },
    {
      id: "grp_stock",
      name: "STOCK",
      nature: "ASSET",
      code: "STOCK",
      section: "PL",
      sortOrder: 9,
      parentId: null,
      isSystem: 1,
    },

    {
      id: "grp_direct_exp",
      name: "DIRECT EXPENCE",
      nature: "EXPENSE",
      code: "DEXP",
      section: "TRADING",
      sortOrder: 10,
      parentId: null,
      isSystem: 1,
    },
    {
      id: "grp_direct_inc",
      name: "DIRECT INCOME",
      nature: "INCOME",
      code: "DINC",
      section: "TRADING",
      sortOrder: 11,
      parentId: null,
      isSystem: 1,
    },
    {
      id: "grp_trading",
      name: "TRADING",
      nature: "INCOME",
      code: "TRA",
      section: "TRADING",
      sortOrder: 12,
      parentId: null,
      isSystem: 1,
    },

    // operational sub-groups we'll likely use
    {
      id: "grp_duties",
      name: "GST / DUTIES & TAXES",
      nature: "LIABILITY",
      code: "TAX",
      section: "LIABILITY",
      sortOrder: 50,
      parentId: null,
      isSystem: 1,
    },
    {
      id: "grp_bank",
      name: "BANK ACCOUNTS",
      nature: "ASSET",
      code: "BANK",
      section: "ASSET",
      sortOrder: 13,
      parentId: "grp_cash_bank",
      isSystem: 1,
    },
    {
      id: "grp_cash",
      name: "CASH-IN-HAND",
      nature: "ASSET",
      code: "CASH",
      section: "ASSET",
      sortOrder: 14,
      parentId: "grp_cash_bank",
      isSystem: 1,
    },
    {
      id: "grp_debtors",
      name: "SUNDRY DEBTORS",
      nature: "ASSET",
      code: "DEBT",
      section: "ASSET",
      sortOrder: 15,
      parentId: "grp_current_assets",
      isSystem: 1,
    },
    {
      id: "grp_creditors",
      name: "SUNDRY CREDITORS",
      nature: "LIABILITY",
      code: "CRED",
      section: "LIABILITY",
      sortOrder: 16,
      parentId: "grp_current_liab",
      isSystem: 1,
    },
    {
      id: "grp_sales",
      name: "SALES ACCOUNTS",
      nature: "INCOME",
      code: "SALE",
      section: "PL",
      sortOrder: 20,
      parentId: "grp_income",
      isSystem: 1,
    },
    {
      id: "grp_purchase",
      name: "PURCHASE ACCOUNTS",
      nature: "EXPENSE",
      code: "PUR",
      section: "PL",
      sortOrder: 21,
      parentId: "grp_expenditure",
      isSystem: 1,
    },
  ];

  const ins = db.prepare(`
    INSERT OR IGNORE INTO account_groups
      (id,name,nature,isSystem,code,section,sortOrder,parentId)
    VALUES
      (@id,@name,@nature,@isSystem,@code,@section,@sortOrder,@parentId)
  `);
  const tx = db.transaction(() => rows.forEach((r) => ins.run(r)));
  tx();
}

// -------------------- IPC --------------------
function registerAccountHandlers() {
  seedDefaultGroupsOnce();

  // GROUPS
  ipcMain.handle("accountGroup:list", () => {
    const rows = db
      .prepare(
        `
      SELECT id, name, nature, parentId, code, section, sortOrder, isSystem
      FROM account_groups
      ORDER BY
        CASE section
          WHEN 'ASSET' THEN 1
          WHEN 'LIABILITY' THEN 2
          WHEN 'PL' THEN 3
          WHEN 'TRADING' THEN 4
          ELSE 5
        END,
        COALESCE(sortOrder, 9999),
        name
    `
      )
      .all();
    return { success: true, rows };
  });

  ipcMain.handle("accountGroup:save", (e, payload) => {
    // create or update (only non-system or safe updates)
    const now = new Date().toISOString();
    const existing = payload.id
      ? db.prepare(`SELECT * FROM account_groups WHERE id=?`).get(payload.id)
      : null;

    if (
      existing?.isSystem &&
      (payload.parentId || payload.nature || payload.section)
    ) {
      return {
        success: false,
        error: "System group cannot change hierarchy/nature.",
      };
    }

    if (!payload.id) {
      const id = `grp_${uuidv4()}`;
      db.prepare(
        `
        INSERT INTO account_groups (id,name,parentId,nature,isSystem,code,section,sortOrder)
        VALUES (?,?,?,?,0,?,?,?)
      `
      ).run(
        id,
        payload.name,
        payload.parentId || null,
        payload.nature,
        payload.code || null,
        payload.section || null,
        payload.sortOrder || null
      );
      return { success: true, id };
    } else {
      db.prepare(
        `
        UPDATE account_groups
        SET name=@name,
            parentId=@parentId,
            nature=@nature,
            code=@code,
            section=@section,
            sortOrder=@sortOrder
        WHERE id=@id
      `
      ).run({
        id: payload.id,
        name: payload.name,
        parentId: payload.parentId || null,
        nature: payload.nature,
        code: payload.code || null,
        section: payload.section || null,
        sortOrder: payload.sortOrder || null,
      });
      return { success: true, id: payload.id, updatedAt: now };
    }
  });

  ipcMain.handle("accountGroup:delete", (e, id) => {
    const g = db
      .prepare(`SELECT isSystem FROM account_groups WHERE id=?`)
      .get(id);
    if (!g) return { success: false, error: "Not found" };
    if (g.isSystem)
      return { success: false, error: "Cannot delete system group" };

    const child = db
      .prepare(`SELECT 1 FROM account_groups WHERE parentId=? LIMIT 1`)
      .get(id);
    if (child) return { success: false, error: "Group has child groups" };

    const used = db
      .prepare(`SELECT 1 FROM accounts WHERE groupId=? LIMIT 1`)
      .get(id);
    if (used) return { success: false, error: "Group has accounts" };

    db.prepare(`DELETE FROM account_groups WHERE id=?`).run(id);
    return { success: true };
  });

  // ACCOUNTS
  ipcMain.handle(
    "account:list",
    (
      e,
      {
        licenseId,
        groupId = null,
        q = "",
        page = 1,
        pageSize = 50,
        fyStart,
      } = {}
    ) => {
      if (!licenseId) return { success: false, error: "licenseId required" };
      const _fyStart = fyStart || getIndiaFYStartISO();

      const where = ["a.licenseId=@licenseId", "COALESCE(a.deletedAt,'')=''"];
      const params = {
        licenseId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        fyStart: _fyStart,
      };

      if (groupId) {
        where.push("a.groupId=@groupId");
        params.groupId = groupId;
      }
      if (q) {
        where.push("(a.name LIKE @q OR COALESCE(a.code,'') LIKE @q)");
        params.q = `%${q}%`;
      }

      const base = `
      FROM accounts a
      LEFT JOIN account_groups g ON g.id=a.groupId
      LEFT JOIN account_opening_balances ob
        ON ob.accountId = a.id AND ob.fyStart = @fyStart
      WHERE ${where.join(" AND ")}
    `;

      const total = db
        .prepare(`SELECT COUNT(*) AS cnt ${base}`)
        .get(params).cnt;

      const rows = db
        .prepare(
          `
      SELECT a.id, a.name, a.code, a.groupId, g.name AS groupName, a.isSystem,
             a.taxType, a.gstComponent, a.rate, a.createdAt, a.updatedAt,
             ob.amount AS openingAmount, ob.side AS openingSide, ob.asOfDate AS openingAsOfDate,
             ob.fyStart AS openingFyStart
      ${base}
      ORDER BY a.createdAt DESC, a.name
      LIMIT @limit OFFSET @offset
    `
        )
        .all(params);

      return { success: true, total, page, pageSize, fyStart: _fyStart, rows };
    }
  );

  ipcMain.handle("account:get", (e, id) => {
    const row = db.prepare(`SELECT * FROM accounts WHERE id=?`).get(id);
    return row
      ? { success: true, account: row }
      : { success: false, error: "Not found" };
  });

  ipcMain.handle("account:save", (e, payload) => {
    const now = new Date().toISOString();
    const isUpdate = !!payload.id;

    if (!payload.licenseId || !payload.name || !payload.groupId) {
      return { success: false, error: "licenseId, name, groupId required" };
    }

    // sanitize opening payload (optional)
    const opening =
      payload.opening && typeof payload.opening === "object"
        ? {
            amount: Number(payload.opening.amount ?? 0),
            side: payload.opening.side === "CR" ? "CR" : "DR", // default DR
            asOfDate: payload.opening.asOfDate || now.slice(0, 10),
            fyStart: payload.opening.fyStart || getIndiaFYStartISO(),
          }
        : null;

    if (!isUpdate) {
      const id = payload.id || uuidv4();
      db.prepare(
        `
        INSERT INTO accounts (id,licenseId,name,code,groupId,isSystem,taxType,gstComponent,rate,createdAt,updatedAt,deletedAt)
        VALUES (?,?,?,?,?,0,?,?,?, ?, ?, NULL)
      `
      ).run(
        id,
        payload.licenseId,
        payload.name,
        payload.code || null,
        payload.groupId,
        payload.taxType || null,
        payload.gstComponent || null,
        payload.rate != null ? Number(payload.rate) : null,
        now,
        now
      );

      // Opening balance upsert (new account)
      if (opening && !isNaN(opening.amount)) {
        const exists = db
          .prepare(
            `SELECT id FROM account_opening_balances WHERE accountId=? AND fyStart=?`
          )
          .get(id, opening.fyStart);
        if (exists) {
          db.prepare(
            `
          UPDATE account_opening_balances
          SET amount=@amount, side=@side, asOfDate=@asOfDate, updatedAt=@now
          WHERE id=@id
        `
          ).run({
            id: exists.id,
            amount: opening.amount,
            side: opening.side,
            asOfDate: opening.asOfDate,
            now,
          });
        } else {
          db.prepare(
            `
          INSERT INTO account_opening_balances
            (id, accountId, fyStart, amount, side, asOfDate, createdAt, updatedAt)
          VALUES
            (@id, @accountId, @fyStart, @amount, @side, @asOfDate, @now, @now)
        `
          ).run({
            id: uuidv4(),
            accountId: id,
            fyStart: opening.fyStart,
            amount: opening.amount,
            side: opening.side,
            asOfDate: opening.asOfDate,
            now,
          });
        }
      }

      return { success: true, id };
    } else {
      const row = db
        .prepare(`SELECT isSystem FROM accounts WHERE id=?`)
        .get(payload.id);
      if (!row) return { success: false, error: "Not found" };

      db.prepare(
        `
        UPDATE accounts
        SET name=@name,
            code=@code,
            groupId=@groupId,
            taxType=@taxType,
            gstComponent=@gstComponent,
            rate=@rate,
            updatedAt=@now
        WHERE id=@id
      `
      ).run({
        id: payload.id,
        name: payload.name,
        code: payload.code || null,
        groupId: payload.groupId,
        taxType: payload.taxType || null,
        gstComponent: payload.gstComponent || null,
        rate: payload.rate != null ? Number(payload.rate) : null,
        now,
      });

      // Opening balance upsert (update)
      if (opening && !isNaN(opening.amount)) {
        const exists = db
          .prepare(
            `SELECT id FROM account_opening_balances WHERE accountId=? AND fyStart=?`
          )
          .get(payload.id, opening.fyStart);
        if (exists) {
          db.prepare(
            `
          UPDATE account_opening_balances
          SET amount=@amount, side=@side, asOfDate=@asOfDate, updatedAt=@now
          WHERE id=@id
        `
          ).run({
            id: exists.id,
            amount: opening.amount,
            side: opening.side,
            asOfDate: opening.asOfDate,
            now,
          });
        } else {
          db.prepare(
            `
          INSERT INTO account_opening_balances
            (id, accountId, fyStart, amount, side, asOfDate, createdAt, updatedAt)
          VALUES
            (@id, @accountId, @fyStart, @amount, @side, @asOfDate, @now, @now)
        `
          ).run({
            id: uuidv4(),
            accountId: payload.id,
            fyStart: opening.fyStart,
            amount: opening.amount,
            side: opening.side,
            asOfDate: opening.asOfDate,
            now,
          });
        }
      }

      return { success: true, id: payload.id };
    }
  });

  ipcMain.handle("account:delete", (e, id) => {
    const row = db.prepare(`SELECT isSystem FROM accounts WHERE id=?`).get(id);
    if (!row) return { success: false, error: "Not found" };
    if (row.isSystem)
      return { success: false, error: "Cannot delete system account" };

    db.prepare(`UPDATE accounts SET deletedAt=?, updatedAt=? WHERE id=?`).run(
      new Date().toISOString(),
      new Date().toISOString(),
      id
    );
    return { success: true };
  });

  ipcMain.handle("account:count", (e, licenseId) => {
    const r = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM accounts WHERE licenseId=? AND COALESCE(deletedAt,'')=''`
      )
      .get(licenseId);
    return { success: true, count: r.cnt || 0 };
  });
}

module.exports = { registerAccountHandlers };
