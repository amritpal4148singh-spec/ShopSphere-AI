import { MAX_PER_CATEGORY, MIN_RELATION, MIN_SIMILAR_SCORE, RECENCY_DECAY } from "./constants";
import { FEATURED_RULE, categoryPairStrength } from "./mock-data";
import { popularityContext, popularityScore, type PopularityContext } from "./popularity";
import { bandAround, complementarity, priceSimilarity, relatedness, tagCosine } from "./relations";
import { compositeScore, explain, scoreComponents } from "./scoring";
import { matchesFilter } from "./filter";
import type { ProductFilter, RecommendationRequest, RecommendationResult, RecommendedProduct, ShopperSignals, SignalKind } from "./types";
import { formatInr } from "@/lib/currency";
import { titleCase } from "@/utils/text";
import type { Product } from "@/types/product";

interface Context {
  request: RecommendationRequest;
  byId: Map<number, Product>;
  popularity: Map<number, number>;
  /** Candidates that can be bought: out-of-stock products never appear in recommendation rails (PRD edge case 23). */
  recommendable: Product[];
  excluded: Set<number>;
  /** Products the shopper already viewed, saved, carted or bought. */
  interacted: Set<number>;
}

export function buildContext(request: RecommendationRequest): Context {
  const popContext: PopularityContext = popularityContext(request.catalog);
  const popularity = new Map(request.catalog.map((product) => [product.id, popularityScore(product, popContext)]));
  const { signals } = request;
  return {
    request,
    byId: new Map(request.catalog.map((product) => [product.id, product])),
    popularity,
    recommendable: request.catalog.filter((product) => product.availability !== "out-of-stock"),
    excluded: new Set(request.excludeIds ?? []),
    interacted: new Set([...signals.viewedIds, ...signals.wishlistIds, ...signals.cartIds, ...signals.purchasedIds]),
  };
}

const byScore = (a: RecommendedProduct, b: RecommendedProduct) => b.score - a.score || b.product.rating - a.product.rating || a.product.id - b.product.id;

/** Keeps a rail varied: no more than `cap` products from one category. */
function capPerCategory(items: RecommendedProduct[], cap: number): RecommendedProduct[] {
  const counts = new Map<string, number>();
  return items.filter((item) => {
    const count = counts.get(item.product.category) ?? 0;
    if (count >= cap) return false;
    counts.set(item.product.category, count + 1);
    return true;
  });
}

function result(
  context: Context,
  items: RecommendedProduct[],
  heading: string,
  basedOn: string,
  signalsUsed: SignalKind[],
  fallback = false,
): RecommendationResult {
  return {
    strategy: context.request.strategy,
    items: items.slice(0, context.request.limit),
    heading,
    basedOn,
    fallback,
    signalsUsed,
    confidence: context.request.signals.confidence,
  };
}

const empty = (context: Context, heading: string, basedOn: string): RecommendationResult => result(context, [], heading, basedOn, []);

/* ------------------------------------------------------------------ 1. recently viewed */

export function recentlyViewed(context: Context): RecommendationResult {
  const items = context.request.signals.viewedProducts
    .filter((product) => !context.excluded.has(product.id))
    .map((product, rank) => ({ product, score: RECENCY_DECAY ** rank, reasons: ["You viewed this recently"] }));
  // Out-of-stock products stay visible here (they were viewed); the product card marks them as out of stock.
  return result(context, items, "Recently Viewed", "products you viewed on this device", items.length ? ["viewed"] : []);
}

/* ------------------------------------------------------------------ 2. similar products */

export function similar(context: Context): RecommendationResult {
  const anchor = context.request.productId !== undefined ? context.byId.get(context.request.productId) : undefined;
  if (!anchor) return empty(context, "Similar Products", "a product that is not available");

  const band = bandAround(anchor.finalPrice, 0.35);
  const items: RecommendedProduct[] = [];
  for (const product of context.recommendable) {
    if (product.id === anchor.id || context.excluded.has(product.id)) continue;
    const sameCategory = product.category === anchor.category;
    const tags = tagCosine(anchor.tags, product.tags);
    const price = priceSimilarity(product.finalPrice, band);
    const score = 0.35 * (sameCategory ? 1 : 0) + 0.3 * tags + 0.2 * price + 0.15 * (product.rating / 5);
    if (score < MIN_SIMILAR_SCORE) continue;

    const shared = product.tags.filter((tag) => anchor.tags.includes(tag)).slice(0, 2);
    const reasons: string[] = [];
    if (sameCategory) reasons.push(`Same category: ${titleCase(product.category)}`);
    if (shared.length) reasons.push(`Shares tags: ${shared.join(", ")}`);
    if (price >= 0.9 && reasons.length < 2) reasons.push("Similar price");
    items.push({ product, score, reasons: reasons.length ? reasons : ["Similar to this product"] });
  }
  return result(context, items.sort(byScore), "Similar Products", anchor.title, ["category", "tags", "price"]);
}

