import assert from "node:assert/strict";
import { openAsBlob } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildReportReference } from "../js/modules/reporte-teikit-lucky/calculations.js";
import { createReportAccumulator } from "../js/modules/reporte-teikit-lucky/incremental-accumulator.js";
import { readXlsxIncrementally } from "../js/modules/reporte-teikit-lucky/xlsx-stream-reader.js";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Indica la ruta del XLSX real como primer argumento.");

const wasmPath = fileURLToPath(new URL("../js/vendor/sax-wasm/sax-wasm.wasm", import.meta.url));
const wasmBuffer = await readFile(wasmPath);
const wasmSource = () => Promise.resolve(new Response(wasmBuffer, { headers: { "Content-Type": "application/wasm" } }));
const file = await openAsBlob(sourcePath);
const rows = [];
const accumulator = createReportAccumulator();
const reader = await readXlsxIncrementally(file, {
  wasmSource,
  onRow(row) { rows.push(row); accumulator.consume(row); },
});
const incremental = accumulator.finish();
const reference = buildReportReference(rows);

function analyticsOnly(report) {
  const copy = structuredClone(report);
  copy.rows = { length: report.rows.length };
  Object.values(copy.brands).forEach((brand) => { brand.rows = { length: brand.rows.length }; });
  return copy;
}

assert.deepEqual(analyticsOnly(incremental), analyticsOnly(reference));
assert.equal(reader.rowCount, 184671);
assert.equal(reader.physicalRowCount, 194503);
assert.equal(reader.emptyRowCount, 9832);

const brandEvidence = (brand) => ({
  summary: brand.summary,
  providerSummary: brand.providerSummary,
  branches: brand.branches.length,
  incidents: brand.incidents.map(({ status, total, reasons }) => ({
    status,
    total,
    reasonRows: reasons.length,
    reasonCount: reasons.reduce((sum, reason) => sum + reason.count, 0),
  })),
});

console.log(JSON.stringify({
  equality: true,
  reader: { rowCount: reader.rowCount, physicalRowCount: reader.physicalRowCount, emptyRowCount: reader.emptyRowCount },
  total: incremental.rows.length,
  unclassified: incremental.validation.unclassifiedCount,
  TEIKIT: brandEvidence(incremental.brands.TEIKIT),
  LUCKY: brandEvidence(incremental.brands.LUCKY),
}, null, 2));
