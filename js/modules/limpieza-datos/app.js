import { ALLOWED_PROVIDERS } from "./constants.js";
import { cleanRows } from "./cleaner.js";
import { downloadCleanWorkbook } from "./exporter.js";
import { readCleaningFile } from "./file-reader.js";

const elements = {
  input: document.querySelector("#cleaning-file-input"),
  clean: document.querySelector("#cleaning-run-button"),
  replace: document.querySelector("#cleaning-replace-button"),
  download: document.querySelector("#cleaning-download-button"),
  fileMeta: document.querySelector("#cleaning-file-meta"),
  message: document.querySelector("#cleaning-message"),
  results: document.querySelector("#cleaning-results"),
  summary: document.querySelector("#cleaning-summary"),
  providers: document.querySelector("#cleaning-providers"),
};

let selectedFile = null;
let parsedFile = null;
let cleanResult = null;

function showMessage(text, type = "error") {
  elements.message.textContent = text;
  elements.message.className = `message message--${type}`;
  elements.message.hidden = false;
}

function resetOutput() {
  parsedFile = null;
  cleanResult = null;
  elements.download.disabled = true;
  elements.results.hidden = true;
  elements.message.hidden = true;
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-MX").format(value);
}

function renderResult(result) {
  const items = [
    ["Filas originales", result.summary.original],
    ["Pasan filtro de proveedor", result.summary.providerFiltered],
    ["Duplicados eliminados", result.summary.duplicatesRemoved],
    ["Filas finales", result.summary.final],
  ];
  elements.summary.replaceChildren(...items.map(([label, value]) => {
    const item = document.createElement("div");
    item.className = "summary-item";
    const text = document.createElement("span"); text.textContent = label;
    const number = document.createElement("strong"); number.textContent = formatNumber(value);
    item.append(text, number);
    return item;
  }));
  elements.providers.replaceChildren(...ALLOWED_PROVIDERS.map((provider) => {
    const row = document.createElement("tr");
    const name = document.createElement("td"); name.textContent = provider;
    const count = document.createElement("td"); count.textContent = formatNumber(result.summary.providers[provider]);
    row.append(name, count);
    return row;
  }));
  elements.results.hidden = false;
}

elements.input.addEventListener("change", () => {
  resetOutput();
  selectedFile = elements.input.files?.[0] || null;
  elements.clean.disabled = !selectedFile;
  elements.replace.hidden = !selectedFile;
  elements.fileMeta.textContent = selectedFile ? `${selectedFile.name} · ${formatNumber(selectedFile.size)} bytes` : "Ningún archivo seleccionado.";
});

elements.replace.addEventListener("click", () => elements.input.click());

elements.clean.addEventListener("click", async () => {
  if (!selectedFile) return;
  elements.clean.disabled = true;
  elements.download.disabled = true;
  elements.message.hidden = true;
  try {
    parsedFile = await readCleaningFile(selectedFile);
    cleanResult = cleanRows(parsedFile.headers, parsedFile.rows);
    renderResult(cleanResult);
    elements.download.disabled = false;
    showMessage("La limpieza terminó correctamente. El archivo está listo para descargar.", "success");
  } catch (error) {
    parsedFile = null;
    cleanResult = null;
    elements.results.hidden = true;
    elements.download.disabled = true;
    showMessage(error.message);
  } finally {
    elements.clean.disabled = !selectedFile;
  }
});

elements.download.addEventListener("click", () => {
  if (!cleanResult || !selectedFile) return;
  try {
    downloadCleanWorkbook(cleanResult, selectedFile.name);
  } catch (error) {
    elements.download.disabled = true;
    showMessage(error.message);
  }
});
