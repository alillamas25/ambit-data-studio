import { mapColumns, normalizeRows } from "./column-normalizer.js";
import { readOperationalFile } from "./file-reader.js";
import { applyFilters, createFilterOptions, emptyFilters } from "./filters.js";
import { prepareDataset } from "./metrics.js";
import { renderBreakdown, renderDistribution, renderExecutiveSummary, renderKpis, renderLoadSummary, renderStages, renderValidation, renderWithoutWait } from "./dashboard-renderer.js";
import { exportDeliveryAnalysis } from "./exporter.js";

const elements = {
  fileInput: document.querySelector("#file-input"),
  analyzeButton: document.querySelector("#analyze-button"),
  replaceButton: document.querySelector("#replace-button"),
  downloadButton: document.querySelector("#download-button"),
  fileMeta: document.querySelector("#file-meta"),
  message: document.querySelector("#message"),
  dashboard: document.querySelector("#dashboard"),
  loadSummary: document.querySelector("#load-summary"),
  filters: document.querySelector("#filters"),
  clearFilters: document.querySelector("#clear-filters"),
  filteredCount: document.querySelector("#filtered-count"),
  kpiGrid: document.querySelector("#kpi-grid"),
  summaryText: document.querySelector("#summary-text"),
  summaryObservations: document.querySelector("#summary-observations"),
  tabs: document.querySelector("#analysis-tabs"),
  analysisContent: document.querySelector("#analysis-content"),
};

const state = { file: null, dataset: null, mapping: null, filters: emptyFilters(), activeTab: "distribution" };

const tabs = [
  ["distribution", "Distribución"],
  ["date", "Evolución por día"],
  ["hour", "Por hora"],
  ["provider", "Proveedores"],
  ["restaurant", "Restaurantes"],
  ["zone", "Zona"],
  ["city", "Ciudad"],
  ["stages", "Tiempos por etapa"],
  ["wait", "Sin espera"],
  ["validation", "Validación"],
];

function showMessage(text, type = "success") {
  elements.message.textContent = text;
  elements.message.className = `message message--${type}`;
  elements.message.hidden = false;
}

function resetMessage() {
  elements.message.hidden = true;
  elements.message.textContent = "";
}

function missingColumnNames(missing) {
  const names = { orderId: "orderId", createdAt: "Creada en", status: "Estatus de orden", provider: "Repartido por", officialTime: "Tiempo total de envio sin cooking time" };
  return missing.map((key) => names[key]).join(", ");
}

function addSelect(container, key, label, options, note = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "filter-field";
  const labelElement = document.createElement("label");
  labelElement.htmlFor = `filter-${key}`;
  labelElement.textContent = label;
  const select = document.createElement("select");
  select.id = `filter-${key}`;
  select.dataset.filter = key;
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "Todos";
  select.append(all, ...options.map((option) => {
    const element = document.createElement("option");
    element.value = String(option);
    element.textContent = key === "hour" ? `${String(option).padStart(2, "0")}:00` : String(option);
    return element;
  }));
  if (!options.length) select.disabled = true;
  wrapper.append(labelElement, select);
  if (note) wrapper.append(Object.assign(document.createElement("small"), { textContent: note }));
  container.append(wrapper);
}

function addDateInput(container, key, label) {
  const wrapper = document.createElement("div");
  wrapper.className = "filter-field";
  const labelElement = document.createElement("label");
  labelElement.htmlFor = `filter-${key}`;
  labelElement.textContent = label;
  const input = document.createElement("input");
  input.type = "date";
  input.id = `filter-${key}`;
  input.dataset.filter = key;
  wrapper.append(labelElement, input);
  container.append(wrapper);
}

function renderFilters() {
  const options = createFilterOptions(state.dataset.analyzed);
  elements.filters.replaceChildren();
  addDateInput(elements.filters, "start", "Periodo desde");
  addDateInput(elements.filters, "end", "Periodo hasta");
  addSelect(elements.filters, "day", "Día", options.day);
  addSelect(elements.filters, "hour", "Hora", options.hour);
  addSelect(elements.filters, "restaurant", "Restaurant", options.restaurant);
  addSelect(elements.filters, "zone", "Zona", options.zone);
  addSelect(elements.filters, "city", "Ciudad", options.city);
  addSelect(elements.filters, "provider", "Repartido por", options.provider);
  addSelect(elements.filters, "brand", "Marca", options.brand, options.brand.length ? "" : "Marca no disponible en el archivo cargado.");
  elements.filters.addEventListener("change", handleFilterChange);
}

function handleFilterChange(event) {
  const key = event.target.dataset.filter;
  if (!key) return;
  state.filters[key] = event.target.value;
  renderResults();
}

function currentRows() {
  return applyFilters(state.dataset.analyzed, state.filters);
}

