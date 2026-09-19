import { NON_DELIVERED_STATUSES } from "./constants.js";
import { comparableText, normalizeText } from "./normalizer.js";

export function identifyBrand(restaurant) {
  const value = comparableText(restaurant);
  if (value.includes("TEIKIT")) return "TEIKIT";
  if (value.includes("LUCKY")) return "LUCKY";
  return "Sin clasificar";
}

export function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime());
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = normalizeText(value);
  if (!text) return null;
  const local = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[ T](\d{1,2}):?(\d{2})?(?::?(\d{2}))?)?/);
  if (local) {
    const date = new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]), Number(local[4] || 0), Number(local[5] || 0), Number(local[6] || 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseMinutes(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = normalizeText(value).replace(",", ".");
  if (!text) return null;
  const clock = text.match(/^(-?)(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (clock) return (clock[1] ? -1 : 1) * (Number(clock[2]) * 60 + Number(clock[3]) + Number(clock[4] || 0) / 60);
  const number = Number(text.replace(/\s*(min|mins|minutos?)\s*$/i, ""));
  return Number.isFinite(number) ? number : null;
}

export function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const number = Number(normalizeText(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export function calculateDeliveryMinutes(createdAt, completedAt, cookingTime) {
  const created = parseDate(createdAt), completed = parseDate(completedAt), cooking = parseMinutes(cookingTime);
  if (!created || !completed || cooking === null) return null;
  const result = (completed.getTime() - created.getTime()) / 60000 - cooking;
  return Number.isFinite(result) && result >= 0 ? result : null;
}

export function isPlannedOrder(value) {
  return typeof value === "number" ? value === 1 : normalizeText(value) === "1";
}

export function calculateSlaMinutes({ plannedOrder, officialTime, createdAt, completedAt, cookingTime }) {
  if (isPlannedOrder(plannedOrder)) {
    const minutes = parseMinutes(officialTime);
    return minutes !== null && minutes >= 0 ? minutes : null;
  }
  return calculateDeliveryMinutes(createdAt, completedAt, cookingTime);
}

export function isDelivered(status) { return comparableText(status) === "COMPLETE"; }
export function isNotDelivered(status) { return NON_DELIVERED_STATUSES.has(comparableText(status)); }
export function classifySla(minutes) {
  if (minutes < 45) return "under45";
  if (minutes <= 60) return "between45And60";
  return "over60";
}
