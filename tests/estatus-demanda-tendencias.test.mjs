import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalysis, prepareDataset } from "../js/modules/estatus-demanda-tendencias/analytics.js";
import { applyFilters, emptyFilters } from "../js/modules/estatus-demanda-tendencias/filters.js";
import { canonicalizeBrand } from "../js/modules/estatus-demanda-tendencias/brand-canonicalization.js";
import { identifyBrand } from "../js/modules/estatus-demanda-tendencias/normalizer.js";

const makeRow = (index, restaurant, status, provider, createdAt, city = "CDMX", zone = "Centro", rejectionReason = "") => ({
  index,
  values: { restaurant, status, provider, createdAt, city, zone, rejectionReason, orderId: String(index) },
});

const source = [
  makeRow(1, "Teikit - Aragón", "COMPLETE", "UBER_DAAS", "01/09/2026 10:15"),
  makeRow(2, "Lucky Sushi - Taxqueña", "CANCELLED", "RAPPI_CARGO", "01/09/2026 10:45", "CDMX", "Centro", "Cliente"),
  makeRow(3, "294 KFC CARMELO PEREZ", "REJECTED", "DIDI_DELIVERY", "02/09/2026 18:00", "CDMX", "Sur", ""),
  makeRow(4, "294 KFC CARMELO PEREZ", "RETURNED", "UBER_DAAS", "02/09/2026 18:30", "CDMX", "Sur", "Producto"),
  makeRow(5, "Okuma Lapizlázuli", "RETURNING", "UBER_DAAS", "03/09/2026 23:00", "CDMX", "Sur"),
  makeRow(6, "Restaurante Independiente", "ACCEPTED", "RAPPI_CARGO", "03/09/2026 08:00", "Puebla", "Centro"),
  makeRow(7, "348 KFC CULHUACÁN", "COMPLETE", "PROVEEDOR_EXTERNO", "03/09/2026 08:00"),
];

const dataset = prepareDataset(source);
const analysis = buildAnalysis(dataset.universe);

