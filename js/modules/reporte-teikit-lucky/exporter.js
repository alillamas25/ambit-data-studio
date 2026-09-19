const COLORS = Object.freeze({
  purple: "FF7D20F8",
  purpleDark: "FF6414D1",
  purpleSoft: "FFF2EAFF",
  ink: "FF202124",
  muted: "FF68707C",
  white: "FFFFFFFF",
  canvas: "FFF7F7F9",
  border: "FFDEDFE4",
  green: "FFEAF6EF",
  greenText: "FF1E6547",
  amber: "FFFFF4D6",
  amberText: "FF765610",
  red: "FFFFEAEA",
  redText: "FF8B1A1A",
});

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thinBorder = { bottom: { style: "thin", color: { argb: COLORS.border } } };
const pct = (value) => value / 100;
const numericOrNull = (value) => Number.isFinite(value) ? value : null;

function mojibakeScore(value) {
  return (String(value).match(/Ã.|Â.|â€|ðŸ/g) || []).length;
}

function cleanText(value) {
  if (typeof value !== "string" || !/[ÃÂâ]/.test(value)) return value;
  try {
    const points = [...value].map((character) => character.charCodeAt(0));
    if (points.some((point) => point > 255)) return value;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(points));
    return !decoded.includes("�") && mojibakeScore(decoded) < mojibakeScore(value) ? decoded : value;
  } catch {
    return value;
  }
}

function styleTitle(worksheet, brand, sourceFile) {
  worksheet.mergeCells("A2:Q2");
  Object.assign(worksheet.getCell("A2"), {
    value: `Reporte operativo · ${brand}`,
    font: { name: "Aptos Display", size: 16, bold: true, color: { argb: COLORS.ink } },
    alignment: { vertical: "middle" },
  });
  worksheet.getRow(2).height = 28;
  worksheet.mergeCells("A3:Q3");
  Object.assign(worksheet.getCell("A3"), {
    value: "AMBIT DATA STUDIO",
    font: { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.purpleDark } },
    border: { bottom: { style: "medium", color: { argb: COLORS.purple } } },
  });
  worksheet.mergeCells("A4:H4");
  Object.assign(worksheet.getCell("A4"), {
    value: `Archivo: ${cleanText(sourceFile || "Archivo operativo")}`,
    font: { name: "Aptos", size: 9, color: { argb: COLORS.muted }, italic: true },
  });
  worksheet.mergeCells("I4:Q4");
  Object.assign(worksheet.getCell("I4"), {
    value: `Generado: ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`,
    font: { name: "Aptos", size: 9, color: { argb: COLORS.muted }, italic: true },
    alignment: { horizontal: "right" },
  });
}

function sectionBand(worksheet, row, title, lastColumn = 17) {
  worksheet.mergeCells(row, 1, row, lastColumn);
  Object.assign(worksheet.getCell(row, 1), {
    value: title,
    fill: fill(COLORS.purpleDark),
    font: { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.white } },
    alignment: { vertical: "middle" },
  });
  worksheet.getRow(row).height = 22;
}

function styleHeader(row) {
  row.height = 25;
  row.eachCell({ includeEmpty: true }, (cell) => Object.assign(cell, {
    fill: fill(COLORS.purple),
    font: { name: "Aptos", size: 9, bold: true, color: { argb: COLORS.white } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: { bottom: { style: "thin", color: { argb: COLORS.white } } },
  }));
}

function styleRows(worksheet, startRow, endRow, { integerColumns = [], percentColumns = [], decimalColumns = [], minuteColumns = [], leftColumns = [1] } = {}) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.height = 21;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.value = cleanText(cell.value);
      Object.assign(cell, {
        font: { name: "Aptos", size: 9, color: { argb: COLORS.ink } },
        fill: fill(rowNumber % 2 ? COLORS.canvas : COLORS.white),
        border: thinBorder,
        alignment: { horizontal: leftColumns.includes(column) ? "left" : "right", vertical: "middle" },
      });
      if (integerColumns.includes(column)) cell.numFmt = "#,##0";
      if (percentColumns.includes(column)) cell.numFmt = "0.00%";
      if (decimalColumns.includes(column)) cell.numFmt = "0.00";
      if (minuteColumns.includes(column)) cell.numFmt = '0.00 "min"';
    });
  }
}

