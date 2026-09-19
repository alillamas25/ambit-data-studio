import { BRANDS, INCIDENT_STATUSES, KNOWN_PAYMENT_METHODS, PRIMARY_PROVIDERS } from "./constants.js";
import { comparableText, normalizeText } from "./normalizer.js";
import { calculateSlaMinutes, classifySla, identifyBrand, isDelivered, isNotDelivered, isPlannedOrder, parseNumber } from "./rules.js";

const percentage = (count, total) => total ? (count / total) * 100 : 0;
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function countValues(rows, field, emptyLabel = "Sin información") {
  const counts = new Map();
  rows.forEach((row) => {
    const text = normalizeText(row.values[field]);
    const label = text || emptyLabel;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].map(([label, count]) => ({ label, count, percentage: percentage(count, rows.length) })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

function incidence(rows, status) {
  const filtered = rows.filter((row) => row.status === status);
  const reasons = new Map();
  filtered.forEach((row) => {
    const restaurant = row.restaurant || "Sin sucursal registrada";
    const reason = normalizeText(row.values.rejectionReason) || "Sin motivo registrado";
    const key = `${restaurant}\u0000${reason}`;
    const current = reasons.get(key) || { restaurant, label: reason, count: 0 };
    current.count += 1;
    reasons.set(key, current);
  });
  return { status, total: filtered.length, reasons: [...reasons.values()].map((row) => ({ ...row, percentage: percentage(row.count, filtered.length) })).sort((a, b) => b.count - a.count || a.restaurant.localeCompare(b.restaurant, "es") || a.label.localeCompare(b.label, "es")) };
}

export function prepareReportRows(rows) {
  return rows.map((row) => {
    const status = comparableText(row.values.status);
    const restaurant = normalizeText(row.values.restaurant);
    const planned = isPlannedOrder(row.values.plannedOrder);
    return {
      ...row,
      status,
      restaurant,
      brand: identifyBrand(restaurant),
      paymentMethod: comparableText(row.values.paymentMethod),
      provider: comparableText(row.values.provider),
      planned,
      deliveryMinutes: status === "COMPLETE" ? calculateSlaMinutes({
        plannedOrder: row.values.plannedOrder,
        officialTime: row.values.officialTime,
        createdAt: row.values.createdAt,
        completedAt: row.values.completedAt,
        cookingTime: row.values.cookingTime,
      }) : null,
      distance: parseNumber(row.values.distance),
    };
  });
}

export function calculateBrandReport(rows, brand) {
  const brandRows = rows.filter((row) => row.brand === brand);
  const completeRows = brandRows.filter((row) => isDelivered(row.status));
  const validSlaRows = completeRows.filter((row) => row.deliveryMinutes !== null);
  const delivered = completeRows.length;
  const cancelled = brandRows.filter((row) => row.status === "CANCELLED").length;
  const rejected = brandRows.filter((row) => row.status === "REJECTED").length;
  const returned = brandRows.filter((row) => row.status === "RETURNED").length;
  const notDelivered = cancelled + rejected + returned;
  const slaCounts = { under45: 0, between45And60: 0, over60: 0 };
  validSlaRows.forEach((row) => { slaCounts[classifySla(row.deliveryMinutes)] += 1; });
  const cash = brandRows.filter((row) => row.paymentMethod === "CASH").length;
  const creditCard = brandRows.filter((row) => row.paymentMethod === "CREDIT_CARD").length;
  const emptyPayments = brandRows.filter((row) => !row.paymentMethod).length;
  const otherPayments = brandRows.length - cash - creditCard - emptyPayments;
  const distances = brandRows.map((row) => row.distance).filter((value) => value !== null);
  const summary = {
    total: brandRows.length,
    delivered, deliveredPercentage: percentage(delivered, brandRows.length),
    cancelled, rejected, returned,
    notDelivered, notDeliveredPercentage: percentage(notDelivered, brandRows.length),
    otherStatuses: brandRows.length - delivered - notDelivered,
    validSla: validSlaRows.length,
    invalidSla: completeRows.length - validSlaRows.length,
    scheduledComplete: completeRows.filter((row) => row.planned).length,
    nonScheduledComplete: completeRows.filter((row) => !row.planned).length,
    invalidScheduledSla: completeRows.filter((row) => row.planned && row.deliveryMinutes === null).length,
    invalidNonScheduledSla: completeRows.filter((row) => !row.planned && row.deliveryMinutes === null).length,
    averageDeliveryTime: average(validSlaRows.map((row) => row.deliveryMinutes)),
    medianDeliveryTime: median(validSlaRows.map((row) => row.deliveryMinutes)),
    under45: slaCounts.under45, under45Percentage: percentage(slaCounts.under45, validSlaRows.length),
    between45And60: slaCounts.between45And60, between45And60Percentage: percentage(slaCounts.between45And60, validSlaRows.length),
    over60: slaCounts.over60, over60Percentage: percentage(slaCounts.over60, validSlaRows.length),
    cash, cashPercentage: percentage(cash, brandRows.length),
    creditCard, creditCardPercentage: percentage(creditCard, brandRows.length),
    otherPayments, otherPaymentsPercentage: percentage(otherPayments, brandRows.length),
    emptyPayments, emptyPaymentsPercentage: percentage(emptyPayments, brandRows.length),
    averageDistance: average(distances), validDistances: distances.length,
  };
  const providers = countValues(brandRows, "provider", "Sin proveedor registrado");
  const providerCount = (label) => providers.find((row) => row.label === label)?.count || 0;
  const emptyProviders = providerCount("Sin proveedor registrado");
  const mainProviderCount = providerCount("UBER_DAAS") + providerCount("RAPPI_CARGO") + providerCount("DIDI_DELIVERY");
  const providerSummary = {
    uber: providerCount("UBER_DAAS"),
    rappi: providerCount("RAPPI_CARGO"),
    didi: providerCount("DIDI_DELIVERY"),
    other: brandRows.length - mainProviderCount - emptyProviders,
    empty: emptyProviders,
  };
  const branches = [...new Set(brandRows.map((row) => row.restaurant))].sort((a, b) => a.localeCompare(b, "es")).map((restaurant) => {
    const report = calculateBrandReportCore(brandRows.filter((row) => row.restaurant === restaurant));
    return { restaurant, ...report };
  });
  return { brand, rows: brandRows, summary, providers, providerSummary, branches, incidents: INCIDENT_STATUSES.map((status) => incidence(brandRows, status)) };
}

function calculateBrandReportCore(rows) {
  const complete = rows.filter((row) => row.status === "COMPLETE");
  const valid = complete.filter((row) => row.deliveryMinutes !== null);
  const notDelivered = rows.filter((row) => isNotDelivered(row.status)).length;
  const buckets = { under45: 0, between45And60: 0, over60: 0 };
  valid.forEach((row) => { buckets[classifySla(row.deliveryMinutes)] += 1; });
  const distances = rows.map((row) => row.distance).filter((value) => value !== null);
  return {
    total: rows.length,
    complete: complete.length,
    completePercentage: percentage(complete.length, rows.length),
    notDelivered,
    notDeliveredPercentage: percentage(notDelivered, rows.length),
    validSla: valid.length,
    ...buckets,
    under45Percentage: percentage(buckets.under45, valid.length),
    between45And60Percentage: percentage(buckets.between45And60, valid.length),
    over60Percentage: percentage(buckets.over60, valid.length),
    averageDeliveryTime: average(valid.map((row) => row.deliveryMinutes)),
    medianDeliveryTime: median(valid.map((row) => row.deliveryMinutes)),
    cash: rows.filter((row) => row.paymentMethod === "CASH").length,
    creditCard: rows.filter((row) => row.paymentMethod === "CREDIT_CARD").length,
    averageDistance: average(distances),
    providers: countValues(rows, "provider", "Sin proveedor registrado"),
  };
}

export function buildReport(rows) {
  const prepared = prepareReportRows(rows);
  const paymentValues = [...new Set(prepared.map((row) => row.paymentMethod || "Sin método registrado"))].sort();
  const providerValues = [...new Set(prepared.map((row) => row.provider || "Sin proveedor registrado"))].sort();
  return {
    rows: prepared,
    brands: Object.fromEntries(BRANDS.map((brand) => [brand, calculateBrandReport(prepared, brand)])),
    validation: {
      unclassifiedCount: prepared.filter((row) => row.brand === "Sin clasificar").length,
      unclassifiedRestaurants: [...new Set(prepared.filter((row) => row.brand === "Sin clasificar").map((row) => row.restaurant || "Sin restaurante registrado"))].sort(),
      paymentValues,
      unexpectedPayments: paymentValues.filter((value) => !KNOWN_PAYMENT_METHODS.has(value)),
      providerValues,
      unexpectedProviders: providerValues.filter((value) => !PRIMARY_PROVIDERS.has(value)),
    },
  };
}
