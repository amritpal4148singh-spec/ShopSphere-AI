import { MAX_QUERY_LENGTH } from "@/lib/constants";
import { formatInr } from "@/lib/currency";
import type { DiscoveryState, Product, SortKey } from "@/types/product";

export const PAGE_SIZE = 24;
/** A product counts as "on sale" from this discount percentage (PRD 5.2 leaves the threshold open). */
export const ON_SALE_MIN_DISCOUNT = 10;
export { MAX_QUERY_LENGTH };

export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Rating" },
  { value: "newest", label: "Newest" },
];

export const DEFAULT_DISCOVERY_STATE: DiscoveryState = {
  query: "",
  categories: [],
  brands: [],
  availability: "any",
  onSale: false,
  sort: "relevance",
  page: 1,
};

export function isOnSale(product: Product): boolean {
  return product.discountPercentage >= ON_SALE_MIN_DISCOUNT;
}

/** Applies every active filter except the text query (search is done by the API). */
export function applyFilters(products: readonly Product[], state: DiscoveryState): Product[] {
  return products.filter((product) => {
    if (state.categories.length > 0 && !state.categories.includes(product.category)) return false;
    if (state.brands.length > 0 && (product.brand === null || !state.brands.includes(product.brand))) return false;
    if (state.minPrice !== undefined && product.finalPrice < state.minPrice) return false;
    if (state.maxPrice !== undefined && product.finalPrice > state.maxPrice) return false;
    if (state.minRating !== undefined && product.rating < state.minRating) return false;
    if (state.availability === "in" && product.availability === "out-of-stock") return false;
    if (state.availability === "out" && product.availability !== "out-of-stock") return false;
    if (state.onSale && !isOnSale(product)) return false;
    return true;
  });
}

export function sortProducts(products: readonly Product[], sort: SortKey): Product[] {
  const copy = [...products];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.finalPrice - b.finalPrice);
    case "price-desc":
      return copy.sort((a, b) => b.finalPrice - a.finalPrice);
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating);
    case "newest":
      return copy.sort((a, b) => (b.createdAt ?? -Infinity) - (a.createdAt ?? -Infinity));
    default:
      return copy;
  }
}

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number = PAGE_SIZE): Page<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, totalPages, total };
}

/** Page numbers to render, with "ellipsis" gaps: always first, last, and a window around the current page. */
export function getPageItems(page: number, totalPages: number): Array<number | "ellipsis"> {
  const wanted = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const numbers = [...wanted].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];
  numbers.forEach((n, index) => {
    const previous = numbers[index - 1];
    if (previous !== undefined && n - previous > 1) items.push("ellipsis");
    items.push(n);
  });
  return items;
}

export interface PriceBounds {
  min: number;
  max: number;
}

export function getPriceBounds(products: readonly Product[], step = 100): PriceBounds {
  if (products.length === 0) return { min: 0, max: 0 };
  const prices = products.map((product) => product.finalPrice);
  return {
    min: Math.floor(Math.min(...prices) / step) * step,
    max: Math.ceil(Math.max(...prices) / step) * step,
  };
}

export function getBrandOptions(products: readonly Product[]): string[] {
  const brands = new Set<string>();
  for (const product of products) if (product.brand) brands.add(product.brand);
  return [...brands].sort((a, b) => a.localeCompare(b));
}

export type FilterKey =
  | { type: "category"; value: string }
  | { type: "brand"; value: string }
  | { type: "price" }
  | { type: "rating" }
  | { type: "availability" }
  | { type: "onSale" };

export interface ActiveFilter {
  key: FilterKey;
  label: string;
}

function priceLabel(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${formatInr(min)} to ${formatInr(max)}`;
  if (min !== undefined) return `From ${formatInr(min)}`;
  return `Up to ${formatInr(max ?? 0)}`;
}

/** The filters the user can remove. `lockedCategory` (a category page) is never listed. */
export function getActiveFilters(
  state: DiscoveryState,
  categoryName: (slug: string) => string,
  lockedCategory?: string,
): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  for (const slug of state.categories) {
    if (slug === lockedCategory) continue;
    filters.push({ key: { type: "category", value: slug }, label: categoryName(slug) });
  }
  for (const brand of state.brands) filters.push({ key: { type: "brand", value: brand }, label: brand });
  if (state.minPrice !== undefined || state.maxPrice !== undefined) {
    filters.push({ key: { type: "price" }, label: priceLabel(state.minPrice, state.maxPrice) });
  }
  if (state.minRating !== undefined) filters.push({ key: { type: "rating" }, label: `${state.minRating} stars and up` });
  if (state.availability === "in") filters.push({ key: { type: "availability" }, label: "In stock" });
  if (state.availability === "out") filters.push({ key: { type: "availability" }, label: "Out of stock" });
  if (state.onSale) filters.push({ key: { type: "onSale" }, label: `On sale (${ON_SALE_MIN_DISCOUNT}% off or more)` });
  return filters;
}

export function removeFilter(state: DiscoveryState, key: FilterKey): DiscoveryState {
  const next: DiscoveryState = { ...state, page: 1 };
  switch (key.type) {
    case "category":
      next.categories = state.categories.filter((slug) => slug !== key.value);
      break;
    case "brand":
      next.brands = state.brands.filter((brand) => brand !== key.value);
      break;
    case "price":
      delete next.minPrice;
      delete next.maxPrice;
      break;
    case "rating":
      delete next.minRating;
      break;
    case "availability":
      next.availability = "any";
      break;
    case "onSale":
      next.onSale = false;
      break;
  }
  return next;
}

/** Clears every filter but keeps the text query, the sort, and a locked category page's category. */
export function clearAllFilters(state: DiscoveryState, lockedCategory?: string): DiscoveryState {
  const next: DiscoveryState = {
    ...DEFAULT_DISCOVERY_STATE,
    query: state.query,
    sort: state.sort,
    categories: lockedCategory ? [lockedCategory] : [],
  };
  return next;
}
