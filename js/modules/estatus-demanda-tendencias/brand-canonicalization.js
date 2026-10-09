const CANONICAL_BRAND_LABELS = new Map([
  ["Chamorros del puerto", "Chamorros del Puerto"],
  ["Lecaroz", "LECAROZ"],
  ["Delicias del Contry", "Delicias Del Contry"],
  ["Esquitemanía", "Esquitemania"],
]);

export function canonicalizeBrand(brand) {
  return CANONICAL_BRAND_LABELS.get(brand) || brand;
}
