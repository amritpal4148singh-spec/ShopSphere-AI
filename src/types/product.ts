import type { CatalogueReview } from "@/types/review";

export type Availability = "in-stock" | "low-stock" | "out-of-stock";

/** Domain product. Prices are in INR (converted from DummyJSON's USD, see lib/currency.ts). */
export interface Product {
  id: number;
  title: string;
  description: string;
  /** Category slug, e.g. "mens-shoes". */
  category: string;
  brand: string | null;
  /** List price in INR. */
  price: number;
  discountPercentage: number;
  /** Price after discount in INR. All price filtering and sorting uses this value. */
  finalPrice: number;
  rating: number;
  stock: number;
  availability: Availability;
  tags: string[];
  thumbnail: string | null;
  /** Epoch milliseconds, or null when the API gives no creation date. */
  createdAt: number | null;
}

export interface Category {
  slug: string;
  name: string;
}

export interface ProductSuggestion {
  id: number;
  title: string;
  category: string;
  thumbnail: string | null;
}

export type SortKey = "relevance" | "price-asc" | "price-desc" | "rating" | "newest";
export type AvailabilityFilter = "any" | "in" | "out";

/** Everything that defines a discovery view. It round-trips through the URL query string. */
export interface DiscoveryState {
  query: string;
  categories: string[];
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availability: AvailabilityFilter;
  onSale: boolean;
  sort: SortKey;
  page: number;
}

export interface ProductDetail extends Product {
  /** Gallery images, in display order (never empty strings). */
  images: string[];
  /** The reviews the data source returns with the product (PRD 10.1). The review module adds local ones (PRD 5.10). */
  reviews: CatalogueReview[];
  sku: string | null;
  warrantyInformation: string | null;
  shippingInformation: string | null;
  returnPolicy: string | null;
  minimumOrderQuantity: number;
}

export interface VariantOption {
  id: string;
  label: string;
  /** Units available for this option. Zero means out of stock. */
  stock: number;
}

/** One selectable dimension such as Size or Storage. */
export interface VariantGroup {
  id: string;
  label: string;
  options: VariantOption[];
}
