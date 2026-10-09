const integer = new Intl.NumberFormat("es-MX");
const decimal = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const pct = (value) => `${decimal.format(value)}%`;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function table(headers, rows) {
  const wrap = element("div", "table-wrap");
  const tableNode = element("table", "data-table");
  const head = element("thead");
  const headRow = element("tr");
  headers.forEach((header) => headRow.append(element("th", "", header)));
  head.append(headRow);
  const body = element("tbody");
  rows.forEach((values) => {
    const row = element("tr");
    values.forEach((value) => row.append(element("td", "", value)));
    body.append(row);
  });
  tableNode.append(head, body); wrap.append(tableNode); return wrap;
}

function panel(title, description, ...contents) {
  const section = element("section", "analysis-panel");
  const heading = element("div", "panel-heading");
  const copy = element("div"); copy.append(element("h2", "", title), element("p", "", description));
  heading.append(copy); section.append(heading, ...contents); return section;
}

function breakdownRows(rows, provider = false) {
  return rows.map((row) => provider
    ? [row.label, integer.format(row.total), pct(row.participation), integer.format(row.complete), pct(row.completePercentage), integer.format(row.notDelivered), pct(row.notDeliveredPercentage)]
    : [row.label, integer.format(row.total), integer.format(row.complete), pct(row.completePercentage), integer.format(row.notDelivered), pct(row.notDeliveredPercentage)]);
}

function barChart(data, valueKey, emptyMessage = "No hay información disponible.") {
  if (!data.length || !Math.max(...data.map((item) => item[valueKey] || 0))) return element("p", "analysis-note", emptyMessage);
  const wrapper = element("div", "chart-bars");
  const max = Math.max(...data.map((item) => item[valueKey] || 0));
  data.forEach((item) => {
    const row = element("div", "chart-bar-row");
    row.append(element("span", "chart-bar-label", item.label));
    const track = element("div", "chart-bar-track");
    const fill = element("div", "chart-bar-fill"); fill.style.width = `${item[valueKey] / max * 100}%`; track.append(fill);
    row.append(track, element("strong", "", integer.format(item[valueKey]))); wrapper.append(row);
  });
  return wrapper;
}

function trendChart(data) {
  if (!data.length) return element("p", "analysis-note", "No existen fechas válidas para construir la tendencia.");
  const width = 900, height = 260, pad = 42;
  const maxOrders = Math.max(1, ...data.map((item) => item.total));
  const x = (index) => data.length === 1 ? width / 2 : pad + index * (width - pad * 2) / (data.length - 1);
  const yOrders = (value) => height - pad - value / maxOrders * (height - pad * 2);
  const yRate = (value) => height - pad - value / 100 * (height - pad * 2);
  const orders = data.map((item, index) => `${x(index)},${yOrders(item.total)}`).join(" ");
  const rates = data.map((item, index) => `${x(index)},${yRate(item.notDeliveredPercentage)}`).join(" ");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.classList.add("trend-chart");
  svg.innerHTML = `<line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="chart-axis"/><polyline points="${orders}" class="trend-orders"/><polyline points="${rates}" class="trend-rate"/>`;
  const wrap = element("div", "trend-wrap");
  const legend = element("div", "chart-legend"); legend.append(element("span", "legend-orders", "Órdenes totales"), element("span", "legend-rate", "% no entregadas"));
  wrap.append(legend, svg);
  const labels = element("div", "trend-labels");
  const step = Math.max(1, Math.ceil(data.length / 8));
  data.forEach((item, index) => { if (index % step === 0 || index === data.length - 1) labels.append(element("span", "", item.label)); });
  wrap.append(labels); return wrap;
}

export function renderLoadSummary(container, counts) {
  const values = [["Filas leídas", counts.loaded], ["Universo analizado", counts.universe], ["Proveedor no permitido", counts.excludedProvider], ["Fechas inválidas", counts.invalidDates], ["Sin marca identificada", counts.unknownBrands]];
  container.replaceChildren(...values.map(([label, value]) => { const item = element("div", "summary-item"); item.append(element("span", "", label), element("strong", "", integer.format(value))); return item; }));
}

export function renderKpis(container, analysis) {
  const s = analysis.summary;
  const values = [
    ["Órdenes totales", s.total, "Todos los estatus"],
    ["Entregadas", s.complete, pct(s.completePercentage)],
    ["No entregadas", s.notDelivered, pct(s.notDeliveredPercentage)],
    ["COMPLETE", s.complete, pct(s.completePercentage)],
    ["CANCELLED", s.cancelled, pct(s.total ? s.cancelled / s.total * 100 : 0)],
    ["REJECTED", s.rejected, pct(s.total ? s.rejected / s.total * 100 : 0)],
    ["RETURNED", s.returned, pct(s.total ? s.returned / s.total * 100 : 0)],
    ["Otros estatus", s.otherStatuses, pct(s.total ? s.otherStatuses / s.total * 100 : 0)],
  ];
  container.replaceChildren(...values.map(([label, value, note]) => { const card = element("article", "kpi"); card.append(element("span", "", label), element("strong", "", integer.format(value)), element("small", "", note)); return card; }));
}

