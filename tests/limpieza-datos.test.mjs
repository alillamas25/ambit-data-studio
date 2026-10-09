import test from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_PROVIDERS, REQUIRED_COLUMNS } from "../js/modules/limpieza-datos/constants.js";
import { CleaningError, cleanRows, validateCleanResult } from "../js/modules/limpieza-datos/cleaner.js";
import { buildCleanFilename } from "../js/modules/limpieza-datos/exporter.js";

const makeRow = (orderId, provider, marker = orderId) => REQUIRED_COLUMNS.map((column) => {
  if (column === "orderId") return orderId;
  if (column === "Repartido por") return provider;
  if (column === "Restaurant") return marker;
  return `${column}-${marker}`;
});

test("1. Un archivo válido con las 22 columnas se limpia", () => {
  const result = cleanRows([...REQUIRED_COLUMNS], [makeRow("1", "UBER_DAAS")]);
  assert.equal(result.validation.passed, true);
  assert.equal(result.summary.final, 1);
});

test("2. Una columna faltante bloquea la limpieza con un mensaje específico", () => {
  const headers = REQUIRED_COLUMNS.filter((column) => column !== "Zona");
  assert.throws(() => cleanRows(headers, []), (error) => {
    assert.ok(error instanceof CleaningError);
    assert.equal(error.message, "No se pudo realizar la limpieza. Faltan las siguientes columnas: [Zona]");
    return true;
  });
});

test("3. Solo permanecen los tres proveedores exactos permitidos", () => {
  const rows = [
    makeRow("1", "DIDI_DELIVERY"), makeRow("2", "RAPPI_CARGO"), makeRow("3", "UBER_DAAS"),
    makeRow("4", "uber_daas"), makeRow("5", "OTRO"), makeRow("6", " UBER_DAAS"),
  ];
  const result = cleanRows([...REQUIRED_COLUMNS], rows);
  assert.deepEqual(result.rows.map((row) => row[0]), ["1", "2", "3"]);
});

test("4. Los orderId duplicados se eliminan después del filtro", () => {
  const result = cleanRows([...REQUIRED_COLUMNS], [makeRow("A", "UBER_DAAS"), makeRow("A", "RAPPI_CARGO")]);
  assert.equal(result.summary.duplicatesRemoved, 1);
  assert.equal(result.summary.final, 1);
});

test("5. Se conserva la primera aparición completa del orderId", () => {
  const result = cleanRows([...REQUIRED_COLUMNS], [makeRow("A", "UBER_DAAS", "primera"), makeRow("A", "RAPPI_CARGO", "segunda")]);
  assert.equal(result.rows[0][REQUIRED_COLUMNS.indexOf("Restaurant")], "primera");
  assert.equal(result.rows[0][REQUIRED_COLUMNS.indexOf("Repartido por")], "UBER_DAAS");
});

test("6. El orden relativo original se conserva", () => {
  const result = cleanRows([...REQUIRED_COLUMNS], [makeRow("3", "UBER_DAAS"), makeRow("1", "OTRO"), makeRow("2", "DIDI_DELIVERY")]);
  assert.deepEqual(result.rows.map((row) => row[0]), ["3", "2"]);
  assert.deepEqual(result.sourceIndices, [0, 2]);
});

test("7. La salida contiene exactamente las 22 columnas en el orden requerido", () => {
  const shuffled = ["extra", ...REQUIRED_COLUMNS.slice().reverse()];
  const source = shuffled.map((column) => column === "orderId" ? "1" : column === "Repartido por" ? "UBER_DAAS" : column);
  const result = cleanRows(shuffled, [source]);
  assert.deepEqual(result.columns, REQUIRED_COLUMNS);
  assert.equal(result.rows[0].length, 22);
});

test("8. El nombre descargado conserva el nombre base y agrega _LIMPIO", () => {
  assert.equal(buildCleanFilename("Sep 2026.xlsx"), "Sep 2026_LIMPIO.xlsx");
});

test("9. El total final reconcilia con filtro menos duplicados", () => {
  const result = cleanRows([...REQUIRED_COLUMNS], [makeRow("1", "UBER_DAAS"), makeRow("1", "UBER_DAAS"), makeRow("2", "OTRO")]);
  assert.equal(result.summary.final, result.summary.providerFiltered - result.summary.duplicatesRemoved);
});

test("10. Los conteos por proveedor suman el total final", () => {
  const result = cleanRows([...REQUIRED_COLUMNS], ALLOWED_PROVIDERS.map((provider, index) => makeRow(String(index), provider)));
  assert.equal(Object.values(result.summary.providers).reduce((sum, value) => sum + value, 0), result.summary.final);
});

test("11. La validación detecta una salida manipulada y bloqueable", () => {
  const result = cleanRows([...REQUIRED_COLUMNS], [makeRow("1", "UBER_DAAS")]);
  result.rows.push([...result.rows[0]]);
  assert.equal(validateCleanResult(result).passed, false);
});
