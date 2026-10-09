import assert from "node:assert/strict";
import XLSX from "../js/vendor/xlsx.full.min.js";
import { REQUIRED_COLUMNS } from "../js/modules/limpieza-datos/constants.js";
import { cleanRows } from "../js/modules/limpieza-datos/cleaner.js";
import { createCleanWorkbook } from "../js/modules/limpieza-datos/exporter.js";
import { workbookToMatrix } from "../js/modules/limpieza-datos/file-reader.js";

const makeRow = (orderId, provider) => REQUIRED_COLUMNS.map((column) => {
  if (column === "orderId") return orderId;
  if (column === "Repartido por") return provider;
  return null;
});

const sourceWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(sourceWorkbook, XLSX.utils.aoa_to_sheet([
  REQUIRED_COLUMNS,
  makeRow("B", "UBER_DAAS"),
  makeRow("A", "RAPPI_CARGO"),
  makeRow("B", "DIDI_DELIVERY"),
  makeRow("X", "OTRO"),
]), "ORIGINAL");
const parsed = workbookToMatrix(sourceWorkbook, XLSX);
const result = cleanRows(parsed.headers, parsed.rows);
const outputWorkbook = createCleanWorkbook(result, XLSX);

assert.deepEqual(outputWorkbook.SheetNames, ["CLEAN"]);
const output = workbookToMatrix(outputWorkbook, XLSX);
assert.deepEqual(output.headers, REQUIRED_COLUMNS);
assert.deepEqual(output.rows.map((row) => row[0]), ["B", "A"]);
assert.equal(output.rows.length, 2);

const invalid = structuredClone(result);
invalid.rows[0][REQUIRED_COLUMNS.indexOf("Repartido por")] = "OTRO";
assert.throws(() => createCleanWorkbook(invalid, XLSX), /No se pudo generar la descarga/);
console.log("OK: hoja CLEAN única, 22 columnas exactas, orden conservado y descarga inválida bloqueada.");
