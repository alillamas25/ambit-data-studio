import { breakdown, calculateMetrics, classifyTime } from "./metrics.js?v=20260915-stage-minutes";
import { buildExecutiveSummary } from "./summary.js?v=20260915-stage-minutes";
import { analyzeStages, analyzeStagesByStatus, validateCalculatedTimes } from "./validation.js?v=20260915-stage-minutes";

const FILTER_LABELS = { start: "Periodo desde", end: "Periodo hasta", day: "Día", hour: "Hora", restaurant: "Restaurant", zone: "Zona", city: "Ciudad", provider: "Repartido por", brand: "Marca" };
const BREAKDOWN_HEADERS = ["Órdenes", "Promedio", "Mediana", "Cantidad <45", "% <45", "Cantidad 45–60", "% 45–60", "Cantidad <60", "% <60", "Cantidad >60", "% >60"];
const COLORS = {
  purple: "FF7D20F8", purpleDark: "FF6414D1", purpleSoft: "FFF2EAFF", text: "FF202124",
  muted: "FF68707C", white: "FFFFFFFF", neutral: "FFF5F6F8", border: "FFDDE0E6",
  green: "FFE8F5EC", greenText: "FF1F6B45", yellow: "FFFFF4CC", yellowText: "FF755700",
  red: "FFFFE4E4", redText: "FF9F2525",
};
const STAGE_LABELS = { acceptance: "Tiempo de aceptación de repartidor", toStore: "Tiempo para llegar a tienda", pickup: "Tiempo para recoger", delivery: "Tiempo para entregar", completion: "Tiempo para completar" };
const BORDER = { top: { style: "thin", color: { argb: COLORS.border } }, left: { style: "thin", color: { argb: COLORS.border } }, bottom: { style: "thin", color: { argb: COLORS.border } }, right: { style: "thin", color: { argb: COLORS.border } } };

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const localDateTime = (date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
const classificationLabel = (value) => ({ under45: "<45", between45And60: "45–60", over60: ">60" })[classifyTime(value)];
function activeFilters(filters) {
  const entries = Object.entries(filters).filter(([, value]) => value !== "");
  return entries.length ? entries.map(([key, value]) => `${FILTER_LABELS[key]}: ${key === "hour" ? `${String(value).padStart(2, "0")}:00` : value}`) : ["Sin filtros adicionales"];
}
function periodFor(rows) {
  const dates = rows.map((row) => row.date).filter(Boolean).sort();
  return dates.length ? { start: dates[0], end: dates.at(-1), label: dates[0] === dates.at(-1) ? dates[0] : `${dates[0]} a ${dates.at(-1)}` } : null;
}
function metricRow(item) {
  return [item.count, item.average, item.median, item.under45.count, item.under45.percentage / 100, item.between45And60.count, item.between45And60.percentage / 100, item.under60.count, item.under60.percentage / 100, item.over60.count, item.over60.percentage / 100];
}

function mojibakeScore(value) { return (value.match(/Ã.|Â.|â€|ðŸ/g) || []).length; }
function cleanText(value) {
  if (typeof value !== "string" || !/[ÃÂâ]/.test(value)) return value;
  try {
    const points = [...value].map((character) => character.charCodeAt(0));
    if (points.some((point) => point > 255)) return value;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(points));
    return !decoded.includes("�") && mojibakeScore(decoded) < mojibakeScore(value) ? decoded : value;
  } catch { return value; }
}

