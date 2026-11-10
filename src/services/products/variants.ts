
import { getAvailableStock } from "@/utils/purchase";
import type { Product, VariantGroup, VariantOption } from "@/types/product";

/**
 * DummyJSON has no variants, so size/colour/storage options and per-option stock are SIMULATED locally
 * (PRD 10.3: local mock data where the free API is insufficient). Everything here is deterministic:
 * the same product always gets the same options and the same stock split, and the split always adds up
 * to the product's real stock.
 */
interface VariantTemplate {
  id: string;
  label: string;
  options: string[];
}

const FOOTWEAR: VariantTemplate = {
  id: "size",
  label: "Size",
  options: ["6", "7", "8", "9", "10"],
};

const APPAREL: VariantTemplate = {
  id: "size",
  label: "Size",
  options: ["S", "M", "L", "XL"],
};

const ACCESSORY: VariantTemplate = {
  id: "color",
  label: "Colour",
  options: ["Black", "Silver", "Gold"],
};

const DEVICE: VariantTemplate = {
  id: "storage",
  label: "Storage",
  options: ["128 GB", "256 GB", "512 GB"],
};

const VOLUME: VariantTemplate = {
  id: "size",
  label: "Size",
  options: ["30 ml", "50 ml", "100 ml"],
};

const TEMPLATES: Record<string, VariantTemplate> = {
  "mens-shoes": FOOTWEAR,
  "womens-shoes": FOOTWEAR,
  "mens-shirts": APPAREL,
  tops: APPAREL,
  "womens-dresses": APPAREL,
  "mens-watches": ACCESSORY,
  "womens-watches": ACCESSORY,
  sunglasses: ACCESSORY,
  "womens-bags": ACCESSORY,
  "womens-jewellery": ACCESSORY,
  tablets: DEVICE,
  laptops: DEVICE,
  fragrances: VOLUME,
  beauty: VOLUME,
  "skin-care": VOLUME,
};

/** Small deterministic hash so stock splits look varied but never change between renders. */
function hash(a: number, b: number): number {
  return Math.abs(
    Math.imul(a * 2654435761 + b * 40503, 2246822519) >>> 0
  );
}

function splitStock(
  productId: number,
  stock: number,
  count: number
): number[] {
  if (stock <= 0) return Array<number>(count).fill(0);

  // Every third product has exactly one sold-out option, so the out-of-stock-variant behaviour
  // (PRD MOD-04-001) is visible in the catalogue.
  const soldOutIndex = productId % 3 === 0 ? productId % count : -1;

  const weights = Array.from(
    { length: count },
    (_, index) =>
      index === soldOutIndex ? 0 : 1 + (hash(productId, index) % 5)
  );

  const total = weights.reduce((sum, weight) => sum + weight, 0);

  const allocation = weights.map((weight) =>
    Math.floor((stock * weight) / total)
  );

  const remainder =
    stock - allocation.reduce((sum, units) => sum + units, 0);

  const firstStocked = weights.findIndex((weight) => weight > 0);

  if (firstStocked >= 0) {
    allocation[firstStocked] =
      (allocation[firstStocked] ?? 0) + remainder;
  }

  return allocation;
}

/** The product's variant group, or null when it has no variants. */
export function getVariantGroup(
  product: Pick<Product, "id" | "category" | "stock">
): VariantGroup | null {
  const category = product.category.trim().toLowerCase();
  const template = TEMPLATES[category];

  if (!template) {
    return null;
  }

  const stocks = splitStock(
    product.id,
    product.stock,
    template.options.length
  );

  const options: VariantOption[] = template.options.map(
    (label, index) => ({
      id: `${template.id}-${label.toLowerCase().replace(/\s+/g, "")}`,
      label,
      stock: stocks[index] ?? 0,
    })
  );

  return {
    id: template.id,
    label: template.label,
    options,
  };
}

/**
 * Units available for a product and (optional) variant. A variant that no longer exists counts as 0,
 * so a stale cart line cannot be bought.
 */
export function getVariantStock(
  product: Pick<Product, "id" | "category" | "stock">,
  variantId: string | null
): number {
  return getAvailableStock(
    product.stock,
    getVariantGroup(product),
    variantId
  );
}
