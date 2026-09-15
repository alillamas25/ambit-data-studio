import test from "node:test";
import assert from "node:assert/strict";
import { mapColumns, normalizeRows } from "../js/modules/tiempos-entrega/column-normalizer.js";
import { prepareDataset } from "../js/modules/tiempos-entrega/metrics.js";
import { analyzeStages, analyzeStagesByStatus } from "../js/modules/tiempos-entrega/validation.js";
import { applyFilters } from "../js/modules/tiempos-entrega/filters.js";

const rows = [
  ["A", "COMPLETE", "UBER_DAAS", 40, 10],
  ["B", "CANCELLED", "UBER_DAAS", 35, ""],
  ["C", "RETURNED", "RAPPI_CARGO", 55, -5],
  ["D", "COMPLETE", "OTRO", 42, 15],
  ["E", "COMPLETE", "", 43, 20],
  ["F", "ACCEPTED", "DIDI_DELIVERY", 65, "texto"],
  ["G", "REJECTED", "DIDI_DELIVERY", 70, 150],
  ["H", " complete ", " uber_daas ", 50, 20],
].map(([orderId, status, provider, official, acceptance], index) => ({
  orderId,
  "Creada en": `0${index + 1}/09/2026 10:00`,
  "Estatus de orden": status,
  "Repartido por": provider,
  "Tiempo total de envio sin cooking time": official,
  "Tiempo de aceptacion de repartidor": acceptance,
  Restaurant: index % 2 ? "Sur" : "Norte",
}));
const { mapping } = mapColumns(Object.keys(rows[0]));
const dataset = prepareDataset(normalizeRows(rows, mapping));
const acceptance = analyzeStages(dataset.stageUniverse, mapping).find((stage) => stage.key === "acceptance");

test("1. COMPLETE + UBER participa en KPI y etapas", () => {
  assert.ok(dataset.analyzed.some((row) => row.values.orderId === "A"));
  assert.ok(dataset.stageUniverse.some((row) => row.values.orderId === "A"));
});
test("2. CANCELLED + UBER participa solo en etapas", () => {
  assert.ok(!dataset.analyzed.some((row) => row.values.orderId === "B"));
  assert.ok(dataset.stageUniverse.some((row) => row.values.orderId === "B"));
});
test("3. RETURNED + RAPPI participa solo en etapas", () => {
  assert.ok(!dataset.analyzed.some((row) => row.values.orderId === "C"));
  assert.ok(dataset.stageUniverse.some((row) => row.values.orderId === "C"));
});
test("4. Proveedor diferente queda fuera de ambos universos", () => {
  assert.ok(!dataset.analyzed.some((row) => row.values.orderId === "D"));
  assert.ok(!dataset.stageUniverse.some((row) => row.values.orderId === "D"));
});
test("5. Proveedor vacío queda fuera de ambos universos", () => {
  assert.ok(!dataset.analyzed.some((row) => row.values.orderId === "E"));
  assert.ok(!dataset.stageUniverse.some((row) => row.values.orderId === "E"));
});
test("6. Tiempo vacío no se convierte en cero", () => {
  assert.equal(acceptance.withDataCount, 5);
  assert.equal(acceptance.validCount, 3);
});
test("7. Tiempo negativo se contabiliza como inválido y no afecta los estadísticos", () => {
  assert.equal(acceptance.invalidCount, 2);
  assert.equal(acceptance.average, 60);
  assert.equal(acceptance.median, 20);
});
test("8. Tiempo positivo alto permanece incluido", () => {
  const rejected = analyzeStagesByStatus(dataset.stageUniverse, mapping).find((group) => group.status === "REJECTED");
  assert.equal(rejected.stages.acceptance.average, 150);
});
test("9. Los filtros mantienen independientes los universos KPI y etapas", () => {
  const filters = { start: "", end: "", day: "", hour: "", restaurant: "Sur", zone: "", city: "", provider: "", brand: "" };
  const sla = applyFilters(dataset.analyzed, filters);
  const stages = applyFilters(dataset.stageUniverse, filters);
  assert.deepEqual(sla.map((row) => row.values.orderId), ["H"]);
  assert.deepEqual(stages.map((row) => row.values.orderId), ["B", "F", "H"]);
});

test("10. El promedio y la mediana de etapa usan registros individuales", () => {
  const controlled = [10, 20, 30, 40].map((acceptance, index) => ({
    values: { acceptance }, status: "COMPLETE", provider: "UBER_DAAS", index,
  }));
  const result = analyzeStages(controlled, { acceptance: "acceptance" }).find((stage) => stage.key === "acceptance");
  assert.equal(result.average, 25);
  assert.equal(result.median, 25);
});

test("11. Los grupos desbalanceados no producen un promedio de promedios", () => {
  const controlled = [10, 10, 10, 10, 100].map((acceptance, index) => ({
    values: { acceptance }, status: "COMPLETE", provider: index < 4 ? "UBER_DAAS" : "RAPPI_CARGO", index,
  }));
  const result = analyzeStages(controlled, { acceptance: "acceptance" }).find((stage) => stage.key === "acceptance");
  assert.equal(result.average, 28);
  assert.equal(result.median, 10);
});

test("12. Una fracción numérica expresada en minutos no se convierte a días de Excel", () => {
  const controlled = [{ values: { acceptance: 0.5 }, status: "COMPLETE", provider: "UBER_DAAS", index: 1 }];
  const result = analyzeStages(controlled, { acceptance: "acceptance" }).find((stage) => stage.key === "acceptance");
  assert.equal(result.average, 0.5);
  assert.equal(result.median, 0.5);
});
