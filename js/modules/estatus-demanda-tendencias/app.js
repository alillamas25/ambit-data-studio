import { buildAnalysis, prepareDataset } from "./analytics.js";
import { readOperationalFile } from "./file-reader.js";
import { applyFilters, createFilterOptions, emptyFilters } from "./filters.js";
import { exportStatusDemandAnalysis } from "./exporter.js";
import { mapColumns, normalizeRows } from "./normalizer.js";
import { renderAnalysis, renderKpis, renderLoadSummary } from "./renderer.js";

const elements = {
  input: document.querySelector("#status-file-input"),
  analyze: document.querySelector("#status-analyze-button"),
  replace: document.querySelector("#status-replace-button"),
  download: document.querySelector("#status-download-button"),
  meta: document.querySelector("#status-file-meta"),
  message: document.querySelector("#status-message"),
  dashboard: document.querySelector("#status-dashboard"),
  loadSummary: document.querySelector("#status-load-summary"),
  filters: document.querySelector("#status-filters"),
  clearFilters: document.querySelector("#status-clear-filters"),
  filteredCount: document.querySelector("#status-filtered-count"),
  kpis: document.querySelector("#status-kpis"),
  analysis: document.querySelector("#status-analysis"),
  validation: document.querySelector("#status-validation"),
};

const filterDefinitions = [
  ["start", "Desde", "date"], ["end", "Hasta", "date"], ["brand", "Marca", "select"],
  ["restaurant", "Sucursal", "select"], ["city", "Ciudad", "select"], ["zone", "Zona", "select"],
  ["provider", "Proveedor", "select"], ["status", "Estatus", "select"],
];

let selectedFile = null;
let dataset = null;
let filters = emptyFilters();
let currentAnalysis = null;

function showMessage(text, type) {
  elements.message.textContent = text;
  elements.message.className = `message message--${type}`;
  elements.message.hidden = false;
}

function filterControl([field, label, type], options) {
  const wrapper = document.createElement("div"); wrapper.className = "filter-field";
  const labelNode = document.createElement("label"); labelNode.htmlFor = `filter-${field}`; labelNode.textContent = label;
  const control = document.createElement(type === "date" ? "input" : "select");
  control.id = `filter-${field}`; control.dataset.field = field;
  if (type === "date") control.type = "date";
  else {
    const all = document.createElement("option"); all.value = ""; all.textContent = "Todos"; control.append(all);
    (options[field] || []).forEach((value) => { const option = document.createElement("option"); option.value = String(value); option.textContent = String(value); control.append(option); });
  }
  control.value = filters[field];
  control.addEventListener("change", () => { filters[field] = control.value; updateDashboard(); });
  wrapper.append(labelNode, control); return wrapper;
}

function renderFilters(rows) {
  const options = createFilterOptions(rows);
  elements.filters.replaceChildren(...filterDefinitions.map((definition) => filterControl(definition, options)));
}

function renderValidation(missingOptional) {
  const messages = [];
  if (missingOptional.length) messages.push(`Columnas opcionales no encontradas: ${missingOptional.join(", ")}. Los análisis dependientes se muestran como Sin información.`);
  if (dataset.counts.invalidDates) messages.push(`${dataset.counts.invalidDates.toLocaleString("es-MX")} órdenes del universo no tienen una fecha interpretable y no participan en análisis temporales.`);
  if (dataset.counts.unknownBrands) messages.push(`${dataset.counts.unknownBrands.toLocaleString("es-MX")} órdenes están clasificadas como Sin marca identificada.`);
  if (!messages.length) messages.push("No se detectaron observaciones estructurales en las columnas utilizadas.");
  elements.validation.replaceChildren(...messages.map((message) => { const item = document.createElement("li"); item.textContent = message; return item; }));
}

function updateDashboard() {
  if (!dataset) return;
  const rows = applyFilters(dataset.universe, filters);
  const analysis = buildAnalysis(rows);
  currentAnalysis = analysis;
  elements.filteredCount.textContent = `${rows.length.toLocaleString("es-MX")} de ${dataset.universe.length.toLocaleString("es-MX")} órdenes del universo`;
  renderKpis(elements.kpis, analysis);
  renderAnalysis(elements.analysis, analysis);
}

function handleFileSelection(event) {
  selectedFile = event.target.files?.[0] || null;
  dataset = null; filters = emptyFilters();
  currentAnalysis = null;
  elements.analyze.disabled = !selectedFile;
  elements.download.disabled = true;
  elements.dashboard.hidden = true;
  elements.meta.textContent = selectedFile ? `Nombre del archivo: ${selectedFile.name}` : "Ningún archivo seleccionado.";
  if (selectedFile) showMessage("Archivo seleccionado. Presiona Analizar para generar el reporte.", "success");
}

async function analyzeFile() {
  if (!selectedFile) return;
  elements.analyze.disabled = true;
  try {
    const source = await readOperationalFile(selectedFile);
    if (!source.rows.length) throw new Error("El archivo no contiene filas de datos.");
    const columns = mapColumns(Object.keys(source.rows[0]));
    if (columns.missingRequired.length) throw new Error(`Faltan columnas obligatorias: ${columns.missingRequired.join(", ")}.`);
    dataset = prepareDataset(normalizeRows(source.rows, columns.mapping));
    if (!dataset.universe.length) throw new Error("No se encontraron órdenes de UBER_DAAS, RAPPI_CARGO o DIDI_DELIVERY.");
    filters = emptyFilters();
    renderLoadSummary(elements.loadSummary, dataset.counts);
    renderFilters(dataset.universe);
    renderValidation(columns.missingOptional);
    updateDashboard();
    elements.download.disabled = false;
    elements.dashboard.hidden = false; elements.replace.hidden = false;
    showMessage(`Análisis completado: ${dataset.universe.length.toLocaleString("es-MX")} órdenes incluidas.`, "success");
  } catch (error) {
    dataset = null; currentAnalysis = null; elements.download.disabled = true; elements.dashboard.hidden = true; showMessage(error.message, "error");
  } finally {
    elements.analyze.disabled = false;
  }
}

elements.input?.addEventListener("change", handleFileSelection);
elements.analyze?.addEventListener("click", analyzeFile);
elements.replace?.addEventListener("click", () => elements.input.click());
elements.clearFilters?.addEventListener("click", () => { filters = emptyFilters(); renderFilters(dataset?.universe || []); updateDashboard(); });
elements.download?.addEventListener("click", async () => {
  if (!currentAnalysis || !selectedFile) return;
  elements.download.disabled = true;
  try {
    const result = await exportStatusDemandAnalysis({ analysis: currentAnalysis, filters: { ...filters }, sourceFile: selectedFile.name });
    showMessage(`Excel generado: ${result.filename}.`, "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    elements.download.disabled = false;
  }
});
