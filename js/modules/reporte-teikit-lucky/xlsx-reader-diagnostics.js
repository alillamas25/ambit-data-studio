import { STREAMED_REPORT_FIELDS } from "./xlsx-stream-reader.js";

const INITIAL_HASH = 2166136261;
const updateHash = (hash, text) => {
  let value = hash >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619) >>> 0;
  }
  return value;
};

function valueType(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? "number" : "nonFinite";
  return typeof value;
}

export function createReaderDiagnostics(sampleRowNumbers = []) {
  const wantedSamples = new Set(sampleRowNumbers.map(Number));
  const fields = Object.fromEntries(STREAMED_REPORT_FIELDS.map((field) => [field, { null: 0, number: 0, string: 0, boolean: 0, nonFinite: 0, other: 0, hash: INITIAL_HASH }]));
  const samples = [];
  let rowsProcessed = 0;
  return {
    consume(row) {
      rowsProcessed += 1;
      for (const field of STREAMED_REPORT_FIELDS) {
        const value = row.values[field], type = valueType(value), stats = fields[field];
        if (Object.hasOwn(stats, type)) stats[type] += 1;
        else stats.other += 1;
        const serialized = value === null || value === undefined ? "null" : `${type}:${String(value)}`;
        stats.hash = updateHash(updateHash(stats.hash, serialized), "\u001f");
      }
      if (wantedSamples.has(row.index)) samples.push(row);
    },
    finish() {
      return {
        rowsProcessed,
        fields: Object.fromEntries(Object.entries(fields).map(([field, stats]) => [field, { ...stats, hash: stats.hash.toString(16).padStart(8, "0") }])),
        samples,
      };
    },
  };
}
