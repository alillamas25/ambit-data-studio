import { ALLOWED_PROVIDERS, REQUIRED_COLUMNS } from "./constants.js";

export class CleaningError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "CleaningError";
    this.code = code;
    Object.assign(this, details);
  }
}

export function findMissingColumns(headers) {
  return REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
}

export function validateCleanResult(result) {
  const errors = [];
  const columnsAreExact = result.columns?.length === REQUIRED_COLUMNS.length
    && result.columns.every((column, index) => column === REQUIRED_COLUMNS[index]);
  if (!columnsAreExact) errors.push("La estructura de salida no contiene las 22 columnas en el orden requerido.");

  const orderIdIndex = REQUIRED_COLUMNS.indexOf("orderId");
  const providerIndex = REQUIRED_COLUMNS.indexOf("Repartido por");
  const orderIds = new Set();
  for (const row of result.rows || []) {
    const orderId = row[orderIdIndex];
    if (orderIds.has(orderId)) errors.push("La salida contiene orderId duplicados.");
    orderIds.add(orderId);
    if (!ALLOWED_PROVIDERS.includes(row[providerIndex])) errors.push("La salida contiene proveedores no permitidos.");
  }

  if (result.summary?.final !== result.summary?.providerFiltered - result.summary?.duplicatesRemoved) {
    errors.push("El total final no reconcilia con el filtrado y los duplicados eliminados.");
  }
  const providerTotal = ALLOWED_PROVIDERS.reduce((sum, provider) => sum + (result.summary?.providers?.[provider] || 0), 0);
  if (providerTotal !== result.summary?.final) errors.push("La suma por proveedor no reconcilia con el total final.");

  const sourceIndices = result.sourceIndices || [];
  if (sourceIndices.length !== (result.rows || []).length
      || sourceIndices.some((value, index) => index > 0 && value <= sourceIndices[index - 1])) {
    errors.push("El orden relativo de las filas sobrevivientes fue alterado.");
  }
  if ((result.rows || []).some((row) => row.length !== REQUIRED_COLUMNS.length)) {
    errors.push("Una o más filas no contienen exactamente 22 valores.");
  }

  return { passed: errors.length === 0, errors };
}

export function cleanRows(headers, rows) {
  const missingColumns = findMissingColumns(headers);
  if (missingColumns.length) {
    throw new CleaningError(
      `No se pudo realizar la limpieza. Faltan las siguientes columnas: [${missingColumns.join(", ")}]`,
      "MISSING_COLUMNS",
      { missingColumns },
    );
  }

  const indexes = Object.fromEntries(REQUIRED_COLUMNS.map((column) => [column, headers.indexOf(column)]));
  const allowed = new Set(ALLOWED_PROVIDERS);
  const filtered = [];
  rows.forEach((row, sourceIndex) => {
    if (allowed.has(row[indexes["Repartido por"]])) filtered.push({ row, sourceIndex });
  });

  const seenOrderIds = new Set();
  const survivors = [];
  for (const entry of filtered) {
    const orderId = entry.row[indexes.orderId];
    if (seenOrderIds.has(orderId)) continue;
    seenOrderIds.add(orderId);
    survivors.push(entry);
  }

  const outputRows = survivors.map(({ row }) => REQUIRED_COLUMNS.map((column) => row[indexes[column]]));
  const providers = Object.fromEntries(ALLOWED_PROVIDERS.map((provider) => [provider, 0]));
  outputRows.forEach((row) => { providers[row[REQUIRED_COLUMNS.indexOf("Repartido por")]] += 1; });

  const result = {
    columns: [...REQUIRED_COLUMNS],
    rows: outputRows,
    sourceIndices: survivors.map(({ sourceIndex }) => sourceIndex),
    summary: {
      original: rows.length,
      providerFiltered: filtered.length,
      duplicatesRemoved: filtered.length - survivors.length,
      final: survivors.length,
      providers,
    },
  };
  result.validation = validateCleanResult(result);
  if (!result.validation.passed) {
    throw new CleaningError(`No se pudo validar el archivo limpio: ${result.validation.errors.join(" ")}`, "OUTPUT_VALIDATION", { result });
  }
  return result;
}
