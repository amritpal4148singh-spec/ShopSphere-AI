import type { Category, Product } from "@/types/product";
import type { Order } from "@/types/order";

/** Where an admin-visible product lives: the product API's catalogue, or created locally by an administrator. */
export type ProductOrigin = "catalogue" | "local";

/** active: for sale. archived: kept because orders reference it (PRD edge case 27). removed: deleted locally. */
export type ProductStatus = "active" | "archived" | "removed";

/** A product as the admin screens see it: the API product with the local overlay applied. */
export interface AdminProduct extends Product {
  origin: ProductOrigin;
  status: ProductStatus;
  /** True when local edits are applied on top of the API values. */
  edited: boolean;
}

/** Fields an administrator can change on a product. Prices are INR. */
export interface ProductValues {
  title: string;
  brand: string | null;
  category: string;
  /** List price, whole rupees. */
  price: number;
  discountPercentage: number;
  stock: number;
  description: string;
  tags: string[];
}

/** A product created by an administrator. Ids start above the product API's range so they never collide. */
export interface LocalProduct extends ProductValues {
  id: number;
  createdAt: number;
}

/**
 * Local changes on top of the product API (PRD 4.2, 8.2): scoped to this browser and never sent anywhere.
 * `edits` holds the full edited values of catalogue products, keyed by product id.
 */
export interface CatalogueOverlay {
  edits: Record<number, ProductValues>;
  added: LocalProduct[];
  /** Ids of catalogue products removed locally (never products that orders reference). */
  removed: number[];
  /** Ids of products archived because orders reference them. */
  archived: number[];
  addedCategories: Category[];
  /** Category slug -> local display name. */
  renamedCategories: Record<string, string>;
  nextLocalId: number;
}

/** The form's text values; validated into `ProductValues`. */
export interface ProductDraft {
  title: string;
  brand: string;
  category: string;
  price: string;
  discountPercentage: string;
  stock: string;
  description: string;
  tags: string;
}

export type ProductDraftErrors = Partial<Record<keyof ProductDraft, string>>;

/** An order together with the account that placed it (orders are stored per customer). */
export interface AdminOrder {
  ownerId: string;
  order: Order;
}

export interface CategoryRow {
  slug: string;
  name: string;
  /** True when the name was changed locally. */
  renamed: boolean;
  /** True when the category was created locally. */
  local: boolean;
  productCount: number;
}
