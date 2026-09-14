import { breakdown, calculateMetrics } from "./metrics.js";
import { analyzeStages, compareStageSum, compareWithoutWait, validateCalculatedTimes, validateIndicators } from "./validation.js";
import { buildExecutiveSummary } from "./summary.js";

const numberFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

export const formatNumber = (value) => value === null || !Number.isFinite(value) ? "—" : numberFormat.format(value);
export const formatPercent = (value) => `${formatNumber(value)}%`;
export const formatMinutes = (value) => value === null || !Number.isFinite(value) ? "—" : `${formatNumber(value)} min`;

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function renderLoadSummary(container, counts) {
  const entries = [
    ["Órdenes cargadas", counts.total],
    ["Estatus COMPLETE", counts.complete],
    ["Elegibles", counts.eligible],
    ["Excluidas por estatus", counts.excludedStatus],
    ["Excluidas por proveedor", counts.excludedProvider],
  ];
  container.replaceChildren(...entries.map(([label, value]) => {
    const item = create("div", "summary-item");
    item.append(create("span", "", label), create("strong", "", formatNumber(value)));
    return item;
  }));
}

export function renderKpis(container, rows) {
  const metrics = calculateMetrics(rows);
  const entries = [
    ["Órdenes analizadas", formatNumber(metrics.count), "registros"],
    ["Menor a 45 min", formatNumber(metrics.under45.count), formatPercent(metrics.under45.percentage)],
    ["Menor a 60 min", formatNumber(metrics.under60.count), formatPercent(metrics.under60.percentage)],
    ["Entre 45 y 60 min", formatNumber(metrics.between45And60.count), formatPercent(metrics.between45And60.percentage)],
    ["Mayor a 60 min", formatNumber(metrics.over60.count), formatPercent(metrics.over60.percentage)],
    ["Promedio", formatMinutes(metrics.average), "tiempo oficial"],
    ["Mediana", formatMinutes(metrics.median), "tiempo oficial"],
  ];
  container.replaceChildren(...entries.map(([label, value, secondary]) => {
    const card = create("article", "kpi");
    card.append(create("span", "", label), create("strong", "", value), create("small", "", secondary));
    return card;
  }));
  return metrics;
}

function table(headers, rows) {
  const tableElement = create("table", "data-table");
  const head = create("thead");
  const headRow = create("tr");
  headers.forEach((header) => headRow.append(create("th", "", header)));
  head.append(headRow);
  const body = create("tbody");
  rows.forEach((cells) => {
    const row = create("tr");
    cells.forEach((cell) => {
      const td = create("td");
      if (cell instanceof Node) td.append(cell);
      else td.textContent = cell;
      row.append(td);
    });
    body.append(row);
  });
  tableElement.append(head, body);
  return tableElement;
}

function bar(percentage) {
  const track = create("div", "bar-track");
  const fill = create("div", "bar-fill");
  fill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
  track.append(fill);
  return track;
}

export function renderDistribution(container, rows) {
  const metrics = calculateMetrics(rows);
  const groups = [
    ["<45 min", metrics.under45],
    ["45–60 min", metrics.between45And60],
    [">60 min", metrics.over60],
  ];
  container.replaceChildren(
    create("h3", "", "Distribución de tiempos"),
    table(["Rango", "Órdenes", "%", "Distribución"], groups.map(([label, metric]) => [label, formatNumber(metric.count), formatPercent(metric.percentage), bar(metric.percentage)])),
  );
}

export function renderBreakdown(container, rows, field, title) {
  const data = breakdown(rows, field);
  if (!data.length) {
    container.replaceChildren(create("p", "analysis-note", `No hay información disponible para el desglose por ${title.toLowerCase()}.`));
    return;
  }
  const maxCount = Math.max(...data.map((item) => item.count));
  const rowsForTable = data.map((item) => [
    item.label,
    formatNumber(item.count),
    formatMinutes(item.average),
    formatMinutes(item.median),
    `${formatNumber(item.under45.count)} · ${formatPercent(item.under45.percentage)}`,
    `${formatNumber(item.between45And60.count)} · ${formatPercent(item.between45And60.percentage)}`,
    `${formatNumber(item.over60.count)} · ${formatPercent(item.over60.percentage)}`,
    `${formatNumber(item.under60.count)} · ${formatPercent(item.under60.percentage)}`,
    bar(maxCount ? item.count / maxCount * 100 : 0),
  ]);
  container.replaceChildren(
    create("h3", "", title),
    table([title, "Órdenes", "Promedio", "Mediana", "<45", "45–60", ">60", "<60", "Volumen"], rowsForTable),
  );
}

function metricCards(entries) {
  const wrapper = create("div", "metric-cards");
  entries.forEach(([label, value]) => {
    const item = create("div", "metric-card");
    item.append(create("span", "", label), create("strong", "", value));
    wrapper.append(item);
  });
  return wrapper;
}

