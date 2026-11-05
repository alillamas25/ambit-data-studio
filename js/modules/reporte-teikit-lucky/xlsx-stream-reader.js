import { Unzip, UnzipInflate } from "../../vendor/fflate/browser.js";
import { SAXParser, SaxEventType } from "../../vendor/sax-wasm/index.js";
import { COLUMN_DEFINITIONS, OPTIONAL_COLUMNS, REQUIRED_COLUMNS } from "./constants.js";
import { normalizeHeader } from "./normalizer.js";

export const STREAMED_REPORT_FIELDS = Object.freeze([
  "restaurant", "status", "createdAt", "completedAt", "cookingTime", "plannedOrder",
  "officialTime", "paymentMethod", "provider", "distance", "rejectionReason",
]);

const SAX_EVENTS = SaxEventType.Text | SaxEventType.OpenTag | SaxEventType.CloseTag;
const DEFAULT_WASM_URL = new URL("../../vendor/sax-wasm/sax-wasm.wasm", import.meta.url);

export class XlsxStreamError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "XlsxStreamError";
    this.code = code;
  }
}

const localName = (value) => String(value || "").split(":").pop();
const normalizeZipPath = (value) => String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
const attributesOf = (tag) => Object.fromEntries(tag.attributes.map((attribute) => [attribute.name.value, attribute.value.value]));
const decodeXmlText = (value) => String(value || "")
  .replace(/&(?:#(x[0-9a-f]+|\d+)|amp|lt|gt|quot|apos);/gi, (entity, numeric) => {
    if (numeric) return String.fromCodePoint(numeric[0].toLowerCase() === "x" ? Number.parseInt(numeric.slice(1), 16) : Number(numeric));
    return ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[entity.toLowerCase()] || entity;
  })
  .replace(/_x([0-9a-f]{4})_/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));

function resolveZipPath(baseFile, target) {
  if (String(target).startsWith("/")) return normalizeZipPath(target);
  const parts = normalizeZipPath(baseFile).split("/");
  parts.pop();
  for (const part of normalizeZipPath(target).split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function joinChunks(chunks, totalLength) {
  const output = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.byteLength; });
  return output;
}

async function createParser(wasmSource = DEFAULT_WASM_URL) {
  const parser = new SAXParser(SAX_EVENTS);
  const configuredSource = typeof wasmSource === "function" ? wasmSource() : wasmSource;
  const source = configuredSource instanceof URL || typeof configuredSource === "string" ? fetch(configuredSource) : configuredSource;
  await parser.prepareWasm(source);
  return parser;
}

function writeParserChunk(parser, chunk, maximumChunkSize = 256 * 1024) {
  for (let offset = 0; offset < chunk.byteLength; offset += maximumChunkSize) {
    parser.write(chunk.subarray(offset, Math.min(chunk.byteLength, offset + maximumChunkSize)));
  }
}

