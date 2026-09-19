const number = new Intl.NumberFormat("es-MX");
const decimal = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const percent = (value) => `${decimal.format(value)}%`;
const minutes = (value) => value === null ? "No disponible" : `${decimal.format(value)} min`;
const distance = (value) => value === null ? "No disponible" : decimal.format(value);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]);

function table(headers, rows) {
  if (!rows.length) return '<p class="empty-state">No hay registros para mostrar.</p>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function metric(label, value, note) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}

export function renderLoadSummary(container, report) {
  const teikit = report.brands.TEIKIT.summary.total, lucky = report.brands.LUCKY.summary.total;
  container.innerHTML = [
    ["Filas leídas", report.rows.length], ["TEIKIT", teikit], ["LUCKY", lucky], ["Sin clasificar", report.validation.unclassifiedCount],
  ].map(([label, value]) => `<div class="summary-item"><span>${label}</span><strong>${number.format(value)}</strong></div>`).join("");
}

export function renderValidation(container, report, missingOptional) {
  const items = [
    `Métodos de pago encontrados: ${report.validation.paymentValues.join(", ") || "sin datos"}.`,
    `Proveedores encontrados: ${report.validation.providerValues.join(", ") || "sin datos"}.`,
    report.validation.unexpectedPayments.length ? `Métodos adicionales o vacíos: ${report.validation.unexpectedPayments.join(", ")}.` : "No se encontraron métodos de pago adicionales ni vacíos.",
    report.validation.unexpectedProviders.length ? `Proveedores adicionales o vacíos: ${report.validation.unexpectedProviders.join(", ")}.` : "No se encontraron proveedores adicionales ni vacíos.",
    report.validation.unclassifiedCount ? `${number.format(report.validation.unclassifiedCount)} órdenes quedaron sin clasificar entre TEIKIT y LUCKY.` : "Todas las órdenes se clasificaron como TEIKIT o LUCKY.",
  ];
  if (missingOptional.length) items.push(`Columnas opcionales no encontradas: ${missingOptional.join(", ")}. Los indicadores dependientes se muestran como no disponibles.`);
  container.innerHTML = `<ul class="validation-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

export function renderBrandNavigation(container, activeBrand, onSelect) {
  container.replaceChildren();
  ["TEIKIT", "LUCKY"].forEach((brand) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "brand-tab"; button.role = "tab";
    button.textContent = brand; button.setAttribute("aria-selected", String(brand === activeBrand));
    button.addEventListener("click", () => onSelect(brand)); container.append(button);
  });
}

export function renderBrandReport(container, report) {
  const s = report.summary;
  const metrics = [
    metric("Órdenes totales", number.format(s.total), "Todos los estatus"),
    metric("Entregadas COMPLETE", number.format(s.delivered), `${percent(s.deliveredPercentage)} de órdenes totales`),
    metric("No entregadas", number.format(s.notDelivered), `${percent(s.notDeliveredPercentage)} de órdenes totales`),
    metric("Tiempo promedio", minutes(s.averageDeliveryTime), `${number.format(s.validSla)} COMPLETE con tiempo válido`),
    metric("Tiempo mediano", minutes(s.medianDeliveryTime), `${number.format(s.validSla)} COMPLETE con tiempo válido`),
    metric("<45 min", number.format(s.under45), `${percent(s.under45Percentage)} de COMPLETE con tiempo calculable`),
    metric("45–60 min", number.format(s.between45And60), `${percent(s.between45And60Percentage)} de COMPLETE con tiempo calculable`),
    metric(">60 min", number.format(s.over60), `${percent(s.over60Percentage)} de COMPLETE con tiempo calculable`),
    metric("CASH", number.format(s.cash), `${percent(s.cashPercentage)} de órdenes totales`),
    metric("CREDIT CARD", number.format(s.creditCard), `${percent(s.creditCardPercentage)} de órdenes totales`),
    metric("Distancia promedio", distance(s.averageDistance), `${number.format(s.validDistances)} valores numéricos`),
  ].join("");
  const providerRows = report.providers.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${number.format(row.count)}</td><td>${percent(row.percentage)}</td></tr>`);
  const branchProviderPercentage = (row, provider) => row.providers.find((item) => item.label === provider)?.percentage || 0;
  const branchRows = report.branches.map((row) => `<tr><td>${escapeHtml(row.restaurant)}</td><td>${number.format(row.total)}</td><td>${number.format(row.complete)}</td><td>${percent(row.completePercentage)}</td><td>${number.format(row.notDelivered)}</td><td>${percent(row.notDeliveredPercentage)}</td><td>${number.format(row.under45)}</td><td>${percent(row.under45Percentage)}</td><td>${number.format(row.between45And60)}</td><td>${percent(row.between45And60Percentage)}</td><td>${number.format(row.over60)}</td><td>${percent(row.over60Percentage)}</td><td>${minutes(row.averageDeliveryTime)}</td><td>${number.format(row.cash)}</td><td>${number.format(row.creditCard)}</td><td>${distance(row.averageDistance)}</td><td>${percent(branchProviderPercentage(row, "UBER_DAAS"))}</td><td>${percent(branchProviderPercentage(row, "RAPPI_CARGO"))}</td><td>${percent(branchProviderPercentage(row, "DIDI_DELIVERY"))}</td></tr>`);
  const incidents = report.incidents.map((group) => `<div class="incidence-block"><h3>${group.status} (${number.format(group.total)})</h3>${table(["Sucursal", "Motivo", "Cantidad", "Porcentaje"], group.reasons.map((row) => `<tr><td>${escapeHtml(row.restaurant)}</td><td>${escapeHtml(row.label)}</td><td>${number.format(row.count)}</td><td>${percent(row.percentage)}</td></tr>`))}</div>`).join("");
  container.innerHTML = `<div class="brand-dashboard"><h2 class="brand-heading">${report.brand}</h2><section aria-labelledby="summary-${report.brand}"><div class="panel-heading"><div><h2 id="summary-${report.brand}">Resumen general</h2><p>Indicadores operativos consolidados de la marca.</p></div></div><div class="metric-grid">${metrics}</div></section><section class="report-panel"><div class="panel-heading"><div><h2>Proveedores logísticos</h2><p>Participación sobre todas las órdenes de la marca.</p></div></div>${table(["Proveedor", "Órdenes", "Participación"], providerRows)}</section><section class="report-panel"><div class="panel-heading"><div><h2>Sucursales</h2><p>El restaurante completo se utiliza como sucursal.</p></div></div>${table(["Sucursal", "Total", "COMPLETE", "% COMPLETE", "No entregadas", "% no entregadas", "<45", "% <45", "45–60", "% 45–60", ">60", "% >60", "Tiempo promedio", "CASH", "CREDIT CARD", "Distancia promedio", "UBER_DAAS %", "RAPPI_CARGO %", "DIDI_DELIVERY %"], branchRows)}</section><section class="report-panel"><div class="panel-heading"><div><h2>Incidencias</h2><p>Las incidencias se agrupan por sucursal y motivo dentro de cada estatus.</p></div></div><div class="incidence-grid">${incidents}</div></section></div>`;
}
