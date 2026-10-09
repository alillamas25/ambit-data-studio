import { MASTER_BRAND_CATALOG } from "./brand-catalog.js";
import { canonicalizeBrand } from "./brand-canonicalization.js";
import { COLUMN_DEFINITIONS, OPTIONAL_COLUMNS, REQUIRED_COLUMNS, UNKNOWN_BRAND } from "./constants.js";

export function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

const WINDOWS_1252_BYTES = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
  [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91],
  [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02DC, 0x98],
  [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F],
]);

export function safeDisplayText(value) {
  const text = normalizeText(value);
  if (!/[ÃÂâ]/.test(text)) return text;
  try {
    const points = [...text].map((character) => character.charCodeAt(0));
    const bytes = points.map((point) => point <= 255 ? point : WINDOWS_1252_BYTES.get(point));
    if (bytes.some((point) => point === undefined)) return text;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    return decoded.includes("�") ? text : decoded;
  } catch {
    return text;
  }
}

export function comparableText(value) {
  return safeDisplayText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function catalogKey(value) {
  const repaired = String(value ?? "")
    .replace(/â€‹/g, "")
    .replace(/â€™|â€˜/g, "'")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  return comparableText(repaired)
    .replace(/[’‘`´]/g, "'")
    .trim()
    .replace(/\s+/g, " ");
}

const BRAND_BY_RESTAURANT = new Map(MASTER_BRAND_CATALOG.map(([restaurant, brand]) => [catalogKey(restaurant), brand]));

export function normalizeHeader(value) {
  return comparableText(value).toLowerCase();
}

export function mapColumns(headers) {
  const available = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mapping = {};
  Object.entries(COLUMN_DEFINITIONS).forEach(([canonical, aliases]) => {
    const match = aliases.map(normalizeHeader).find((alias) => available.has(alias));
    if (match) mapping[canonical] = available.get(match);
  });
  return {
    mapping,
    missingRequired: REQUIRED_COLUMNS.filter((field) => !mapping[field]),
    missingOptional: OPTIONAL_COLUMNS.filter((field) => !mapping[field]),
  };
}

export function identifyBrand(restaurant) {
  const catalogBrand = BRAND_BY_RESTAURANT.get(catalogKey(restaurant));
  return catalogBrand ? canonicalizeBrand(catalogBrand) : UNKNOWN_BRAND;
}

export function normalizeRows(rawRows, mapping) {
  return rawRows.map((raw, index) => ({
    index: index + 2,
    raw,
    values: Object.fromEntries(Object.entries(mapping).map(([canonical, original]) => [canonical, raw[original]])),
  }));
}
