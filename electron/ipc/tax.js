// electron/ipc/tax.js
const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function ensureGroup(db, { code, name, nature, section }) {
  const row = db
    .prepare(`SELECT id FROM account_groups WHERE code=?`)
    .get(code);
  if (row?.id) return row.id;
  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO account_groups(id, name, code, nature, section, isSystem, sortOrder)
    VALUES(?,?,?,?,?,1,0)
  `
  ).run(id, name, code, nature, section);
  return id;
}

function ensureAccount(
  db,
  {
    id,
    licenseId,
    name,
    code,
    groupId,
    taxType = null,
    gstComponent = null,
    rate = null,
    isSystem = 1,
  }
) {
  const existing = db
    .prepare(
      `SELECT id FROM accounts WHERE licenseId=? AND name=? AND COALESCE(deletedAt,'')=''`
    )
    .get(licenseId, name);
  if (existing) return existing.id;
  const now = new Date().toISOString();
  const accId = id || uuidv4();
  db.prepare(
    `
    INSERT INTO accounts
      (id, licenseId, name, code, groupId, isSystem, taxType, gstComponent, rate, createdAt, updatedAt, deletedAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `
  ).run(
    accId,
    licenseId,
    name,
    code || null,
    groupId,
    isSystem ? 1 : 0,
    taxType,
    gstComponent,
    rate,
    now,
    now
  );
  return accId;
}

function getGroupIdByCode(db, code) {
  const g = db.prepare(`SELECT id FROM account_groups WHERE code=?`).get(code);
  return g?.id || null;
}

function seedIndiaGSTBasics(licenseId) {
  // groups we'll use (created in your account seed):
  const grpSales = ensureGroup(db, {
    code: "SALE",
    name: "Sales Accounts",
    nature: "INCOME",
    section: "PL",
  });
  const grpPurchase = ensureGroup(db, {
    code: "PUR",
    name: "Purchase Accounts",
    nature: "EXPENSE",
    section: "PL",
  });
  const grpTax = ensureGroup(db, {
    code: "TAX",
    name: "Duties & Taxes",
    nature: "LIABILITY",
    section: "LIABILITY",
  });

  const mkTax = (name, code, comp, rate) => ({
    output: { name: `OUTPUT ${name}`, code: `OUT-${code}`, comp, rate },
    input: { name: `INPUT ${name}`, code: `IN-${code}`, comp, rate },
  });

  const slab = (pct) => {
    // intra: CGST+SGST
    const half = pct / 2;
    const intra = [
      mkTax(`CGST ${half}%`, `CGST-${half}`, "CGST", half),
      mkTax(`SGST ${half}%`, `SGST-${half}`, "SGST", half),
    ];
    // inter: IGST
    const inter = [mkTax(`IGST ${pct}%`, `IGST-${pct}`, "IGST", pct)];
    return { intra, inter };
  };

  const slabs = [5, 12, 18, 28];
  const accounts = {
    // we'll collect ids here
    sales: {},
    purchases: {},
    tax: { output: {}, input: {} },
  };

  // Create sales/purchase heads per slab + NT
  // Names & codes stay simple and human friendly
  const mkSP = (pct) => {
    const sName = pct === 0 ? "SALES (NT)" : `SALES ${pct}%`;
    const pName = pct === 0 ? "PURCHASE (NT)" : `PURCHASE ${pct}%`;
    const sCode = pct === 0 ? "S-NT" : `S-${pct}`;
    const pCode = pct === 0 ? "P-NT" : `P-${pct}`;
    accounts.sales[pct] = ensureAccount(db, {
      licenseId,
      name: sName,
      code: sCode,
      groupId: grpSales,
      isSystem: 1,
    });
    accounts.purchases[pct] = ensureAccount(db, {
      licenseId,
      name: pName,
      code: pCode,
      groupId: grpPurchase,
      isSystem: 1,
    });
  };

  mkSP(0);
  slabs.forEach(mkSP);

  // Create tax ledgers
  for (const pct of slabs) {
    const { intra, inter } = slab(pct);
    for (const item of [...intra, ...inter]) {
      for (const kind of ["output", "input"]) {
        const def = item[kind];
        const id = ensureAccount(db, {
          licenseId,
          name: def.name,
          code: def.code,
          groupId: grpTax,
          isSystem: 1,
          taxType: kind === "output" ? "OUTPUT" : "INPUT",
          gstComponent: def.comp, // CGST/SGST/IGST
          rate: def.rate,
        });
        accounts.tax[kind][`${def.comp}-${def.rate}`] = id;
      }
    }
  }

  // Helper: upsert a tax category with components & defaults
  const upsertTaxCategory = (
    code,
    { name, rate, isInterstate, components, defaults }
  ) => {
    const now = new Date().toISOString();
    const row = db
      .prepare(`SELECT id FROM tax_categories WHERE licenseId=? AND code=?`)
      .get(licenseId, code);
    const id = row?.id || uuidv4();

    if (!row) {
      db.prepare(
        `
        INSERT INTO tax_categories(id,licenseId,code,name,rate,isInterstate,cessRate,calcMethod,createdAt,updatedAt)
        VALUES(?,?,?,?,?,?,NULL,'FIXED',?,?)
      `
      ).run(id, licenseId, code, name, rate, isInterstate ? 1 : 0, now, now);
    } else {
      db.prepare(
        `
        UPDATE tax_categories
        SET name=@name, rate=@rate, isInterstate=@isInterstate, cessRate=NULL, calcMethod='FIXED', updatedAt=@now
        WHERE id=@id
      `
      ).run({ id, name, rate, isInterstate: isInterstate ? 1 : 0, now });
      db.prepare(`DELETE FROM tax_category_components WHERE categoryId=?`).run(
        id
      );
      db.prepare(`DELETE FROM tax_category_defaults WHERE categoryId=?`).run(
        id
      );
    }

    const insComp = db.prepare(`
      INSERT INTO tax_category_components(id,categoryId,component,rate,createdAt,updatedAt)
      VALUES(?,?,?,?,?,?)
    `);
    const tNow = new Date().toISOString();
    for (const c of components) {
      insComp.run(uuidv4(), id, c.component, Number(c.rate || 0), tNow, tNow);
    }

    if (defaults) {
      db.prepare(
        `
        INSERT INTO tax_category_defaults(
          id, categoryId,
          salesAccountId, purchaseAccountId, salesReturnAccountId, purchaseReturnAccountId,
          outputCgstAccountId, outputSgstAccountId, outputIgstAccountId,
          inputCgstAccountId,  inputSgstAccountId,  inputIgstAccountId,
          cessAccountId, singleTaxAccountId, createdAt, updatedAt
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `
      ).run(
        uuidv4(),
        id,
        defaults.salesAccountId || null,
        defaults.purchaseAccountId || null,
        defaults.salesReturnAccountId || null,
        defaults.purchaseReturnAccountId || null,
        defaults.outputCgstAccountId || null,
        defaults.outputSgstAccountId || null,
        defaults.outputIgstAccountId || null,
        defaults.inputCgstAccountId || null,
        defaults.inputSgstAccountId || null,
        defaults.inputIgstAccountId || null,
        defaults.cessAccountId || null,
        defaults.singleTaxAccountId || null,
        tNow,
        tNow
      );
    }

    return id;
  };

  // NT (No tax)
  upsertTaxCategory("NT", {
    name: "No Tax",
    rate: 0,
    isInterstate: 0,
    components: [],
    defaults: {
      salesAccountId: accounts.sales[0],
      purchaseAccountId: accounts.purchases[0],
      salesReturnAccountId: accounts.sales[0],
      purchaseReturnAccountId: accounts.purchases[0],
    },
  });

  // For each slab, create P5 / P12 / ... (intra) and P5-I / ... (inter)
  for (const pct of slabs) {
    const half = pct / 2;

    // INTRA (CGST+SGST) — code e.g. "P5"
    upsertTaxCategory(`P${pct}`, {
      name: `${pct}% (Intra)`,
      rate: pct,
      isInterstate: 0,
      components: [
        { component: "CGST", rate: half },
        { component: "SGST", rate: half },
      ],
      defaults: {
        salesAccountId: accounts.sales[pct],
        purchaseAccountId: accounts.purchases[pct],
        salesReturnAccountId: accounts.sales[pct],
        purchaseReturnAccountId: accounts.purchases[pct],
        outputCgstAccountId: accounts.tax.output[`CGST-${half}`],
        outputSgstAccountId: accounts.tax.output[`SGST-${half}`],
        inputCgstAccountId: accounts.tax.input[`CGST-${half}`],
        inputSgstAccountId: accounts.tax.input[`SGST-${half}`],
      },
    });

    // INTER (IGST) — code e.g. "P5-I"
    upsertTaxCategory(`P${pct}-I`, {
      name: `${pct}% (Inter)`,
      rate: pct,
      isInterstate: 1,
      components: [{ component: "IGST", rate: pct }],
      defaults: {
        salesAccountId: accounts.sales[pct],
        purchaseAccountId: accounts.purchases[pct],
        salesReturnAccountId: accounts.sales[pct],
        purchaseReturnAccountId: accounts.purchases[pct],
        outputIgstAccountId: accounts.tax.output[`IGST-${pct}`],
        inputIgstAccountId: accounts.tax.input[`IGST-${pct}`],
      },
    });
  }

  return true;
}

function ensureTaxSeeded(licenseId) {
  const existing = db
    .prepare(`SELECT COUNT(1) AS c FROM tax_categories WHERE licenseId=?`)
    .get(licenseId);
  if (!existing?.c) {
    seedIndiaGSTBasics(licenseId);
    // Backfill returns (no-op for fresh seeds)
    db.prepare(
      `
      UPDATE tax_category_defaults
      SET salesReturnAccountId    = COALESCE(salesReturnAccountId,    salesAccountId),
          purchaseReturnAccountId = COALESCE(purchaseReturnAccountId, purchaseAccountId)
    `
    ).run();
  }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

function registerTaxHandlers() {
  ipcMain.handle("tax:listCategories", (e, licenseId) => {
    ensureTaxSeeded(licenseId);
    const cats = db
      .prepare(
        `
      SELECT * FROM tax_categories WHERE licenseId=? ORDER BY rate, code
    `
      )
      .all(licenseId);

    const compsStmt = db.prepare(`
      SELECT * FROM tax_category_components WHERE categoryId=?
    `);
    const defStmt = db.prepare(`
      SELECT * FROM tax_category_defaults WHERE categoryId=?
    `);

    const result = cats.map((c) => ({
      ...c,
      components: compsStmt.all(c.id),
      defaults: defStmt.get(c.id) || null,
    }));
    return { success: true, rows: result };
  });

  ipcMain.handle("tax:saveCategory", (e, payload) => {
    const total = Number(payload.rate || 0);
    const sum = (payload.components || []).reduce(
      (a, c) => a + Number(c.rate || 0),
      0
    );
    const interstate = !!payload.isInterstate;

    // Epsilon for float sum equality
    const epsilon = 1e-6;
    if (Math.abs(total - sum) > epsilon && !(total === 0 && sum === 0)) {
      return {
        success: false,
        error: "Component rates must sum to total rate.",
      };
    }

    if (interstate && total > 0) {
      // IGST only for interstate non-zero slabs
      const bad = (payload.components || []).some(
        (c) => c.component !== "IGST"
      );
      if (bad)
        return {
          success: false,
          error: "Interstate slab should use IGST only.",
        };
    } else {
      if (total > 0) {
        const comps = (payload.components || [])
          .map((c) => c.component)
          .sort()
          .join(",");
        const allowed = ["CGST,SGST", "CGST,SGST,CESS", "CGST,CESS,SGST"]; // lenient
      }
    }

    const now = new Date().toISOString();
    const id = payload.id || uuidv4();

    const tx = db.transaction(() => {
      if (!payload.id) {
        db.prepare(
          `
          INSERT INTO tax_categories(id,licenseId,code,name,rate,isInterstate,cessRate,calcMethod,createdAt,updatedAt)
          VALUES(?,?,?,?,?,?,?,COALESCE(?, 'FIXED'),?,?)
        `
        ).run(
          id,
          payload.licenseId,
          payload.code,
          payload.name,
          payload.rate,
          payload.isInterstate ? 1 : 0,
          payload.cessRate ?? null,
          payload.calcMethod ?? "FIXED",
          now,
          now
        );
      } else {
        db.prepare(
          `
          UPDATE tax_categories
          SET code=@code, name=@name, rate=@rate, isInterstate=@isInterstate,
              cessRate=@cessRate, calcMethod=COALESCE(@calcMethod,'FIXED'), updatedAt=@now
          WHERE id=@id
        `
        ).run({
          id,
          code: payload.code,
          name: payload.name,
          rate: payload.rate,
          isInterstate: payload.isInterstate ? 1 : 0,
          cessRate: payload.cessRate ?? null,
          calcMethod: payload.calcMethod ?? "FIXED",
          now,
        });

        db.prepare(
          `DELETE FROM tax_category_components WHERE categoryId=?`
        ).run(id);
        db.prepare(`DELETE FROM tax_category_defaults WHERE categoryId=?`).run(
          id
        );
      }

      // components
      const insComp = db.prepare(`
        INSERT INTO tax_category_components(id,categoryId,component,rate,createdAt,updatedAt)
        VALUES(?,?,?,?,?,?)
      `);
      for (const c of payload.components || []) {
        insComp.run(uuidv4(), id, c.component, Number(c.rate || 0), now, now);
      }

      if (payload.defaults) {
        // Safety: if returns are null but base exists, copy base -> returns
        const d = { ...payload.defaults };
        if (!d.salesReturnAccountId && d.salesAccountId)
          d.salesReturnAccountId = d.salesAccountId;
        if (!d.purchaseReturnAccountId && d.purchaseAccountId)
          d.purchaseReturnAccountId = d.purchaseAccountId;

        db.prepare(
          `
          INSERT INTO tax_category_defaults(
            id, categoryId,
            salesAccountId, purchaseAccountId, salesReturnAccountId, purchaseReturnAccountId,
            outputCgstAccountId, outputSgstAccountId, outputIgstAccountId,
            inputCgstAccountId,  inputSgstAccountId,  inputIgstAccountId,
            cessAccountId, singleTaxAccountId, createdAt, updatedAt
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `
        ).run(
          uuidv4(),
          id,
          d.salesAccountId || null,
          d.purchaseAccountId || null,
          d.salesReturnAccountId || null,
          d.purchaseReturnAccountId || null,
          d.outputCgstAccountId || null,
          d.outputSgstAccountId || null,
          d.outputIgstAccountId || null,
          d.inputCgstAccountId || null,
          d.inputSgstAccountId || null,
          d.inputIgstAccountId || null,
          d.cessAccountId || null,
          d.singleTaxAccountId || null,
          now,
          now
        );
      }
    });
    tx();

    return { success: true, id };
  });

  ipcMain.handle("tax:deleteCategory", (e, id) => {
    db.prepare(`DELETE FROM tax_categories WHERE id=?`).run(id);
    return { success: true };
  });

  ipcMain.handle(
    "tax:saveCodeMap",
    (e, { licenseId, productTaxCode, categoryId }) => {
      const row = db
        .prepare(
          `
      SELECT id FROM tax_code_map WHERE licenseId=? AND productTaxCode=?
    `
        )
        .get(licenseId, productTaxCode);
      if (row) {
        db.prepare(`UPDATE tax_code_map SET categoryId=? WHERE id=?`).run(
          categoryId,
          row.id
        );
        return { success: true, id: row.id };
      } else {
        const id = uuidv4();
        db.prepare(
          `
        INSERT INTO tax_code_map(id,licenseId,productTaxCode,categoryId) VALUES(?,?,?,?)
      `
        ).run(id, licenseId, productTaxCode, categoryId);
        return { success: true, id };
      }
    }
  );

  ipcMain.handle("tax:getCodeMap", (e, licenseId) => {
    const rows = db
      .prepare(
        `
      SELECT * FROM tax_code_map WHERE licenseId=?
    `
      )
      .all(licenseId);
    return { success: true, rows };
  });

  // NEW HANDLERS

  // 1) Seed India GST basics (idempotent: uses upserts / ensureAccount)
  ipcMain.handle("tax:seedIndiaGST", (e, licenseId) => {
    try {
      seedIndiaGSTBasics(licenseId);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err.message || err) };
    }
  });

  // 2) List accounts useful for Defaults dropdowns
  ipcMain.handle("tax:listDefaultableAccounts", (e, licenseId) => {
    ensureTaxSeeded(licenseId);
    const rows = db
      .prepare(
        `
      SELECT id, name, code, groupId, taxType, gstComponent, rate
      FROM accounts
      WHERE licenseId=? AND COALESCE(deletedAt,'')=''
      ORDER BY name
    `
      )
      .all(licenseId);
    return { success: true, rows };
  });
}

module.exports = { registerTaxHandlers };
