const FILTER_FIELDS = ["brand", "restaurant", "city", "zone", "provider", "status"];

export function emptyFilters() {
  return { start: "", end: "", brand: "", restaurant: "", city: "", zone: "", provider: "", status: "" };
}

export function createFilterOptions(rows) {
  return Object.fromEntries(FILTER_FIELDS.map((field) => [field, [...new Set(rows.map((row) => row[field]).filter((value) => value !== null && value !== ""))].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }))]));
}

export function applyFilters(rows, filters) {
  return rows.filter((row) => {
    if (filters.start && (!row.date || row.date < filters.start)) return false;
    if (filters.end && (!row.date || row.date > filters.end)) return false;
    return FILTER_FIELDS.every((field) => !filters[field] || String(row[field]) === filters[field]);
  });
}
