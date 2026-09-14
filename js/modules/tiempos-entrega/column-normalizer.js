import { COLUMN_DEFINITIONS, REQUIRED_COLUMNS } from "./constants.js";

export function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function mapColumns(headers) {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mapping = {};

  Object.entries(COLUMN_DEFINITIONS).forEach(([canonical, aliases]) => {
    const match = aliases.map(normalizeHeader).find((alias) => normalizedHeaders.has(alias));
    if (match) mapping[canonical] = normalizedHeaders.get(match);
  });

  return {
    mapping,
    missingRequired: REQUIRED_COLUMNS.filter((column) => !mapping[column]),
  };
}

export function normalizeRows(rawRows, mapping) {
  return rawRows.map((raw, index) => {
    const values = {};
    Object.entries(mapping).forEach(([canonical, original]) => {
      values[canonical] = raw[original];
    });
    return { index: index + 2, raw, values };
  });
}