async function streamZip(file, sinks, onBytes) {
  let failure = null;
  const found = new Set();
  const unzip = new Unzip((entry) => {
    const name = normalizeZipPath(entry.name);
    const sink = sinks.get(name);
    if (!sink) return;
    found.add(name);
    entry.ondata = (error, chunk, final) => {
      if (failure) return;
      if (error) { failure = error; return; }
      try { sink(chunk, final); } catch (caught) { failure = caught; }
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  const reader = file.stream().getReader();
  let bytesRead = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      unzip.push(value, false);
      if (failure) throw failure;
      onBytes?.(bytesRead, file.size);
    }
    unzip.push(new Uint8Array(), true);
    if (failure) throw failure;
    onBytes?.(file.size, file.size);
    return found;
  } catch (error) {
    try { await reader.cancel(error); } catch { /* no-op */ }
    throw error;
  }
}

async function parseSmallXml(bytes, wasmSource, onOpenTag) {
  const parser = await createParser(wasmSource);
  parser.eventHandler = (event, detail) => {
    if (event === SaxEventType.OpenTag) onOpenTag(localName(detail.name), attributesOf(detail));
  };
  writeParserChunk(parser, bytes);
  parser.end();
}

async function readMetadata(file, wasmSource, onProgress) {
  const workbookChunks = [], relationshipChunks = [];
  let workbookLength = 0, relationshipLength = 0;
  const sharedStrings = [];
  let sharedParts = null, insideText = false, sharedFound = false;
  const sharedParser = await createParser(wasmSource);
  sharedParser.eventHandler = (event, detail) => {
    if (event === SaxEventType.OpenTag) {
      const name = localName(detail.name);
      if (name === "si") sharedParts = [];
      if (name === "t" && sharedParts) insideText = true;
    } else if (event === SaxEventType.Text && insideText && sharedParts) {
      sharedParts.push(detail.value);
    } else if (event === SaxEventType.CloseTag) {
      const name = localName(detail.name);
      if (name === "t") insideText = false;
      if (name === "si" && sharedParts) { sharedStrings.push(decodeXmlText(sharedParts.join(""))); sharedParts = null; }
    }
  };
  const sinks = new Map([
    ["xl/workbook.xml", (chunk) => { const copy = chunk.slice(); workbookChunks.push(copy); workbookLength += copy.byteLength; }],
    ["xl/_rels/workbook.xml.rels", (chunk) => { const copy = chunk.slice(); relationshipChunks.push(copy); relationshipLength += copy.byteLength; }],
    ["xl/sharedStrings.xml", (chunk, final) => { sharedFound = true; writeParserChunk(sharedParser, chunk); if (final) sharedParser.end(); }],
  ]);
  let lastPercent = -1;
  const found = await streamZip(file, sinks, (bytesRead, totalBytes) => {
    const percent = totalBytes ? Math.floor((bytesRead / totalBytes) * 100) : 0;
    if (percent !== lastPercent) { lastPercent = percent; onProgress?.({ phase: "metadata", bytesRead, totalBytes, percent }); }
  });
  if (!found.has("xl/workbook.xml")) throw new XlsxStreamError("INVALID_XLSX", "El archivo no contiene la estructura principal de un XLSX.");
  if (!found.has("xl/_rels/workbook.xml.rels")) throw new XlsxStreamError("INVALID_XLSX", "El archivo no contiene las relaciones del libro Excel.");
  if (!sharedFound) sharedParser.end();

  let firstSheet = null;
  await parseSmallXml(joinChunks(workbookChunks, workbookLength), wasmSource, (name, attributes) => {
    if (name === "sheet" && !firstSheet) firstSheet = { name: attributes.name || "Hoja 1", relationshipId: attributes["r:id"] || attributes.id };
  });
  if (!firstSheet?.relationshipId) throw new XlsxStreamError("NO_WORKSHEETS", "El archivo de Excel no contiene hojas disponibles.");
  const relationships = new Map();
  await parseSmallXml(joinChunks(relationshipChunks, relationshipLength), wasmSource, (name, attributes) => {
    if (name === "Relationship" && attributes.Id && attributes.Target) relationships.set(attributes.Id, attributes.Target);
  });
  const target = relationships.get(firstSheet.relationshipId);
  if (!target) throw new XlsxStreamError("INVALID_XLSX", "No fue posible localizar la primera hoja del archivo Excel.");
  return { sheetName: firstSheet.name, sheetPath: resolveZipPath("xl/workbook.xml", target), sharedStrings };
}

function columnIndex(reference, fallback) {
  const match = String(reference || "").match(/^([A-Z]+)\d+$/i);
  if (!match) return fallback;
  return [...match[1].toUpperCase()].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function decodeCell(cell, sharedStrings) {
  const raw = cell.textParts.join("");
  if (!raw && !cell.hasValue) return null;
  if (cell.type === "s") {
    const index = Number(raw);
    return Number.isInteger(index) && index >= 0 ? sharedStrings[index] ?? null : null;
  }
  if (cell.type === "inlineStr" || cell.type === "str" || cell.type === "d") return decodeXmlText(raw);
  if (cell.type === "b") return raw === "1" || raw.toLowerCase() === "true";
  if (cell.type === "e") return null;
  const numeric = Number(raw);
  return raw !== "" && Number.isFinite(numeric) ? numeric : raw;
}

function buildColumnSelection(headers) {
  const available = new Map();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (normalized && !available.has(normalized)) available.set(normalized, { header, index });
  });
  const selected = {};
  for (const field of STREAMED_REPORT_FIELDS) {
    const definition = COLUMN_DEFINITIONS[field] || [];
    const match = definition.map(normalizeHeader).find((alias) => available.has(alias));
    if (match) selected[field] = available.get(match);
  }
  const missingRequired = REQUIRED_COLUMNS.filter((field) => !selected[field]);
  const missingOptional = OPTIONAL_COLUMNS.filter((field) => STREAMED_REPORT_FIELDS.includes(field) && !selected[field]);
  if (missingRequired.length) {
    const labels = { restaurant: "restaurant (Restaurant o Restaurante)", status: "status (Estatus de orden)" };
    throw new XlsxStreamError("MISSING_REQUIRED_COLUMNS", `Faltan columnas obligatorias: ${missingRequired.map((field) => labels[field] || field).join(", ")}.`);
  }
  return { selected, missingOptional };
}

