// electron/ipc/labelPrinting.js
const { ipcMain } = require("electron");
const db = require("../db");
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");

function nowISO() {
  return new Date().toISOString();
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function escapeXml(v) {
  return safeStr(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function csvEscape(v) {
  const s = safeStr(v).replace(/"/g, '""');
  return `"${s}"`;
}

function zplEscape(v) {
  return safeStr(v).replace(/\^/g, " ").replace(/~/g, " ");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getJobDir() {
  const dir = path.join(os.tmpdir(), "storewise-label-jobs");
  ensureDir(dir);
  return dir;
}

function getTemplate(licenseId, templateId) {
  if (!templateId) return null;

  return (
    db
      .prepare(
        `
        SELECT *
        FROM label_templates
        WHERE id = ?
          AND licenseId = ?
          AND COALESCE(deletedAt,'') = ''
        LIMIT 1
      `,
      )
      .get(templateId, licenseId) || null
  );
}

function getPrinter(licenseId, printerId) {
  if (printerId) {
    return (
      db
        .prepare(
          `
          SELECT *
          FROM label_printers
          WHERE id = ?
            AND licenseId = ?
            AND COALESCE(deletedAt,'') = ''
          LIMIT 1
        `,
        )
        .get(printerId, licenseId) || null
    );
  }

  return (
    db
      .prepare(
        `
        SELECT *
        FROM label_printers
        WHERE licenseId = ?
          AND isDefault = 1
          AND COALESCE(deletedAt,'') = ''
        ORDER BY updatedAt DESC
        LIMIT 1
      `,
      )
      .get(licenseId) || null
  );
}

function getMappings(templateId) {
  if (!templateId) return [];
  return db
    .prepare(
      `
      SELECT *
      FROM label_template_mappings
      WHERE templateId = ?
      ORDER BY appField ASC
    `,
    )
    .all(templateId);
}

function resolveRowData(row) {
  return {
    barcode: safeStr(row.barcode),
    itemName: safeStr(row.itemName),
    salePrice:
      row.salePrice === null || row.salePrice === undefined
        ? ""
        : row.salePrice,
    mrp: row.mrp === null || row.mrp === undefined ? "" : row.mrp,
    batchNo: safeStr(row.batchNo),
    copies: Math.max(1, Number(row.copies || 1)),
    productId: safeStr(row.productId),
    batchId: safeStr(row.batchId),
  };
}

function expandCopies(rows) {
  const out = [];
  for (const row of rows || []) {
    const clean = resolveRowData(row);
    for (let i = 0; i < clean.copies; i++) {
      out.push({ ...clean, copyIndex: i + 1 });
    }
  }
  return out;
}

function applyMappingsToRow(row, mappings = []) {
  const base = { ...resolveRowData(row) };

  for (const m of mappings) {
    const appField = safeStr(m.appField);
    const externalField = safeStr(m.externalField);
    if (!externalField) continue;
    base[externalField] = base[appField] ?? "";
  }

  return base;
}

function loadTemplateText(templatePath) {
  if (!templatePath) return null;
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, "utf8");
}

function renderRawTemplate(templateText, row) {
  return templateText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    return safeStr(row[key]);
  });
}

function buildDefaultZplForRow(row, template) {
  const widthMm = Number(template?.widthMm || 50);
  const heightMm = Number(template?.heightMm || 30);
  const dpi = Number(template?.dpi || 203);

  const dpmm = dpi / 25.4;
  const pw = Math.max(200, Math.round(widthMm * dpmm));
  const ll = Math.max(120, Math.round(heightMm * dpmm));

  const name = zplEscape(row.itemName).slice(0, 32);
  const barcode = zplEscape(row.barcode);
  const mrp = zplEscape(row.mrp);
  const sale = zplEscape(row.salePrice);
  const batchNo = zplEscape(row.batchNo);

  return `
^XA
^CI28
^PW${pw}
^LL${ll}
^LH0,0
^FO20,20^A0N,28,28^FD${name}^FS
^FO20,55^BY2,2,70^BCN,70,Y,N,N^FD${barcode}^FS
^FO20,145^A0N,24,24^FDMRP: ${mrp}^FS
^FO180,145^A0N,24,24^FDSALE: ${sale}^FS
^FO20,175^A0N,22,22^FDBATCH: ${batchNo}^FS
^XZ
`.trim();
}

function buildZplFromRows({ rows, template, mappings, printer }) {
  const expanded = expandCopies(rows);
  const templateText =
    template?.templatePath && fs.existsSync(template.templatePath)
      ? loadTemplateText(template.templatePath)
      : null;

  const chunks = expanded.map((r) => {
    const mapped = applyMappingsToRow(r, mappings);
    if (templateText) {
      return renderRawTemplate(templateText, mapped);
    }
    return buildDefaultZplForRow(mapped, {
      ...template,
      dpi: printer?.dpi || 203,
    });
  });

  return chunks.join("\n");
}

function buildPrnFromRows({ rows, template, mappings }) {
  if (!template?.templatePath) {
    throw new Error("PRN templatePath required");
  }

  const expanded = expandCopies(rows);
  const templateText = loadTemplateText(template.templatePath);

  const chunks = expanded.map((r) => {
    const mapped = applyMappingsToRow(r, mappings);
    return renderRawTemplate(templateText, mapped);
  });

  return chunks.join("\n");
}

function sendRawToNetworkPrinter({ host, port, content }) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch (_) {}
      err ? reject(err) : resolve(true);
    };

    socket.setTimeout(10000);

    socket.once("timeout", () => finish(new Error("Printer socket timeout")));
    socket.once("error", finish);

    socket.connect(Number(port || 9100), host, () => {
      socket.write(Buffer.from(content, "utf8"), (err) => {
        if (err) return finish(err);
        socket.end();
      });
    });

    socket.once("close", (hadError) => {
      if (!hadError) finish();
    });
  });
}

