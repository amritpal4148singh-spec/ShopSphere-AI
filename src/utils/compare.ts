import { titleCase } from "@/utils/text";
import type { Product, ProductDetail } from "@/types/product";

/** Pure rules of the product comparison (PRD 3.2, 5.2): 2 to 4 products, no duplicates. */
export const COMPARE_MIN = 2;
export const COMPARE_MAX = 4;

export interface CompareItem {
  productId: number;
  title: string;
  thumbnail: string | null;
  category: string;
}

export type CompareResult = { items: CompareItem[]; outcome: "added" | "removed" | "duplicate" | "full" };

export function canCompare(items: readonly CompareItem[]): boolean {
  return items.length >= COMPARE_MIN;
}

export function isFull(items: readonly CompareItem[]): boolean {
  return items.length >= COMPARE_MAX;
}

/** Adds a product. A product already chosen is never added twice, and the fifth is refused. */
export function addCompareItem(items: readonly CompareItem[], item: CompareItem): CompareResult {
  if (items.some((existing) => existing.productId === item.productId)) return { items: [...items], outcome: "duplicate" };
  if (isFull(items)) return { items: [...items], outcome: "full" };
  return { items: [...items, item], outcome: "added" };
}

export function removeCompareItem(items: readonly CompareItem[], productId: number): CompareResult {
  const next = items.filter((item) => item.productId !== productId);
  return { items: next, outcome: next.length === items.length ? "duplicate" : "removed" };
}

export function toggleCompareItem(items: readonly CompareItem[], item: CompareItem): CompareResult {
  return items.some((existing) => existing.productId === item.productId) ? removeCompareItem(items, item.productId) : addCompareItem(items, item);
}

export function toCompareItem(product: Pick<Product, "id" | "title" | "thumbnail" | "category">): CompareItem {
  return { productId: product.id, title: product.title, thumbnail: product.thumbnail, category: product.category };
}

/* ------------------------------------------------------------------ comparison table */

export type CompareRowKind = "price" | "discount" | "rating" | "availability" | "text" | "list";

export interface CompareRow {
  id: string;
  label: string;
  kind: CompareRowKind;
  /** One display value per product, in the same order as the products. "Not specified" stands in for missing data. */
  values: string[];
  /** True when the products do not all show the same value (PRD: highlight meaningful differences). */
  differs: boolean;
  /** Indexes of the best value where "best" is meaningful (lowest price, highest rating, highest discount). */
  best: number[];
}

export const NOT_SPECIFIED = "Not specified";

const AVAILABILITY_TEXT = { "in-stock": "In stock", "low-stock": "Low stock", "out-of-stock": "Out of stock" } as const;

const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

function bestIndexes(numbers: Array<number | null>, prefer: "min" | "max"): number[] {
  const present = numbers.filter((value): value is number => value !== null);
  if (present.length < 2) return [];
  const target = prefer === "min" ? Math.min(...present) : Math.max(...present);
  if (present.every((value) => value === target)) return [];
  return numbers.flatMap((value, index) => (value === target ? [index] : []));
}

const differsAcross = (values: readonly string[]) => new Set(values).size > 1;

/**
 * Builds the rows of the comparison table. `details` holds the extra fields (warranty, SKU, shipping) when they have
 * loaded; a product without them shows "Not specified" rather than breaking the table.
 */
export function buildComparisonRows(products: readonly Product[], details: ReadonlyArray<ProductDetail | null | undefined>): CompareRow[] {
  const detail = (index: number) => details[index] ?? null;
  const text = (pick: (index: number) => string | null | undefined) => products.map((_, index) => pick(index)?.trim() || NOT_SPECIFIED);

  const prices = products.map((product) => product.finalPrice);
  const discounts = products.map((product) => (product.discountPercentage > 0 ? Math.round(product.discountPercentage) : 0));
  const ratings = products.map((product) => (product.rating > 0 ? product.rating : null));

  const rows: CompareRow[] = [
    { id: "price", label: "Price", kind: "price", values: prices.map(money), differs: differsAcross(prices.map(String)), best: bestIndexes(prices, "min") },
    { id: "discount", label: "Discount", kind: "discount", values: discounts.map((d) => (d > 0 ? `${d}% off` : "No discount")), differs: differsAcross(discounts.map(String)), best: bestIndexes(discounts, "max") },
    { id: "rating", label: "Rating", kind: "rating", values: ratings.map((r) => (r === null ? "Not rated yet" : `${r.toFixed(1)} out of 5`)), differs: differsAcross(ratings.map(String)), best: bestIndexes(ratings, "max") },
    { id: "availability", label: "Availability", kind: "availability", values: products.map((p) => AVAILABILITY_TEXT[p.availability]), differs: differsAcross(products.map((p) => p.availability)), best: [] },
    { id: "brand", label: "Brand", kind: "text", values: text((i) => products[i]?.brand), differs: false, best: [] },
    { id: "category", label: "Category", kind: "text", values: products.map((p) => titleCase(p.category)), differs: false, best: [] },
    { id: "description", label: "Description", kind: "text", values: text((i) => products[i]?.description), differs: false, best: [] },
    { id: "sku", label: "SKU", kind: "text", values: text((i) => detail(i)?.sku), differs: false, best: [] },
    { id: "warranty", label: "Warranty", kind: "text", values: text((i) => detail(i)?.warrantyInformation), differs: false, best: [] },
    { id: "shipping", label: "Shipping", kind: "text", values: text((i) => detail(i)?.shippingInformation), differs: false, best: [] },
    { id: "returns", label: "Return policy", kind: "text", values: text((i) => detail(i)?.returnPolicy), differs: false, best: [] },
    { id: "tags", label: "Tags", kind: "list", values: products.map((p) => (p.tags.length > 0 ? p.tags.join(", ") : NOT_SPECIFIED)), differs: false, best: [] },
  ];

  return rows.map((row) => ({ ...row, differs: row.id === "price" || row.id === "discount" || row.id === "rating" || row.id === "availability" ? row.differs : differsAcross(row.values) }));
}
