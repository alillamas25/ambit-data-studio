import { DAYS, ELIGIBLE_PROVIDERS, INCIDENT_STATUSES, NON_DELIVERED_STATUSES, UNKNOWN_BRAND } from "./constants.js";
import { comparableText, identifyBrand, normalizeText, safeDisplayText } from "./normalizer.js";

const percentage = (count, total) => total ? count / total * 100 : 0;
const emptyLabel = (value, fallback = "Sin información") => normalizeText(value) || fallback;

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

function isoDate(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function prepareDataset(rows) {
  const prepared = rows.map((row) => {
    const createdDate = parseDate(row.values.createdAt);
    const restaurant = safeDisplayText(row.values.restaurant);
    return {
      ...row,
      restaurant,
      status: comparableText(row.values.status) || "SIN ESTATUS",
      provider: comparableText(row.values.provider),
      brand: identifyBrand(restaurant),
      city: safeDisplayText(row.values.city) || "Sin ciudad",
      zone: safeDisplayText(row.values.zone) || "Sin zona",
      rejectionReason: safeDisplayText(row.values.rejectionReason) || "Sin motivo registrado",
      createdDate,
      date: createdDate ? isoDate(createdDate) : null,
      day: createdDate ? DAYS[createdDate.getDay()] : "Sin fecha válida",
      hour: createdDate ? createdDate.getHours() : null,
    };
  });
  const universe = prepared.filter((row) => ELIGIBLE_PROVIDERS.has(row.provider));
  return {
    all: prepared,
    universe,
    counts: {
      loaded: prepared.length,
      universe: universe.length,
      excludedProvider: prepared.length - universe.length,
      invalidDates: universe.filter((row) => !row.createdDate).length,
      unknownBrands: universe.filter((row) => row.brand === UNKNOWN_BRAND).length,
    },
  };
}

export function summarize(rows) {
  const total = rows.length;
  const complete = rows.filter((row) => row.status === "COMPLETE").length;
  const cancelled = rows.filter((row) => row.status === "CANCELLED").length;
  const rejected = rows.filter((row) => row.status === "REJECTED").length;
  const returned = rows.filter((row) => row.status === "RETURNED").length;
  const notDelivered = cancelled + rejected + returned;
  return {
    total,
    complete,
    completePercentage: percentage(complete, total),
    cancelled,
    rejected,
    returned,
    notDelivered,
    notDeliveredPercentage: percentage(notDelivered, total),
    otherStatuses: total - complete - notDelivered,
  };
}

export function statusBreakdown(rows) {
  const counts = new Map();
  rows.forEach((row) => counts.set(row.status, (counts.get(row.status) || 0) + 1));
  return [...counts.entries()].map(([label, count]) => ({ label, count, percentage: percentage(count, rows.length) })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

export function breakdown(rows, field) {
  const groups = new Map();
  rows.forEach((row) => {
    const label = row[field] === null || row[field] === "" ? "Sin información" : String(row[field]);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row);
  });
  return [...groups.entries()].map(([label, group]) => ({ label, ...summarize(group) })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es", { numeric: true }));
}

export function providerBreakdown(rows) {
  return breakdown(rows, "provider").map((item) => ({ ...item, participation: percentage(item.total, rows.length) }));
}

export function temporalTrend(rows) {
  return breakdown(rows.filter((row) => row.date), "date").sort((a, b) => a.label.localeCompare(b.label));
}

export function demandByDay(rows) {
  const order = new Map(DAYS.map((day, index) => [day, index]));
  return breakdown(rows.filter((row) => row.createdDate), "day").sort((a, b) => order.get(a.label) - order.get(b.label));
}

export function demandByHour(rows) {
  const groups = breakdown(rows.filter((row) => row.hour !== null), "hour");
  const byHour = new Map(groups.map((item) => [Number(item.label), item]));
  return Array.from({ length: 24 }, (_, hour) => byHour.get(hour) || { label: String(hour), ...summarize([]) });
}

export function incidents(rows) {
  return INCIDENT_STATUSES.map((status) => {
    const statusRows = rows.filter((row) => row.status === status);
    const groups = new Map();
    statusRows.forEach((row) => {
      const restaurant = emptyLabel(row.restaurant, "Sin sucursal registrada");
      const reason = emptyLabel(row.rejectionReason, "Sin motivo registrado");
      const key = `${restaurant}\u0000${reason}`;
      const current = groups.get(key) || { restaurant, reason, count: 0 };
      current.count += 1;
      groups.set(key, current);
    });
    return {
      status,
      total: statusRows.length,
      rows: [...groups.values()].map((item) => ({ ...item, percentage: percentage(item.count, statusRows.length) })).sort((a, b) => b.count - a.count || a.restaurant.localeCompare(b.restaurant, "es") || a.reason.localeCompare(b.reason, "es")),
    };
  });
}

export function buildAnalysis(rows) {
  return {
    rows,
    summary: summarize(rows),
    statuses: statusBreakdown(rows),
    trend: temporalTrend(rows),
    byDay: demandByDay(rows),
    byHour: demandByHour(rows),
    byRestaurant: breakdown(rows, "restaurant"),
    byBrand: breakdown(rows, "brand"),
    byCity: breakdown(rows, "city"),
    byZone: breakdown(rows, "zone"),
    byProvider: providerBreakdown(rows),
    incidents: incidents(rows),
    unknownBrandCount: rows.filter((row) => row.brand === UNKNOWN_BRAND).length,
    statusClassifiedCount: rows.filter((row) => row.status === "COMPLETE" || NON_DELIVERED_STATUSES.has(row.status)).length,
  };
}