function addTitle(worksheet, title, subtitle, lastColumn) {
  worksheet.mergeCells(1, 1, 1, lastColumn);
  Object.assign(worksheet.getCell(1, 1), { value: cleanText(title), fill: fill(COLORS.purpleDark), font: { name: "Aptos Display", size: 16, bold: true, color: { argb: COLORS.white } }, alignment: { vertical: "middle" } });
  worksheet.getRow(1).height = 30;
  worksheet.mergeCells(2, 1, 2, lastColumn);
  Object.assign(worksheet.getCell(2, 1), { value: cleanText(subtitle), font: { name: "Aptos", size: 10, color: { argb: COLORS.muted } }, alignment: { vertical: "middle" } });
  worksheet.getRow(2).height = 24;
}
function styleHeader(row) {
  row.height = 28;
  row.eachCell((cell) => Object.assign(cell, { font: { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.white } }, fill: fill(COLORS.purple), border: BORDER, alignment: { vertical: "middle", horizontal: "center", wrapText: true } }));
}
function styleData(worksheet, startRow, endRow, { integers = [], times = [], percents = [], left = [1] } = {}) {
  for (let r = startRow; r <= endRow; r += 1) {
    const row = worksheet.getRow(r); row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.value = cleanText(cell.value);
      Object.assign(cell, { font: { name: "Aptos", size: 10, color: { argb: COLORS.text } }, border: BORDER, fill: fill(r % 2 ? COLORS.neutral : COLORS.white), alignment: { vertical: "middle", horizontal: left.includes(column) ? "left" : "right" } });
      if (integers.includes(column)) cell.numFmt = "#,##0";
      if (times.includes(column)) cell.numFmt = '0.00 "min"';
      if (percents.includes(column)) cell.numFmt = "0.00%";
    });
  }
}
function colorScale(worksheet, column, startRow, endRow, inverse = false) {
  if (endRow < startRow) return;
  const colors = inverse ? [COLORS.green, COLORS.yellow, COLORS.red] : [COLORS.red, COLORS.yellow, COLORS.green];
  worksheet.addConditionalFormatting({ ref: `${column}${startRow}:${column}${endRow}`, rules: [{ type: "colorScale", cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }], color: colors.map((argb) => ({ argb })) }] });
}
function configureTable(worksheet, headerRow, endRow, endColumn) {
  worksheet.views = [{ state: "frozen", ySplit: headerRow, showGridLines: false }];
  worksheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: endRow, column: endColumn } };
  worksheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function makeBreakdownSheet(workbook, rows, field, dimension, available) {
  const name = dimension === "Proveedor" ? "Proveedores" : `Por ${dimension}`;
  const worksheet = workbook.addWorksheet(name, { properties: { tabColor: { argb: COLORS.purple } } });
  addTitle(worksheet, dimension === "Proveedor" ? "Desempeño por proveedor" : `Desglose por ${dimension.toLowerCase()}`, "Tiempos de entrega · Ambit Data Studio", 12);
  if (!available) {
    worksheet.mergeCells("A4:L5");
    Object.assign(worksheet.getCell("A4"), { value: "Información no disponible en el archivo analizado.", fill: fill(COLORS.neutral), font: { name: "Aptos", italic: true, color: { argb: COLORS.muted } }, alignment: { vertical: "middle", horizontal: "center" } });
    worksheet.getColumn(1).width = 34; worksheet.views = [{ showGridLines: false }]; return;
  }
  worksheet.addRow([]); worksheet.addRow([dimension, ...BREAKDOWN_HEADERS]);
  breakdown(rows, field).forEach((item) => worksheet.addRow([cleanText(item.label), ...metricRow(item)]));
  styleHeader(worksheet.getRow(4));
  styleData(worksheet, 5, worksheet.rowCount, { integers: [2, 5, 7, 9, 11], times: [3, 4], percents: [6, 8, 10, 12] });
  colorScale(worksheet, "F", 5, worksheet.rowCount); colorScale(worksheet, "L", 5, worksheet.rowCount, true);
  [28, 12, 14, 14, 15, 12, 18, 12, 16, 12, 16, 12].forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });
  configureTable(worksheet, 4, worksheet.rowCount, 12);
}