function sendRawToWindowsSharedPrinter({ printerName, filePath }) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cmd.exe",
      ["/c", "copy", "/b", filePath, printerName],
      { windowsHide: true },
    );

    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      if (code === 0) return resolve(true);
      reject(
        new Error(
          stderr || `Failed to copy raw print file to printer. exit=${code}`,
        ),
      );
    });
  });
}

async function sendRawPrint({
  printer,
  content,
  extension = "zpl",
  testMode = "REAL_PRINT",
}) {
  const dir = getJobDir();
  const filePath = path.join(dir, `${uuidv4()}.${extension}`);
  fs.writeFileSync(filePath, content, "utf8");

  if (testMode === "FILE_ONLY") {
    return { mode: "FILE_ONLY", filePath };
  }

  if (printer?.connectionType === "NETWORK") {
    if (!printer.host) {
      throw new Error("Network printer host missing");
    }
    await sendRawToNetworkPrinter({
      host: printer.host,
      port: printer.port || 9100,
      content,
    });
    return { mode: "NETWORK", filePath };
  }

  if (printer?.connectionType === "WINDOWS") {
    if (!printer.printerName) {
      throw new Error("printerName missing");
    }
    await sendRawToWindowsSharedPrinter({
      printerName: printer.printerName,
      filePath,
    });
    return { mode: "WINDOWS", filePath };
  }

  throw new Error("Unsupported printer connectionType");
}

function findBarTenderExecutable() {
  const candidates = [
    process.env.BARTENDER_EXE,
    "C:\\Program Files\\Seagull\\BarTender Suite\\bartend.exe",
    "C:\\Program Files\\Seagull Scientific\\BarTender Suite\\bartend.exe",
    "C:\\Program Files (x86)\\Seagull\\BarTender Suite\\bartend.exe",
    "C:\\Program Files (x86)\\Seagull Scientific\\BarTender Suite\\bartend.exe",
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    "BarTender executable not found. Set BARTENDER_EXE or install BarTender.",
  );
}

