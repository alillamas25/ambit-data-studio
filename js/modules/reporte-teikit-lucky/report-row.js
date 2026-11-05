import { comparableText, normalizeText } from "./normalizer.js";
import { calculateSlaMinutes, identifyBrand, isPlannedOrder, parseNumber } from "./rules.js";

export function prepareReportRow(row) {
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
}
