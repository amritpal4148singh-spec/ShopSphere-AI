import type { Category, Product, ProductDetail, ProductSuggestion } from "@/types/product";
import { getJson } from "./client";
import { parseCategories, parseProductDetail, parseProductList, parseSuggestions } from "./mappers";

/** Only the fields discovery needs, to keep the full-catalogue payload small. */
const LIST_FIELDS = [
  "id",
  "title",
  "description",
  "category",
  "price",
  "discountPercentage",
  "rating",
  "stock",
  "tags",
  "brand",
  "thumbnail",
  "availabilityStatus",
  "meta",
].join(",");

const SUGGESTION_FIELDS = "id,title,category,thumbnail";
export const SUGGESTION_LIMIT = 5;

/**
 * DummyJSON cannot filter by price, rating, stock, brand or discount, so discovery loads the
 * (small) catalogue once, caches it with TanStack Query, and filters/sorts/paginates on the client.
 */
export async function fetchCatalog(signal?: AbortSignal): Promise<Product[]> {
  return parseProductList(await getJson(`/products?limit=0&select=${LIST_FIELDS}`, { signal }));
}

export async function searchProducts(query: string, signal?: AbortSignal): Promise<Product[]> {
  const q = encodeURIComponent(query);
  return parseProductList(await getJson(`/products/search?q=${q}&limit=0&select=${LIST_FIELDS}`, { signal }));
}

export async function fetchSuggestions(query: string, signal?: AbortSignal): Promise<ProductSuggestion[]> {
  const q = encodeURIComponent(query);
  return parseSuggestions(
    await getJson(`/products/search?q=${q}&limit=${SUGGESTION_LIMIT}&select=${SUGGESTION_FIELDS}`, { signal }),
  );
}

export async function fetchCategories(signal?: AbortSignal): Promise<Category[]> {
  return parseCategories(await getJson("/products/categories", { signal }));
}

/** A removed product comes back as HTTP 404, surfaced as ApiError(kind "http", status 404). */
export async function fetchProduct(id: number, signal?: AbortSignal): Promise<ProductDetail> {
  return parseProductDetail(await getJson(`/products/${id}`, { signal }));
}