function buildBtxml({ template, printer, rows, mappings }) {
  if (!template?.templatePath) {
    throw new Error("BarTender .btw templatePath required");
  }

  const expanded = expandCopies(rows).map((r) =>
    applyMappingsToRow(r, mappings),
  );

  const externalFields = Array.from(
    new Set(
      [
        ...mappings.map((m) => safeStr(m.externalField)).filter(Boolean),
        "barcode",
        "itemName",
        "salePrice",
        "mrp",
        "batchNo",
      ].filter(Boolean),
    ),
  );

  const header = externalFields.map(csvEscape).join(",");
  const lines = expanded.map((row) =>
    externalFields.map((f) => csvEscape(row[f])).join(","),
  );
  const csv = [header, ...lines].join("\r\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<XMLScript Version="2.0">
  <Command Name="StoreWisePrint">
    <Print ReturnPrintData="false" ReturnSummary="true">
      <Format>${escapeXml(template.templatePath)}</Format>
      ${
        printer?.printerName
          ? `<PrintSetup><Printer>${escapeXml(printer.printerName)}</Printer></PrintSetup>`
          : ""
      }
      <RecordSet Name="Text File 1" Type="btTextFile">
        <Delimitation>btDelimQuoteAndComma</Delimitation>
        <UseFieldNamesFromFirstRecord>true</UseFieldNamesFromFirstRecord>
        <TextData><![CDATA[${csv}]]></TextData>
      </RecordSet>
    </Print>
  </Command>
</XMLScript>`;
}

function runBarTenderBTXML(xmlText) {
  return new Promise((resolve, reject) => {
    const exe = findBarTenderExecutable();
    const dir = getJobDir();
    const xmlPath = path.join(dir, `${uuidv4()}.btxml`);

    fs.writeFileSync(xmlPath, xmlText, "utf8");

    const child = spawn(exe, [`/XMLScript=${xmlPath}`], {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });

    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, xmlPath, stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `BarTender failed. exit=${code}`));
      }
    });
  });
}

function createJob({ licenseId, templateId, printerId, engine, payload }) {
  const id = uuidv4();
  const ts = nowISO();

  db.prepare(
    `
    INSERT INTO label_print_jobs
      (id, licenseId, templateId, printerId, engine, status, payloadJson, errorText, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NULL, ?, ?)
  `,
  ).run(
    id,
    licenseId,
    templateId || null,
    printerId || null,
    engine,
    JSON.stringify(payload || {}),
    ts,
    ts,
  );

  return id;
}

function markJobSuccess(id) {
  db.prepare(
    `
    UPDATE label_print_jobs
    SET status='SUCCESS', errorText=NULL, updatedAt=?
    WHERE id=?
  `,
  ).run(nowISO(), id);
}

function markJobFail(id, err) {
  db.prepare(
    `
    UPDATE label_print_jobs
    SET status='FAILED', errorText=?, updatedAt=?
    WHERE id=?
  `,
  ).run(String(err?.message || err), nowISO(), id);
}

function upsertPrinter(payload) {
  const id = payload?.id || uuidv4();
  const ts = nowISO();

  if (Number(payload?.isDefault || 0) === 1) {
    db.prepare(
      `
      UPDATE label_printers
      SET isDefault = 0, updatedAt = ?
      WHERE licenseId = ?
        AND COALESCE(deletedAt,'') = ''
    `,
    ).run(ts, payload.licenseId);
  }

  db.prepare(
    `
    INSERT INTO label_printers
      (id, licenseId, name, engine, printerName, connectionType, host, port, dpi, isDefault, createdAt, updatedAt, deletedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      engine=excluded.engine,
      printerName=excluded.printerName,
      connectionType=excluded.connectionType,
      host=excluded.host,
      port=excluded.port,
      dpi=excluded.dpi,
      isDefault=excluded.isDefault,
      updatedAt=excluded.updatedAt,
      deletedAt=NULL
  `,
  ).run(
    id,
    payload.licenseId,
    payload.name,
    payload.engine,
    payload.printerName,
    payload.connectionType || "WINDOWS",
    payload.host || null,
    payload.port || null,
    payload.dpi || 203,
    Number(payload.isDefault || 0),
    ts,
    ts,
  );

  return id;
}

function upsertTemplate(payload) {
  const id = payload?.id || uuidv4();
  const ts = nowISO();

  db.prepare(
    `
    INSERT INTO label_templates
      (id, licenseId, name, engine, templatePath, widthMm, heightMm, defaultPrinterId, createdAt, updatedAt, deletedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      engine=excluded.engine,
      templatePath=excluded.templatePath,
      widthMm=excluded.widthMm,
      heightMm=excluded.heightMm,
      defaultPrinterId=excluded.defaultPrinterId,
      updatedAt=excluded.updatedAt,
      deletedAt=NULL
  `,
  ).run(
    id,
    payload.licenseId,
    payload.name,
    payload.engine,
    payload.templatePath,
    payload.widthMm || null,
    payload.heightMm || null,
    payload.defaultPrinterId || null,
    ts,
    ts,
  );

  const mappings = Array.isArray(payload.mappings) ? payload.mappings : [];
  db.prepare(`DELETE FROM label_template_mappings WHERE templateId=?`).run(id);

  const ins = db.prepare(
    `
    INSERT INTO label_template_mappings
      (id, templateId, appField, externalField, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  );

  for (const m of mappings) {
    ins.run(
      uuidv4(),
      id,
      safeStr(m.appField),
      safeStr(m.externalField),
      ts,
      ts,
    );
  }

  return id;
}

function registerLabelPrintingHandlers() {
  ipcMain.handle("label:printer:list", (_e, { licenseId }) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT *
          FROM label_printers
          WHERE licenseId = ?
            AND COALESCE(deletedAt,'') = ''
          ORDER BY isDefault DESC, name ASC
        `,
        )
        .all(licenseId);

      return { success: true, rows };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  ipcMain.handle("label:printer:save", (_e, payload) => {
    try {
      if (!payload?.licenseId) {
        return { success: false, error: "licenseId required" };
      }
      const id = upsertPrinter(payload);
      return { success: true, id };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  ipcMain.handle("label:template:list", (_e, { licenseId }) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT *
          FROM label_templates
          WHERE licenseId = ?
            AND COALESCE(deletedAt,'') = ''
          ORDER BY name ASC
        `,
        )
        .all(licenseId);

      return { success: true, rows };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  ipcMain.handle("label:template:get", (_e, { licenseId, templateId }) => {
    try {
      const row = getTemplate(licenseId, templateId);
      if (!row) return { success: false, error: "Template not found" };
      const mappings = getMappings(templateId);
      return { success: true, row, mappings };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  ipcMain.handle("label:template:save", (_e, payload) => {
    try {
      if (!payload?.licenseId) {
        return { success: false, error: "licenseId required" };
      }
      const id = upsertTemplate(payload);
      return { success: true, id };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  ipcMain.handle("label:print", async (_e, payload) => {
    let jobId = null;

    try {
      if (!payload?.licenseId) {
        return { success: false, error: "licenseId required" };
      }
      if (!Array.isArray(payload?.rows) || payload.rows.length === 0) {
        return { success: false, error: "rows required" };
      }

      const engine = safeStr(payload?.engine || "HTML").toUpperCase();
      const template = getTemplate(payload.licenseId, payload.templateId);
      const printer =
        getPrinter(payload.licenseId, payload.printerId) ||
        (template?.defaultPrinterId
          ? getPrinter(payload.licenseId, template.defaultPrinterId)
          : null);

      const mappings = getMappings(payload.templateId);
      jobId = createJob({
        licenseId: payload.licenseId,
        templateId: payload.templateId,
        printerId: payload.printerId || template?.defaultPrinterId || null,
        engine,
        payload,
      });

      if (engine === "HTML") {
        markJobFail(jobId, "Use renderer HTML fallback");
        return { success: false, error: "Use renderer HTML fallback", jobId };
      }

      if (engine === "ZPL") {
        if (!printer) throw new Error("Printer config missing for ZPL");

        const ext = template?.templatePath?.toLowerCase()?.endsWith(".prn")
          ? "prn"
          : "zpl";

        const raw =
          ext === "prn"
            ? buildPrnFromRows({
                rows: payload.rows,
                template,
                mappings,
              })
            : buildZplFromRows({
                rows: payload.rows,
                template,
                mappings,
                printer,
              });

        const result = await sendRawPrint({
          printer,
          content: raw,
          extension: ext,
          testMode: payload.testMode || "REAL_PRINT",
        });

        markJobSuccess(jobId);
        return {
          success: true,
          engine: "ZPL",
          jobId,
          transport: result.mode,
          filePath: result.filePath,
        };
      }

      if (engine === "BARTENDER") {
        if (!template?.templatePath) {
          throw new Error("BarTender templatePath (.btw) required");
        }

        const xml = buildBtxml({
          template,
          printer,
          rows: payload.rows,
          mappings,
        });

        const result = await runBarTenderBTXML(xml);

        markJobSuccess(jobId);
        return {
          success: true,
          engine: "BARTENDER",
          jobId,
          xmlPath: result.xmlPath,
        };
      }

      throw new Error(`Unsupported engine: ${engine}`);
    } catch (err) {
      if (jobId) markJobFail(jobId, err);
      return {
        success: false,
        error: String(err?.message || err),
        jobId,
      };
    }
  });

  ipcMain.handle("label:job:list", (_e, { licenseId, limit = 50 }) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT *
          FROM label_print_jobs
          WHERE licenseId = ?
          ORDER BY datetime(createdAt) DESC
          LIMIT ?
        `,
        )
        .all(licenseId, Math.max(1, Number(limit || 50)));
      return { success: true, rows };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    }
  });
}

module.exports = { registerLabelPrintingHandlers };