async function readWorksheet(file, metadata, wasmSource, { onHeaders, onRow, onProgress }) {
  const parser = await createParser(wasmSource);
  let currentRow = null, currentCell = null, valueElement = null;
  let headerProcessed = false, headers = [], selected = {}, selectedIndexes = new Set(), missingOptional = [];
  let dataRows = 0, physicalDataRows = 0, emptyRows = 0, declaredRange = null, declaredRows = null, lastRowNumber = 0, lastProgressRow = 0;
  parser.eventHandler = (event, detail) => {
    if (event === SaxEventType.OpenTag) {
      const name = localName(detail.name), attributes = attributesOf(detail);
      if (name === "dimension" && attributes.ref) {
        declaredRange = attributes.ref;
        const end = attributes.ref.split(":").pop()?.match(/(\d+)$/);
        declaredRows = end ? Number(end[1]) : null;
      } else if (name === "row") {
        const number = Number(attributes.r) || lastRowNumber + 1;
        lastRowNumber = number;
        currentRow = { number, cells: new Map(), hasValue: false, nextColumn: 0 };
      } else if (name === "c" && currentRow) {
        const index = columnIndex(attributes.r, currentRow.nextColumn);
        currentRow.nextColumn = index + 1;
        const capture = !headerProcessed || selectedIndexes.has(index);
        currentCell = { index, type: attributes.t || "n", capture, textParts: [], hasValue: false };
      } else if ((name === "v" || name === "t") && currentCell) {
        valueElement = name;
      }
    } else if (event === SaxEventType.Text && currentCell && valueElement) {
      const value = detail.value;
      if (value !== "") currentRow.hasValue = true;
      currentCell.hasValue = true;
      if (currentCell.capture) currentCell.textParts.push(value);
    } else if (event === SaxEventType.CloseTag) {
      const name = localName(detail.name);
      if (name === "v" || name === "t") valueElement = null;
      else if (name === "c" && currentCell && currentRow) {
        if (currentCell.capture) currentRow.cells.set(currentCell.index, decodeCell(currentCell, metadata.sharedStrings));
        currentCell = null;
      } else if (name === "row" && currentRow) {
        if (!headerProcessed) {
          const maxColumn = Math.max(-1, ...currentRow.cells.keys());
          headers = Array.from({ length: maxColumn + 1 }, (_, index) => currentRow.cells.get(index) ?? null);
          const selection = buildColumnSelection(headers);
          selected = selection.selected;
          missingOptional = selection.missingOptional;
          selectedIndexes = new Set(Object.values(selected).map((column) => column.index));
          headerProcessed = true;
          onHeaders?.({ headers, selected, missingOptional, headerRow: currentRow.number });
        } else {
          physicalDataRows += 1;
          if (currentRow.hasValue) {
            const values = Object.fromEntries(STREAMED_REPORT_FIELDS.map((field) => [field, selected[field] ? currentRow.cells.get(selected[field].index) ?? null : null]));
            dataRows += 1;
            onRow?.({ index: currentRow.number, values });
          } else emptyRows += 1;
          if (physicalDataRows - lastProgressRow >= 1000) {
            lastProgressRow = physicalDataRows;
            onProgress?.({ phase: "rows", rowsProcessed: physicalDataRows, dataRows, emptyRows, totalRows: declaredRows ? Math.max(0, declaredRows - 1) : null, percent: declaredRows ? Math.min(100, Math.floor((currentRow.number / declaredRows) * 100)) : null });
          }
        }
        currentRow = null;
      }
    }
  };
  const sinks = new Map([[metadata.sheetPath, (chunk, final) => { writeParserChunk(parser, chunk); if (final) parser.end(); }]]);
  let lastBytePercent = -1;
  const found = await streamZip(file, sinks, (bytesRead, totalBytes) => {
    const percent = totalBytes ? Math.floor((bytesRead / totalBytes) * 100) : 0;
    if (percent !== lastBytePercent) { lastBytePercent = percent; onProgress?.({ phase: "sheet-bytes", bytesRead, totalBytes, percent }); }
  });
  if (!found.has(metadata.sheetPath)) throw new XlsxStreamError("INVALID_XLSX", "No fue posible leer la primera hoja del archivo Excel.");
  if (!headerProcessed) throw new XlsxStreamError("EMPTY_WORKSHEET", "La hoja de Excel no contiene encabezados.");
  onProgress?.({ phase: "rows", rowsProcessed: physicalDataRows, dataRows, emptyRows, totalRows: declaredRows ? Math.max(0, declaredRows - 1) : null, percent: 100 });
  return { rowCount: dataRows, physicalRowCount: physicalDataRows, emptyRowCount: emptyRows, headers, selected, missingOptional, declaredRange, declaredRows };
}

export async function readXlsxIncrementally(file, options = {}) {
  if (!file?.stream || !Number.isFinite(file.size)) throw new XlsxStreamError("INVALID_FILE", "Selecciona un archivo XLSX válido.");
  const startedAt = performance.now();
  try {
    const metadata = await readMetadata(file, options.wasmSource, options.onProgress);
    const worksheet = await readWorksheet(file, metadata, options.wasmSource, options);
    return {
      ...worksheet,
      sheetName: metadata.sheetName,
      sheetPath: metadata.sheetPath,
      sharedStringCount: metadata.sharedStrings.length,
      selectedColumns: Object.entries(worksheet.selected).map(([field, column]) => ({ field, header: column.header, columnIndex: column.index })),
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    if (error instanceof XlsxStreamError) throw error;
    throw new XlsxStreamError("XLSX_READ_ERROR", "No se pudo interpretar el archivo XLSX de forma incremental.", error);
  }
}
