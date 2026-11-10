import { usdToInr } from "@/lib/currency";
import { titleCase } from "@/utils/text";
import type { Availability, Category, Product, ProductDetail, ProductSuggestion } from "@/types/product";
import type { CatalogueReview } from "@/types/review";
import { ApiError } from "./client";

const LOW_STOCK_THRESHOLD = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getAvailability(stock: number, status: unknown): Availability {
  if (stock <= 0) return "out-of-stock";
  const normalized = typeof status === "string" ? status.toLowerCase() : "";
  if (normalized.includes("out")) return "out-of-stock";
  if (normalized.includes("low") || stock <= LOW_STOCK_THRESHOLD) return "low-stock";
  return "in-stock";
}

/** Defensive mapping (PRD edge case 21): returns null for items that cannot be shown safely. */
export function mapProduct(raw: unknown): Product | null {
  if (!isRecord(raw)) return null;

  const id = finiteNumber(raw.id);
  const title = nonEmptyString(raw.title);
  const priceUsd = finiteNumber(raw.price);
  if (id === null || title === null || priceUsd === null || priceUsd < 0) return null;

  const discountPercentage = clamp(finiteNumber(raw.discountPercentage) ?? 0, 0, 100);
  const stock = Math.max(0, Math.floor(finiteNumber(raw.stock) ?? 0));
  const images = Array.isArray(raw.images) ? raw.images : [];
  const meta = isRecord(raw.meta) ? raw.meta : {};
  const created = typeof meta.createdAt === "string" ? Date.parse(meta.createdAt) : Number.NaN;

  return {
    id,
    title,
    description: typeof raw.description === "string" ? raw.description : "",
    category: nonEmptyString(raw.category) ?? "uncategorized",
    brand: nonEmptyString(raw.brand),
    price: usdToInr(priceUsd),
    discountPercentage,
    finalPrice: usdToInr(priceUsd * (1 - discountPercentage / 100)),
    rating: clamp(finiteNumber(raw.rating) ?? 0, 0, 5),
    stock,
    availability: getAvailability(stock, raw.availabilityStatus),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === "string") : [],
    thumbnail: nonEmptyString(raw.thumbnail) ?? nonEmptyString(images[0]),
    createdAt: Number.isFinite(created) ? created : null,
  };
}

function getProductsArray(json: unknown): unknown[] {
  if (!isRecord(json) || !Array.isArray(json.products)) {
    throw new ApiError("parse", "The product response had an unexpected shape");
  }
  return json.products;
}

export function parseProductList(json: unknown): Product[] {
  const rawItems = getProductsArray(json);
  const products = rawItems.map(mapProduct).filter((product): product is Product => product !== null);
  if (rawItems.length > 0 && products.length === 0) {
    throw new ApiError("parse", "None of the returned products could be read");
  }
  return products;
}

export function parseSuggestions(json: unknown): ProductSuggestion[] {
  const suggestions: ProductSuggestion[] = [];
  for (const raw of getProductsArray(json)) {
    if (!isRecord(raw)) continue;
    const id = finiteNumber(raw.id);
    const title = nonEmptyString(raw.title);
    if (id === null || title === null) continue;
    suggestions.push({
      id,
      title,
      category: nonEmptyString(raw.category) ?? "uncategorized",
      thumbnail: nonEmptyString(raw.thumbnail),
    });
  }
  return suggestions;
}

/** DummyJSON returns category objects ({ slug, name, url }); older versions returned plain strings. */
export function parseCategories(json: unknown): Category[] {
  if (!Array.isArray(json)) throw new ApiError("parse", "The category response had an unexpected shape");

  const categories: Category[] = [];
  for (const item of json) {
    if (typeof item === "string" && item.trim()) {
      categories.push({ slug: item.trim(), name: titleCase(item.trim()) });
    } else if (isRecord(item)) {
      const slug = nonEmptyString(item.slug);
      if (slug) categories.push({ slug, name: nonEmptyString(item.name) ?? titleCase(slug) });
    }
  }
  return categories;
}

const MAX_REVIEW_TEXT = 1000;

/**
 * The reviews DummyJSON returns with a product. Defensive (PRD edge case 21): an entry without a whole-star rating
 * from 1 to 5 is dropped; a missing comment or reviewer name gets a safe default.
 */
export function parseCatalogueReviews(raw: unknown): CatalogueReview[] {
  if (!Array.isArray(raw)) return [];
  const reviews: CatalogueReview[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const rating = finiteNumber(entry.rating);
    if (rating === null || rating < 1 || rating > 5) continue;
    const date = typeof entry.date === "string" ? Date.parse(entry.date) : Number.NaN;
    reviews.push({
      rating: Math.round(rating),
      comment: (nonEmptyString(entry.comment) ?? "").slice(0, MAX_REVIEW_TEXT),
      date: Number.isFinite(date) ? date : null,
      reviewerName: nonEmptyString(entry.reviewerName)?.slice(0, 60) ?? "Anonymous",
    });
  }
  return reviews;
}

/** Detail response for one product (GET /products/{id}). Returns null if the core product is unreadable. */
export function mapProductDetail(raw: unknown): ProductDetail | null {
  const product = mapProduct(raw);
  if (!product || !isRecord(raw)) return null;

  const images = [
    ...new Set(
      (Array.isArray(raw.images) ? raw.images : [])
        .map((image) => nonEmptyString(image))
        .filter((image): image is string => image !== null),
    ),
  ];
  if (product.thumbnail && !images.includes(product.thumbnail)) images.push(product.thumbnail);

  return {
    ...product,
    images,
    reviews: parseCatalogueReviews(raw.reviews),
    sku: nonEmptyString(raw.sku),
    warrantyInformation: nonEmptyString(raw.warrantyInformation),
    shippingInformation: nonEmptyString(raw.shippingInformation),
    returnPolicy: nonEmptyString(raw.returnPolicy),
    minimumOrderQuantity: Math.max(1, Math.floor(finiteNumber(raw.minimumOrderQuantity) ?? 1)),
  };
}

export function parseProductDetail(json: unknown): ProductDetail {
  const detail = mapProductDetail(json);
  if (!detail) throw new ApiError("parse", "The product response could not be read");
  return detail;
}
