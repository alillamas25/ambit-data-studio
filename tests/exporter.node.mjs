import assert from "node:assert/strict";
import ExcelJS from "../js/vendor/exceljs.min.js";
import { mapColumns, normalizeRows } from "../js/modules/tiempos-entrega/column-normalizer.js";
import { prepareDataset } from "../js/modules/tiempos-entrega/metrics.js";

let exportedBlob;
globalThis.window = { ExcelJS };
globalThis.document = {
  body: { append() {} },
  createElement() { return { click() {}, remove() {} }; },
};
URL.createObjectURL = (blob) => { exportedBlob = blob; return "blob:test"; };
URL.revokeObjectURL = () => {};

const rawRows = [
  { orderId: "T-1", "Creada en": "01/09/2026 10:00", "Completada en": "01/09/2026 10:50", "Estatus de orden": "COMPLETE", "Repartido por": "UBER_DAAS", "Cooking Time": 10, "Tiempo total de envio sin cooking time": 40, Restaurant: "Teikit - RÃ­o Lerma", Zona: "Centro", Ciudad: "CDMX" },
  { orderId: "T-2", "Creada en": "02/09/2026 11:00", "Completada en": "02/09/2026 12:10", "Estatus de orden": "COMPLETE", "Repartido por": "RAPPI_CARGO", "Cooking Time": 10, "Tiempo total de envio sin cooking time": 60, Restaurant: "Lucky", Zona: "Centro", Ciudad: "CDMX" },
];
const { mapping, missingRequired } = mapColumns(Object.keys(rawRows[0]));
assert.deepEqual(missingRequired, []);
const dataset = prepareDataset(normalizeRows(rawRows, mapping));
const { exportDeliveryAnalysis } = await import("../js/modules/tiempos-entrega/exporter.js");
const result = await exportDeliveryAnalysis({ rows: dataset.analyzed, dataset, mapping, filters: { start: "", end: "", day: "", hour: "", restaurant: "", zone: "", city: "", provider: "", brand: "" }, sourceFile: "prueba.xlsx" });
assert.deepEqual(result.sheetNames, ["Resumen", "Por fecha", "Por hora", "Por Restaurant", "Por Zona", "Por Ciudad", "Proveedores", "Tiempos por etapa", "Validación", "Base analizada"]);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(await exportedBlob.arrayBuffer());
const summary = workbook.getWorksheet("Resumen");
assert.equal(summary.getCell("A1").value, "AMBIT DATA STUDIO");
assert.equal(summary.getCell("A1").fill.fgColor.argb, "FF6414D1");
assert.equal(summary.getCell("A10").value, "Órdenes analizadas");
assert.equal(summary.getCell("A11").value, 2);
const restaurants = workbook.getWorksheet("Por Restaurant");
assert.match(JSON.stringify(restaurants.autoFilter), /4/);
assert.equal(restaurants.views[0].state, "frozen");
assert.ok(restaurants.conditionalFormattings.length >= 2);
assert.ok([restaurants.getCell("A5").value, restaurants.getCell("A6").value].includes("Teikit - Río Lerma"));
const base = workbook.getWorksheet("Base analizada");
assert.equal(base.rowCount, 3);
assert.match(JSON.stringify(base.autoFilter), /1/);
assert.notEqual(base.getCell(1, 1).fill.fgColor.argb, base.getCell(1, Object.keys(mapping).length + 1).fill.fgColor.argb);
console.log("OK: XLSX íntegro, 10 hojas, estilos, filtros, paneles, formato condicional y corrección de codificación.");
