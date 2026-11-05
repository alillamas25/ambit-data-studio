import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, buildReportReference } from "../js/modules/reporte-teikit-lucky/calculations.js";
import { createReportAccumulator } from "../js/modules/reporte-teikit-lucky/incremental-accumulator.js";

const row = (index, values) => ({ index: index + 2, values: {
  restaurant: "Teikit Centro", status: "COMPLETE", createdAt: "01/10/2026 10:00",
  completedAt: "01/10/2026 10:50", cookingTime: 10, plannedOrder: null, officialTime: null,
  paymentMethod: "CASH", provider: "UBER_DAAS", distance: 3, rejectionReason: null,
  ...values,
} });

const rows = [
  row(0, {}),
  row(1, { completedAt: "01/10/2026 11:05", paymentMethod: "CREDIT_CARD", provider: "RAPPI_CARGO", distance: 5 }),
  row(2, { plannedOrder: 1, officialTime: 0.5, provider: "DIDI_DELIVERY" }),
  row(3, { plannedOrder: 1, officialTime: "", provider: "", paymentMethod: "" }),
  row(4, { status: "CANCELLED", rejectionReason: "Cliente" }),
  row(5, { status: "REJECTED", restaurant: "Teikit Norte", rejectionReason: "" }),
  row(6, { status: "RETURNED", restaurant: "Teikit Norte", paymentMethod: "TRANSFER", provider: "OTHER" }),
  row(7, { status: "RETURNING", restaurant: "Teikit Norte" }),
  row(8, { restaurant: "Lucky Sushi Sur", completedAt: "01/10/2026 11:20", cookingTime: 20, distance: null }),
  row(9, { restaurant: "Lucky Sushi Sur", plannedOrder: "1", officialTime: 75, paymentMethod: "CARD_ON_DELIVERY" }),
  row(10, { restaurant: "Lucky Sushi Sur", status: "CANCELLED", rejectionReason: "Cliente" }),
  row(11, { restaurant: "Otra marca", status: "COMPLETE", paymentMethod: "TRANSFER", provider: "OTHER" }),
];

function analyticsOnly(report) {
  const copy = structuredClone(report);
  copy.rows = { length: report.rows.length };
  Object.values(copy.brands).forEach((brand) => { brand.rows = { length: brand.rows.length }; });
  return copy;
}

test("buildReport incremental coincide con el motor anterior en todos los indicadores", () => {
  assert.deepEqual(analyticsOnly(buildReport(rows)), analyticsOnly(buildReportReference(rows)));
});

test("el acumulador por fila produce exactamente el mismo resultado que buildReport", () => {
  const accumulator = createReportAccumulator();
  rows.forEach((item) => accumulator.consume(item));
  assert.deepEqual(accumulator.finish(), buildReport(rows));
});

test("las medianas exactas conservan los valores necesarios sin guardar órdenes completas", () => {
  const report = buildReport(rows);
  assert.equal(report.rows.length, rows.length);
  assert.equal(Array.isArray(report.rows), false);
  assert.equal(Array.isArray(report.brands.TEIKIT.rows), false);
  assert.equal(report.brands.TEIKIT.summary.medianDeliveryTime, 40);
  assert.equal(report.brands.LUCKY.summary.medianDeliveryTime, 67.5);
});