function renderActiveAnalysis(rows) {
  const actions = {
    distribution: () => renderDistribution(elements.analysisContent, rows),
    date: () => renderBreakdown(elements.analysisContent, rows, "date", "Día"),
    hour: () => renderBreakdown(elements.analysisContent, rows, "hour", "Hora"),
    provider: () => renderBreakdown(elements.analysisContent, rows, "provider", "Proveedor"),
    restaurant: () => renderBreakdown(elements.analysisContent, rows, "restaurant", "Restaurant"),
    zone: () => renderBreakdown(elements.analysisContent, rows, "zone", "Zona"),
    city: () => renderBreakdown(elements.analysisContent, rows, "city", "Ciudad"),
    stages: () => renderStages(elements.analysisContent, rows, state.mapping),
    wait: () => renderWithoutWait(elements.analysisContent, rows, state.mapping),
    validation: () => renderValidation(elements.analysisContent, rows, state.mapping),
  };
  actions[state.activeTab]();
}

function renderResults() {
  const rows = currentRows();
  elements.filteredCount.textContent = `${rows.length} órdenes coinciden con los filtros actuales.`;
  renderKpis(elements.kpiGrid, rows);
  renderExecutiveSummary(elements.summaryText, elements.summaryObservations, rows);
  renderActiveAnalysis(rows);
}

function renderTabs() {
  elements.tabs.replaceChildren(...tabs.map(([key, label]) => {
    const button = document.createElement("button");
    button.className = "analysis-tab";
    button.type = "button";
    button.role = "tab";
    button.dataset.tab = key;
    button.setAttribute("aria-selected", String(state.activeTab === key));
    button.textContent = label;
    return button;
  }));
  elements.tabs.addEventListener("click", (event) => {
    const key = event.target.dataset.tab;
    if (!key) return;
    state.activeTab = key;
    elements.tabs.querySelectorAll("[role=tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.tab === key)));
    renderActiveAnalysis(currentRows());
  });
}

async function analyzeFile() {
  if (!state.file) return;
  resetMessage();
  elements.analyzeButton.disabled = true;
  elements.analyzeButton.textContent = "Analizando…";
  try {
    const result = await readOperationalFile(state.file);
    if (!result.rows.length) throw new Error("El archivo no contiene registros para analizar.");
    const headers = Object.keys(result.rows[0]);
    const { mapping, missingRequired } = mapColumns(headers);
    if (missingRequired.length) throw new Error(`Faltan columnas necesarias: ${missingColumnNames(missingRequired)}.`);
    const dataset = prepareDataset(normalizeRows(result.rows, mapping));
    if (!dataset.counts.eligible) throw new Error("No existen órdenes elegibles con estatus COMPLETE y los proveedores permitidos.");
    if (!dataset.analyzed.length) throw new Error("Los tiempos elegibles no pueden convertirse correctamente.");

    state.dataset = dataset;
    state.mapping = mapping;
    state.filters = emptyFilters();
    state.activeTab = "distribution";
    renderLoadSummary(elements.loadSummary, dataset.counts);
    renderFilters();
    renderTabs();
    renderResults();
    elements.dashboard.hidden = false;
    elements.replaceButton.hidden = false;
    elements.downloadButton.disabled = false;

    const warnings = [];
    if (dataset.counts.invalidDates) warnings.push(`${dataset.counts.invalidDates} fechas no pudieron interpretarse`);
    if (dataset.counts.invalidTimes) warnings.push(`${dataset.counts.invalidTimes} tiempos no pudieron convertirse`);
    showMessage(warnings.length ? `Análisis completado. Revisa: ${warnings.join("; ")}.` : "Análisis completado correctamente.", warnings.length ? "warning" : "success");
  } catch (error) {
    elements.dashboard.hidden = true;
    showMessage(error.message || "No fue posible analizar el archivo.", "error");
  } finally {
    elements.analyzeButton.disabled = false;
    elements.analyzeButton.textContent = "Analizar";
  }
}

elements.fileInput.addEventListener("change", () => {
  const [file] = elements.fileInput.files;
  state.file = file || null;
  state.dataset = null;
  elements.dashboard.hidden = true;
  elements.downloadButton.disabled = true;
  resetMessage();
  elements.analyzeButton.disabled = !file;
  elements.fileMeta.textContent = file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : "Ningún archivo seleccionado.";
});

elements.analyzeButton.addEventListener("click", analyzeFile);
elements.replaceButton.addEventListener("click", () => elements.fileInput.click());
elements.clearFilters.addEventListener("click", () => {
  state.filters = emptyFilters();
  elements.filters.querySelectorAll("select, input").forEach((control) => { control.value = ""; });
  renderResults();
});

elements.downloadButton.addEventListener("click", async () => {
  if (!state.dataset) return;
  elements.downloadButton.disabled = true;
  elements.downloadButton.textContent = "Generando archivo...";
  showMessage("Generando archivo...", "success");
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const result = await exportDeliveryAnalysis({
      rows: currentRows(),
      dataset: state.dataset,
      mapping: state.mapping,
      filters: state.filters,
      sourceFile: state.file.name,
    });
    showMessage(`Archivo generado correctamente: ${result.filename}`, "success");
  } catch (error) {
    showMessage(error.message || "No fue posible generar el archivo de análisis.", "error");
  } finally {
    elements.downloadButton.disabled = false;
    elements.downloadButton.textContent = "Descargar análisis";
  }
});
