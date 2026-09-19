import test from "node:test";
import assert from "node:assert/strict";
import { calculateBrandReport, prepareReportRows } from "../js/modules/reporte-teikit-lucky/calculations.js";
import { calculateDeliveryMinutes, calculateSlaMinutes, classifySla, identifyBrand, isPlannedOrder } from "../js/modules/reporte-teikit-lucky/rules.js";

const source = [
  ["1", "Teikit Centro", "COMPLETE", "01/09/2026 10:00", "01/09/2026 10:55", 10, "CASH", "UBER_DAAS", 3, ""],
  ["2", "Teikit Centro", "CANCELLED", "", "", "", "CREDIT_CARD", "RAPPI_CARGO", 2, "Cliente"],
  ["3", "Teikit Centro", "REJECTED", "", "", "", "CASH", "DIDI_DELIVERY", "", ""],
  ["4", "Teikit Norte", "RETURNED", "", "", "", "TRANSFER", "OTHER", 5, "Producto"],
  ["5", "Teikit Norte", "RETURNING", "", "", "", "CASH", "", 4, ""],
  ["6", "Lucky Sushi Sur", "COMPLETE", "01/09/2026 10:00", "01/09/2026 11:10", 10, "CREDIT_CARD", "UBER_DAAS", 1, ""],
].map(([orderId, restaurant, status, createdAt, completedAt, cookingTime, paymentMethod, provider, distance, rejectionReason], index) => ({ index, values: { orderId, restaurant, status, createdAt, completedAt, cookingTime, paymentMethod, provider, distance, rejectionReason } }));
const prepared = prepareReportRows(source);
const teikit = calculateBrandReport(prepared, "TEIKIT");

test("1. Todos los estatus cuentan para órdenes totales", () => assert.equal(teikit.summary.total, 5));
test("2. Solo COMPLETE cuenta como entregada", () => assert.equal(teikit.summary.delivered, 1));
test("3. CANCELLED + REJECTED + RETURNED forman no entregadas", () => assert.equal(teikit.summary.notDelivered, 3));
test("4. RETURNING no forma parte de no entregadas", () => assert.equal(teikit.summary.notDeliveredPercentage, 60));
test("5. SLA usa únicamente COMPLETE", () => assert.equal(teikit.summary.validSla, 1));
test("6. SLA usa Completada - Creada - Cooking Time", () => assert.equal(calculateDeliveryMinutes("01/09/2026 10:00", "01/09/2026 10:55", 10), 45));
test("7. Menor a 45 entra en el primer rango", () => assert.equal(classifySla(44.99), "under45"));
test("8. 45 exacto entra en 45–60", () => assert.equal(classifySla(45), "between45And60"));
test("9. 60 exacto entra en 45–60", () => assert.equal(classifySla(60), "between45And60"));
test("10. Mayor a 60 entra en el último rango", () => assert.equal(classifySla(60.01), "over60"));
test("11. Tiempo negativo se excluye", () => assert.equal(calculateDeliveryMinutes("01/09/2026 10:00", "01/09/2026 10:05", 10), null));
test("12. Vacío no se convierte en cero", () => assert.equal(calculateDeliveryMinutes("01/09/2026 10:00", "01/09/2026 10:05", ""), null));
test("13. CASH y CREDIT_CARD se mantienen separados", () => { assert.equal(teikit.summary.cash, 3); assert.equal(teikit.summary.creditCard, 1); });
test("14. Motivos se agrupan por sucursal independientemente dentro de cada estatus", () => { const cancelled = teikit.incidents.find((x) => x.status === "CANCELLED").reasons[0]; assert.equal(cancelled.restaurant, "Teikit Centro"); assert.equal(cancelled.label, "Cliente"); assert.equal(teikit.incidents.find((x) => x.status === "RETURNED").reasons[0].label, "Producto"); });
test("15. Motivo vacío se muestra como Sin motivo registrado", () => assert.equal(teikit.incidents.find((x) => x.status === "REJECTED").reasons[0].label, "Sin motivo registrado"));
test("16. Marca y sucursal se obtienen de Restaurant", () => { assert.equal(identifyBrand("Lucky Sushi Sur"), "LUCKY"); assert.equal(teikit.branches[0].restaurant, "Teikit Centro"); });
test("17. Cooking Time numérico menor a 1 permanece en minutos", () => assert.equal(calculateDeliveryMinutes(new Date("2026-09-01T10:00:00Z"), new Date("2026-09-01T10:01:00Z"), 0.5), 0.5));
test("18. Orden planeada numérica o textual con valor 1 se identifica como programada", () => {
  assert.equal(isPlannedOrder(1), true);
  assert.equal(isPlannedOrder("1"), true);
  assert.equal(isPlannedOrder(0), false);
  assert.equal(isPlannedOrder(""), false);
});
test("19. Una COMPLETE programada usa el tiempo oficial y no la diferencia de fechas", () => {
  assert.equal(calculateSlaMinutes({ plannedOrder: 1, officialTime: 38, createdAt: "01/09/2026 01:00", completedAt: "01/09/2026 10:00", cookingTime: 10 }), 38);
});
test("20. Una COMPLETE no programada conserva Completada - Creada - Cooking Time", () => {
  assert.equal(calculateSlaMinutes({ plannedOrder: "", officialTime: 5, createdAt: "01/09/2026 10:00", completedAt: "01/09/2026 10:55", cookingTime: 10 }), 45);
});
test("21. El tiempo oficial programado menor a 1 permanece en minutos", () => {
  assert.equal(calculateSlaMinutes({ plannedOrder: 1, officialTime: 0.5 }), 0.5);
});
test("22. Tiempo oficial vacío, no numérico, infinito o negativo es inválido", () => {
  assert.equal(calculateSlaMinutes({ plannedOrder: 1, officialTime: "" }), null);
  assert.equal(calculateSlaMinutes({ plannedOrder: 1, officialTime: "texto" }), null);
  assert.equal(calculateSlaMinutes({ plannedOrder: 1, officialTime: Infinity }), null);
  assert.equal(calculateSlaMinutes({ plannedOrder: 1, officialTime: -1 }), null);
});
test("23. Los valores oficiales positivos altos no se eliminan", () => {
  assert.equal(calculateSlaMinutes({ plannedOrder: 1, officialTime: 720 }), 720);
});
test("24. Incidencias iguales de sucursales distintas permanecen en filas separadas", () => {
  const rows = prepareReportRows([
    { index: 0, values: { restaurant: "Teikit Centro", status: "RETURNED", rejectionReason: "Cliente" } },
    { index: 1, values: { restaurant: "Teikit Norte", status: "RETURNED", rejectionReason: "Cliente" } },
  ]);
  const returned = calculateBrandReport(rows, "TEIKIT").incidents.find((group) => group.status === "RETURNED");
  assert.equal(returned.reasons.length, 2);
  assert.deepEqual(returned.reasons.map((item) => item.percentage), [50, 50]);
});
