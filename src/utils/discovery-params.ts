import type { AvailabilityFilter, DiscoveryState, SortKey } from "@/types/product";
import { DEFAULT_DISCOVERY_STATE, MAX_QUERY_LENGTH, SORT_OPTIONS } from "./discovery";

interface ParamsReader {
  get(name: string): string | null;
  getAll(name: string): string[];
}

const SORT_KEYS = new Set<string>(SORT_OPTIONS.map((option) => option.value));
const MAX_PAGE = 10_000;

function parsePrice(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

/**
 * URL query string -> discovery state. Never throws: unknown or malformed values fall back to defaults,
 * and a reversed price range is swapped (PRD edge case 7: never a broken query).
 */
export function parseDiscoveryParams(params: ParamsReader, options: { fixedCategory?: string } = {}): DiscoveryState {
  let minPrice = parsePrice(params.get("minPrice"));
  let maxPrice = parsePrice(params.get("maxPrice"));
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const ratingValue = Number(params.get("rating"));
  const minRating = Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? ratingValue : undefined;

  const availabilityParam = params.get("availability");
  const availability: AvailabilityFilter =
    availabilityParam === "in" || availabilityParam === "out" ? availabilityParam : "any";

  const sortParam = params.get("sort") ?? "";
  const sort: SortKey = SORT_KEYS.has(sortParam) ? (sortParam as SortKey) : "relevance";

  const pageValue = Math.floor(Number(params.get("page")));
  const page = Number.isFinite(pageValue) && pageValue >= 1 ? Math.min(pageValue, MAX_PAGE) : 1;

  const state: DiscoveryState = {
    ...DEFAULT_DISCOVERY_STATE,
    query: (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    categories: options.fixedCategory ? [options.fixedCategory] : unique(params.getAll("category")),
    brands: unique(params.getAll("brand")),
    availability,
    onSale: params.get("onSale") === "1",
    sort,
    page,
  };
  if (minPrice !== undefined) state.minPrice = minPrice;
  if (maxPrice !== undefined) state.maxPrice = maxPrice;
  if (minRating !== undefined) state.minRating = minRating;
  return state;
}

/** Discovery state -> query string. Defaults are omitted so URLs stay short and shareable. */
export function serializeDiscoveryParams(state: DiscoveryState, options: { fixedCategory?: string } = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query.slice(0, MAX_QUERY_LENGTH));
  if (!options.fixedCategory) for (const category of state.categories) params.append("category", category);
  for (const brand of state.brands) params.append("brand", brand);
  if (state.minPrice !== undefined) params.set("minPrice", String(state.minPrice));
  if (state.maxPrice !== undefined) params.set("maxPrice", String(state.maxPrice));
  if (state.minRating !== undefined) params.set("rating", String(state.minRating));
  if (state.availability !== "any") params.set("availability", state.availability);
  if (state.onSale) params.set("onSale", "1");
  if (state.sort !== "relevance") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  return params;
}