function addSummary(worksheet, report) {
  const summary = report.summary;
  sectionBand(worksheet, 6, "Resumen general", 8);
  const rows = [
    ["Órdenes totales", summary.total, null],
    ["Entregadas (COMPLETE)", summary.delivered, pct(summary.deliveredPercentage)],
    ["CANCELLED", summary.cancelled, null],
    ["REJECTED", summary.rejected, null],
    ["RETURNED", summary.returned, null],
    ["No entregadas", summary.notDelivered, pct(summary.notDeliveredPercentage)],
    ["Otros estatus", summary.otherStatuses, null],
    ["Tiempo promedio", numericOrNull(summary.averageDeliveryTime), null],
    ["Tiempo mediano", numericOrNull(summary.medianDeliveryTime), null],
    ["Distancia promedio", numericOrNull(summary.averageDistance), null],
  ];
  worksheet.getRow(7).values = ["Indicador", "Cantidad / valor", "Porcentaje"];
  styleHeader(worksheet.getRow(7));
  rows.forEach((values) => worksheet.addRow(values));
  styleRows(worksheet, 8, 17, { integerColumns: [2], percentColumns: [3] });
  worksheet.getCell("B15").numFmt = '0.00 "min"';
  worksheet.getCell("B16").numFmt = '0.00 "min"';
  worksheet.getCell("B17").numFmt = "0.00";
}

function addSla(worksheet, report) {
  const summary = report.summary;
  sectionBand(worksheet, 19, "SLA", 8);
  worksheet.getRow(20).values = ["Rango", "Órdenes", "Porcentaje"];
  styleHeader(worksheet.getRow(20));
  [
    ["<45", summary.under45, pct(summary.under45Percentage)],
    ["45–60", summary.between45And60, pct(summary.between45And60Percentage)],
    [">60", summary.over60, pct(summary.over60Percentage)],
    ["COMPLETE sin tiempo calculable", summary.invalidSla, null],
    ["COMPLETE programadas", summary.scheduledComplete, null],
    ["COMPLETE no programadas", summary.nonScheduledComplete, null],
  ].forEach((values) => worksheet.addRow(values));
  styleRows(worksheet, 21, 26, { integerColumns: [2], percentColumns: [3] });
  worksheet.getCell("A21").fill = fill(COLORS.green); worksheet.getCell("A21").font = { name: "Aptos", size: 9, bold: true, color: { argb: COLORS.greenText } };
  worksheet.getCell("A22").fill = fill(COLORS.amber); worksheet.getCell("A22").font = { name: "Aptos", size: 9, bold: true, color: { argb: COLORS.amberText } };
  worksheet.getCell("A23").fill = fill(COLORS.red); worksheet.getCell("A23").font = { name: "Aptos", size: 9, bold: true, color: { argb: COLORS.redText } };
  worksheet.mergeCells("F20:Q20");
  Object.assign(worksheet.getCell("F20"), {
    value: "Regla: programadas usan Tiempo total de envio sin cooking time; no programadas usan Completada en - Creada en - Cooking Time.",
    fill: fill(COLORS.purpleSoft),
    font: { name: "Aptos", size: 9, color: { argb: COLORS.purpleDark } },
    alignment: { vertical: "middle", wrapText: true },
  });
  worksheet.getRow(20).height = 32;
}

function addPayments(worksheet, report) {
  const summary = report.summary;
  sectionBand(worksheet, 29, "Pagos", 8);
  worksheet.getRow(30).values = ["Método", "Órdenes", "Porcentaje"];
  styleHeader(worksheet.getRow(30));
  [
    ["CASH", summary.cash, pct(summary.cashPercentage)],
    ["CREDIT_CARD", summary.creditCard, pct(summary.creditCardPercentage)],
    ["Otros métodos", summary.otherPayments, pct(summary.otherPaymentsPercentage)],
    ["Sin método registrado", summary.emptyPayments, pct(summary.emptyPaymentsPercentage)],
  ].forEach((values) => worksheet.addRow(values));
  styleRows(worksheet, 31, 34, { integerColumns: [2], percentColumns: [3] });
}

function addProviders(worksheet, report) {
  const providers = report.providerSummary;
  const total = report.summary.total;
  sectionBand(worksheet, 36, "Proveedores logísticos", 8);
  worksheet.getRow(37).values = ["Proveedor", "Órdenes", "Participación"];
  styleHeader(worksheet.getRow(37));
  [
    ["UBER_DAAS", providers.uber, total ? providers.uber / total : 0],
    ["RAPPI_CARGO", providers.rappi, total ? providers.rappi / total : 0],
    ["DIDI_DELIVERY", providers.didi, total ? providers.didi / total : 0],
    ["Otros proveedores", providers.other, total ? providers.other / total : 0],
    ["Sin proveedor", providers.empty, total ? providers.empty / total : 0],
  ].forEach((values) => worksheet.addRow(values));
  styleRows(worksheet, 38, 42, { integerColumns: [2], percentColumns: [3] });
}

function providerShare(branch, provider) {
  return branch.providers.find((row) => row.label === provider)?.percentage / 100 || 0;
}

