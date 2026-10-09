const COLORS = Object.freeze({ purple: "FF7D20F8", purpleDark: "FF6414D1", purpleSoft: "FFF2EAFF", ink: "FF202124", muted: "FF68707C", white: "FFFFFFFF", canvas: "FFF7F7F9", border: "FFDEDFE4", green: "FFEAF6EF", amber: "FFFFF4D6", red: "FFFFEAEA" });
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const percentValue = (value) => value / 100;

function cleanText(value) {
  return String(value ?? "");
}

function filterDescription(filters) {
  const labels = { start: "Desde", end: "Hasta", brand: "Marca", restaurant: "Sucursal", city: "Ciudad", zone: "Zona", provider: "Proveedor", status: "Estatus" };
  const active = Object.entries(filters).filter(([, value]) => value).map(([key, value]) => `${labels[key]}: ${value}`);
  return active.length ? active.join(" · ") : "Sin filtros adicionales";
}

function periodDescription(analysis, filters) {
  if (filters.start || filters.end) return `${filters.start || "Inicio disponible"} a ${filters.end || "Fin disponible"}`;
  if (!analysis.trend.length) return "Sin fechas válidas";
  return `${analysis.trend[0].label} a ${analysis.trend.at(-1).label}`;
}

function configureSheet(sheet, widths) {
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 5, topLeftCell: "B6", activeCell: "B6", showGridLines: false }];
  sheet.properties.defaultRowHeight = 19;
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; sheet.getColumn(index + 1).hidden = false; });
  sheet.pageSetup = { orientation: "landscape", fitToPage: false, margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  sheet.headerFooter.oddFooter = "Ambit Data Studio · Estatus, Demanda y Tendencias · Página &P de &N";
}

function titleBlock(sheet, title, analysis, filters, sourceFile) {
  sheet.getCell("A2").value = title;
  sheet.getCell("A2").font = { name: "Aptos Display", size: 15, bold: true, color: { argb: COLORS.ink } };
  sheet.getCell("A3").value = `Periodo: ${periodDescription(analysis, filters)}`;
  sheet.getCell("A3").font = { name: "Aptos", size: 9, color: { argb: COLORS.muted }, italic: true };
  sheet.getCell("A4").value = `Filtros: ${filterDescription(filters)} · Archivo: ${cleanText(sourceFile || "Archivo operativo")}`;
  sheet.getCell("A4").font = { name: "Aptos", size: 9, color: { argb: COLORS.muted }, italic: true };
}

function styleTable(sheet, headerRow, firstDataRow, lastDataRow, columnCount, { integerColumns = [], percentColumns = [], textColumns = [1], dateColumns = [] } = {}) {
  const header = sheet.getRow(headerRow);
  header.height = 28;
  for (let column = 1; column <= columnCount; column += 1) {
    const cell = header.getCell(column);
    Object.assign(cell, { fill: fill(COLORS.purpleDark), font: { name: "Aptos", size: 9, bold: true, color: { argb: COLORS.white } }, alignment: { horizontal: "center", vertical: "middle", wrapText: true }, border: { right: { style: "thin", color: { argb: COLORS.white } } } });
  }
  for (let rowNumber = firstDataRow; rowNumber <= lastDataRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber); row.height = 21;
    for (let column = 1; column <= columnCount; column += 1) {
      const cell = row.getCell(column);
      Object.assign(cell, { fill: fill(rowNumber % 2 ? COLORS.canvas : COLORS.white), font: { name: "Aptos", size: 9, color: { argb: COLORS.ink } }, alignment: { horizontal: textColumns.includes(column) ? "left" : "right", vertical: "middle" }, border: { bottom: { style: "thin", color: { argb: COLORS.border } } } });
      if (integerColumns.includes(column)) cell.numFmt = "#,##0";
      if (percentColumns.includes(column)) cell.numFmt = "0.00%";
      if (dateColumns.includes(column)) cell.numFmt = "yyyy-mm-dd";
    }
  }
  if (lastDataRow >= firstDataRow) sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastDataRow, column: columnCount } };
}

function addTableSheet(workbook, name, title, headers, rows, analysis, filters, sourceFile, options) {
  const sheet = workbook.addWorksheet(name, { properties: { tabColor: { argb: COLORS.purpleDark } } });
  titleBlock(sheet, title, analysis, filters, sourceFile);
  sheet.getRow(5).values = headers;
  rows.forEach((values) => sheet.addRow(values));
  styleTable(sheet, 5, 6, 5 + rows.length, headers.length, options);
  configureSheet(sheet, options.widths);
  return sheet;
}

