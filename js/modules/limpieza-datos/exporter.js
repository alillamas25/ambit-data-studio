import { REQUIRED_COLUMNS } from "./constants.js";
import { CleaningError, validateCleanResult } from "./cleaner.js";

export function buildCleanFilename(originalName) {
  const baseName = String(originalName || "archivo").replace(/\.[^.]+$/, "");
  return `${baseName}_LIMPIO.xlsx`;
}

export function createCleanWorkbook(result, xlsx) {
  const validation = validateCleanResult(result);
  if (!validation.passed) {
    throw new CleaningError(`No se pudo generar la descarga: ${validation.errors.join(" ")}`, "DOWNLOAD_BLOCKED");
  }
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.aoa_to_sheet([REQUIRED_COLUMNS, ...result.rows], { cellDates: true });
  xlsx.utils.book_append_sheet(workbook, worksheet, "CLEAN");
  return workbook;
}

export function downloadCleanWorkbook(result, originalName, xlsx = window.XLSX) {
  const workbook = createCleanWorkbook(result, xlsx);
  const bytes = xlsx.write(workbook, { bookType: "xlsx", type: "array", cellDates: true });
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = buildCleanFilename(originalName);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
