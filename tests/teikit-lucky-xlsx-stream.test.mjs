import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import XLSX from "../js/vendor/xlsx.full.min.js";
import { readXlsxIncrementally, STREAMED_REPORT_FIELDS, XlsxStreamError } from "../js/modules/reporte-teikit-lucky/xlsx-stream-reader.js";

const wasmSource = await readFile(new URL("../js/vendor/sax-wasm/sax-wasm.wasm", import.meta.url));
const headers = [
  "Restaurant", "Estatus de orden", "Creada en", "Completada en", "Cooking Time",
  "Orden planeada", "Tiempo total de envio sin cooking time", "Metodo de pago",
  "Repartido por", "Distancia manejada", "Razon de rechazo", "Columna ignorada",
];

function makeFile(rows, customHeaders = headers) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([customHeaders, ...rows]), "Operación");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", bookSST: true });
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { size: blob.size, stream: () => blob.stream() };
}

test("lector incremental conserva tipos y extrae solo las 11 columnas requeridas", async () => {
  const rows = [];
  const file = makeFile([
    ["Teikit Centro", "COMPLETE", 46242.5, 46242.55, 10, null, 52.25, "CASH", "UBER_DAAS", 3.5, null, "ignorar"],
    ["Lucky Sur", "REJECTED", 46243, null, 15, 1, null, "CREDIT_CARD", null, 0, "SIN_REPARTIDOR", "ignorar"],
  ]);
  const result = await readXlsxIncrementally(file, { wasmSource, onRow: (row) => rows.push(row) });
  assert.equal(result.rowCount, 2);
  assert.equal(result.physicalRowCount, 2);
  assert.equal(result.headers.length, 12);
  assert.deepEqual(result.selectedColumns.map((column) => column.field), STREAMED_REPORT_FIELDS);
  assert.deepEqual(Object.keys(rows[0].values), STREAMED_REPORT_FIELDS);
  assert.equal(rows[0].values.restaurant, "Teikit Centro");
  assert.equal(rows[0].values.createdAt, 46242.5);
  assert.equal(rows[0].values.officialTime, 52.25);
  assert.equal(rows[1].values.plannedOrder, 1);
  assert.equal(rows[1].values.provider, null);
  assert.equal(rows[1].values.rejectionReason, "SIN_REPARTIDOR");
  assert.equal(Object.hasOwn(rows[0].values, "Columna ignorada"), false);
});

test("lector incremental reporta columnas obligatorias faltantes", async () => {
  const file = makeFile([["COMPLETE"]], ["Estatus de orden"]);
  await assert.rejects(() => readXlsxIncrementally(file, { wasmSource }), (error) => {
    assert.ok(error instanceof XlsxStreamError);
    assert.equal(error.code, "MISSING_REQUIRED_COLUMNS");
    assert.match(error.message, /restaurant/);
    return true;
  });
});

test("lector incremental no convierte entidades XML visibles en texto literal", async () => {
  const rows = [];
  const file = makeFile([["TEIKIT & LUCKY", "COMPLETE", 1, 2, 0, null, 1, "CASH", "UBER_DAAS", 1, "A < B", "ignorar"]]);
  await readXlsxIncrementally(file, { wasmSource, onRow: (row) => rows.push(row) });
  assert.equal(rows[0].values.restaurant, "TEIKIT & LUCKY");
  assert.equal(rows[0].values.rejectionReason, "A < B");
});
