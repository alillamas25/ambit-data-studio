const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { chromium } = global.playwright || require("playwright");
const XLSX = require("../js/vendor/xlsx.full.min.js");

const headers = [
  "orderId", "Creada en", "Completada en", "Estatus de orden", "Repartido por",
  "Cooking Time", "Tiempo total de envio", "Tiempo total de envio sin cooking time",
  "Tiempo total sin cooking time <45", "Tiempo total sin cooking time <60",
  "Tiempo total sin cooking time >60", "Tiempo total de envio sin espera de restaurante",
  "Tiempo de aceptacion de repartidor", "Tiempo para llegar a tienda", "Tiempo para recoger",
  "Tiempo para entregar", "Tiempo para completar", "Restaurant", "Zona", "Ciudad",
];

const rows = [
  ["T-001", "01/09/2026 10:00", "01/09/2026 10:50", " complete ", "uber_daas", 10, 42, 40, 1, 1, 0, 36, 3, 8, 7, 24, 2, "Sucursal Norte", "Norte", "CDMX"],
  ["T-002", "02/09/2026 11:00", "02/09/2026 11:55", "COMPLETE", "RAPPI_CARGO", 10, 48, 45, 0, 1, 0, 40, 4, 9, "", 29, 3, "Sucursal Centro", "Centro", "CDMX"],
  ["T-003", "03/09/2026 12:00", "03/09/2026 13:10", "COMPLETE", "RAPPI_CARGO", 10, 62, 60, 0, 0, 0, 54, 4, 10, 8, 40, 4, "Sucursal Centro", "Centro", "CDMX"],
  ["T-004", "04/09/2026 13:00", "04/09/2026 14:15", "COMPLETE", "DIDI_DELIVERY", 10, 66, 61, 0, 0, 1, 58, 5, 10, 9, 42, 4, "Sucursal Sur", "Sur", "Puebla"],
  ["T-005", "05/09/2026 14:00", "05/09/2026 14:40", "CANCELLED", "UBER_DAAS", 5, 35, 30, 1, 1, 0, 30, 2, 8, 5, 20, 1, "Sucursal Norte", "Norte", "CDMX"],
  ["T-006", "06/09/2026 15:00", "06/09/2026 15:55", "COMPLETE", "OTRO", 5, 50, 48, 0, 1, 0, 45, 4, 8, 7, 31, 2, "Sucursal Norte", "Norte", "CDMX"],
  ["T-007", "07/09/2026 16:00", "07/09/2026 16:55", "COMPLETE", "UBER_DAAS", 5, 50, "", 0, 1, 0, 45, 4, 8, 7, 31, 2, "Sucursal Norte", "Norte", "CDMX"],
];

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function runAnalysis(page, file) {
  await page.locator("#file-input").setInputFiles(file);
  await page.locator("#analyze-button").click();
  await page.locator("#message").waitFor({ state: "visible" });
  await page.locator("#dashboard").waitFor({ state: "visible" });
  assert.match(await page.locator("#message").textContent(), /Análisis completado/);
  assert.equal(await page.locator("#load-summary .summary-item strong").allTextContents().then((values) => values.join(",")), "7,6,5,1,1");
  assert.equal(await page.locator("#kpi-grid .kpi strong").allTextContents().then((values) => values.slice(0, 5).join(",")), "4,1,2,2,1");
}