function addBranches(worksheet, report) {
  const sectionRow = 44;
  const headerRow = 45;
  sectionBand(worksheet, sectionRow, "Sucursales", 19);
  worksheet.getRow(headerRow).values = ["Sucursal", "Órdenes", "COMPLETE", "% COMPLETE", "No entregadas", "% no entregadas", "<45", "% <45", "45–60", "% 45–60", ">60", "% >60", "Tiempo promedio", "CASH", "CREDIT_CARD", "Distancia promedio", "UBER_DAAS %", "RAPPI_CARGO %", "DIDI_DELIVERY %"];
  styleHeader(worksheet.getRow(headerRow));
  report.branches.forEach((branch) => worksheet.addRow([
    branch.restaurant, branch.total, branch.complete, pct(branch.completePercentage), branch.notDelivered, pct(branch.notDeliveredPercentage),
    branch.under45, pct(branch.under45Percentage), branch.between45And60, pct(branch.between45And60Percentage), branch.over60, pct(branch.over60Percentage),
    numericOrNull(branch.averageDeliveryTime), branch.cash, branch.creditCard, numericOrNull(branch.averageDistance),
    providerShare(branch, "UBER_DAAS"), providerShare(branch, "RAPPI_CARGO"), providerShare(branch, "DIDI_DELIVERY"),
  ]));
  const endRow = headerRow + report.branches.length;
  styleRows(worksheet, headerRow + 1, endRow, { integerColumns: [2, 3, 5, 7, 9, 11, 14, 15], percentColumns: [4, 6, 8, 10, 12, 17, 18, 19], minuteColumns: [13], decimalColumns: [16] });
  worksheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: endRow, column: 19 } };
  worksheet.views = [{ state: "frozen", xSplit: 1, ySplit: 4, topLeftCell: "B5", activeCell: "B5", showGridLines: false }];
  return endRow;
}

function addIncidents(worksheet, report, startRow) {
  sectionBand(worksheet, startRow, "Incidencias");
  let row = startRow + 1;
  report.incidents.forEach((incident) => {
    worksheet.mergeCells(row, 1, row, 4);
    Object.assign(worksheet.getCell(row, 1), {
      value: `${incident.status} · ${incident.total.toLocaleString("es-MX")} órdenes`,
      fill: fill(COLORS.purpleSoft),
      font: { name: "Aptos", size: 9, bold: true, color: { argb: COLORS.purpleDark } },
    });
    row += 1;
    worksheet.getRow(row).values = ["Sucursal", "Motivo", "Cantidad", "Porcentaje"];
    styleHeader(worksheet.getRow(row));
    const firstDataRow = row + 1;
    if (incident.reasons.length) {
      incident.reasons.forEach((reason) => worksheet.addRow([reason.restaurant, reason.label, reason.count, pct(reason.percentage)]));
    } else {
      worksheet.addRow(["Sin registros", "Sin registros", 0, null]);
    }
    row = firstDataRow + Math.max(incident.reasons.length, 1) - 1;
    styleRows(worksheet, firstDataRow, row, { integerColumns: [3], percentColumns: [4], leftColumns: [1, 2] });
    row += 2;
  });
  return row;
}

function configureColumns(worksheet) {
  [42, 30, 15, 15, 17, 17, 12, 12, 12, 12, 12, 12, 19, 13, 16, 19, 17, 18, 18].forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });
  worksheet.properties.defaultRowHeight = 18;
  worksheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  worksheet.headerFooter.oddFooter = "Ambit Data Studio · Reporte TEIKIT & LUCKY · Página &P de &N";
}

function makeBrandSheet(workbook, report, sourceFile) {
  const worksheet = workbook.addWorksheet(report.brand, { properties: { tabColor: { argb: COLORS.purpleDark } }, views: [{ showGridLines: false }] });
  styleTitle(worksheet, report.brand, sourceFile);
  addSummary(worksheet, report);
  addSla(worksheet, report);
  addPayments(worksheet, report);
  addProviders(worksheet, report);
  const branchEnd = addBranches(worksheet, report);
  addIncidents(worksheet, report, branchEnd + 2);
  configureColumns(worksheet);
}

function filenameFor(sourceFile) {
  const base = String(sourceFile || "Reporte").replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
  return `Ambit_Reporte_TEIKIT_LUCKY_${base || "Operativo"}.xlsx`;
}

function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function createTeikitLuckyWorkbook({ report, sourceFile }) {
  if (!window.ExcelJS) throw new Error("El generador local de Excel no está disponible.");
  const workbook = new window.ExcelJS.Workbook();
  Object.assign(workbook, {
    creator: "Ambit Data Studio",
    title: "Reporte TEIKIT & LUCKY",
    subject: "Reporte operativo ejecutivo",
    created: new Date(),
  });
  makeBrandSheet(workbook, report.brands.TEIKIT, sourceFile);
  makeBrandSheet(workbook, report.brands.LUCKY, sourceFile);
  return workbook;
}

export async function exportTeikitLuckyReport({ report, sourceFile }) {
  const workbook = await createTeikitLuckyWorkbook({ report, sourceFile });
  const filename = filenameFor(sourceFile);
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
  return { filename, sheetNames: workbook.worksheets.map((worksheet) => worksheet.name), buffer };
}
