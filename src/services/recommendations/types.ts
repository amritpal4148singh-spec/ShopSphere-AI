import type { Product } from "@/types/product";

/**
 * The nine PRD strategies (section 6.3) plus two that are not part of the nine: "featured", the editorial Featured
 * Products rail of the landing page (a selection rule), and "assistant", which executes the structured filter the
 * shopping assistant extracted from a message (PRD 7.3).
 */
export type StrategyId =
  | "recently-viewed"
  | "similar"
  | "category-based"
  | "price-based"
  | "wishlist-based"
  | "cart-based"
  | "frequently-bought-together"
  | "trending"
  | "personalized"
  | "featured"
  | "assistant";

export const PRD_STRATEGIES: readonly StrategyId[] = [
  "recently-viewed",
  "similar",
  "category-based",
  "price-based",
  "wishlist-based",
  "cart-based",
  "frequently-bought-together",
  "trending",
  "personalized",
];

/** The kinds of signal an explanation can name (PRD 6.1). */
export type SignalKind = "viewed" | "search" | "wishlist" | "cart" | "purchases" | "price" | "brand" | "category" | "tags" | "popularity";

/* ------------------------------------------------------------------ raw signals: plain data collected from local sources */

export interface ViewedSignal {
  productId: number;
  viewedAt: number;
  category: string;
  brand: string | null;
  price: number;
  tags: string[];
}

export interface WishlistSignal {
  productId: number;
  category: string;
  brand: string | null;
  price: number;
}

export interface CartSignal {
  productId: number;
  quantity: number;
  category: string;
  price: number;
}

export interface OrderSignal {
  placedAt: number;
  items: Array<{ productId: number; quantity: number; unitPrice: number }>;
}

/** Everything the shopper has done on this device, as plain data. The hook gathers it; the service turns it into signals. */
export interface RawSignals {
  viewed: ViewedSignal[];
  /** Recent search texts, most recent first. */
  searches: string[];
  wishlist: WishlistSignal[];
  cart: CartSignal[];
  orders: OrderSignal[];
}

export const EMPTY_RAW_SIGNALS: RawSignals = { viewed: [], searches: [], wishlist: [], cart: [], orders: [] };

/* ------------------------------------------------------------------ derived signals */

export interface PriceBand {
  min: number;
  max: number;
}

/** Signals derived from the raw data and the catalogue (PRD 6.1). Every affinity is normalized to 0..1. */
export interface ShopperSignals {
  /** Product ids, most recently viewed first. */
  viewedIds: number[];
  wishlistIds: number[];
  cartIds: number[];
  purchasedIds: number[];
  /** Catalogue products behind the ids above (ids no longer in the catalogue are dropped). */
  viewedProducts: Product[];
  wishlistProducts: Product[];
  cartProducts: Product[];
  purchasedProducts: Product[];
  categoryAffinity: Record<string, number>;
  tagAffinity: Record<string, number>;
  brandAffinity: Record<string, number>;
  priceBand: PriceBand | null;
  /** Categories inferred from recent searches. */
  searchCategories: string[];
  searches: string[];
  dominantCategory: string | null;
  /** Product id -> ids bought in the same (simulated) order. */
  coPurchases: Map<number, Set<number>>;
  /** Weighted amount of evidence collected, and the confidence (0..1) derived from it. */
  evidence: number;
  confidence: number;
  counts: { viewed: number; searches: number; wishlist: number; cart: number; purchases: number };
}

/* ------------------------------------------------------------------ requests, results, provider contract */

/**
 * A structured filter, as extracted from free text by the shopping assistant (PRD 7.3) and executed by the "assistant"
 * strategy. Every field is optional; an empty filter matches every product.
 */
export interface ProductFilter {
  /** Category slugs a product may belong to. Together with `keywords`, matching either is enough. */
  categories?: string[];
  /** Single words matched against a product's title, tags and category: for product types that are not a category (headphones). */
  keywords?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  /** A colour the product must come in, lower case. */
  colour?: string;
  sort?: "relevance" | "rating" | "price-asc" | "price-desc";
  /** What was asked for, in words ("headphones"), for headings and reasons. */
  label?: string;
}

export interface RecommendationRequest {
  strategy: StrategyId;
  /** The product a product-page strategy is anchored to (similar, frequently bought together). */
  productId?: number;
  /** A category a category-based rail is anchored to; otherwise the shopper's dominant category is used. */
  categorySlug?: string;
  /** Ids that must not appear (for example the product being viewed). */
  excludeIds?: number[];
  /** The structured filter an "assistant" request executes. */
  filter?: ProductFilter;
  limit: number;
  signals: ShopperSignals;
  /** Candidate products: the whole catalogue (DummyJSON plus local data). */
  catalog: readonly Product[];
}

export interface ScoreBreakdown {
  categoryMatch: number;
  priceSimilarity: number;
  tagOverlap: number;
  normalizedRating: number;
  recentlyViewedRelation: number;
  wishlistRelation: number;
  cartRelation: number;
  brandAffinity: number;
  popularity: number;
}

export interface RecommendedProduct {
  product: Product;
  /** 0..1 */
  score: number;
  /** Plain-language explanations, strongest first (PRD 6: every recommendation is traceable to a signal). */
  reasons: string[];
  breakdown?: ScoreBreakdown;
}

export interface RecommendationResult {
  strategy: StrategyId;
  items: RecommendedProduct[];
  /** A signal-transparent heading (PRD 6.3), for example "Because You Browsed Mens Shoes". */
  heading: string;
  /** What the rail is based on, in words. */
  basedOn: string;
  /** True when there was not enough signal and popular products were shown instead. */
  fallback: boolean;
  signalsUsed: SignalKind[];
  confidence: number;
  /** For "assistant" requests: how many products matched the filter before the limit was applied. */
  matched?: number;
}

/**
 * The contract boundary (PRD 6.4). Today the mock engine implements it; an ML or LLM provider could replace it
 * without any change to the service, hooks or UI. It is asynchronous so a remote provider fits.
 */
export interface RecommendationProvider {
  readonly id: string;
  recommend(request: RecommendationRequest): Promise<RecommendationResult>;
}