/* ------------------------------------------------------------------ 3. category based */

export function categoryBased(context: Context): RecommendationResult {
  const { request } = context;
  const anchored = request.categorySlug !== undefined;
  const category = request.categorySlug ?? request.signals.dominantCategory;
  if (!category) return empty(context, "Because You Browsed", "no browsing yet");

  const band = request.signals.priceBand;
  const items: RecommendedProduct[] = [];
  for (const product of context.recommendable) {
    if (product.category !== category || context.excluded.has(product.id)) continue;
    if (!anchored && context.interacted.has(product.id)) continue;
    const popularity = context.popularity.get(product.id) ?? 0;
    const score = 0.5 * (product.rating / 5) + 0.3 * (band ? priceSimilarity(product.finalPrice, band) : 0.5) + 0.2 * popularity;
    items.push({
      product,
      score,
      reasons: [anchored ? `Top rated in ${titleCase(category)}` : `Because you browsed ${titleCase(category)}`, `Rated ${product.rating.toFixed(1)} out of 5`],
    });
  }
  const heading = anchored ? `More in ${titleCase(category)}` : `Because You Browsed ${titleCase(category)}`;
  return result(context, items.sort(byScore), heading, anchored ? `the ${titleCase(category)} category` : "the category you browse most", anchored ? ["category"] : ["category", "viewed"]);
}

/* ------------------------------------------------------------------ 4. price based */

export function priceBased(context: Context): RecommendationResult {
  const band = context.request.signals.priceBand;
  if (!band) return empty(context, "In Your Price Range", "no price range yet");

  const items: RecommendedProduct[] = [];
  for (const product of context.recommendable) {
    if (context.excluded.has(product.id) || context.interacted.has(product.id)) continue;
    // Strictly inside the band: the heading and the reason promise "within your typical price range".
    const price = priceSimilarity(product.finalPrice, band);
    if (price < 1) continue;
    const popularity = context.popularity.get(product.id) ?? 0;
    items.push({
      product,
      score: 0.5 * (product.rating / 5) + 0.3 * price + 0.2 * popularity,
      reasons: [`Within your typical price range (${formatInr(band.min)} to ${formatInr(band.max)})`, `Rated ${product.rating.toFixed(1)} out of 5`],
    });
  }
  return result(
    context,
    capPerCategory(items.sort(byScore), 3),
    `In Your Price Range (${formatInr(band.min)} to ${formatInr(band.max)})`,
    "the prices of products you viewed, saved or bought",
    ["price"],
  );
}

/* ------------------------------------------------------------------ 5 and 6. wishlist based, cart based */

function anchoredOn(context: Context, anchors: readonly Product[], measure: (a: Product, b: Product) => number, reasonFor: (anchor: Product) => string, exclude: Set<number>): RecommendedProduct[] {
  const band = context.request.signals.priceBand;
  const items: RecommendedProduct[] = [];
  for (const product of context.recommendable) {
    if (exclude.has(product.id) || context.excluded.has(product.id)) continue;

    let relation = 0;
    let closest: Product | null = null;
    for (const anchor of anchors) {
      const value = measure(product, anchor);
      if (value > relation) {
        relation = value;
        closest = anchor;
      }
    }
    if (!closest || relation < MIN_RELATION) continue;

    const tags = Math.max(0, ...anchors.map((anchor) => tagCosine(product.tags, anchor.tags)));
    const score = 0.5 * relation + 0.15 * tags + 0.15 * (band ? priceSimilarity(product.finalPrice, band) : 0.5) + 0.2 * (product.rating / 5);
    items.push({ product, score, reasons: [reasonFor(closest)] });
  }
  return items.sort(byScore);
}

export function wishlistBased(context: Context): RecommendationResult {
  const { signals } = context.request;
  if (signals.wishlistProducts.length === 0) return empty(context, "Inspired By Your Wishlist", "an empty wishlist");

  const exclude = new Set([...signals.wishlistIds, ...signals.cartIds]);
  const items = anchoredOn(context, signals.wishlistProducts, relatedness, (anchor) => `Similar to ${anchor.title} on your wishlist`, exclude);
  return result(context, capPerCategory(items, MAX_PER_CATEGORY), "Inspired By Your Wishlist", "products on your wishlist", ["wishlist"]);
}

