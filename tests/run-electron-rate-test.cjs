const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTypeScriptModule(filePath, dependencyMap = {}) {
  const source = fs.readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const moduleRecord = { exports: {} };
  const localRequire = (id) => {
    if (id in dependencyMap) return dependencyMap[id];
    throw new Error(`Unexpected test dependency: ${id}`);
  };
  new Function("require", "module", "exports", output)(
    localRequire,
    moduleRecord,
    moduleRecord.exports,
  );
  return moduleRecord.exports;
}

const resolution = loadTypeScriptModule(
  path.join(__dirname, "../src/lib/rates/rateResolution.ts"),
);
const rateMaster = loadTypeScriptModule(
  path.join(__dirname, "../src/lib/rates/rateMaster.ts"),
);
assert.equal(rateMaster.generateRateCode("  Wholesale  Price!  "), "WHOLESALE_PRICE");
assert.equal(
  rateMaster.codeAfterNameChange("Dealer Price", "CUSTOM_CODE", true),
  "CUSTOM_CODE",
  "manual code overrides must survive later name edits",
);
assert.equal(
  rateMaster.codeAfterNameChange("Dealer Price", "OLD", false),
  "DEALER_PRICE",
);

const baseBulkRow = {
  name: "Wholesale",
  code: "WHOLESALE",
  sortOrder: 10,
  isActive: true,
  isDefault: false,
};
const blankTrailing = rateMaster.validateBulkRateRows([
  baseBulkRow,
  { name: "", code: "", sortOrder: 20, isActive: true, isDefault: false },
]);
assert.equal(
  blankTrailing.rows.length,
  1,
  "untouched trailing rows with a suggested order are ignored",
);
assert.equal(blankTrailing.errors.length, 0);
assert.ok(
  rateMaster.validateBulkRateRows([
    baseBulkRow,
    { name: "", code: "", sortOrder: 20, isActive: false, isDefault: false },
  ]).errors.some((error) => error.row === 1 && error.field === "name"),
  "a trailing row changed from its blank defaults is partially entered",
);
assert.ok(
  rateMaster.validateBulkRateRows([
    baseBulkRow,
    { name: "Partial", code: "", sortOrder: 20, isActive: true, isDefault: false },
  ]).errors.some((error) => error.row === 1 && error.field === "code"),
  "partially entered rows must be rejected",
);
assert.ok(
  rateMaster.validateBulkRateRows([
    baseBulkRow,
    { ...baseBulkRow, name: " wholesale ", code: "OTHER", sortOrder: 20 },
  ]).errors.some((error) => error.field === "name"),
  "batch names must be unique case-insensitively",
);
assert.ok(
  rateMaster.validateBulkRateRows([
    baseBulkRow,
    { ...baseBulkRow, name: "Other", code: " wholesale ", sortOrder: 20 },
  ]).errors.some((error) => error.field === "code"),
  "batch codes must be unique case-insensitively",
);
assert.ok(
  rateMaster.validateBulkRateRows([baseBulkRow], [
    { name: "WHOLESALE", code: "EXISTING", deletedAt: null },
  ]).errors.some((error) => error.field === "name"),
  "existing-name collisions must be case-insensitive",
);
assert.ok(
  rateMaster.validateBulkRateRows([
    { ...baseBulkRow, isDefault: true },
    { ...baseBulkRow, name: "Dealer", code: "DEALER", sortOrder: 20, isDefault: true },
  ]).errors.some((error) => error.field === "isDefault"),
  "multiple defaults must be rejected",
);
assert.ok(
  rateMaster.validateBulkRateRows([
    { ...baseBulkRow, isDefault: true, isActive: false },
  ]).errors.some((error) => error.field === "isActive"),
  "an inactive default must be rejected",
);
assert.deepEqual(
  rateMaster.parseRatePaste("Wholesale\nDealer,DEALER,30", 20).rows.map((row) => ({
    name: row.name,
    code: row.code,
    sortOrder: row.sortOrder,
  })),
  [
    { name: "Wholesale", code: "WHOLESALE", sortOrder: "20" },
    { name: "Dealer", code: "DEALER", sortOrder: "30" },
  ],
);
assert.deepEqual(
  rateMaster.parseRatePaste("Wholesale,,20\nDealer,DEALER,\nOnline,,", 20).rows.map(
    (row) => ({
      name: row.name,
      code: row.code,
      sortOrder: row.sortOrder,
      codeManuallyEdited: row.codeManuallyEdited,
    }),
  ),
  [
    {
      name: "Wholesale",
      code: "WHOLESALE",
      sortOrder: "20",
      codeManuallyEdited: false,
    },
    {
      name: "Dealer",
      code: "DEALER",
      sortOrder: "30",
      codeManuallyEdited: true,
    },
    {
      name: "Online",
      code: "ONLINE",
      sortOrder: "40",
      codeManuallyEdited: false,
    },
  ],
  "CSV paste must generate omitted codes and sort orders",
);
assert.deepEqual(
  rateMaster.parseRatePaste("Good\nBad,TOO,MANY,COLUMNS", 10).errors,
  [{ line: 2, message: "Use either a name or name,code,sortOrder." }],
);
assert.deepEqual(
  rateMaster.parseRatePaste("Good\n,EMPTY,20\nBad,BAD,-1", 10).errors,
  [
    { line: 2, message: "Rate name is required." },
    { line: 3, message: "Sort order must be a non-negative whole number." },
  ],
  "malformed non-empty paste lines must be reported with line numbers",
);

