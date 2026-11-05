import { BRANDS, INCIDENT_STATUSES, KNOWN_PAYMENT_METHODS, PRIMARY_PROVIDERS } from "./constants.js";
import { normalizeText } from "./normalizer.js";
import { prepareReportRow } from "./report-row.js";
import { classifySla, isDelivered, isNotDelivered } from "./rules.js";

const percentage = (count, total) => total ? (count / total) * 100 : 0;
const averageFrom = (sum, count) => count ? sum / count : null;
const median = (values) => {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
};

const addCount = (map, label) => map.set(label, (map.get(label) || 0) + 1);
const countRows = (map, total) => [...map.entries()]
  .map(([label, count]) => ({ label, count, percentage: percentage(count, total) }))
  .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));

function createAggregate() {
  return {
    total: 0, delivered: 0, cancelled: 0, rejected: 0, returned: 0, notDelivered: 0,
    scheduledComplete: 0, nonScheduledComplete: 0, invalidScheduledSla: 0, invalidNonScheduledSla: 0,
    slaCounts: { under45: 0, between45And60: 0, over60: 0 },
    slaValues: [], slaSum: 0,
    cash: 0, creditCard: 0, emptyPayments: 0,
    distanceSum: 0, validDistances: 0,
    providers: new Map(),
  };
}

function consumeAggregate(aggregate, row) {
  aggregate.total += 1;
  const delivered = isDelivered(row.status);
  if (delivered) {
    aggregate.delivered += 1;
    if (row.planned) aggregate.scheduledComplete += 1;
    else aggregate.nonScheduledComplete += 1;
    if (row.deliveryMinutes === null) {
      if (row.planned) aggregate.invalidScheduledSla += 1;
      else aggregate.invalidNonScheduledSla += 1;
    } else {
      aggregate.slaValues.push(row.deliveryMinutes);
      aggregate.slaSum += row.deliveryMinutes;
      aggregate.slaCounts[classifySla(row.deliveryMinutes)] += 1;
    }
  }
  if (row.status === "CANCELLED") aggregate.cancelled += 1;
  if (row.status === "REJECTED") aggregate.rejected += 1;
  if (row.status === "RETURNED") aggregate.returned += 1;
  if (isNotDelivered(row.status)) aggregate.notDelivered += 1;
  if (row.paymentMethod === "CASH") aggregate.cash += 1;
  else if (row.paymentMethod === "CREDIT_CARD") aggregate.creditCard += 1;
  else if (!row.paymentMethod) aggregate.emptyPayments += 1;
  if (row.distance !== null) { aggregate.distanceSum += row.distance; aggregate.validDistances += 1; }
  addCount(aggregate.providers, row.provider || "Sin proveedor registrado");
}

function finishCore(aggregate) {
  const validSla = aggregate.slaValues.length;
  return {
    total: aggregate.total,
    complete: aggregate.delivered,
    completePercentage: percentage(aggregate.delivered, aggregate.total),
    notDelivered: aggregate.notDelivered,
    notDeliveredPercentage: percentage(aggregate.notDelivered, aggregate.total),
    validSla,
    ...aggregate.slaCounts,
    under45Percentage: percentage(aggregate.slaCounts.under45, validSla),
    between45And60Percentage: percentage(aggregate.slaCounts.between45And60, validSla),
    over60Percentage: percentage(aggregate.slaCounts.over60, validSla),
    averageDeliveryTime: averageFrom(aggregate.slaSum, validSla),
    medianDeliveryTime: median(aggregate.slaValues),
    cash: aggregate.cash,
    creditCard: aggregate.creditCard,
    averageDistance: averageFrom(aggregate.distanceSum, aggregate.validDistances),
    providers: countRows(aggregate.providers, aggregate.total),
  };
}

function createBrandState() {
  return {
    aggregate: createAggregate(),
    branches: new Map(),
    incidents: new Map(INCIDENT_STATUSES.map((status) => [status, { total: 0, reasons: new Map() }])),
  };
}

