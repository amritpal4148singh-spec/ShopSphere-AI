# PROJECT STATE

Last updated: Phase 07.

## Source of truth
- PRD: "ShopSphere AI - Product Requirements Document", version 1.0, Approved for Implementation (delivered as a .docx).
- This file supports continuity and never replaces the PRD.

## Official phase sequence (PRD 19)
01 Project Setup and Architecture | 02 Authentication | 03 Product Discovery | 04 Product Detail Page | 05 Cart and Wishlist |
06 Checkout and Orders | 07 Recommendation Engine | 08 AI Shopping Assistant | 09 Admin Dashboard and Reviews |
10 Testing, Performance, Accessibility, Deployment

## Progress

| Phase | Status |
|---|---|
| 01 | Source complete; verification NOT RUN (see PHASE-01-REPORT.md) |
| 02 | Source complete; Vitest/Playwright/build/lint/typecheck NOT RUN; logic tests passed under a stand-in runner (see PHASE-02-REPORT.md) |
| 03 | Source complete; Vitest/Playwright/build/lint/typecheck NOT RUN; 76 new logic tests passed under the stand-in runner; live DummyJSON never called (see PHASE-03-REPORT.md) |
| 04 | Source complete. **User-verified locally** (reported): unit tests, type check, production build, all 35 E2E tests pass. Independently re-checked here: `tsc --noEmit` and `eslint .` pass with no output. Five test files were corrected (see "Phase 04 verified baseline" below). |
| 05 | Source complete. Real `tsc --noEmit` and `eslint .` pass (run with the user's installed dependencies). 97 new logic tests passed under the stand-in runner. Vitest, Playwright and `next build` for this phase NOT RUN (see PHASE-05-REPORT.md). |
| 06 | Source complete. Real `tsc --noEmit` and `eslint .` pass (run with the user's installed dependencies). 81 new logic tests passed under the stand-in runner. Vitest, Playwright and `next build` for this phase NOT RUN (see PHASE-06-REPORT.md). Phase 05 and 06 results from the user's own run have not been reported yet. |
| 07 | Source complete. Real `tsc --noEmit` and `eslint .` pass (run with the user's installed dependencies). 120 new logic tests passed under the stand-in runner (453 in total). Vitest, Playwright and `next build` for this phase NOT RUN (see PHASE-07-REPORT.md). Phase 05, 06 and 07 results from the user's own run have not been reported yet. |
| 08 | Source complete. **Run for real in this phase** (dependencies installed): `tsc --noEmit` and `eslint .` pass; Vitest 991 tests, 985 pass; `next build` passes (Google Fonts mocked in the sandbox); Playwright 100 tests, 93 pass. All 6 unit and 7 e2e failures also fail on the untouched Phase 7 code (see PHASE-08-REPORT.md). Phase 7's `next build` failure (missing `"use client"`) fixed. |
| 09 | Source complete. Run for real: `tsc --noEmit` and `eslint .` pass; Vitest 1,188 tests, 1,182 pass (the same 6 pre-existing failures, 0 new); `next build` passes (Google Fonts mocked in the sandbox); Playwright 119 tests, 112 pass (the same 7 pre-existing failures, confirmed on an untouched Phase 8 copy; all 19 new tests pass). See PHASE-09-REPORT.md. |
| 10 | Not started |

## Technology choices
TypeScript; Next.js ^15.1 (App Router); React ^19; Tailwind CSS ^4 (+ @tailwindcss/postcss); shadcn/ui (new-york, hand-written Button);
Zustand ^5; TanStack Query ^5; Vitest ^2.1 + React Testing Library ^16 + jsdom ^25; Playwright ^1.49; ESLint ^9; Manrope font.
Declared as caret ranges; exact resolved versions are in `package-lock.json` (see "Phase 04 verified baseline").

## Architectural decisions
See docs/ARCHITECTURE.md. Highlights: PRD 9.2 structure; layer rules enforced via ESLint `no-restricted-imports`;
Zustand (client) and TanStack Query (server) kept separate; list navigation: pagination (24 per page, URL-synced), chosen in Phase 03.

## User decisions and workflow rules
- TypeScript approved. Pagination only per the PRD's explicit requirements. Visual design follows the PRD, else polished/minimal/accessible.
- No network: proceed source-only, mark unrun checks "NOT RUN", never claim unverified results.
- Each ZIP is the complete source tree without `.git`. No claims of commits or branches that were not created.
- One phase at a time; wait for the user's command between phases.

## Requirements
- Completed (source): all PHASE-01 key tasks except GitHub repo/branch/push; all PHASE-02 tasks (registration, login, mock JWT session and persistence, protected routes, role-based UI).
- Completed (source): all PHASE-03 tasks (DummyJSON integration, grid, filters, sort, pagination, debounced search with suggestions, recent/popular searches, URL sync, all states).
- Completed (source): all PHASE-04 tasks (gallery, variants, stock-aware quantity, description/specification tabs, delivery block, rail placeholders, removed-product state).
- Completed (source): all PHASE-05 tasks (cart state with stock validation, coupons, save-for-later, simulated shipping and tax, wishlist add/remove/move-to-cart, all PRD 5.5 failure paths) plus the price-slider race fix.
- Completed (source): all PHASE-06 tasks (six-step checkout with persistence and session-expiry restore, mock payment, order confirmation, order history, order detail with tracking timeline).
- Completed (source): all PHASE-07 tasks (recommendation service architecture, the nine strategies, documented scoring, rails on home, product page, cart and wishlist, and the dashboard's Recommendation Preferences panel with reset).
- Pending: PHASE-08 to PHASE-10 and PRD deliverables 1-10 (section 22).

## Verification results
Phases 08 and 09 ran with real dependencies. Phase 08 was the first phase run with real dependencies, Vitest, Playwright and `next build`. The pre-existing failures it found in Phase 3 to 7 tests (6 unit, 7 e2e) are listed in docs/PHASE-08-REPORT.md and are not yet fixed. Earlier phases' own results remain as recorded above.

## Authentication facts (Phase 02)
- Demo accounts: customer@shopsphere.test / Customer123, admin@shopsphere.test / Admin12345. Local mock store plus `localStorage`; token is unsigned JWT-shaped, 30-minute TTL.
- Auth state: `src/store/auth-store.ts`; service: `src/services/auth`; feature: `src/features/auth` (public entry `@/features/auth`).
- Guarded routes: /dashboard, /orders, /checkout (any signed-in user), /admin (admin only; still a placeholder). /orders, /checkout and /dashboard (recommendation preferences only) are real from Phases 6 and 7.
- PHASE-06 must use the existing `expired` status and `readStoredSession` for edge cases 17-18 (checkout restore after re-authentication).

## Phase 04 verified baseline (user-supplied ZIP)
The user ran the Phase 04 ZIP locally, fixed the failures, and re-supplied it. **That ZIP is now the authoritative baseline; later phases extend it and must not overwrite these fixes.**
- Result reported by the user: unit tests, type check, production build and all 35 E2E tests pass. Lint was not mentioned by the user; re-run here with the user's `node_modules`: `tsc --noEmit` exit 0, `eslint .` exit 0 (no output). Vitest, Next build and Playwright could not be re-run here (the supplied `node_modules` hold Windows binaries).
- **No production source file changed.** All fixes were in five test files: `e2e/auth.spec.ts`, `e2e/discovery.spec.ts`, `src/components/ui/pagination.test.tsx`, `src/features/products/components/product-discovery.test.tsx`, `src/features/search/components/search-bar.test.tsx`. Added files: `package-lock.json` (lockfile v3, 600 packages) and generated `next-env.d.ts`. `package.json` is unchanged.
- Meaningful fixes: pagination test used page 2 of 5, whose window has no "Page 4" button (test bug); discovery integration test asserted card titles before data had rendered; SearchBar debounce tests replaced `userEvent.type` with `fireEvent.change` under fake timers; E2E price/rating test now waits for the URL to settle and uses `click` + `toBeChecked` instead of `check()` on a URL-controlled radio; E2E "Clear Filters" locator uses `exact: true` (Playwright matches names case-insensitively); the admin E2E test no longer asserts the "Signed in as Demo Admin" text (now asserts the Sign out button). The remaining differences are formatting (Prettier-style wrapping, leading blank lines).
- Resolved versions (package-lock.json): next 15.5.27, react and react-dom 19.3.1, tailwindcss and @tailwindcss/postcss 4.3.3, zustand 5.0.15, @tanstack/react-query 5.104.2, vitest 2.1.9, @vitejs/plugin-react 4.7.0, jsdom 25.0.1, @testing-library/react 16.3.3, user-event 14.6.8, jest-dom 6.9.1, @playwright/test 1.64.1, eslint 9.39.5, eslint-config-next 15.5.28, typescript 5.9.3, lucide-react 0.469.0, tailwind-merge 3.7.0, class-variance-authority 0.7.1, clsx 2.1.1, @radix-ui/react-slot 1.5.0, @types/react 19.3.0, @types/node 20.19.43.
- **Resolved in Phase 05 (was an open finding):** the price sliders committed to the URL with the callback captured when the slider moved, so a filter changed inside the 300 ms window (for example the rating) could be overwritten. `price-range-filter.tsx` now calls the latest `onCommit` through a ref. Regression tests: a component test with a stale/latest callback, and two integration tests in `product-discovery.race.test.tsx` (rating and sort chosen while a price change is pending). The user's E2E wait-for-URL change was left in place.
- **Open finding:** the admin E2E test no longer verifies that the admin page shows the signed-in identity. The page does render it (`SignedInAs` in `src/app/(protected)/admin/page.tsx`) and the dashboard E2E test still asserts it, so this is a weaker test rather than a known defect; the original cause of the failure was not documented.
- ZIP hygiene: the user's ZIP is 221 MB because it contains `node_modules` (Windows binaries) and `.next`, and it has an extra wrapper folder. Phase ZIPs must exclude `node_modules`, `.next`, `test-results`, `tsconfig.tsbuildinfo` and `next-env.d.ts`, and keep `package-lock.json`.

## Recommendation facts (Phase 07)
- Full documentation, weights and strategy table: `docs/RECOMMENDATIONS.md`. Engine: `src/services/recommendations/*` (provider contract in `types.ts`, weights in `constants.ts`, service in `service.ts`, mock engine in `mock-engine.ts`/`strategies.ts`). Feature: `src/features/recommendations` (public API: `RecommendationRail`, `ProductPageRecommendations`, `RecommendationPreferences`, `RecommendationSync`).
- Signals come from: `store/viewed-store.ts` (device-level views, key `shopsphere.viewed.v1`, latest 20, recorded by the product page), the search history (`lib/search-history.ts` now emits change events), the wishlist, cart and orders stores. Derived signals are computed on demand, not stored.
- The nine PRD strategies are `PRD_STRATEGIES`; "featured" is a tenth, editorial id used by the home page. Seed data: `src/data/recommendations.json`.
- Rails: home (`src/app/home-view.tsx`), product page (slot supplied by `src/app/products/[id]/page.tsx`), cart (`cart-view.tsx`), wishlist (`wishlist-view.tsx`); the dashboard panel is on `/dashboard`.
- **PHASE-08 (assistant) is built** on `recommendationService` (new `"assistant"` strategy plus `"similar"`) and `useCatalog`; see docs/ASSISTANT.md. Admins do not get the assistant (PRD 4.3).
- **PHASE-09 (admin analytics)** can read views from the viewed store and orders from each customer's order storage; there is no click tracking on rails yet.
- Not built (by design): the Recently Viewed header dropdown and rails on category/search pages (PRD names them only as typical placements).

## Checkout and orders facts (Phase 06)
- Routes: `/checkout`, `/checkout/confirmation/[orderId]`, `/orders`, `/orders/[orderId]` (all under the `(protected)` group). Public APIs: `@/features/checkout` (CheckoutView, CheckoutSync), `@/features/orders` (OrdersView, OrderDetailView, OrderConfirmation); `@/features/cart` now also exports `useCartData`.
- State: `store/checkout-store.ts`, `orders-store.ts`, `address-store.ts`; keys `shopsphere.checkout.v1.user-<id>`, `shopsphere.orders.v1.user-<id>`, `shopsphere.addresses.v1.user-<id>` (local storage). The cart store has a new `clear()` action (empties items and coupon, keeps saved-for-later).
- Orders store only the signed-in customer's orders. **PHASE-09 (admin) will need to read orders across customers**: scan local-storage keys with the `shopsphere.orders.v1.user-` prefix (`ORDER_STORAGE_PREFIX` in `lib/order-storage.ts`) and, to advance an order, write its `history` and set `autoProgress` to false.
- Order tracking simulation constants: `AUTO_PROGRESS_OFFSETS_MS` in `utils/orders.ts`. Delivery fees and payment rules: `utils/checkout.ts` (`DELIVERY_METHODS`, `COD_LIMIT`).
- **PHASE-07 should** treat purchase history as the order records above (`orders-store`) for the "Purchase-History-Based" strategy, and reuse `useCatalog` for candidate products. The cart page and wishlist page still have no recommendation rails (PHASE-07 task).
- Demo data: `customer@shopsphere.test` has six sample orders (`SS-DEMO-0001`..`0006`, one per status) and one saved address; other customers start empty.

## Cart and wishlist facts (Phase 05)
- Routes `/cart`, `/wishlist`; public APIs `@/features/cart` (CartView, CartLink, CartSync) and `@/features/wishlist` (WishlistView, WishlistLink, WishlistSync); `@/features/products` now also exports `ProductImage` and `useCatalog`.
- State: `src/store/cart-store.ts`, `wishlist-store.ts` (Zustand). Persistence keys `shopsphere.cart.v1.<guest|user-ID>` (local storage), `shopsphere.wishlist.v1.<guest|user-ID>` (guest: session storage; user: local storage). Pure rules in `src/utils/cart.ts`, `wishlist.ts`, `coupons.ts`.
- Cart line identity is `productId:variantId`. A line stores last-known title, image, accepted unit price and stock for the offline fallback.
- Done in PHASE-06: checkout uses `getCheckoutBlockers`, `useCartData` and a new `clear()` action.
- The cart icon count is the number of units in the cart (all lines), while the summary's item count and subtotal only count purchasable lines.
- The cart and wishlist recommendation rails were added in PHASE-07.

## Items the PRD mentions but no phase assigns (decisions pending from the user)
- **User dashboard (PRD 5.7):** profile editing, saved-address management (edit/delete/default), recently viewed and "my reviews" panels (customers can already edit/delete their own review on the product page, Phase 09). Only the Recommendation Preferences panel is assigned (PHASE-07). Checkout already lists and saves addresses but cannot edit or delete them.
- **Quick View modal and Product Comparison (PRD 5.2):** still unassigned (see below).
- Please decide before PHASE-10 whether to schedule or drop these.

## Decisions recorded from the user (Phase 05 kick-off)
- Apply the price-slider race fix in Phase 05 with a regression test (done).
- Quick View and Product Comparison: build only if a phase assigns them; the PRD assigns them to no phase (they appear only in the PRD 5.2 text), so they were **not** built and remain unassigned. Raise again before Phase 10 so they are consciously scheduled or dropped.
- Mobile product grid: PRD 5.2 says 2 columns and PRD 15 says single-column; the PRD is not clear, so the existing 2-column layout is kept.

## Discovery facts (Phase 03)
- Routes: /products, /category/[slug], /search. State in the URL (see docs/ARCHITECTURE.md). Pagination chosen: 24 per page, URL-synced.
- Data: DummyJSON via `src/services/products`; prices converted USD to INR at 85 (`src/lib/currency.ts`); discovery filters client-side over the cached catalogue.
- Product cards link to `/products/<id>` (PHASE-04 builds it; until then it is the not-found page). Cards have no wishlist toggle yet.
- Public APIs: `@/features/products` (ProductDiscovery, DiscoveryPageFallback, DiscoverySkeleton, useCategories), `@/features/search` (SearchBar, SearchHome).
- PHASE-04 should reuse `fetchCategories`/mappers, add `GET /products/{id}` to `services/products`, and implement the "no longer available" state (edge case 2).

## Product detail facts (Phase 04)
- Route `/products/[id]`; public API `@/features/products` adds `ProductDetailView`; (the PDP now receives its rails from the route as a slot; see the Phase 07 facts).
- Variants are simulated locally (`getVariantGroup`); the purchase panel's `Add to Cart` / `Buy Now` currently show a "cart not available yet" notice. PHASE-05 must replace that with the real cart action, add the cart store keyed by product id + variant id, and respect per-variant stock (`getAvailableStock`, `clampQuantity` in `utils/purchase.ts`; `QuantityStepper` in `components/ui` is reusable for cart lines).
- PHASE-05 also adds the wishlist toggle to the PDP and to product cards (neither has one yet).
- The PDP rails were placeholders in Phase 04; Phase 07 replaced them with the real rails (see the Phase 07 facts).
- Review summary details and the review list are PHASE-09; the PDP shows only rating and review count.

## PRD inconsistency to be aware of
- PRD 5.2 says "2 columns mobile" for the product grid; PRD 15 says "Single-column grid" on mobile. The user decided to keep 2 columns (see above).

## Unassigned PRD 5.2 items (see "Decisions recorded from the user")
- **Quick View modal** and **Product Comparison (select 2-4, side-by-side table)** are listed in PRD 5.2 but belong to no phase in PRD section 19, and PHASE-03's tasks and acceptance criteria do not include them. Not built. Not built in PHASE-04 either, because no answer was given. Proposed: Quick View with PHASE-05, Comparison with PHASE-05 or as its own addition. The **wishlist toggle on every product card** belongs with PHASE-05 (MOD-09).

## Known issues and risks
- Unverified install/build/lint/test (above). No lockfile.
- Sandbox has no network: DummyJSON's real response shapes are unverified (see docs/API-INTEGRATION.md for the exact assumptions). Variant and per-variant stock data do not exist in DummyJSON and need local fixtures in PHASE-04.
- DummyJSON prices are USD while the PRD uses INR; handled by a fixed conversion (Phase 03).
- Deliverables outside the sandbox (GitHub, deployment, demo video) are the user's to execute; scripts and docs will be prepared.

## Reviews and admin facts (Phase 09)
- Reviews of a product = DummyJSON's own reviews + `data/reviews.json` samples + reviews written on this device (`shopsphere.reviews.v1`, device-level). The product page rating line is the review average; cards still use the catalogue rating.
- Admin catalogue changes are an overlay (`shopsphere.admin.catalogue.v1`) and never reach the storefront (PRD 8.2). Deleting a product that an order references archives it (edge case 27). Local products have ids from 1,000,001.
- Recommendation analytics (`shopsphere.analytics.v1`, device-level): impressions per card shown, clicks on a card link, conversion = add-to-cart within 24 h of a click. `data/analytics.json` is a simulated baseline.
- Admin routes: /admin, /products, /products/new, /products/[id], /inventory, /categories, /orders, /orders/[orderId], /reviews, /analytics.
- E2E sandbox setup: Chromium from the `@sparticuz/chromium` npm package; `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` for `next build` (see PHASE-09-REPORT.md).

## Latest deliverable
ShopSphere-AI-Phase-09-Complete.zip (cumulative; continues from Phase-08-Complete.zip)

## Next official phase
PHASE-10 - Testing, QA, Accessibility and Deployment (after user command `NEXT PHASE`). Before it: decide whether to fix the pre-existing test failures listed in PHASE-08-REPORT.md (unchanged in Phase 09), and whether to schedule or drop the unassigned items above (user dashboard, Quick View, Comparison).
