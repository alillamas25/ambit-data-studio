import assert from "node:assert/strict";
import ExcelJS from "../js/vendor/exceljs.min.js";
import { buildReport } from "../js/modules/reporte-teikit-lucky/calculations.js";

let exportedBlob;
globalThis.window = { ExcelJS };
globalThis.document = {
  body: { append() {} },
  createElement() { return { click() {}, remove() {} }; },
};
URL.createObjectURL = (blob) => { exportedBlob = blob; return "blob:test"; };
URL.revokeObjectURL = () => {};

const row = (index, values) => ({ index, values: {
  orderId: String(index + 1), restaurant: "", status: "", plannedOrder: "", officialTime: "",
  createdAt: "", completedAt: "", cookingTime: "", paymentMethod: "", provider: "",
  distance: "", rejectionReason: "", ...values,
} });

const rows = [
  row(0, { restaurant: "TEIKIT Centro", status: "COMPLETE", plannedOrder: 1, officialTime: 40, createdAt: "01/09/2026 01:00", completedAt: "01/09/2026 10:00", cookingTime: 10, paymentMethod: "CASH", provider: "UBER_DAAS", distance: 2 }),
  row(1, { restaurant: "TEIKIT Centro", status: "COMPLETE", createdAt: "01/09/2026 10:00", completedAt: "01/09/2026 10:55", cookingTime: 10, paymentMethod: "CREDIT_CARD", provider: "RAPPI_CARGO", distance: 4 }),
  row(2, { restaurant: "TEIKIT Norte", status: "REJECTED", paymentMethod: "TRANSFER", provider: "OTRO", rejectionReason: "Cobertura" }),
  row(3, { restaurant: "LUCKY Sur", status: "COMPLETE", plannedOrder: "1", officialTime: 61, paymentMethod: "CASH", provider: "DIDI_DELIVERY", distance: 3 }),
  row(4, { restaurant: "LUCKY Sur", status: "CANCELLED", paymentMethod: "", provider: "", rejectionReason: "" }),
];

const report = buildReport(rows);
const { exportTeikitLuckyReport } = await import("../js/modules/reporte-teikit-lucky/exporter.js");
const result = await exportTeikitLuckyReport({ report, sourceFile: "W37-2026.xlsx" });
assert.deepEqual(result.sheetNames, ["TEIKIT", "LUCKY"]);
assert.equal(result.filename, "Ambit_Reporte_TEIKIT_LUCKY_W37-2026.xlsx");

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(await exportedBlob.arrayBuffer());
assert.equal(workbook.worksheets.length, 2);

for (const brand of ["TEIKIT", "LUCKY"]) {
  const worksheet = workbook.getWorksheet(brand);
  const expected = report.brands[brand];
  assert.equal(worksheet.getCell("A2").value, `Reporte operativo · ${brand}`);
  assert.equal(worksheet.getCell("B8").value, expected.summary.total);
  assert.equal(worksheet.getCell("B15").value, expected.summary.averageDeliveryTime);
  assert.equal(worksheet.getCell("B16").value, expected.summary.medianDeliveryTime);
  assert.equal(worksheet.getCell("B17").value, expected.summary.averageDistance);
  assert.equal(worksheet.getCell("B21").value, expected.summary.under45);
  assert.equal(worksheet.getCell("B22").value, expected.summary.between45And60);
  assert.equal(worksheet.getCell("B23").value, expected.summary.over60);
  assert.equal(worksheet.getCell("B24").value, expected.summary.invalidSla);
  assert.equal(worksheet.getCell("B25").value, expected.summary.scheduledComplete);
  assert.equal(worksheet.getCell("B26").value, expected.summary.nonScheduledComplete);
  assert.equal(worksheet.getCell("B31").value, expected.summary.cash);
  assert.equal(worksheet.getCell("B32").value, expected.summary.creditCard);
  assert.match(JSON.stringify(worksheet.autoFilter), /S/);
  assert.equal(worksheet.views[0].state, "frozen");
  assert.equal(worksheet.views[0].xSplit, 1);
  assert.equal(worksheet.views[0].ySplit, 4);
  assert.equal(worksheet.views[0].topLeftCell, "B5");
  assert.ok(worksheet.rowCount > 45);
  assert.equal(worksheet.getCell("S45").value, "DIDI_DELIVERY %");
  assert.equal(worksheet.getCell("T45").value, null);
}

assert.equal(report.brands.TEIKIT.summary.averageDeliveryTime, 42.5);
assert.equal(report.brands.TEIKIT.summary.scheduledComplete, 1);
assert.equal(report.brands.TEIKIT.summary.nonScheduledComplete, 1);
assert.equal(report.brands.LUCKY.summary.over60, 1);
assert.match(String(workbook.getWorksheet("TEIKIT").getCell("F20").value), /programadas usan Tiempo total/);
const exportedLabels = workbook.worksheets.flatMap((worksheet) => worksheet.getSheetValues().flat().filter(Boolean).map(String));
assert.ok(!exportedLabels.includes("Distancia mínima"));
assert.ok(!exportedLabels.includes("Otros proveedores %"));
assert.ok(!exportedLabels.includes("Sin proveedor %"));
assert.ok(!exportedLabels.some((label) => label === "Denominador" || label.includes("SLA válido")));
for (const worksheet of workbook.worksheets) {
  const headerRows = worksheet.getSheetValues().filter((values) => Array.isArray(values) && values[1] === "Sucursal" && values[2] === "Motivo" && values[3] === "Cantidad" && values[4] === "Porcentaje");
  assert.equal(headerRows.length, 3);
}
console.log("OK: exportación TEIKIT/LUCKY íntegra, dos hojas y reconciliada con el objeto de resultados validado.");