function kpiCard(worksheet, column, label, value, note, background, foreground = COLORS.text) {
  for (const row of [10, 11, 12]) worksheet.mergeCells(row, column, row, column + 1);
  const cells = [10, 11, 12].map((row) => worksheet.getCell(row, column));
  cells.forEach((cell) => Object.assign(cell, { fill: fill(background), border: BORDER, alignment: { horizontal: "center", vertical: "middle", wrapText: true } }));
  Object.assign(cells[0], { value: label, font: { name: "Aptos", size: 9, bold: true, color: { argb: foreground } } });
  Object.assign(cells[1], { value, font: { name: "Aptos Display", size: 18, bold: true, color: { argb: foreground } } });
  Object.assign(cells[2], { value: note, font: { name: "Aptos", size: 8, color: { argb: foreground } } });
}
function sectionBar(worksheet, row, text) {
  worksheet.mergeCells(row, 1, row, 14);
  Object.assign(worksheet.getCell(row, 1), { value: text, font: { name: "Aptos", bold: true, color: { argb: COLORS.white } }, fill: fill(COLORS.purple) });
}
function makeSummarySheet(workbook, { rows, dataset, filters, sourceFile }) {
  const worksheet = workbook.addWorksheet("Resumen", { properties: { tabColor: { argb: COLORS.purpleDark } }, views: [{ showGridLines: false }] });
  const metrics = calculateMetrics(rows); const period = periodFor(rows); const summary = buildExecutiveSummary(rows);
  worksheet.mergeCells("A1:N1"); Object.assign(worksheet.getCell("A1"), { value: "AMBIT DATA STUDIO", font: { name: "Aptos Display", size: 18, bold: true, color: { argb: COLORS.white } }, fill: fill(COLORS.purpleDark), alignment: { vertical: "middle" } }); worksheet.getRow(1).height = 34;
  worksheet.mergeCells("A2:N2"); Object.assign(worksheet.getCell("A2"), { value: "Tiempos de entrega", font: { name: "Aptos Display", size: 15, bold: true, color: { argb: COLORS.purpleDark } }, fill: fill(COLORS.purpleSoft) }); worksheet.getRow(2).height = 28;
  [["Archivo analizado", cleanText(sourceFile)], ["Periodo analizado", period?.label || "No disponible"], ["Fecha de generación", localDateTime(new Date())], ["Filtros activos", activeFilters(filters).join(" | ")]].forEach(([label, value], index) => {
    const row = index + 4; worksheet.mergeCells(row, 1, row, 3); worksheet.mergeCells(row, 4, row, 14);
    Object.assign(worksheet.getCell(row, 1), { value: label, font: { name: "Aptos", bold: true, color: { argb: COLORS.muted } }, fill: fill(COLORS.neutral) });
    Object.assign(worksheet.getCell(row, 4), { value, font: { name: "Aptos", color: { argb: COLORS.text } }, fill: fill(COLORS.neutral) });
  });
  sectionBar(worksheet, 9, "Indicadores principales");
  kpiCard(worksheet, 1, "Órdenes analizadas", metrics.count, "Después de filtros", COLORS.purpleSoft, COLORS.purpleDark);
  kpiCard(worksheet, 3, "<45 min", metrics.under45.count, `${metrics.under45.percentage.toFixed(2)}%`, COLORS.green, COLORS.greenText);
  kpiCard(worksheet, 5, "<60 min", metrics.under60.count, `${metrics.under60.percentage.toFixed(2)}%`, COLORS.green, COLORS.greenText);
  kpiCard(worksheet, 7, "45–60 min", metrics.between45And60.count, `${metrics.between45And60.percentage.toFixed(2)}%`, COLORS.yellow, COLORS.yellowText);
  kpiCard(worksheet, 9, ">60 min", metrics.over60.count, `${metrics.over60.percentage.toFixed(2)}%`, COLORS.red, COLORS.redText);
  kpiCard(worksheet, 11, "Promedio", metrics.average, "minutos", COLORS.neutral); worksheet.getCell("K11").numFmt = '0.00 "min"';
  kpiCard(worksheet, 13, "Mediana", metrics.median, "minutos", COLORS.neutral); worksheet.getCell("M11").numFmt = '0.00 "min"';
  worksheet.getRow(10).height = 27; worksheet.getRow(11).height = 34; worksheet.getRow(12).height = 23;
  sectionBar(worksheet, 14, "Control de carga");
  [["Órdenes cargadas", dataset.counts.total], ["Órdenes COMPLETE", dataset.counts.complete], ["Órdenes elegibles", dataset.counts.eligible], ["Excluidas por estatus", dataset.counts.excludedStatus], ["Excluidas por proveedor", dataset.counts.excludedProvider]].forEach(([label, value], index) => {
    const column = 1 + index * 2; worksheet.mergeCells(15, column, 15, column + 1); worksheet.mergeCells(16, column, 16, column + 1);
    for (const row of [15, 16]) Object.assign(worksheet.getCell(row, column), { fill: fill(COLORS.neutral), border: BORDER, alignment: { horizontal: "center" } });
    Object.assign(worksheet.getCell(15, column), { value: label, font: { name: "Aptos", size: 9, bold: true, color: { argb: COLORS.muted } } });
    Object.assign(worksheet.getCell(16, column), { value, font: { name: "Aptos", size: 13, bold: true, color: { argb: COLORS.text } }, numFmt: "#,##0" });
  });
  sectionBar(worksheet, 18, "Resumen ejecutivo"); worksheet.getCell("A18").fill = fill(COLORS.purpleDark);
  worksheet.mergeCells("A19:N21"); Object.assign(worksheet.getCell("A19"), { value: cleanText(summary.text), fill: fill(COLORS.purpleSoft), font: { name: "Aptos", size: 11, color: { argb: COLORS.text } }, alignment: { vertical: "middle", wrapText: true }, border: BORDER });
  summary.observations.forEach((observation, index) => { const row = 22 + index; worksheet.mergeCells(row, 1, row, 14); Object.assign(worksheet.getCell(row, 1), { value: `• ${cleanText(observation)}`, font: { name: "Aptos", size: 10, color: { argb: COLORS.muted } }, alignment: { wrapText: true } }); });
  for (let column = 1; column <= 14; column += 1) worksheet.getColumn(column).width = 11;
}

