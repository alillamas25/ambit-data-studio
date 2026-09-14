import { breakdown, calculateMetrics } from "./metrics.js";

const numberFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

function number(value) {
  return value === null || !Number.isFinite(value) ? "—" : numberFormat.format(value);
}

function percent(value) {
  return `${number(value)}%`;
}

function minutes(value) {
  return value === null || !Number.isFinite(value) ? "—" : `${number(value)} min`;
}

export function buildExecutiveSummary(rows) {
  const metrics = calculateMetrics(rows);
  if (!metrics.count) {
    return { text: "No hay órdenes que coincidan con los filtros seleccionados.", observations: [] };
  }

  const text = `Se analizaron ${number(metrics.count)} órdenes completadas. El ${percent(metrics.under45.percentage)} se encuentra por debajo de 45 minutos y el ${percent(metrics.under60.percentage)} por debajo de 60 minutos. El tiempo promedio fue de ${minutes(metrics.average)} y la mediana de ${minutes(metrics.median)}. El ${percent(metrics.over60.percentage)} superó los 60 minutos.`;
  const observations = [];
  const providers = breakdown(rows, "provider").filter((item) => item.count >= 3);
  if (providers.length > 1) {
    const fastest = [...providers].sort((a, b) => a.average - b.average)[0];
    const slowest = [...providers].sort((a, b) => b.average - a.average)[0];
    if (slowest.average - fastest.average >= 5) observations.push(`${fastest.label} registra un promedio ${number(slowest.average - fastest.average)} minutos menor que ${slowest.label}.`);
  }
  const restaurants = breakdown(rows, "restaurant").filter((item) => item.label !== "Sin información" && item.count >= 5);
  if (restaurants.length) {
    const highest = [...restaurants].sort((a, b) => b.over60.percentage - a.over60.percentage)[0];
    if (highest.over60.percentage >= 20) observations.push(`${highest.label} concentra ${percent(highest.over60.percentage)} de sus órdenes por encima de 60 minutos.`);
  }
  return { text, observations };
}
