import type { Availability, Category, Product } from "@/types/product";
import type { AdminProduct, CatalogueOverlay, CategoryRow, LocalProduct, ProductDraft, ProductDraftErrors, ProductStatus, ProductValues } from "@/types/admin";
import type { Order } from "@/types/order";
import { titleCase } from "@/utils/text";

/** Locally created products get ids above the product API's range (DummyJSON has fewer than 1,000), so they never collide. */
export const LOCAL_ID_START = 1_000_001;
/** Same threshold the storefront uses for "Only a few left". */
export const LOW_STOCK_THRESHOLD = 5;

export const EMPTY_OVERLAY: CatalogueOverlay = {
  edits: {},
  added: [],
  removed: [],
  archived: [],
  addedCategories: [],
  renamedCategories: {},
  nextLocalId: LOCAL_ID_START,
};

export const LIMITS = { title: [2, 120], brand: 60, description: 2000, tag: 30, tags: 10, price: 10_000_000, stock: 1_000_000, categoryName: [2, 40] } as const;

export function availabilityFor(stock: number): Availability {
  if (stock <= 0) return "out-of-stock";
  return stock <= LOW_STOCK_THRESHOLD ? "low-stock" : "in-stock";
}

export function valuesOf(product: Product): ProductValues {
  return {
    title: product.title,
    brand: product.brand,
    category: product.category,
    price: product.price,
    discountPercentage: product.discountPercentage,
    stock: product.stock,
    description: product.description,
    tags: product.tags,
  };
}

function withValues(product: Product, values: ProductValues): Product {
  return {
    ...product,
    ...values,
    finalPrice: Math.round(values.price * (1 - values.discountPercentage / 100)),
    // Edited stock is judged by the threshold; untouched products keep the API's own availability.
    availability: availabilityFor(values.stock),
  };
}

function fromLocal(local: LocalProduct): Product {
  return withValues(
    { id: local.id, title: local.title, description: local.description, category: local.category, brand: local.brand, price: local.price, discountPercentage: 0, finalPrice: local.price, rating: 0, stock: local.stock, availability: "in-stock", tags: [], thumbnail: null, createdAt: local.createdAt },
    local,
  );
}

/** The product API's catalogue with this browser's local changes applied (PRD 8.2: simulated, scoped to local state). */
export function applyOverlay(base: readonly Product[], overlay: CatalogueOverlay): AdminProduct[] {
  const removed = new Set(overlay.removed);
  const archived = new Set(overlay.archived);
  const statusOf = (id: number): ProductStatus => (removed.has(id) ? "removed" : archived.has(id) ? "archived" : "active");

  const fromApi = base.map((product): AdminProduct => {
    const edit = overlay.edits[product.id];
    return { ...(edit ? withValues(product, edit) : product), origin: "catalogue", status: statusOf(product.id), edited: edit !== undefined };
  });
  const local = overlay.added.map((entry): AdminProduct => ({ ...fromLocal(entry), origin: "local", status: statusOf(entry.id), edited: false }));
  return [...fromApi, ...local];
}

export function referencedProductIds(orders: ReadonlyArray<Pick<Order, "items">>): Set<number> {
  return new Set(orders.flatMap((order) => order.items.map((item) => item.productId)));
}

/* ------------------------------------------------------------------ the product form */

export function productToDraft(product?: Pick<Product, keyof ProductValues>): ProductDraft {
  return {
    title: product?.title ?? "",
    brand: product?.brand ?? "",
    category: product?.category ?? "",
    price: product ? String(product.price) : "",
    discountPercentage: product ? String(product.discountPercentage) : "0",
    stock: product ? String(product.stock) : "",
    description: product?.description ?? "",
    tags: product?.tags.join(", ") ?? "",
  };
}

export type DraftValidation = { ok: true; values: ProductValues } | { ok: false; errors: ProductDraftErrors };

const WHOLE = /^\d+$/;