async function testWebBulkTransaction() {
  const STORES = {
    RATE_TYPES: "rate_types",
    PRODUCT_RATES: "product_rates",
    PRODUCT_BATCH_RATES: "product_batch_rates",
    PRODUCTS: "products",
    PRODUCT_BATCHES: "product_batches",
  };
  let idSequence = 1;
  let syncPushes = 0;
  let failCode = null;
  const stores = new Map(Object.values(STORES).map((store) => [store, []]));
  const retail = {
    id: "web-retail",
    licenseId: "web-license",
    code: "RETAIL",
    name: "Retail",
    isDefault: true,
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    isSynced: false,
    syncedAt: null,
  };
  stores.get(STORES.RATE_TYPES).push(retail);

  const idbRunTransaction = async (_storeNames, _mode, executor) => {
    const snapshot = new Map(
      [...stores].map(([name, values]) => [name, structuredClone(values)]),
    );
    const tx = {
      getAll: async (storeName) => structuredClone(stores.get(storeName)),
      getAllByIndex: async (storeName, indexName, key) =>
        structuredClone(stores.get(storeName).filter((row) => row[indexName] === key)),
      put: async (storeName, value) => {
        if (storeName === STORES.RATE_TYPES && value.code === failCode) {
          throw new Error("forced browser write failure");
        }
        const values = stores.get(storeName);
        const at = values.findIndex((row) => row.id === value.id);
        if (at >= 0) values[at] = structuredClone(value);
        else values.push(structuredClone(value));
        return value;
      },
    };
    try {
      return await executor(tx);
    } catch (error) {
      stores.clear();
      for (const [name, values] of snapshot) stores.set(name, values);
      throw error;
    }
  };
  const unused = async () => {
    throw new Error("Unexpected standalone IndexedDB call in bulk test");
  };
  const webRates = loadTypeScriptModule(
    path.join(__dirname, "../src/platform/web/rates.ts"),
    {
      "./idb": {
        STORES,
        idbGetAllByIndex: unused,
        idbGetByKey: unused,
        idbPut: unused,
        idbPutMany: unused,
        idbRunTransaction,
        newId: () => `web-created-${idSequence++}`,
      },
      "@/lib/rates/rateMaster": rateMaster,
      "@/sync/SyncManager": {
        SyncManager: {
          pushEntity: async (entity) => {
            assert.equal(entity, "rateType");
            syncPushes += 1;
          },
        },
      },
    },
  );

  global.window = {};
  const preserved = await webRates.webCreateRateTypesBulk({
    licenseId: "web-license",
    rows: [{ ...baseBulkRow, name: "Web Wholesale", code: "WEB_WHOLESALE" }],
  });
  assert.equal(preserved.success, true, preserved.error);
  assert.equal(
    stores.get(STORES.RATE_TYPES).find((row) => row.id === retail.id).isDefault,
    true,
    "no supplied browser default must preserve the existing default",
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(syncPushes, 1, "a successful browser bulk create triggers Rate Type sync once");
  assert.equal(preserved.rows[0].isSynced, false, "bulk-created rows remain dirty for sync");

  const switched = await webRates.webCreateRateTypesBulk({
    licenseId: "web-license",
    rows: [{
      ...baseBulkRow,
      name: "Web Dealer",
      code: "WEB_DEALER",
      sortOrder: 20,
      isDefault: true,
    }],
  });
  assert.equal(switched.success, true, switched.error);
  assert.equal(
    stores.get(STORES.RATE_TYPES).find((row) => row.id === retail.id).isDefault,
    false,
    "a supplied browser default atomically replaces the old default",
  );
  assert.equal(switched.rows[0].isDefault, true);

  const beforeInvalid = structuredClone(stores.get(STORES.RATE_TYPES));
  const invalid = await webRates.webCreateRateTypesBulk({
    licenseId: "web-license",
    rows: [
      { ...baseBulkRow, name: "Web Valid Prefix", code: "WEB_VALID_PREFIX", sortOrder: 25 },
      { ...baseBulkRow, name: "", code: "", sortOrder: 30 },
    ],
  });
  assert.equal(invalid.success, false);
  assert.deepEqual(
    stores.get(STORES.RATE_TYPES),
    beforeInvalid,
    "the browser persistence boundary must reject, not trim, invalid payload rows",
  );

  failCode = "WEB_FAIL";
  const beforeFailure = structuredClone(stores.get(STORES.RATE_TYPES));
  const failed = await webRates.webCreateRateTypesBulk({
    licenseId: "web-license",
    rows: [
      { ...baseBulkRow, name: "Web Before Fail", code: "WEB_BEFORE_FAIL", sortOrder: 30 },
      { ...baseBulkRow, name: "Web Fail", code: "WEB_FAIL", sortOrder: 40 },
    ],
  });
  assert.equal(failed.success, false);
  assert.deepEqual(
    stores.get(STORES.RATE_TYPES),
    beforeFailure,
    "browser bulk creation must roll back every row after a write failure",
  );
  delete global.window;
}

const rateTypes = [
  {
    id: "retail",
    code: "RETAIL",
    name: "Retail",
    isDefault: true,
    isActive: true,
    sortOrder: 10,
    deletedAt: null,
  },
  {
    id: "wholesale",
    code: "WHOLESALE",
    name: "Wholesale",
    isDefault: false,
    isActive: true,
    sortOrder: 20,
    deletedAt: null,
  },
];
assert.equal(resolution.findDefaultRateType(rateTypes).id, "retail");
assert.equal(
  resolution.resolveNamedRate({
    rateType: rateTypes[0],
    productRates: [{ rateTypeId: "retail", amount: 100 }],
    batchRates: [{ rateTypeId: "retail", amount: 95 }],
  }).amount,
  95,
);
assert.equal(
  resolution.resolveNamedRate({
    rateType: rateTypes[1],
    productRates: [{ rateTypeId: "retail", amount: 100 }],
  }).configured,
  false,
  "resolution must not borrow a different named rate",
);
assert.equal(
  resolution.compatibilitySalePrice(rateTypes, [
    { rateTypeId: "retail", amount: 100 },
    { rateTypeId: "wholesale", amount: 90 },
  ]),
  100,
);

const salesUtils = loadTypeScriptModule(
  path.join(__dirname, "../src/components/sales/utils.ts"),
);
const offerEngine = loadTypeScriptModule(
  path.join(__dirname, "../src/components/sales/offerEngine.ts"),
  { "./utils": salesUtils },
);
const offer = {
  id: "hourly",
  name: "Ten percent",
  type: "HOURLY_DISCOUNT",
  isActive: 1,
  applyScope: "ALL_PRODUCTS",
  discountPercent: 10,
};
const baseRow = {
  ...salesUtils.createEmptyRow(1),
  productId: "product-1",
  quantity: 1,
  rate: 72,
  salePrice: 72,
};
const offerResult = offerEngine.calculateOffers({
  header: { saleDate: new Date().toISOString() },
  rows: [baseRow],
  offers: [offer],
  targets: [],
});
assert.equal(offerResult.rows[0].originalRate, 72);
assert.equal(offerResult.rows[0].appliedRate, 64.8);
const changedRateResult = offerEngine.calculateOffers({
  header: { saleDate: new Date().toISOString() },
  rows: [{ ...offerResult.rows[0], rate: 60, originalRate: null }],
  offers: [offer],
  targets: [],
});
assert.equal(changedRateResult.rows[0].originalRate, 60);
assert.equal(changedRateResult.rows[0].appliedRate, 54);
console.log("Rate resolution and selected-base offer checks passed.");

testWebBulkTransaction()
  .then(() => {
    console.log("Rate Master helper and browser bulk transaction checks passed.");
    runElectronChecks();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

function runElectronChecks() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(
    require("electron"),
    [path.join(__dirname, "rate-migration.electron.cjs")],
    { env, stdio: "inherit" },
  );

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
