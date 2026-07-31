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

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const result = spawnSync(
  require("electron"),
  [path.join(__dirname, "rate-migration.electron.cjs")],
  { env, stdio: "inherit" },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
