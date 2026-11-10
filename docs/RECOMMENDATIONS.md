# Recommendation system (PRD section 6)

Added in Phase 07. This document describes how recommendations are produced, how a score is composed, and how the
engine can be replaced. Everything runs in the browser on local data: no recommendation request leaves the device.

## Architecture (PRD 6.4)

```
UI rail  ->  useRecommendations (hook)  ->  recommendationService  ->  RecommendationProvider  ->  mock engine
features/recommendations/            services/recommendations/service.ts   (interface in types.ts)     mock-engine.ts, strategies.ts,
components, hooks                    assembles signals, caches results                                  scoring.ts, signals.ts, relations.ts,
                                                                                                        popularity.ts, mock-data.ts
```

| Layer | Responsibility | File |
|---|---|---|
| Rail / panel components | Render a result: heading, "based on" line, cards with a reason each; hide when empty | `features/recommendations/components/*` |
| Hook | Gathers raw signals from local stores and the cached catalogue; asks the service; re-asks when anything that matters changes | `hooks/use-recommendations.ts`, `hooks/use-raw-signals.ts` |
| Service | Turns raw activity into derived signals, calls the provider, caches results by their inputs, does not cache failures | `services/recommendations/service.ts` |
| Provider contract | `RecommendationProvider { id; recommend(request): Promise<RecommendationResult> }` | `services/recommendations/types.ts` |
| Mock engine | The current provider: rules and scores, deterministic, no network | `mock-engine.ts`, `strategies.ts` |

The contract is asynchronous so a remote ML or LLM provider fits. To replace the engine, implement `RecommendationProvider`
and pass it to `createRecommendationService(provider)`; nothing else changes. A unit test does exactly this with a stand-in provider.

Dependency directions: the products feature does not import the recommendations feature (the product page receives its rails
from the route as a slot); the cart and wishlist features import it; the recommendations feature reads the cart, wishlist,
orders and viewed stores directly and reads the catalogue through the products feature's public API.

## Signals (PRD 6.1)

| Signal | Source | Used for |
|---|---|---|
| Recently viewed products | Product pages record a view; kept per device (`shopsphere.viewed.v1`, latest 20) | Recently Viewed, category and tag interest, price band, similarity to viewed items |
| Search history | The search box's recent searches | Inferred categories (a search word matching a category name or a product tag) |
| Wishlist | Wishlist store | Wishlist-based strategy, interests, price band, relation score |
| Cart | Cart store | Cart-based strategy, interests, price band, relation score |
| Purchase history | The customer's orders | Interests, price band, "bought together" evidence, excluding already-bought products |
| Category / brand / tag affinity | Derived from the above | Match scores |
| Price band | Derived from prices of viewed, saved, carted and bought products | Price scores and the Price-Based rail |

Derived values (`assembleSignals`): behaviour counts by kind (view 1, wishlist item 1.5, cart item 2, order item 1.2, matched search 0.6);
a view counts 0.85 times less than the one after it. Affinities are normalized so the strongest is 1. The price band is the middle 60%
of the prices involved, widened by 15% (or 30% around a single price), rounded to the nearest 100 rupees.

**Confidence (PRD edge case 25).** Evidence points: viewed product 1, wishlist item 1.5, cart item 2, ordered product 1.5, search 0.5
(at most three searches). `confidence = min(1, evidence / 6)`. With no evidence there is no personalization at all.

## Score composition (PRD 6.2)

For a candidate product, each component is normalized to 0..1, and

`score = w1*categoryMatch + w2*priceSimilarity + w3*tagOverlap + w4*normalizedRating + w5*recentlyViewedRelation + w6*wishlistRelation + w7*cartRelation + w8*brandAffinity + w9*popularity`

| Component | Weight | How it is computed |
|---|---|---|
| categoryMatch (w1) | 0.22 | The shopper's affinity for the product's category (0..1) |
| priceSimilarity (w2) | 0.12 | 1 inside the shopper's price band, falling to 0 a band-midpoint away; 0 with no band |
| tagOverlap (w3) | 0.14 | Cosine similarity between the product's tags and the shopper's tag profile |
| normalizedRating (w4) | 0.10 | rating / 5 |
| recentlyViewedRelation (w5) | 0.16 | Strongest relatedness to a viewed product, discounted by how long ago it was viewed |
| wishlistRelation (w6) | 0.08 | Strongest relatedness to a wishlist product |
| cartRelation (w7) | 0.08 | Strongest complementarity with a cart product (category pair strength, or relatedness) |
| brandAffinity (w8) | 0.06 | The shopper's affinity for the product's brand |
| popularity (w9) | 0.04 | Simulated popularity (below) |

w1 to w7 are the PRD's components; w8 and w9 are two documented additions (the PRD lists brand preference as a signal, and popularity is
what low-signal shoppers are blended with). The weights add up to 1.00, so a score is always between 0 and 1; a test checks this.
They live in one place, `services/recommendations/constants.ts`, and the dashboard's "How recommendations are scored" shows them.