function dimensionRows(rows) {
  return rows.map((row) => [row.label, row.total, row.complete, percentValue(row.completePercentage), row.notDelivered, percentValue(row.notDeliveredPercentage)]);
}

function temporalRows(rows, labelTransform = (value) => value) {
  return rows.map((row) => [labelTransform(row.label), row.total, row.complete, percentValue(row.completePercentage), row.notDelivered, percentValue(row.notDeliveredPercentage), row.cancelled, row.rejected, row.returned]);
}

function addSummary(workbook, analysis, filters, sourceFile) {
  const sheet = workbook.addWorksheet("Resumen", { properties: { tabColor: { argb: COLORS.purpleDark } }, views: [{ showGridLines: false }] });
  titleBlock(sheet, "Estatus, Demanda y Tendencias", analysis, filters, sourceFile);
  const summary = analysis.summary;
  const peakDay = [...analysis.byDay].sort((a, b) => b.total - a.total)[0];
  const peakHour = [...analysis.byHour].sort((a, b) => b.total - a.total)[0];
  const metrics = [
    ["Órdenes totales", summary.total, null], ["COMPLETE", summary.complete, percentValue(summary.completePercentage)],
    ["No entregadas", summary.notDelivered, percentValue(summary.notDeliveredPercentage)], ["CANCELLED", summary.cancelled, summary.total ? summary.cancelled / summary.total : 0],
    ["REJECTED", summary.rejected, summary.total ? summary.rejected / summary.total : 0], ["RETURNED", summary.returned, summary.total ? summary.returned / summary.total : 0],
    ["Otros estatus", summary.otherStatuses, summary.total ? summary.otherStatuses / summary.total : 0],
  ];
  sheet.getRow(6).values = ["Indicador", "Cantidad", "Porcentaje"];
  metrics.forEach((row) => sheet.addRow(row));
  styleTable(sheet, 6, 7, 6 + metrics.length, 3, { integerColumns: [2], percentColumns: [3], textColumns: [1] });
  sheet.getCell("E6").value = "Picos de demanda"; sheet.getCell("E6").fill = fill(COLORS.purpleDark); sheet.getCell("E6").font = { bold: true, color: { argb: COLORS.white } };
  sheet.getCell("E7").value = "Día de mayor demanda"; sheet.getCell("F7").value = peakDay?.label || "Sin datos"; sheet.getCell("G7").value = peakDay?.total || 0;
  sheet.getCell("E8").value = "Hora de mayor demanda"; sheet.getCell("F8").value = peakHour ? `${String(peakHour.label).padStart(2, "0")}:00` : "Sin datos"; sheet.getCell("G8").value = peakHour?.total || 0;
  sheet.getCell("E10").value = "Estatus encontrados"; sheet.getCell("E10").fill = fill(COLORS.purpleDark); sheet.getCell("E10").font = { bold: true, color: { argb: COLORS.white } };
  analysis.statuses.forEach((status, index) => { const row = 11 + index; sheet.getCell(row, 5).value = status.label; sheet.getCell(row, 6).value = status.count; sheet.getCell(row, 7).value = percentValue(status.percentage); sheet.getCell(row, 6).numFmt = "#,##0"; sheet.getCell(row, 7).numFmt = "0.00%"; });
  sheet.getCell("I6").value = "Participación por proveedor"; sheet.getCell("I6").fill = fill(COLORS.purpleDark); sheet.getCell("I6").font = { bold: true, color: { argb: COLORS.white } };
  analysis.byProvider.forEach((provider, index) => { const row = 7 + index; sheet.getCell(row, 9).value = provider.label; sheet.getCell(row, 10).value = provider.total; sheet.getCell(row, 11).value = percentValue(provider.participation); sheet.getCell(row, 10).numFmt = "#,##0"; sheet.getCell(row, 11).numFmt = "0.00%"; });
  configureSheet(sheet, [30, 15, 15, 3, 28, 20, 15, 3, 24, 15, 16]);
  sheet.views = [{ showGridLines: false }];
  return sheet;
}