function finishBrand(brand, state) {
  const aggregate = state.aggregate;
  const validSla = aggregate.slaValues.length;
  const providers = countRows(aggregate.providers, aggregate.total);
  const providerCount = (label) => providers.find((row) => row.label === label)?.count || 0;
  const emptyProviders = providerCount("Sin proveedor registrado");
  const mainProviderCount = providerCount("UBER_DAAS") + providerCount("RAPPI_CARGO") + providerCount("DIDI_DELIVERY");
  const notDelivered = aggregate.cancelled + aggregate.rejected + aggregate.returned;
  const summary = {
    total: aggregate.total,
    delivered: aggregate.delivered,
    deliveredPercentage: percentage(aggregate.delivered, aggregate.total),
    cancelled: aggregate.cancelled,
    rejected: aggregate.rejected,
    returned: aggregate.returned,
    notDelivered,
    notDeliveredPercentage: percentage(notDelivered, aggregate.total),
    otherStatuses: aggregate.total - aggregate.delivered - notDelivered,
    validSla,
    invalidSla: aggregate.delivered - validSla,
    scheduledComplete: aggregate.scheduledComplete,
    nonScheduledComplete: aggregate.nonScheduledComplete,
    invalidScheduledSla: aggregate.invalidScheduledSla,
    invalidNonScheduledSla: aggregate.invalidNonScheduledSla,
    averageDeliveryTime: averageFrom(aggregate.slaSum, validSla),
    medianDeliveryTime: median(aggregate.slaValues),
    under45: aggregate.slaCounts.under45,
    under45Percentage: percentage(aggregate.slaCounts.under45, validSla),
    between45And60: aggregate.slaCounts.between45And60,
    between45And60Percentage: percentage(aggregate.slaCounts.between45And60, validSla),
    over60: aggregate.slaCounts.over60,
    over60Percentage: percentage(aggregate.slaCounts.over60, validSla),
    cash: aggregate.cash,
    cashPercentage: percentage(aggregate.cash, aggregate.total),
    creditCard: aggregate.creditCard,
    creditCardPercentage: percentage(aggregate.creditCard, aggregate.total),
    otherPayments: aggregate.total - aggregate.cash - aggregate.creditCard - aggregate.emptyPayments,
    otherPaymentsPercentage: percentage(aggregate.total - aggregate.cash - aggregate.creditCard - aggregate.emptyPayments, aggregate.total),
    emptyPayments: aggregate.emptyPayments,
    emptyPaymentsPercentage: percentage(aggregate.emptyPayments, aggregate.total),
    averageDistance: averageFrom(aggregate.distanceSum, aggregate.validDistances),
    validDistances: aggregate.validDistances,
  };
  const branches = [...state.branches.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "es"))
    .map(([restaurant, branch]) => ({ restaurant, ...finishCore(branch) }));
  const incidents = INCIDENT_STATUSES.map((status) => {
    const incident = state.incidents.get(status);
    const reasons = [...incident.reasons.values()]
      .map((row) => ({ ...row, percentage: percentage(row.count, incident.total) }))
      .sort((a, b) => b.count - a.count || a.restaurant.localeCompare(b.restaurant, "es") || a.label.localeCompare(b.label, "es"));
    return { status, total: incident.total, reasons };
  });
  return {
    brand,
    rows: { length: aggregate.total },
    summary,
    providers,
    providerSummary: {
      uber: providerCount("UBER_DAAS"),
      rappi: providerCount("RAPPI_CARGO"),
      didi: providerCount("DIDI_DELIVERY"),
      other: aggregate.total - mainProviderCount - emptyProviders,
      empty: emptyProviders,
    },
    branches,
    incidents,
  };
}

export function createReportAccumulator() {
  let rowCount = 0;
  const brands = new Map(BRANDS.map((brand) => [brand, createBrandState()]));
  const paymentValues = new Set(), providerValues = new Set(), unclassifiedRestaurants = new Set();
  let unclassifiedCount = 0;
  return {
    consume(sourceRow) {
      const row = prepareReportRow(sourceRow);
      rowCount += 1;
      paymentValues.add(row.paymentMethod || "Sin método registrado");
      providerValues.add(row.provider || "Sin proveedor registrado");
      const brandState = brands.get(row.brand);
      if (!brandState) {
        unclassifiedCount += 1;
        unclassifiedRestaurants.add(row.restaurant || "Sin restaurante registrado");
        return;
      }
      consumeAggregate(brandState.aggregate, row);
      let branch = brandState.branches.get(row.restaurant);
      if (!branch) { branch = createAggregate(); brandState.branches.set(row.restaurant, branch); }
      consumeAggregate(branch, row);
      const incident = brandState.incidents.get(row.status);
      if (incident) {
        incident.total += 1;
        const restaurant = row.restaurant || "Sin sucursal registrada";
        const label = normalizeText(row.values.rejectionReason) || "Sin motivo registrado";
        const key = `${restaurant}\u0000${label}`;
        const current = incident.reasons.get(key) || { restaurant, label, count: 0 };
        current.count += 1;
        incident.reasons.set(key, current);
      }
    },
    finish() {
      const payments = [...paymentValues].sort();
      const providers = [...providerValues].sort();
      return {
        rows: { length: rowCount },
        brands: Object.fromEntries(BRANDS.map((brand) => [brand, finishBrand(brand, brands.get(brand))])),
        validation: {
          unclassifiedCount,
          unclassifiedRestaurants: [...unclassifiedRestaurants].sort(),
          paymentValues: payments,
          unexpectedPayments: payments.filter((value) => !KNOWN_PAYMENT_METHODS.has(value)),
          providerValues: providers,
          unexpectedProviders: providers.filter((value) => !PRIMARY_PROVIDERS.has(value)),
        },
      };
    },
  };
}
