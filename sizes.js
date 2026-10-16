/**
 * Standard volleyball-jersey size order across the storefront, admin, Excel and PDF.
 * Unknown/custom sizes remain supported and appear after standard sizes.
 * Do not sort sizes alphabetically (e.g. 2XL must not appear before XS).
 */
export const SIZE_ORDER = Object.freeze([
  'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL',
]);
const aliases = new Map([
  ['XXL', '2XL'], ['XXXL', '3XL'], ['XXXXL', '4XL'],
  ['XXXXXL', '5XL'], ['XXXXXXL', '6XL'],
]);
export function normalizeSize(value) {
  const text = String(value ?? '').trim().toUpperCase();
  return aliases.get(text) ?? text;
}
export function sizeRank(value) {
  const rank = SIZE_ORDER.indexOf(normalizeSize(value));
  return rank < 0 ? Number.MAX_SAFE_INTEGER : rank;
}
export function compareSizes(a, b) {
  const aRank = sizeRank(a);
  const bRank = sizeRank(b);
  return aRank - bRank || normalizeSize(a).localeCompare(normalizeSize(b), 'en', { numeric: true });
}
export function sortVariants(variants) {
  return [...variants].sort((a, b) => compareSizes(a.size_label, b.size_label));
}

/** Preserve stored items but present them grouped by the standard size order. */
export function sortOrderItems(items) {
  return [...items].sort((a, b) => compareSizes(a.size_label, b.size_label));
}