function makeStagesSheet(workbook, rows, mapping) {
  const worksheet = workbook.addWorksheet("Tiempos por etapa", { properties: { tabColor: { argb: COLORS.purple } } });
  addTitle(worksheet, "Tiempos por etapa", "Cobertura y duración de las etapas disponibles", 8);
  worksheet.addRow([]);
  worksheet.mergeCells("A4:H4");
  Object.assign(worksheet.getCell("A4"), {
    value: "Universo: órdenes de UBER_DAAS, RAPPI_CARGO y DIDI_DELIVERY de todos los estatus. Los promedios de cada etapa consideran únicamente registros con tiempo válido.",
    fill: fill(COLORS.purpleSoft), font: { name: "Aptos", size: 10, color: { argb: COLORS.purpleDark } },
    alignment: { vertical: "middle", wrapText: true }, border: BORDER,
  });
  worksheet.getRow(4).height = 34;
  worksheet.addRow(["Total universo de etapas", rows.length]);
  worksheet.addRow(["Estatus presentes", [...new Set(rows.map((row) => row.status || "Sin estatus"))].sort((a, b) => a.localeCompare(b, "es")).join(", ") || "—"]);
  worksheet.addRow([]);
  worksheet.addRow(["Etapa", "Órdenes del universo B", "Órdenes con dato", "Órdenes con dato válido", "Registros inválidos", "Cobertura %", "Promedio", "Mediana"]);
  styleHeader(worksheet.getRow(8));
  analyzeStages(rows, mapping).forEach((stage) => worksheet.addRow(stage.available
    ? [STAGE_LABELS[stage.key], stage.universeCount, stage.withDataCount, stage.validCount, stage.invalidCount, stage.coverage / 100, stage.average, stage.median]
    : [STAGE_LABELS[stage.key], rows.length, "Información no disponible", null, null, null, null, null]));
  const stageEndRow = worksheet.rowCount;
  styleData(worksheet, 9, stageEndRow, { integers: [2, 3, 4, 5], percents: [6], times: [7, 8] });
  const statusStart = stageEndRow + 2;
  worksheet.mergeCells(statusStart, 1, statusStart, 8);
  Object.assign(worksheet.getCell(statusStart, 1), { value: "Promedio por estatus", font: { name: "Aptos", bold: true, color: { argb: COLORS.white } }, fill: fill(COLORS.purple) });
  worksheet.addRow(["Estatus", "Órdenes", "Aceptación", "Llegar tienda", "Recoger", "Entregar", "Completar"]);
  styleHeader(worksheet.getRow(statusStart + 1));
  analyzeStagesByStatus(rows, mapping).forEach((group) => worksheet.addRow([
    group.status, group.count,
    ...["acceptance", "toStore", "pickup", "delivery", "completion"].map((key) => group.stages[key]?.average ?? null),
  ]));
  styleData(worksheet, statusStart + 2, worksheet.rowCount, { integers: [2], times: [3, 4, 5, 6, 7] });
  [42, 24, 22, 25, 20, 18, 18, 18].forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });
  configureTable(worksheet, 8, stageEndRow, 8);
}
function validationColor(category) {
  if (/Exacta|Muy cercana/i.test(category)) return [COLORS.green, COLORS.greenText];
  if (/Moderada/i.test(category)) return [COLORS.yellow, COLORS.yellowText];
  if (/Alta|Revisar/i.test(category)) return [COLORS.red, COLORS.redText];
  return [COLORS.neutral, COLORS.muted];
}
function makeValidationSheet(workbook, rows, mapping) {
  const worksheet = workbook.addWorksheet("Validación", { properties: { tabColor: { argb: COLORS.purple } } });
  const headers = ["orderId", "Creada en", "Completada en", "Restaurant", "Repartido por", "Tiempo oficial sin Cooking", "Tiempo calculado Creación → Completado sin Cooking", "Diferencia con signo", "Diferencia absoluta", "Clasificación de diferencia"];
  addTitle(worksheet, "Validación de tiempos", "Comparación entre el tiempo oficial y el tiempo calculado", headers.length);
  worksheet.addRow([]); worksheet.addRow(headers); styleHeader(worksheet.getRow(4));
  const validation = validateCalculatedTimes(rows, mapping);
  if (!validation.available || !validation.records.length) worksheet.addRow(["Información no disponible para realizar la validación."]);
  else validation.records.forEach((record) => worksheet.addRow([record.row.values.orderId, record.row.values.createdAt, record.row.values.completedAt, record.row.values.restaurant, record.row.values.provider, record.official, record.calculated, record.signed, record.absolute, record.category].map(cleanText)));
  styleData(worksheet, 5, worksheet.rowCount, { times: [6, 7, 8, 9], left: [1, 2, 3, 4, 5, 10] });
  for (let row = 5; row <= worksheet.rowCount; row += 1) { const cell = worksheet.getCell(row, 10); const [background, foreground] = validationColor(String(cell.value || "")); cell.fill = fill(background); cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: foreground } }; }
  [22, 22, 22, 28, 20, 24, 44, 20, 20, 26].forEach((width, index) => { worksheet.getColumn(index + 1).width = width; }); configureTable(worksheet, 4, worksheet.rowCount, headers.length);
}
function makeBaseSheet(workbook, rows, mapping) {
  const worksheet = workbook.addWorksheet("Base analizada", { properties: { tabColor: { argb: COLORS.purple } } });
  const originalColumns = [...new Set(Object.values(mapping))];
  const headers = [...originalColumns, "Fecha análisis", "Día", "Hora", "Mes", "Rango de tiempo", "Tiempo calculado Creación → Completado sin Cooking", "Diferencia de tiempo", "Clasificación de validación"];
  const validation = validateCalculatedTimes(rows, mapping); const validationByIndex = new Map(validation.records.map((record) => [record.row.index, record]));
  worksheet.addRow(headers.map(cleanText));
  rows.forEach((row) => { const record = validationByIndex.get(row.index); worksheet.addRow([...originalColumns.map((column) => cleanText(row.raw[column])), row.date, row.day, row.hour, row.month, classificationLabel(row.officialTime), record?.calculated ?? null, record?.signed ?? null, cleanText(record?.category ?? "No disponible")]); });
  styleHeader(worksheet.getRow(1));
  for (let column = originalColumns.length + 1; column <= headers.length; column += 1) Object.assign(worksheet.getCell(1, column), { fill: fill(COLORS.purpleSoft), font: { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.purpleDark } } });
  styleData(worksheet, 2, worksheet.rowCount, { integers: [originalColumns.length + 3], times: [originalColumns.length + 6, originalColumns.length + 7], left: headers.map((_, index) => index + 1) });
  headers.forEach((header, index) => { worksheet.getColumn(index + 1).width = Math.min(44, Math.max(14, String(header).length + 2)); }); configureTable(worksheet, 1, worksheet.rowCount, headers.length);
}

