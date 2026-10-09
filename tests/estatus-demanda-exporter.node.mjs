import assert from "node:assert/strict";
import ExcelJS from "../js/vendor/exceljs.min.js";
import { buildAnalysis, prepareDataset } from "../js/modules/estatus-demanda-tendencias/analytics.js";
import { applyFilters, emptyFilters } from "../js/modules/estatus-demanda-tendencias/filters.js";

let exportedBlob;
globalThis.window = { ExcelJS };
globalThis.document = { body: { append() {} }, createElement() { return { click() {}, remove() {} }; } };
URL.createObjectURL = (blob) => { exportedBlob = blob; return "blob:test"; };
URL.revokeObjectURL = () => {};

const source = [
  ["Teikit - Aragón", "COMPLETE", "UBER_DAAS", "01/09/2026 10:00", "CDMX", "Centro", ""],
  ["Teikit - Aragón", "CANCELLED", "RAPPI_CARGO", "01/09/2026 11:00", "CDMX", "Centro", "Cliente"],
  ["Teikit - San Jerónimo", "REJECTED", "DIDI_DELIVERY", "02/09/2026 12:00", "CDMX", "Sur", ""],
  ["Teikit - San Jerónimo", "RETURNED", "UBER_DAAS", "02/09/2026 13:00", "CDMX", "Sur", "Producto"],
  ["Otra", "ACCEPTED", "UBER_DAAS", "03/09/2026 14:00", "Puebla", "Centro", ""],
].map(([restaurant, status, provider, createdAt, city, zone, rejectionReason], index) => ({ index, values: { restaurant, status, provider, createdAt, city, zone, rejectionReason } }));

const dataset = prepareDataset(source);
const filters = { ...emptyFilters(), brand: "TEIKIT" };
const analysis = buildAnalysis(applyFilters(dataset.universe, filters));
const { exportStatusDemandAnalysis } = await import("../js/modules/estatus-demanda-tendencias/exporter.js");
const result = await exportStatusDemandAnalysis({ analysis, filters, sourceFile: "control.xlsx" });
const expectedSheets = ["Resumen", "Tendencia", "Por día", "Por hora", "Sucursales", "Marcas", "Ciudades", "Zonas", "Proveedores", "CANCELLED", "REJECTED", "RETURNED"];
assert.deepEqual(result.sheetNames, expectedSheets);

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(await exportedBlob.arrayBuffer());
assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), expectedSheets);
const summary = workbook.getWorksheet("Resumen");
assert.equal(summary.getCell("B7").value, analysis.summary.total);
assert.equal(summary.getCell("B8").value, analysis.summary.complete);
assert.equal(summary.getCell("B9").value, analysis.summary.notDelivered);
assert.match(summary.getCell("A4").value, /Marca: TEIKIT/);

for (const name of expectedSheets.slice(1)) {
  const sheet = workbook.getWorksheet(name);
  assert.equal(sheet.views[0].state, "frozen");
  assert.equal(sheet.views[0].xSplit, 1);
  assert.equal(sheet.views[0].ySplit, 5);
  assert.equal(sheet.views[0].topLeftCell, "B6");
  assert.equal(sheet.getColumn(1).hidden, false);
  assert.ok(!sheet.pageSetup.printArea);
}

assert.equal(workbook.getWorksheet("Tendencia").getCell("B6").value, analysis.trend[0].total);
assert.equal(workbook.getWorksheet("Por hora").rowCount, 29);
assert.equal(workbook.getWorksheet("Sucursales").getCell("B6").value, analysis.byRestaurant[0].total);
assert.equal(workbook.getWorksheet("Proveedores").getCell("B6").value, analysis.byProvider[0].total);
assert.equal(workbook.getWorksheet("CANCELLED").getCell("C6").value, analysis.incidents.find((group) => group.status === "CANCELLED").rows[0].count);
assert.equal(workbook.getWorksheet("REJECTED").getCell("C6").value, analysis.incidents.find((group) => group.status === "REJECTED").rows[0].count);
assert.equal(workbook.getWorksheet("RETURNED").getCell("C6").value, analysis.incidents.find((group) => group.status === "RETURNED").rows[0].count);
console.log("OK: 12 hojas reconciliadas, filtros activos respetados y navegación compacta.");