*Relatedness* of two products = 0.5 for the same category + 0.3 times the cosine similarity of their tags + 0.2 for the same brand.

**Blending (PRD edge case 25).** The Recommended For You score is `confidence * personalScore + (1 - confidence) * popularity`, so one
weak signal cannot dominate the rail.

**Simulated popularity** (no live order data exists): `0.45*rating/5 + 0.20*min(1, discount/25) + 0.15*newness + 0.15*categoryBoost + 0.05*jitter`,
where `categoryBoost` comes from `src/data/recommendations.json` and `jitter` is a deterministic per-product tie-breaker. Deterministic.

## The strategies (PRD 6.3)

| # | Strategy | Heading | What it does | Where it appears |
|---|---|---|---|---|
| 1 | recently-viewed | Recently Viewed | Viewed products, most recent first. Out-of-stock ones stay, marked | Home |
| 2 | similar | Similar Products | Anchored to a product: 0.35 same category + 0.30 tag cosine + 0.20 price (within 35%) + 0.15 rating; minimum 0.25 | Product page |
| 3 | category-based | Because You Browsed X / More in X | Top products in the shopper's dominant category (or the anchored category), unseen first: 0.5 rating + 0.3 price + 0.2 popularity | Home, product page |
| 4 | price-based | In Your Price Range (a to b) | Products strictly inside the price band, unseen: 0.5 rating + 0.3 price + 0.2 popularity; at most 3 per category | Home |
| 5 | wishlist-based | Inspired By Your Wishlist | Related to wishlist items, excluding them: 0.5 relation + 0.15 tags + 0.15 price + 0.2 rating | Home, wishlist |
| 6 | cart-based | Goes Well With Your Cart | Complementary products from other categories, excluding the cart: 0.5 complementarity + 0.15 tags + 0.15 price + 0.2 rating | Cart |
| 7 | frequently-bought-together | Frequently Bought Together | Anchored to a product: 0.5 co-purchase strength + 0.15 price + 0.2 rating + 0.15 popularity. Strength is 1 if bought together in the customer's own orders, otherwise the simulated category pair strength; minimum 0.3; at most 2 per category | Product page |
| 8 | trending | Trending Now | Simulated popularity, at most 3 per category | Home |
| 9 | personalized | Recommended For You | The full score above, blended by confidence, excluding viewed, saved, carted and bought products; at most 4 per category. With no activity it becomes "Popular Right Now" (flagged as a fallback) | Home, product page |
| - | featured | Featured Products | Editorial: products with 10 percent or more off first, then top rated; at most 2 per category | Home |

"Featured" is a selection rule, not a personalization strategy, so it is the tenth id; the PRD's nine are `PRD_STRATEGIES`.

**`assistant`** (added in Phase 08, the eleventh id, also not one of the nine) executes the structured filter the shopping assistant extracted from a message: products must pass the filter (category or keyword, price bounds, minimum rating, colour), then are ranked by `(1 - c/2) * (0.6 * rating/5 + 0.4 * popularity) + (c/2) * personalized score`, where `c` is the shopper's confidence. Out-of-stock products are excluded. The result carries `matched`, the number that passed before the limit. See `docs/ASSISTANT.md`.

## Explainability

Every result has a heading that names its basis, a "Based on ..." line, and, for each product, up to two reasons built from the real
signal ("Similar to P1, which you viewed", "In your usual price range (₹1,400 to ₹5,400)", "Goes with P8 in your cart"). The dashboard's
Recommendation Preferences panel shows the viewed products, price range, interests, searches and confidence, and resets browsing signals.

## Rules that apply to every rail

- Out-of-stock products are never recommended; they appear only in Recently Viewed, marked (edge case 23).
- A rail with no candidates renders nothing, and fewer candidates than the limit show only what exists (edge case 16).
- No activity at all: the homepage shows Featured and Trending only; the personalized rail hides there, and elsewhere falls back to "Popular Right Now" (MOD-01-001, edge case 24).
- If the catalogue or the engine fails, rails disappear quietly (no broken boxes).
- Results are cached by a fingerprint of the activity and the catalogue's stock and prices, so a change is picked up and identical requests are not recomputed.

## Simulated data

`src/data/recommendations.json` holds the simulated co-purchase strength between categories (used by Frequently Bought Together and the cart
rail), the simulated category popularity (used by Trending and the popularity component), and the Featured rule. There is no live order data
and no machine learning. Derived signals are computed on demand rather than stored (the PRD's optional `user-preferences.json` is not needed),
so resetting the browsing signals is a real reset.

## Known limits

Recommendations are only as good as the local signals: a new device starts empty, history is per device (views, searches) or per account (orders), and
the catalogue is a free demo API. The strategies and weights are reasoned defaults, not tuned on data.