function filenameFor(rows) { const period = periodFor(rows); return period ? `Ambit_Tiempos_${period.start}_${period.end}.xlsx` : "Ambit_Tiempos_Analisis.xlsx"; }
function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
export async function exportDeliveryAnalysis({ rows, stageRows, dataset, mapping, filters, sourceFile }) {
  if (!window.ExcelJS) throw new Error("El generador local de Excel no está disponible.");
  const workbook = new window.ExcelJS.Workbook();
  Object.assign(workbook, { creator: "Ambit Data Studio", title: "Ambit Data Studio · Tiempos de entrega", subject: "Análisis local de tiempos de entrega", created: new Date() });
  makeSummarySheet(workbook, { rows, dataset, filters, sourceFile });
  makeBreakdownSheet(workbook, rows, "date", "fecha", Boolean(mapping.createdAt));
  makeBreakdownSheet(workbook, rows, "hour", "hora", Boolean(mapping.createdAt));
  makeBreakdownSheet(workbook, rows, "restaurant", "Restaurant", Boolean(mapping.restaurant));
  makeBreakdownSheet(workbook, rows, "zone", "Zona", Boolean(mapping.zone));
  makeBreakdownSheet(workbook, rows, "city", "Ciudad", Boolean(mapping.city));
  makeBreakdownSheet(workbook, rows, "provider", "Proveedor", Boolean(mapping.provider));
  makeStagesSheet(workbook, stageRows, mapping); makeValidationSheet(workbook, rows, mapping); makeBaseSheet(workbook, rows, mapping);
  const filename = filenameFor(rows); const buffer = await workbook.xlsx.writeBuffer(); downloadBuffer(buffer, filename);
  return { filename, sheetNames: workbook.worksheets.map((worksheet) => worksheet.name) };
}
