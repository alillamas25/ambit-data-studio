import { COLUMN_DEFINITIONS, OPTIONAL_COLUMNS, REQUIRED_COLUMNS } from "./constants.js";

export function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function comparableText(value) {
  return normalizeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

export function normalizeHeader(value) {
  return comparableText(value).toLowerCase();
}

export function mapColumns(headers) {
  const available = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mapping = {};
  Object.entries(COLUMN_DEFINITIONS).forEach(([canonical, aliases]) => {
    const alias = aliases.map(normalizeHeader).find((candidate) => available.has(candidate));
    if (alias) mapping[canonical] = available.get(alias);
  });
  return {
    mapping,
    missingRequired: REQUIRED_COLUMNS.filter((key) => !mapping[key]),
    missingOptional: OPTIONAL_COLUMNS.filter((key) => !mapping[key]),
  };
}

export function normalizeRows(rawRows, mapping) {
  return rawRows.map((raw, index) => ({
    index: index + 2,
    raw,
    values: Object.fromEntries(Object.entries(mapping).map(([canonical, original]) => [canonical, raw[original]])),
  }));
}
