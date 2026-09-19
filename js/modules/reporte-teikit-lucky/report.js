import { buildReport } from "./calculations.js";
import { exportTeikitLuckyReport } from "./exporter.js";
import { readReportFile } from "./file-reader.js";
import { mapColumns, normalizeRows } from "./normalizer.js";
import { renderBrandNavigation, renderBrandReport, renderLoadSummary, renderValidation } from "./renderer.js";

const elements = {
  input: document.querySelector("#report-file-input"), analyze: document.querySelector("#report-analyze-button"), replace: document.querySelector("#report-replace-button"), download: document.querySelector("#report-download-button"),
  meta: document.querySelector("#report-file-meta"), message: document.querySelector("#report-message"), results: document.querySelector("#report-results"),
  loadSummary: document.querySelector("#report-load-summary"), validation: document.querySelector("#report-validation"), navigation: document.querySelector("#brand-navigation"), brandReport: document.querySelector("#brand-report"),
};
let selectedFile = null;
let currentReport = null;

function showMessage(text, type) {
  elements.message.textContent = text; elements.message.className = `message message--${type}`; elements.message.hidden = false;
}

function handleFileSelection(event) {
  selectedFile = event.target.files?.[0] || null;
  currentReport = null;
  elements.analyze.disabled = !selectedFile;
  elements.download.disabled = true;
  elements.meta.textContent = selectedFile ? `Nombre del archivo: ${selectedFile.name}` : "Ningún archivo seleccionado.";
  if (selectedFile) showMessage("Archivo seleccionado. Presiona Analizar para calcular el reporte.", "success");
}

async function analyzeFile() {
  if (!selectedFile) return;
  elements.analyze.disabled = true;
  try {
    const source = await readReportFile(selectedFile);
    if (!source.rows.length) throw new Error("El archivo no contiene filas de datos.");
    const columns = mapColumns(Object.keys(source.rows[0]));
    if (columns.missingRequired.length) throw new Error(`Faltan columnas obligatorias: ${columns.missingRequired.join(", ")}.`);
    const report = buildReport(normalizeRows(source.rows, columns.mapping));
    currentReport = report;
    renderLoadSummary(elements.loadSummary, report);
    renderValidation(elements.validation, report, columns.missingOptional);
    let activeBrand = "TEIKIT";
    const selectBrand = (brand) => { activeBrand = brand; renderBrandNavigation(elements.navigation, activeBrand, selectBrand); renderBrandReport(elements.brandReport, report.brands[brand]); };
    selectBrand(activeBrand);
    elements.results.hidden = false; elements.replace.hidden = false; elements.download.disabled = false;
    showMessage(`Análisis completado: ${source.rows.length.toLocaleString("es-MX")} filas procesadas localmente.`, "success");
  } catch (error) {
    currentReport = null; elements.download.disabled = true; elements.results.hidden = true; showMessage(error.message, "error");
  } finally { elements.analyze.disabled = false; }
}

elements.input?.addEventListener("change", handleFileSelection);
elements.analyze?.addEventListener("click", analyzeFile);
elements.replace?.addEventListener("click", () => elements.input.click());
elements.download?.addEventListener("click", async () => {
  if (!currentReport || !selectedFile) return;
  elements.download.disabled = true;
  try {
    const result = await exportTeikitLuckyReport({ report: currentReport, sourceFile: selectedFile.name });
    showMessage(`Excel generado: ${result.filename}.`, "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    elements.download.disabled = false;
  }
});