export function cartBased(context: Context): RecommendationResult {
  const { signals } = context.request;
  if (signals.cartProducts.length === 0) return empty(context, "Goes Well With Your Cart", "an empty cart");

  const exclude = new Set(signals.cartIds);
  // An add-on rail offers what goes WITH the cart, not near-duplicates of it: same-category products do not count.
  const complements = (candidate: Product, inCart: Product) => (candidate.category === inCart.category ? 0 : complementarity(candidate, inCart));
  const items = anchoredOn(context, signals.cartProducts, complements, (anchor) => `Goes with ${anchor.title} in your cart`, exclude);
  return result(context, capPerCategory(items, 3), "Goes Well With Your Cart", "items in your cart", ["cart"]);
}

/* ------------------------------------------------------------------ 7. frequently bought together */

export function frequentlyBoughtTogether(context: Context): RecommendationResult {
  const anchor = context.request.productId !== undefined ? context.byId.get(context.request.productId) : undefined;
  if (!anchor) return empty(context, "Frequently Bought Together", "a product that is not available");

  const bought = context.request.signals.coPurchases.get(anchor.id) ?? new Set<number>();
  const band = bandAround(anchor.finalPrice, 0.6);
  const items: RecommendedProduct[] = [];
  for (const product of context.recommendable) {
    if (product.id === anchor.id || context.excluded.has(product.id)) continue;
    const together = bought.has(product.id) ? 1 : categoryPairStrength(anchor.category, product.category);
    if (together < MIN_RELATION) continue;
    const popularity = context.popularity.get(product.id) ?? 0;
    items.push({
      product,
      score: 0.5 * together + 0.15 * priceSimilarity(product.finalPrice, band) + 0.2 * (product.rating / 5) + 0.15 * popularity,
      reasons: [bought.has(product.id) ? "Bought together in your past orders" : `Often bought with ${titleCase(anchor.category)} (simulated order data)`],
    });
  }
  return result(context, capPerCategory(items.sort(byScore), 2), "Frequently Bought Together", anchor.title, ["category"]);
}

/* ------------------------------------------------------------------ 8. trending */

function trendingItems(context: Context): RecommendedProduct[] {
  const items: RecommendedProduct[] = [];
  for (const product of context.recommendable) {
    if (context.excluded.has(product.id)) continue;
    const reasons: string[] = [];
    if (product.rating >= 4.5) reasons.push(`Highly rated (${product.rating.toFixed(1)})`);
    if (product.discountPercentage >= FEATURED_RULE.minDiscount) reasons.push(`${Math.round(product.discountPercentage)}% off`);
    if (reasons.length < 2) reasons.push("Popular with shoppers right now");
    items.push({ product, score: context.popularity.get(product.id) ?? 0, reasons: reasons.slice(0, 2) });
  }
  return capPerCategory(items.sort(byScore), 3);
}

export function trending(context: Context): RecommendationResult {
  return result(context, trendingItems(context), "Trending Now", "what is popular right now (simulated popularity)", ["popularity"]);
}

/* ------------------------------------------------------------------ 9. personalized */

/** The kinds of shopper activity that actually contributed signal (for "based on" labels). */
function personalSignalKinds(signals: ShopperSignals): SignalKind[] {
  const used: SignalKind[] = [];
  if (signals.counts.viewed) used.push("viewed");
  if (signals.counts.searches) used.push("search");
  if (signals.counts.wishlist) used.push("wishlist");
  if (signals.counts.cart) used.push("cart");
  if (signals.counts.purchases) used.push("purchases");
  if (signals.priceBand) used.push("price");
  if (Object.keys(signals.brandAffinity).length) used.push("brand");
  return used;
}

export function personalized(context: Context): RecommendationResult {
  const { signals } = context.request;

  // No signal at all (PRD MOD-01-001, edge case 24): show what is popular instead, and say so.
  if (signals.evidence === 0) return result(context, trendingItems(context), "Popular Right Now", "what is popular right now (no activity yet)", ["popularity"], true);

  const confidence = signals.confidence;
  const items: RecommendedProduct[] = [];
  for (const product of context.recommendable) {
    if (context.excluded.has(product.id) || context.interacted.has(product.id)) continue;
    const popularity = context.popularity.get(product.id) ?? 0;
    const breakdown = scoreComponents(product, signals, popularity);
    // With little evidence the personal score is blended with popularity (PRD edge case 25).
    const score = confidence * compositeScore(breakdown) + (1 - confidence) * popularity;
    const reasons = explain(product, breakdown, signals);
    if (confidence < 0.5 && reasons.length < 2 && !reasons.includes("Popular with shoppers")) reasons.push("Popular with shoppers");
    items.push({ product, score, reasons, breakdown });
  }

  return result(context, capPerCategory(items.sort(byScore), MAX_PER_CATEGORY), "Recommended For You", "your browsing, searches, wishlist, cart and orders", personalSignalKinds(signals), false);
}