(async () => {
  const executablePath = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:8000/modules/tiempos-entrega.html", { waitUntil: "networkidle" });
  assert.equal(await page.locator("#download-button").isDisabled(), true);

  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
  const requestCountBeforeCsv = (await page.evaluate(() => performance.getEntriesByType("resource").length));
  await runAnalysis(page, { name: "prueba-sintetica.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  assert.equal(await page.locator("#download-button").isEnabled(), true);
  const requestCountAfterCsv = await page.evaluate(() => performance.getEntriesByType("resource").length);
  assert.equal(requestCountAfterCsv, requestCountBeforeCsv, "El procesamiento CSV no debe generar peticiones de red");

  await page.locator("#filter-provider").selectOption("RAPPI_CARGO");
  assert.equal(await page.locator("#kpi-grid .kpi strong").first().textContent(), "2");
  const resourcesBeforeExport = await page.evaluate(() => performance.getEntriesByType("resource").length);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-button").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "Ambit_Tiempos_2026-09-02_2026-09-03.xlsx");
  const downloadStream = await download.createReadStream();
  const downloadChunks = [];
  for await (const chunk of downloadStream) downloadChunks.push(chunk);
  const exportedWorkbook = XLSX.read(Buffer.concat(downloadChunks), { type: "buffer", cellDates: true });
  assert.deepEqual(exportedWorkbook.SheetNames, ["Resumen", "Por fecha", "Por hora", "Por Restaurant", "Por Zona", "Por Ciudad", "Proveedores", "Tiempos por etapa", "Validación", "Base analizada"]);
  const summaryRows = XLSX.utils.sheet_to_json(exportedWorkbook.Sheets.Resumen, { header: 1, defval: null });
  const positionOf = (label) => {
    for (let row = 0; row < summaryRows.length; row += 1) {
      const column = summaryRows[row].indexOf(label);
      if (column >= 0) return { row, column };
    }
    return null;
  };
  const kpiValue = (label) => {
    const position = positionOf(label);
    return position ? summaryRows[position.row + 1][position.column] : undefined;
  };
  assert.equal(kpiValue("Órdenes analizadas"), 2);
  assert.equal(kpiValue("<45 min"), 0);
  assert.equal(kpiValue("45–60 min"), 2);
  assert.equal(kpiValue("<60 min"), 1);
  assert.equal(kpiValue(">60 min"), 0);
  const filtersRow = summaryRows[positionOf("Filtros activos").row];
  assert.match(filtersRow.find((value) => typeof value === "string" && value.includes("RAPPI_CARGO")), /Repartido por: RAPPI_CARGO/);
  const baseRows = XLSX.utils.sheet_to_json(exportedWorkbook.Sheets["Base analizada"], { header: 1, defval: null });
  assert.equal(baseRows.length, 3);
  const providerIndex = baseRows[0].indexOf("Repartido por");
  const pickupIndex = baseRows[0].indexOf("Tiempo para recoger");
  assert.ok(baseRows.slice(1).every((row) => row[providerIndex] === "RAPPI_CARGO"));
  assert.notEqual(baseRows[1][pickupIndex], 0, "Un valor vacío no debe exportarse como cero");
  assert.equal(await page.evaluate(() => performance.getEntriesByType("resource").length), resourcesBeforeExport, "La exportación no debe generar peticiones de red");
  assert.match(await page.locator("#message").textContent(), /Archivo generado correctamente/);
  await page.locator("#clear-filters").click();
  assert.equal(await page.locator("#kpi-grid .kpi strong").first().textContent(), "4");
  await page.getByRole("tab", { name: "Tiempos por etapa" }).click();
  const pickupRow = page.locator("#analysis-content tbody tr").filter({ hasText: "Recoger" });
  assert.equal(await pickupRow.locator("td").nth(1).textContent(), "3", "Los valores vacíos no deben contarse como cero");
  for (const tabName of ["Distribución", "Evolución por día", "Por hora", "Proveedores", "Restaurantes", "Zona", "Ciudad", "Sin espera", "Validación"]) {
    await page.getByRole("tab", { name: tabName, exact: true }).click();
    assert.notEqual((await page.locator("#analysis-content").textContent()).trim(), "", `${tabName} debe mostrar contenido`);
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Órdenes");
  const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  await runAnalysis(page, { name: "prueba-sintetica.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(xlsxBuffer) });

  const xlsBuffer = XLSX.write(workbook, { type: "buffer", bookType: "biff8" });
  await runAnalysis(page, { name: "prueba-sintetica.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from(xlsBuffer) });

  const minimalCsv = [
    ["orderId", "Creada en", "Estatus de orden", "Repartido por", "Tiempo total de envio sin cooking time"],
    ["M-001", "08/09/2026 09:00", "COMPLETE", "UBER_DAAS", 35],
  ].map((row) => row.map(csvValue).join(",")).join("\n");
  await page.locator("#file-input").setInputFiles({ name: "prueba-minima.csv", mimeType: "text/csv", buffer: Buffer.from(minimalCsv) });
  await page.locator("#analyze-button").click();
  await page.locator("#message").waitFor({ state: "visible" });
  const minimalDownloadPromise = page.waitForEvent("download");
  await page.locator("#download-button").click();
  const minimalDownload = await minimalDownloadPromise;
  const minimalStream = await minimalDownload.createReadStream();
  const minimalChunks = [];
  for await (const chunk of minimalStream) minimalChunks.push(chunk);
  const minimalWorkbook = XLSX.read(Buffer.concat(minimalChunks), { type: "buffer" });
  const zoneRows = XLSX.utils.sheet_to_json(minimalWorkbook.Sheets["Por Zona"], { header: 1, defval: null });
  assert.match(zoneRows.flat().find((value) => typeof value === "string" && value.includes("Información no disponible")), /Información no disponible/);
  assert.equal(XLSX.utils.sheet_to_json(minimalWorkbook.Sheets["Base analizada"], { header: 1, defval: null }).length, 2);

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("OK: CSV, XLSX, XLS, descarga XLSX válida, filtros, KPIs y consola sin errores.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
