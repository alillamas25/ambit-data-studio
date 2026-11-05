import { buildReport } from "./calculations.js";
import { exportTeikitLuckyReport } from "./exporter.js";
import { readReportFile } from "./file-reader.js";
import { mapColumns, normalizeRows } from "./normalizer.js";
import { renderBrandNavigation, renderBrandReport, renderLoadSummary, renderValidation } from "./renderer.js";

const elements = {
  input: document.querySelector("#report-file-input"), analyze: document.querySelector("#report-analyze-button"), cancel: document.querySelector("#report-cancel-button"), replace: document.querySelector("#report-replace-button"), download: document.querySelector("#report-download-button"),
  meta: document.querySelector("#report-file-meta"), message: document.querySelector("#report-message"), results: document.querySelector("#report-results"),
  progress: document.querySelector("#report-progress"), progressText: document.querySelector("#report-progress-text"), progressValue: document.querySelector("#report-progress-value"), progressBar: document.querySelector("#report-progress-bar"),
  loadSummary: document.querySelector("#report-load-summary"), validation: document.querySelector("#report-validation"), navigation: document.querySelector("#brand-navigation"), brandReport: document.querySelector("#brand-report"),
};
let selectedFile = null;
let currentReport = null;
let activeWorker = null;
let processId = 0;

function showMessage(text, type) {
  elements.message.textContent = text; elements.message.className = `message message--${type}`; elements.message.hidden = false;
}

function showProgress(text, { current = null, total = null, percent = null } = {}) {
  elements.progress.hidden = false;
  elements.progressText.textContent = text;
  elements.progressValue.textContent = current === null ? "" : total ? `${current.toLocaleString("es-MX")} de ${total.toLocaleString("es-MX")}` : current.toLocaleString("es-MX");
  if (Number.isFinite(percent)) { elements.progressBar.value = Math.max(0, Math.min(100, percent)); }
  else elements.progressBar.removeAttribute("value");
}

function hideProgress() { elements.progress.hidden = true; elements.progressBar.removeAttribute("value"); elements.progressValue.textContent = ""; }

function setProcessing(processing) {
  elements.analyze.disabled = processing || !selectedFile;
  elements.cancel.hidden = !processing;
  elements.replace.disabled = processing;
  if (processing) elements.download.disabled = true;
}

function cancelProcessing({ announce = true } = {}) {
  processId += 1;
  activeWorker?.terminate();
  activeWorker = null;
  setProcessing(false);
  hideProgress();
  if (announce) showMessage("Procesamiento cancelado. Puedes seleccionar otro archivo.", "success");
}

function handleFileSelection(event) {
  if (activeWorker) cancelProcessing({ announce: false });
  selectedFile = event.target.files?.[0] || null;
  currentReport = null;
  elements.analyze.disabled = !selectedFile;
  elements.download.disabled = true;
  elements.meta.textContent = selectedFile ? `Nombre del archivo: ${selectedFile.name}` : "Ningún archivo seleccionado.";
  if (selectedFile) showMessage("Archivo seleccionado. Presiona Analizar para calcular el reporte.", "success");
}

function analyzeXlsxIncrementally(file, id) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./xlsx-reader.worker.js", import.meta.url), { type: "module" });
    activeWorker = worker;
    let rowsStarted = false;
    worker.onmessage = ({ data }) => {
      if (id !== processId) return;
      if (data.type === "progress") {
        if (data.phase === "rows") {
          rowsStarted = true;
          showProgress("Leyendo órdenes", { current: data.dataRows, total: data.totalRows, percent: data.percent });
        } else if (!rowsStarted) showProgress("Preparando archivo.", { percent: data.phase === "metadata" ? Math.min(15, (data.percent || 0) * 0.15) : null });
      } else if (data.type === "complete") {
        worker.terminate();
        activeWorker = null;
        if (!data.result.rowCount) { reject(new Error("El archivo no contiene filas de datos.")); return; }
        showProgress("Preparando resultados.", { percent: 100 });
        resolve({ report: data.result.analysis, missingOptional: data.result.missingOptional, rowCount: data.result.rowCount });
      } else if (data.type === "error") {
        worker.terminate();
        activeWorker = null;
        const error = new Error(data.error.message);
        error.code = data.error.code;
        reject(error);
      }
    };
    worker.onerror = (event) => { worker.terminate(); activeWorker = null; reject(new Error(event.message || "No se pudo procesar el archivo Excel.")); };
    worker.postMessage({ type: "analyze-xlsx", file });
  });
}

async function analyzeLegacyFile(file) {
  showProgress("Preparando archivo.");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const source = await readReportFile(file);
  if (!source.rows.length) throw new Error("El archivo no contiene filas de datos.");
  showProgress("Leyendo órdenes", { current: source.rows.length, total: source.rows.length, percent: 100 });
  const columns = mapColumns(Object.keys(source.rows[0]));
  if (columns.missingRequired.length) throw new Error(`Faltan columnas obligatorias: ${columns.missingRequired.join(", ")}.`);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  showProgress("Preparando resultados.", { percent: 100 });
  return { report: buildReport(normalizeRows(source.rows, columns.mapping)), missingOptional: columns.missingOptional, rowCount: source.rows.length };
}

async function analyzeFile() {
  if (!selectedFile) return;
  const file = selectedFile;
  const id = ++processId;
  setProcessing(true);
  showProgress("Preparando archivo.");
  try {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const { report, missingOptional, rowCount } = extension === "xlsx" ? await analyzeXlsxIncrementally(file, id) : await analyzeLegacyFile(file);
    if (id !== processId) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    currentReport = report;
    renderLoadSummary(elements.loadSummary, report);
    renderValidation(elements.validation, report, missingOptional);
    let activeBrand = "TEIKIT";
    const selectBrand = (brand) => { activeBrand = brand; renderBrandNavigation(elements.navigation, activeBrand, selectBrand); renderBrandReport(elements.brandReport, report.brands[brand]); };
    selectBrand(activeBrand);
    elements.results.hidden = false; elements.replace.hidden = false; elements.download.disabled = false;
    showMessage(`Análisis completado: ${rowCount.toLocaleString("es-MX")} filas procesadas localmente.`, "success");
  } catch (error) {
    if (id !== processId) return;
    currentReport = null; elements.download.disabled = true; elements.results.hidden = true; showMessage(error.message, "error");
  } finally {
    if (id === processId) { activeWorker = null; setProcessing(false); hideProgress(); }
  }
}

elements.input?.addEventListener("change", handleFileSelection);
elements.analyze?.addEventListener("click", analyzeFile);
elements.cancel?.addEventListener("click", () => cancelProcessing());
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
