# API integration (PRD section 10)

Updated in: Phase 07. Later phases extend this document.

## Data sources

| Domain | Source | Status |
|---|---|---|
| Products (list) | DummyJSON `GET /products?limit=0&select=...` | Used (Phase 03) |
| Search | DummyJSON `GET /products/search?q=...&limit=0&select=...` | Used (Phase 03) |
| Search suggestions | DummyJSON `GET /products/search?q=...&limit=5&select=id,title,category,thumbnail` | Used (Phase 03) |
| Categories | DummyJSON `GET /products/categories` | Used (Phase 03) |
| Product detail | DummyJSON `GET /products/{id}` | Used (Phase 04); a 404 means the product was removed |
| Variants and per-variant stock | Local rules (`services/products/variants.ts`), not from the API | Used (Phase 04) |
| Authentication | Local mock user store plus JWT-shaped mock token (not DummyJSON `/auth`) | Used (Phase 02) |
| Cart and wishlist | Browser storage (per shopper); live price and stock checked against the cached `GET /products?limit=0` catalogue, no new endpoints | Used (Phase 05) |
| Checkout, payment, orders, order tracking, saved addresses | Local only: browser storage per user, a payment simulation and sample orders (`src/data/seed-orders.json`); no network calls, no card data | Used (Phase 06) |
| Recommendations | Computed in the browser from the cached catalogue (`GET /products?limit=0`), the shopper's local activity and simulated seed data (`src/data/recommendations.json`); no recommendation endpoint, no network calls | Used (Phase 07) |
| Reviews, analytics | Local mock data and browser storage | Later phases |

The API base URL comes from `NEXT_PUBLIC_API_BASE_URL` (default `https://dummyjson.com`). No API keys are used or needed.

## Why the whole catalogue is loaded

DummyJSON can list, search and paginate, but it cannot filter by price, rating, stock status, brand or discount, which PRD 5.2 requires.
Instead of many partial requests, discovery fetches the catalogue once (about 200 products with only the fields it needs), caches it, and filters on the client.
Search results are fetched per query from the API and filtered the same way.

## Response handling

All responses pass through `services/products/mappers.ts`: unknown shapes are rejected with a `parse` error, individual unreadable products are dropped, numbers are clamped, and missing fields get safe defaults.
`services/products/client.ts` applies a 10-second timeout and turns failures into `ApiError` with kind `network`, `timeout`, `http` or `parse`.

## Product detail

`fetchProduct` reads `images`, `reviews` (only the count is used), `sku`, `warrantyInformation`, `shippingInformation`, `returnPolicy` and `minimumOrderQuantity` in addition to the list fields.
Review text, reviewer names and e-mail addresses are deliberately not kept in the app model. Weight and dimensions are not used because their units are not documented.

## Assumptions not yet verified against the live service

The authoring environment has no network access, so these are from knowledge of the public DummyJSON API and are unverified:
`limit=0` returns every item; `select` accepts the listed keys including `meta`; `/products/categories` returns `{slug, name, url}` objects; the search endpoint accepts `limit` and `select`; thumbnails are served from `cdn.dummyjson.com`; `GET /products/{id}` returns HTTP 404 for an unknown id and includes `images`, `reviews`, `sku`, `shippingInformation`, `warrantyInformation` and `returnPolicy`.
If any of these differs, the mappers and `product-service.ts` are the only places to change.

## Endpoint coverage and intentional local substitutes (PRD 10.2, 10.3)

| PRD row | What this project does | Why |
|---|---|---|
| Products, categories, search | DummyJSON `/products`, `/products/categories`, `/products/search`, `/products/{id}` | Used |
| Users (mock profile data) | **Not called.** Accounts and the editable profile are local (`services/auth/`, `lib/profile-storage.ts`) | The PRD allows local persistence; DummyJSON users cannot be registered or edited, so a real account flow needs local storage anyway |
| Cart (development reference) | **Not called.** The cart is local and checked against live price and stock from `/products` | `/carts` is a fake write; the PRD calls it a reference only |
| Authentication (development reference) | **Not called.** Local user store and a JWT-shaped mock token | PRD 11.1 allows "DummyJSON and/or a local store" |
| Recommendations, orders, reviews, analytics | Local services and fixtures (`src/data/*.json`) | PRD 10.2 |

The mock session token is **not attached to any API request**. There is no authenticated endpoint to send it to, and sending it to the public DummyJSON service would only leak it. The unused `buildAuthHeaders` helper was removed rather than left as dead code. This is the one place where the PRD's wording in 11.2 ("attach to subsequent authenticated calls") is met by there being nothing to attach it to.

Fixtures in `src/data/`: `seed-orders.json` (one order per tracking status), `reviews.json`, `recommendations.json`, `analytics.json` and `user-preferences.json`. The last one documents the shape of derived preference signals (price band, preferred categories and brands, recent searches, confidence). Preferences are never stored: `toDerivedPreferences()` in `services/recommendations/preferences.ts` computes that shape from live activity, and a test keeps the fixture and the function in step.