export async function createStatusDemandWorkbook({ analysis, filters, sourceFile }) {
  if (!window.ExcelJS) throw new Error("El generador local de Excel no está disponible.");
  const workbook = new window.ExcelJS.Workbook();
  Object.assign(workbook, { creator: "Ambit Data Studio", title: "Estatus, Demanda y Tendencias", created: new Date() });
  addSummary(workbook, analysis, filters, sourceFile);
  addTableSheet(workbook, "Tendencia", "Tendencia por fecha", ["Fecha", "Total", "COMPLETE", "% COMPLETE", "No entregadas", "% no entregadas", "CANCELLED", "REJECTED", "RETURNED"], temporalRows(analysis.trend), analysis, filters, sourceFile, { widths: [14, 13, 13, 15, 16, 18, 14, 14, 14], integerColumns: [2, 3, 5, 7, 8, 9], percentColumns: [4, 6], textColumns: [1] });
  addTableSheet(workbook, "Por día", "Demanda por día de semana", ["Día", "Total", "COMPLETE", "% COMPLETE", "No entregadas", "% no entregadas", "CANCELLED", "REJECTED", "RETURNED"], temporalRows(analysis.byDay), analysis, filters, sourceFile, { widths: [18, 13, 13, 15, 16, 18, 14, 14, 14], integerColumns: [2, 3, 5, 7, 8, 9], percentColumns: [4, 6], textColumns: [1] });
  addTableSheet(workbook, "Por hora", "Demanda por hora", ["Hora", "Total", "COMPLETE", "% COMPLETE", "No entregadas", "% no entregadas"], analysis.byHour.map((row) => [`${String(row.label).padStart(2, "0")}:00`, row.total, row.complete, percentValue(row.completePercentage), row.notDelivered, percentValue(row.notDeliveredPercentage)]), analysis, filters, sourceFile, { widths: [14, 13, 13, 15, 16, 18], integerColumns: [2, 3, 5], percentColumns: [4, 6], textColumns: [1] });
  const dimensionHeaders = ["Dimensión", "Total", "COMPLETE", "% COMPLETE", "No entregadas", "% no entregadas"];
  [["Sucursales", "Desempeño por sucursal", analysis.byRestaurant, 42], ["Marcas", "Desempeño por marca", analysis.byBrand, 30], ["Ciudades", "Desempeño por ciudad", analysis.byCity, 30], ["Zonas", "Desempeño por zona", analysis.byZone, 30]].forEach(([name, title, rows, width]) => addTableSheet(workbook, name, title, dimensionHeaders, dimensionRows(rows), analysis, filters, sourceFile, { widths: [width, 13, 13, 15, 16, 18], integerColumns: [2, 3, 5], percentColumns: [4, 6], textColumns: [1] }));
  addTableSheet(workbook, "Proveedores", "Participación por proveedor", ["Proveedor", "Total", "Participación %", "COMPLETE", "% COMPLETE", "No entregadas", "% no entregadas", "CANCELLED", "REJECTED", "RETURNED"], analysis.byProvider.map((row) => [row.label, row.total, percentValue(row.participation), row.complete, percentValue(row.completePercentage), row.notDelivered, percentValue(row.notDeliveredPercentage), row.cancelled, row.rejected, row.returned]), analysis, filters, sourceFile, { widths: [24, 13, 18, 13, 15, 16, 18, 14, 14, 14], integerColumns: [2, 4, 6, 8, 9, 10], percentColumns: [3, 5, 7], textColumns: [1] });
  analysis.incidents.forEach((group) => addTableSheet(workbook, group.status, group.status, ["Sucursal", "Motivo", "Cantidad", "Porcentaje"], group.rows.map((row) => [row.restaurant, row.reason, row.count, percentValue(row.percentage)]), analysis, filters, sourceFile, { widths: [42, 34, 14, 16], integerColumns: [3], percentColumns: [4], textColumns: [1, 2] }));
  return workbook;
}

function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportStatusDemandAnalysis({ analysis, filters, sourceFile }) {
  const workbook = await createStatusDemandWorkbook({ analysis, filters, sourceFile });
  const base = String(sourceFile || "Analisis").replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "Analisis";
  const filename = `Ambit_Estatus_Demanda_Tendencias_${base}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
  return { filename, buffer, sheetNames: workbook.worksheets.map((sheet) => sheet.name) };
}
