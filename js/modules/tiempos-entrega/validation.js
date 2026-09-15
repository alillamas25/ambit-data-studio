import { DIFFERENCE_THRESHOLDS, STAGES } from "./constants.js";
import { average, classifyTime, median, parseDuration, parseStageDuration } from "./metrics.js?v=20260915-stage-minutes";

function truthyIndicator(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "si", "sí", "yes", "x"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  const number = Number(normalized.replace(",", "."));
  return Number.isFinite(number) ? number !== 0 : null;
}

export function validateIndicators(rows, mapping) {
  const available = ["indicator45", "indicator60", "indicatorOver60"].filter((key) => mapping[key]);
  if (!available.length) return { available: false, compared: 0, matches: 0, differences: 0, percentage: 0 };
  let compared = 0;
  let matches = 0;
  rows.forEach((row) => {
    const expectedClass = classifyTime(row.officialTime);
    const expected = { indicator45: expectedClass === "under45", indicator60: row.officialTime < 60, indicatorOver60: expectedClass === "over60" };
    const checks = available.map((key) => truthyIndicator(row.values[key])).filter((value) => value !== null);
    if (!checks.length) return;
    compared += 1;
    const values = available.map((key) => truthyIndicator(row.values[key]));
    if (values.every((value, index) => value === null || value === expected[available[index]])) matches += 1;
  });
  const differences = compared - matches;
  return { available: true, compared, matches, differences, percentage: compared ? differences / compared * 100 : 0 };
}

export function validateCalculatedTimes(rows, mapping) {
  if (!mapping.completedAt || !mapping.cookingTime) return { available: false, records: [] };
  const records = rows.flatMap((row) => {
    const cooking = parseDuration(row.values.cookingTime);
    if (!row.createdDate || !row.completedDate || cooking === null) return [];
    const calculated = (row.completedDate - row.createdDate) / 60000 - cooking;
    if (!Number.isFinite(calculated)) return [];
    const signed = calculated - row.officialTime;
    const absolute = Math.abs(signed);
    let category = "Diferencia importante";
    if (absolute <= DIFFERENCE_THRESHOLDS.coincide) category = "Coincide";
    else if (absolute <= DIFFERENCE_THRESHOLDS.minor) category = "Diferencia menor";
    else if (absolute <= DIFFERENCE_THRESHOLDS.review) category = "Revisar";
    return [{ row, official: row.officialTime, calculated, signed, absolute, category }];
  });
  const differences = records.map((record) => record.absolute);
  return {
    available: true,
    records,
    over1: records.filter((record) => record.absolute > 1).length,
    over5: records.filter((record) => record.absolute > 5).length,
    over10: records.filter((record) => record.absolute > 10).length,
    average: average(differences),
    median: median(differences),
  };
}

export function analyzeStages(rows, mapping) {
  return STAGES.map(([key, label]) => {
    if (!mapping[key]) return { key, label, available: false };
    const valuesWithData = rows
      .map((row) => row.values[key])
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
    const parsed = valuesWithData.map(parseStageDuration);
    const values = parsed.filter((value) => value !== null && Number.isFinite(value) && value >= 0);
    const invalidCount = parsed.length - values.length;
    return {
      key,
      label,
      available: true,
      universeCount: rows.length,
      withDataCount: valuesWithData.length,
      validCount: values.length,
      invalidCount,
      count: values.length,
      coverage: rows.length ? values.length / rows.length * 100 : 0,
      average: average(values),
      median: median(values),
    };
  });
}

const KNOWN_STATUSES = ["COMPLETE", "CANCELLED", "RETURNED", "RETURNING", "REJECTED", "ACCEPTED"];

export function analyzeStagesByStatus(rows, mapping) {
  const groups = new Map(KNOWN_STATUSES.map((status) => [status, []]));
  groups.set("Otros", []);
  rows.forEach((row) => {
    const key = KNOWN_STATUSES.includes(row.status) ? row.status : "Otros";
    groups.get(key).push(row);
  });
  return [...groups.entries()]
    .filter(([, statusRows]) => statusRows.length)
    .map(([status, statusRows]) => ({
      status,
      count: statusRows.length,
      stages: Object.fromEntries(analyzeStages(statusRows, mapping).map((stage) => [stage.key, stage])),
    }));
}

export function compareStageSum(rows, mapping) {
  const keys = ["acceptance", "toStore", "pickup", "delivery"];
  if (!mapping.totalDelivery || keys.some((key) => !mapping[key])) return { available: false };
  const differences = rows.flatMap((row) => {
    const values = keys.map((key) => parseDuration(row.values[key]));
    const total = parseDuration(row.values.totalDelivery);
    if (values.some((value) => value === null) || total === null) return [];
    return [Math.abs(values.reduce((sum, value) => sum + value, 0) - total)];
  });
  return { available: true, count: differences.length, approximate: differences.filter((value) => value <= 1).length, different: differences.filter((value) => value > 1).length, averageDifference: average(differences) };
}

export function compareWithoutWait(rows, mapping) {
  if (!mapping.totalDelivery || !mapping.withoutRestaurantWait) return { available: false, records: [] };
  const records = rows.flatMap((row) => {
    const total = parseDuration(row.values.totalDelivery);
    const withoutWait = parseDuration(row.values.withoutRestaurantWait);
    if (total === null || withoutWait === null) return [];
    return [{ total, withoutWait, difference: total - withoutWait, pickup: parseDuration(row.values.pickup) }];
  });
  return {
    available: true,
    records,
    totalAverage: average(records.map((record) => record.total)),
    totalMedian: median(records.map((record) => record.total)),
    withoutAverage: average(records.map((record) => record.withoutWait)),
    withoutMedian: median(records.map((record) => record.withoutWait)),
    differenceAverage: average(records.map((record) => record.difference)),
    differenceMedian: median(records.map((record) => record.difference)),
  };
}