test("1. El universo incluye únicamente proveedores permitidos", () => {
  assert.equal(dataset.universe.length, 6);
  assert.equal(dataset.counts.excludedProvider, 1);
});
test("2. Órdenes totales usa todos los estatus del universo", () => assert.equal(analysis.summary.total, 6));
test("3. COMPLETE se cuenta como entregada", () => assert.equal(analysis.summary.complete, 1));
test("4. No entregadas suma CANCELLED, REJECTED y RETURNED", () => assert.equal(analysis.summary.notDelivered, 3));
test("5. Porcentajes utilizan el total del contexto", () => {
  assert.ok(Math.abs(analysis.summary.completePercentage - 100 / 6) < 1e-10);
  assert.equal(analysis.summary.notDeliveredPercentage, 50);
});
test("6. Otros estatus no se clasifican como no entregados", () => assert.equal(analysis.summary.otherStatuses, 2));
test("7. Todos los estatus encontrados permanecen visibles", () => assert.deepEqual(new Set(analysis.statuses.map((row) => row.label)), new Set(["COMPLETE", "CANCELLED", "REJECTED", "RETURNED", "RETURNING", "ACCEPTED"])));
test("8. Demanda por fecha usa todas las órdenes del universo", () => assert.deepEqual(analysis.trend.map((row) => [row.label, row.total]), [["2026-09-01", 2], ["2026-09-02", 2], ["2026-09-03", 2]]));
test("9. Demanda por hora presenta 24 horas", () => {
  assert.equal(analysis.byHour.length, 24);
  assert.equal(analysis.byHour.find((row) => row.label === "10").total, 2);
  assert.equal(analysis.byHour.find((row) => row.label === "11").total, 0);
});
test("10. Agrupación por proveedor conserva cantidades", () => assert.deepEqual(analysis.byProvider.map((row) => [row.label, row.total]), [["UBER_DAAS", 3], ["RAPPI_CARGO", 2], ["DIDI_DELIVERY", 1]]));
test("11. Agrupación por sucursal no fusiona nombres", () => assert.equal(analysis.byRestaurant.length, 5));
test("12. La marca se obtiene de la relación exacta del catálogo maestro", () => {
  assert.equal(identifyBrand("Teikit - Aragón"), "TEIKIT");
  assert.equal(identifyBrand("lucky sushi - taxqueña"), "LUCKY");
  assert.equal(identifyBrand("294 kfc carmelo perez"), "KFC");
});
test("13. Una marca desconocida no se inventa", () => {
  assert.equal(identifyBrand("Restaurante Independiente"), "Sin marca identificada");
  assert.equal(identifyBrand("Pastelería Centro"), "Sin marca identificada");
  assert.equal(identifyBrand("El Pollo Feliz"), "Sin marca identificada");
  assert.equal(analysis.unknownBrandCount, 1);
});
test("14. El catálogo maestro tolera acentos, mayúsculas y mojibake sin inferir por prefijo", () => {
  assert.equal(identifyBrand("348 KFC CULHUACÃN"), "KFC");
  assert.equal(identifyBrand("371 KFC PLAZA CENTRALâ€‹"), "KFC");
  assert.equal(identifyBrand("559 KFC PATIO QUERÃ‰TARO"), "KFC");
  assert.equal(identifyBrand("Okuma Lapizlazuli"), "Okuma");
  assert.equal(identifyBrand("Caty PastelerÃ­a FÃ©lix U. GÃ³mez"), "Caty Pastelería");
  assert.equal(identifyBrand("KFC SUCURSAL NO CATALOGADA"), "Sin marca identificada");
});
test("15. Motivos permanecen separados por estatus y vacío tiene etiqueta", () => {
  const rejected = analysis.incidents.find((group) => group.status === "REJECTED");
  assert.equal(rejected.rows[0].reason, "Sin motivo registrado");
  assert.equal(rejected.rows[0].percentage, 100);
  assert.equal(analysis.incidents.find((group) => group.status === "CANCELLED").rows[0].reason, "Cliente");
});
test("16. Filtros recalculan totales y porcentajes", () => {
  const filters = { ...emptyFilters(), brand: "KFC", status: "REJECTED" };
  const filtered = buildAnalysis(applyFilters(dataset.universe, filters));
  assert.equal(filtered.summary.total, 1);
  assert.equal(filtered.summary.rejected, 1);
  assert.equal(filtered.statuses[0].percentage, 100);
});
test("17. Filtro de periodo excluye filas fuera del intervalo", () => {
  const filtered = applyFilters(dataset.universe, { ...emptyFilters(), start: "2026-09-02", end: "2026-09-02" });
  assert.equal(filtered.length, 2);
});
test("18. RETURNING y ACCEPTED permanecen en el total sin alterar no entregadas", () => {
  const other = buildAnalysis(dataset.universe.filter((row) => ["RETURNING", "ACCEPTED"].includes(row.status)));
  assert.equal(other.summary.total, 2);
  assert.equal(other.summary.notDelivered, 0);
});
test("19. Las cuatro equivalencias aprobadas producen etiquetas canónicas", () => {
  assert.equal(canonicalizeBrand("Chamorros del puerto"), "Chamorros del Puerto");
  assert.equal(canonicalizeBrand("Lecaroz"), "LECAROZ");
  assert.equal(canonicalizeBrand("Delicias del Contry"), "Delicias Del Contry");
  assert.equal(canonicalizeBrand("Esquitemanía"), "Esquitemania");
});
test("20. La canonicalización se aplica después de identificar la sucursal exacta", () => {
  assert.equal(identifyBrand("Chamorros del puerto - Boca del Rio"), "Chamorros del Puerto");
  assert.equal(identifyBrand("Lecaroz Lorenzo Boturini"), "LECAROZ");
  assert.equal(identifyBrand("Delicias del Contry Apodaca"), "Delicias Del Contry");
  assert.equal(identifyBrand("Esquitemanía Polanco"), "Esquitemania");
});
test("21. Los candidatos similares no aprobados permanecen separados", () => {
  assert.equal(canonicalizeBrand("Church ́s Chicken"), "Church ́s Chicken");
  assert.equal(canonicalizeBrand("Church's chiken"), "Church's chiken");
  assert.equal(canonicalizeBrand("El Gallo"), "El Gallo");
  assert.equal(canonicalizeBrand("Pez Gallo"), "Pez Gallo");
  assert.equal(canonicalizeBrand("Habemus Alitas"), "Habemus Alitas");
  assert.equal(canonicalizeBrand("Habemus Alitas Contry"), "Habemus Alitas Contry");
});