export function renderStages(container, rows, mapping) {
  const stages = analyzeStages(rows, mapping);
  const stageSum = compareStageSum(rows, mapping);
  const available = stages.filter((stage) => stage.available);
  if (!available.length) {
    container.replaceChildren(create("p", "analysis-note", "El archivo no contiene columnas de tiempos por etapa."));
    return;
  }
  const contents = [create("h3", "", "Tiempos por etapa"), table(
    ["Etapa", "Con información", "Cobertura", "Promedio", "Mediana"],
    available.map((stage) => [stage.label, formatNumber(stage.count), formatPercent(stage.coverage), formatMinutes(stage.average), formatMinutes(stage.median)]),
  )];
  if (stageSum.available) {
    contents.push(create("h3", "", "Suma de etapas frente al tiempo total de envío"));
    contents.push(metricCards([
      ["Comparaciones", formatNumber(stageSum.count)],
      ["Coincidencia aproximada", formatNumber(stageSum.approximate)],
      ["Con diferencia", formatNumber(stageSum.different)],
      ["Diferencia promedio", formatMinutes(stageSum.averageDifference)],
    ]));
  } else {
    contents.push(create("p", "analysis-note", "La suma de etapas requiere Aceptación, Llegar a tienda, Recoger, Entregar y Tiempo total de envío. Tiempo para completar no se incluye."));
  }
  container.replaceChildren(...contents);
}

export function renderWithoutWait(container, rows, mapping) {
  const comparison = compareWithoutWait(rows, mapping);
  if (!comparison.available || !comparison.records.length) {
    container.replaceChildren(create("p", "analysis-note", "No hay información suficiente para comparar el tiempo sin espera de restaurante."));
    return;
  }
  const pickupValues = comparison.records.map((record) => record.pickup).filter((value) => value !== null);
  container.replaceChildren(
    create("h3", "", "Tiempo sin espera de restaurante"),
    metricCards([
      ["Registros comparables", formatNumber(comparison.records.length)],
      ["Total · promedio", formatMinutes(comparison.totalAverage)],
      ["Sin espera · promedio", formatMinutes(comparison.withoutAverage)],
      ["Diferencia · promedio", formatMinutes(comparison.differenceAverage)],
      ["Total · mediana", formatMinutes(comparison.totalMedian)],
      ["Sin espera · mediana", formatMinutes(comparison.withoutMedian)],
      ["Diferencia · mediana", formatMinutes(comparison.differenceMedian)],
      ["Recoger · con datos", formatNumber(pickupValues.length)],
    ]),
    create("p", "analysis-note", "La diferencia se presenta como contexto. No se asume que las columnas deban coincidir matemáticamente."),
  );
}

export function renderValidation(container, rows, mapping) {
  const indicators = validateIndicators(rows, mapping);
  const calculated = validateCalculatedTimes(rows, mapping);
  const contents = [create("h3", "", "Validación de tiempos")];
  if (indicators.available) {
    contents.push(metricCards([
      ["Indicadores comparados", formatNumber(indicators.compared)],
      ["Coincidencias", formatNumber(indicators.matches)],
      ["Diferencias", formatNumber(indicators.differences)],
      ["Registros inconsistentes", formatPercent(indicators.percentage)],
    ]));
  } else {
    contents.push(create("p", "analysis-note", "No están disponibles los indicadores originales de rangos para comparar la clasificación."));
  }
  contents.push(create("h3", "", "Creación → Completado sin Cooking"));
  if (calculated.available && calculated.records.length) {
    contents.push(metricCards([
      ["Comparaciones", formatNumber(calculated.records.length)],
      ["Diferencia >1 min", formatNumber(calculated.over1)],
      ["Diferencia >5 min", formatNumber(calculated.over5)],
      ["Diferencia >10 min", formatNumber(calculated.over10)],
      ["Diferencia promedio", formatMinutes(calculated.average)],
      ["Diferencia mediana", formatMinutes(calculated.median)],
    ]));
    const categories = ["Coincide", "Diferencia menor", "Revisar", "Diferencia importante"].map((category) => [category, calculated.records.filter((record) => record.category === category).length]);
    contents.push(table(["Clasificación", "Órdenes"], categories.map(([label, count]) => [label, formatNumber(count)])));
  } else {
    contents.push(create("p", "analysis-note", "La validación calculada requiere Creada en, Completada en y Cooking Time con valores interpretables."));
  }
  contents.push(create("p", "analysis-note", "Las diferencias señalan registros para revisión; no confirman que el tiempo oficial sea incorrecto. Diferencia con signo = tiempo calculado − tiempo oficial."));
  container.replaceChildren(...contents);
}

export function renderExecutiveSummary(textElement, listElement, rows) {
  const summary = buildExecutiveSummary(rows);
  textElement.textContent = summary.text;
  listElement.replaceChildren(...summary.observations.map((observation) => create("li", "", observation)));
}