/* ------------------------------------------------------------------ featured (editorial, not personalized) */

export function featured(context: Context): RecommendationResult {
  const candidates = context.recommendable.filter((product) => !context.excluded.has(product.id));
  const toItem = (product: Product): RecommendedProduct => ({
    product,
    score: product.rating / 5,
    reasons: [product.discountPercentage >= FEATURED_RULE.minDiscount ? `${Math.round(product.discountPercentage)}% off` : "Highly rated", `Rated ${product.rating.toFixed(1)} out of 5`],
  });

  const onSale = candidates
    .filter((product) => product.discountPercentage >= FEATURED_RULE.minDiscount)
    .map(toItem)
    .sort((a, b) => b.score - a.score || b.product.discountPercentage - a.product.discountPercentage || a.product.id - b.product.id);
  const rest = candidates
    .filter((product) => product.discountPercentage < FEATURED_RULE.minDiscount)
    .map(toItem)
    .sort(byScore);

  const items = capPerCategory([...onSale, ...rest], FEATURED_RULE.maxPerCategory);
  return result(context, items, "Featured Products", "highly rated products, with deals first", ["popularity"]);
}

/* ------------------------------------------------------------------ assistant: a structured intent (PRD 7.3) */

function intentReasons(product: Product, filter: ProductFilter, breakdown: ReturnType<typeof scoreComponents>, signals: ShopperSignals): string[] {
  const reasons: string[] = [];
  if (filter.colour) reasons.push(`Available in ${titleCase(filter.colour)}`);
  if (filter.minRating !== undefined) reasons.push(`Rated ${product.rating.toFixed(1)} out of 5 (you asked for ${filter.minRating}+)`);
  else if (product.rating >= 4.5) reasons.push(`Highly rated (${product.rating.toFixed(1)} out of 5)`);
  if (filter.maxPrice !== undefined) reasons.push(`${formatInr(product.finalPrice)}, within your ${formatInr(filter.maxPrice)} budget`);
  if (reasons.length < 2 && signals.evidence > 0) {
    const personal = explain(product, breakdown, signals).find((reason) => reason !== "Popular with shoppers" && !reason.startsWith("Highly rated"));
    if (personal) reasons.push(personal);
  }
  if (reasons.length === 0) reasons.push(filter.label ? `Matches ${filter.label}` : "Matches your request");
  return reasons.slice(0, 2);
}

/**
 * Executes the structured filter the shopping assistant extracted from a message, through the same machinery as the
 * rails: the products must pass the filter, and they are ranked with the shared scoring model. With no activity the
 * rank is rating and popularity; as evidence builds, the personalized score (category, tags, brand, price band,
 * views, wishlist, cart) takes up to half of the weight, so two shoppers can see different orders for the same
 * request, and the card says why. Out-of-stock products are never offered (PRD edge case 23).
 */
export function intentSearch(context: Context): RecommendationResult {
  const { request } = context;
  const filter = request.filter ?? {};
  const { signals } = request;
  const confidence = signals.confidence;

  const items: RecommendedProduct[] = [];
  for (const product of context.recommendable) {
    if (context.excluded.has(product.id) || !matchesFilter(product, filter)) continue;
    const popularity = context.popularity.get(product.id) ?? 0;
    const breakdown = scoreComponents(product, signals, popularity);
    const base = 0.6 * (product.rating / 5) + 0.4 * popularity;
    const score = (1 - 0.5 * confidence) * base + 0.5 * confidence * compositeScore(breakdown);
    items.push({ product, score, reasons: intentReasons(product, filter, breakdown, signals), breakdown });
  }

  const sorted = [...items];
  switch (filter.sort) {
    case "rating":
      sorted.sort((a, b) => b.product.rating - a.product.rating || byScore(a, b));
      break;
    case "price-asc":
      sorted.sort((a, b) => a.product.finalPrice - b.product.finalPrice || byScore(a, b));
      break;
    case "price-desc":
      sorted.sort((a, b) => b.product.finalPrice - a.product.finalPrice || byScore(a, b));
      break;
    default:
      sorted.sort(byScore);
  }

  const used: SignalKind[] = ["popularity"];
  if (filter.categories?.length || filter.keywords?.length) used.push("category");
  if (filter.minPrice !== undefined || filter.maxPrice !== undefined) used.push("price");
  if (signals.evidence > 0) used.push(...personalSignalKinds(signals).filter((kind) => !used.includes(kind)));

  return { ...result(context, sorted, "Assistant Results", "what you asked the shopping assistant for", used), matched: items.length };
}