/** Validates the form (PRD 13: every admin edit form). Returns normalized values or an error per field. */
export function validateDraft(draft: ProductDraft, categorySlugs: readonly string[]): DraftValidation {
  const errors: ProductDraftErrors = {};
  const title = draft.title.trim().replace(/\s+/g, " ");
  const brand = draft.brand.trim();
  const description = draft.description.trim();
  const price = draft.price.trim();
  const discount = draft.discountPercentage.trim() === "" ? "0" : draft.discountPercentage.trim();
  const stock = draft.stock.trim();

  if (title.length < LIMITS.title[0] || title.length > LIMITS.title[1]) errors.title = `Enter a title of ${LIMITS.title[0]} to ${LIMITS.title[1]} characters.`;
  if (brand.length > LIMITS.brand) errors.brand = `The brand can be at most ${LIMITS.brand} characters.`;
  if (!categorySlugs.includes(draft.category)) errors.category = "Choose a category.";
  if (!WHOLE.test(price) || Number(price) < 1 || Number(price) > LIMITS.price) errors.price = `Enter a whole-rupee price from 1 to ${LIMITS.price.toLocaleString("en-IN")}.`;
  const discountNumber = Number(discount);
  if (!/^\d+(\.\d{1,2})?$/.test(discount) || discountNumber > 100) errors.discountPercentage = "Enter a discount from 0 to 100 percent.";
  if (!WHOLE.test(stock) || Number(stock) > LIMITS.stock) errors.stock = `Enter a whole number of units from 0 to ${LIMITS.stock.toLocaleString("en-IN")}.`;
  if (description.length > LIMITS.description) errors.description = `The description can be at most ${LIMITS.description} characters.`;

  const tags = [...new Set(draft.tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  if (tags.length > LIMITS.tags) errors.tags = `Use at most ${LIMITS.tags} tags.`;
  else if (tags.some((tag) => tag.length > LIMITS.tag)) errors.tags = `Each tag can be at most ${LIMITS.tag} characters.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values: { title, brand: brand || null, category: draft.category, price: Number(price), discountPercentage: discountNumber, stock: Number(stock), description, tags } };
}

/* ------------------------------------------------------------------ product changes (pure) */

export function createLocalProduct(overlay: CatalogueOverlay, values: ProductValues, now: number): { overlay: CatalogueOverlay; id: number } {
  const id = overlay.nextLocalId;
  return { overlay: { ...overlay, added: [...overlay.added, { ...values, id, createdAt: now }], nextLocalId: id + 1 }, id };
}

export function saveProductValues(overlay: CatalogueOverlay, product: Pick<AdminProduct, "id" | "origin">, values: ProductValues): CatalogueOverlay {
  if (product.origin === "local") {
    return { ...overlay, added: overlay.added.map((entry) => (entry.id === product.id ? { ...entry, ...values } : entry)) };
  }
  return { ...overlay, edits: { ...overlay.edits, [product.id]: values } };
}

/** Drops local edits of a catalogue product so it shows the API's values again. */
export function revertProduct(overlay: CatalogueOverlay, id: number): CatalogueOverlay {
  const { [id]: _dropped, ...edits } = overlay.edits;
  void _dropped;
  return { ...overlay, edits };
}

export type RemoveOutcome = "removed" | "archived";

/**
 * Deleting a product that an existing order references would silently break order history, so it is archived instead
 * (PRD edge case 27). Any other product is removed: a locally created one disappears, a catalogue one is hidden locally.
 */
export function removeProduct(overlay: CatalogueOverlay, product: Pick<AdminProduct, "id" | "origin">, referenced: ReadonlySet<number>): { overlay: CatalogueOverlay; outcome: RemoveOutcome } {
  if (referenced.has(product.id)) {
    return { overlay: { ...overlay, archived: [...new Set([...overlay.archived, product.id])] }, outcome: "archived" };
  }
  if (product.origin === "local") {
    return { overlay: { ...overlay, added: overlay.added.filter((entry) => entry.id !== product.id) }, outcome: "removed" };
  }
  return { overlay: { ...overlay, removed: [...new Set([...overlay.removed, product.id])] }, outcome: "removed" };
}

/** Brings back an archived or locally removed product. */
export function restoreProduct(overlay: CatalogueOverlay, id: number): CatalogueOverlay {
  return { ...overlay, removed: overlay.removed.filter((value) => value !== id), archived: overlay.archived.filter((value) => value !== id) };
}

/* ------------------------------------------------------------------ categories */

export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildCategoryRows(base: readonly Category[], overlay: CatalogueOverlay, products: readonly AdminProduct[]): CategoryRow[] {
  const counts = new Map<string, number>();
  for (const product of products) if (product.status !== "removed") counts.set(product.category, (counts.get(product.category) ?? 0) + 1);

  const local = new Set(overlay.addedCategories.map((category) => category.slug));
  const all = [...base, ...overlay.addedCategories.filter((category) => !base.some((entry) => entry.slug === category.slug))];
  // A product may still carry a slug the category list no longer returns; it is shown rather than hidden.
  for (const slug of counts.keys()) if (!all.some((category) => category.slug === slug)) all.push({ slug, name: titleCase(slug) });

  return all
    .map((category) => ({
      slug: category.slug,
      name: overlay.renamedCategories[category.slug] ?? category.name,
      renamed: category.slug in overlay.renamedCategories,
      local: local.has(category.slug),
      productCount: counts.get(category.slug) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type CategoryResult = { ok: true; overlay: CatalogueOverlay } | { ok: false; error: string };

function checkCategoryName(name: string, rows: readonly CategoryRow[], ignoreSlug?: string): string | null {
  const [min, max] = LIMITS.categoryName;
  if (name.length < min || name.length > max) return `Enter a name of ${min} to ${max} characters.`;
  if (slugify(name) === "") return "The name needs at least one letter or number.";
  if (rows.some((row) => row.slug !== ignoreSlug && row.name.toLowerCase() === name.toLowerCase())) return "A category with this name already exists.";
  return null;
}

export function addCategory(overlay: CatalogueOverlay, rawName: string, rows: readonly CategoryRow[]): CategoryResult {
  const name = rawName.trim().replace(/\s+/g, " ");
  const problem = checkCategoryName(name, rows);
  if (problem) return { ok: false, error: problem };
  const slug = slugify(name);
  if (rows.some((row) => row.slug === slug)) return { ok: false, error: "A category with this name already exists." };
  return { ok: true, overlay: { ...overlay, addedCategories: [...overlay.addedCategories, { slug, name }] } };
}

/** Renaming changes the display name only: the slug (and every product's category) stays the same. */
export function renameCategory(overlay: CatalogueOverlay, slug: string, rawName: string, rows: readonly CategoryRow[]): CategoryResult {
  const name = rawName.trim().replace(/\s+/g, " ");
  const problem = checkCategoryName(name, rows, slug);
  if (problem) return { ok: false, error: problem };
  return { ok: true, overlay: { ...overlay, renamedCategories: { ...overlay.renamedCategories, [slug]: name } } };
}

/* ------------------------------------------------------------------ list: search, filter, sort, page */

export type StatusFilter = "all" | ProductStatus | "low-stock" | "out-of-stock";
export type AdminSort = "title" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc" | "rating";

export interface AdminProductFilters {
  query: string;
  category: string;
  status: StatusFilter;
}

export const DEFAULT_FILTERS: AdminProductFilters = { query: "", category: "", status: "all" };

export const ADMIN_SORT_LABELS: Record<AdminSort, string> = {
  title: "Title (A to Z)",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  "stock-asc": "Stock: low to high",
  "stock-desc": "Stock: high to low",
  rating: "Rating",
};

/** Matches the title, brand, category, tags and id (so "1000001" finds a locally created product). */
export function filterAdminProducts(products: readonly AdminProduct[], filters: AdminProductFilters): AdminProduct[] {
  const query = filters.query.trim().toLowerCase();
  return products.filter((product) => {
    // Removed products only appear when asked for.
    if (filters.status === "all" ? product.status === "removed" : false) return false;
    if (filters.status === "active" && product.status !== "active") return false;
    if (filters.status === "archived" && product.status !== "archived") return false;
    if (filters.status === "removed" && product.status !== "removed") return false;
    if (filters.status === "low-stock" && !(product.status !== "removed" && product.availability === "low-stock")) return false;
    if (filters.status === "out-of-stock" && !(product.status !== "removed" && product.availability === "out-of-stock")) return false;
    if (filters.category && product.category !== filters.category) return false;
    if (!query) return true;
    return [product.title, product.brand ?? "", product.category, product.tags.join(" "), String(product.id)].join(" ").toLowerCase().includes(query);
  });
}

export function sortAdminProducts(products: readonly AdminProduct[], sort: AdminSort): AdminProduct[] {
  const compare: Record<AdminSort, (a: AdminProduct, b: AdminProduct) => number> = {
    title: (a, b) => a.title.localeCompare(b.title),
    "price-asc": (a, b) => a.finalPrice - b.finalPrice,
    "price-desc": (a, b) => b.finalPrice - a.finalPrice,
    "stock-asc": (a, b) => a.stock - b.stock,
    "stock-desc": (a, b) => b.stock - a.stock,
    rating: (a, b) => b.rating - a.rating,
  };
  return [...products].sort((a, b) => compare[sort](a, b) || a.id - b.id);
}