export function renderAnalysis(container, analysis) {
  const statusTable = table(["Estatus", "Cantidad", "Porcentaje"], analysis.statuses.map((row) => [row.label, integer.format(row.count), pct(row.percentage)]));
  const topDates = [...analysis.trend].sort((a, b) => b.total - a.total).slice(0, 10);
  const topHours = [...analysis.byHour].sort((a, b) => b.total - a.total).slice(0, 10).map((row) => ({ ...row, label: `${String(row.label).padStart(2, "0")}:00` }));
  const dateTable = table(["Fecha", "Total", "COMPLETE", "% COMPLETE", "No entregadas", "% no entregadas", "CANCELLED", "REJECTED", "RETURNED"], analysis.trend.map((row) => [row.label, integer.format(row.total), integer.format(row.complete), pct(row.completePercentage), integer.format(row.notDelivered), pct(row.notDeliveredPercentage), integer.format(row.cancelled), integer.format(row.rejected), integer.format(row.returned)]));
  const dayTable = table(["Día", "Órdenes", "Participación"], analysis.byDay.map((row) => [row.label, integer.format(row.total), pct(analysis.summary.total ? row.total / analysis.summary.total * 100 : 0)]));
  const hourTable = table(["Hora", "Órdenes", "Participación"], analysis.byHour.map((row) => [`${String(row.label).padStart(2, "0")}:00`, integer.format(row.total), pct(analysis.summary.total ? row.total / analysis.summary.total * 100 : 0)]));
  const commonHeaders = ["Dimensión", "Total", "COMPLETE", "% COMPLETE", "No entregadas", "% no entregadas"];
  const incidents = element("div", "incident-sections");
  analysis.incidents.forEach((group) => incidents.append(panel(`${group.status} (${integer.format(group.total)})`, `Porcentaje sobre ${group.status} dentro de los filtros actuales.`, table(["Sucursal", "Motivo", "Cantidad", "Porcentaje"], group.rows.map((row) => [row.restaurant, row.reason, integer.format(row.count), pct(row.percentage)])))));
  const control = analysis.unknownBrandCount ? element("p", "control-warning", `${integer.format(analysis.unknownBrandCount)} órdenes están clasificadas como “Sin marca identificada”.`) : element("p", "control-ok", "Todas las órdenes del resultado filtrado tienen una marca identificada.");

  const peakCharts = element("div", "chart-grid");
  peakCharts.append(barChart(topDates, "total"), barChart(topHours, "total"));
  container.replaceChildren(
    panel("Estatus encontrados", "Todos los valores detectados en Estatus de orden.", statusTable),
    panel("Tendencia por fecha", "Demanda y tasa de no entrega se muestran juntas sin inferir causalidad.", trendChart(analysis.trend), dateTable),
    panel("Picos de demanda", "Fechas y horas se calculan con todas las órdenes del universo filtrado.", peakCharts),
    panel("Demanda por día de semana", "Distribución basada en Creada en.", barChart(analysis.byDay, "total"), dayTable),
    panel("Demanda por hora", "Se muestran las 24 horas, incluso cuando alguna tiene cero órdenes.", barChart(analysis.byHour.map((row) => ({ ...row, label: `${String(row.label).padStart(2, "0")}:00` })), "total"), hourTable),
    panel("Desempeño por sucursal", "Ordenado por volumen descendente.", table(["Sucursal", ...commonHeaders.slice(1)], breakdownRows(analysis.byRestaurant))),
    panel("Desempeño por marca", "La marca se obtiene del catálogo centralizado.", control, table(["Marca", ...commonHeaders.slice(1)], breakdownRows(analysis.byBrand))),
    panel("Desempeño por ciudad", "Los vacíos se conservan como Sin ciudad.", table(["Ciudad", ...commonHeaders.slice(1)], breakdownRows(analysis.byCity))),
    panel("Desempeño por zona", "Los vacíos se conservan como Sin zona.", table(["Zona", ...commonHeaders.slice(1)], breakdownRows(analysis.byZone))),
    panel("Participación de proveedores", "Participación sobre todas las órdenes del resultado filtrado.", barChart(analysis.byProvider, "total"), table(["Proveedor", "Total", "Participación %", "COMPLETE", "% COMPLETE", "No entregadas", "% no entregadas"], breakdownRows(analysis.byProvider, true))),
    panel("Incidencias", "CANCELLED, REJECTED y RETURNED permanecen separados.", incidents),
  );
}
