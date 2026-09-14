import { DAYS, ELIGIBLE_PROVIDERS, MONTHS } from "./constants.js";

export function cleanText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function comparableText(value) {
  return cleanText(value).toUpperCase();
}

export function parseDuration(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value > 0 && value < 1 ? value * 1440 : value;
  }
  const text = cleanText(value).replace(",", ".");
  if (!text) return null;
  const clock = text.match(/^(-?)(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (clock) {
    const sign = clock[1] ? -1 : 1;
    return sign * (Number(clock[2]) * 60 + Number(clock[3]) + Number(clock[4] || 0) / 60);
  }
  const number = Number(text.replace(/\s*(min|mins|minutos?)\s*$/i, ""));
  return Number.isFinite(number) ? number : null;
}

export function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime());
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = cleanText(value);
  if (!text) return null;
  const local = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[ T](\d{1,2}):?(\d{2})?(?::?(\d{2}))?)?/);
  if (local) {
    const date = new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]), Number(local[4] || 0), Number(local[5] || 0), Number(local[6] || 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function weekKey(date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((copy - yearStart) / 86400000 + 1) / 7);
  return `${copy.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
}

export function prepareDataset(rows) {
  const prepared = rows.map((row) => {
    const createdDate = parseDate(row.values.createdAt);
    const officialTime = parseDuration(row.values.officialTime);
    const provider = comparableText(row.values.provider);
    const status = comparableText(row.values.status);
    return {
      ...row,
      status,
      provider,
      createdDate,
      completedDate: parseDate(row.values.completedAt),
      officialTime,
      date: createdDate ? isoDate(createdDate) : null,
      day: createdDate ? DAYS[createdDate.getDay()] : null,
      hour: createdDate ? createdDate.getHours() : null,
      week: createdDate ? weekKey(createdDate) : null,
      month: createdDate ? `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, "0")} · ${MONTHS[createdDate.getMonth()]}` : null,
      restaurant: cleanText(row.values.restaurant),
      zone: cleanText(row.values.zone),
      city: cleanText(row.values.city),
      brand: cleanText(row.values.brand),
    };
  });

  const complete = prepared.filter((row) => row.status === "COMPLETE");
  const eligible = complete.filter((row) => ELIGIBLE_PROVIDERS.has(row.provider));
  const analyzed = eligible.filter((row) => row.officialTime !== null && row.officialTime >= 0);
  return {
    all: prepared,
    eligible,
    analyzed,
    counts: {
      total: prepared.length,
      complete: complete.length,
      eligible: eligible.length,
      excludedStatus: prepared.length - complete.length,
      excludedProvider: complete.length - eligible.length,
      invalidTimes: eligible.length - analyzed.length,
      invalidDates: eligible.filter((row) => !row.createdDate).length,
    },
  };
}

export function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function classifyTime(value) {
  if (value < 45) return "under45";
  if (value <= 60) return "between45And60";
  return "over60";
}

export function calculateMetrics(rows) {
  const values = rows.map((row) => row.officialTime).filter((value) => value !== null);
  const count = values.length;
  const makeBucket = (predicate) => {
    const total = values.filter(predicate).length;
    return { count: total, percentage: count ? (total / count) * 100 : 0 };
  };
  return {
    count,
    average: average(values),
    median: median(values),
    under45: makeBucket((value) => value < 45),
    under60: makeBucket((value) => value < 60),
    between45And60: makeBucket((value) => value >= 45 && value <= 60),
    over60: makeBucket((value) => value > 60),
  };
}

export function breakdown(rows, field) {
  const groups = new Map();
  rows.forEach((row) => {
    const label = row[field] ?? "Sin información";
    const key = label === "" ? "Sin información" : String(label);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.entries()]
    .map(([label, groupRows]) => ({ label, ...calculateMetrics(groupRows) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}
