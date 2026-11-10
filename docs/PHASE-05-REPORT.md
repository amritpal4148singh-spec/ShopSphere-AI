# Phase 05 report - Cart and Wishlist

## Phase information
PRD section 19.2, PHASE-05. Continues from the **user-verified Phase 04 ZIP** (not from the originally delivered one); the working tree was made identical to it (generated output excluded) before any change.
Delivers the cart (PRD 5.5) and wishlist (PRD 5.9), plus one correction to Phase 03 code requested by the user.

## Correction to earlier code (requested)
Price-slider race condition: the delayed price commit used a callback captured when the slider moved, so another filter changed within 300 ms could be overwritten. Fixed in `price-range-filter.tsx` (latest callback kept in a ref). Regression tests: one component test (stale vs latest callback) and two integration tests in `product-discovery.race.test.tsx` (rating, and sort, chosen while a price change is pending). The fixes the user made to five test files were kept.

## PRD compliance

| PRD item | Status |
|---|---|
| Cart state in Zustand with stock validation | Done (source) |
| Quantity bounded by stock; exceeding it is corrected with an inline explanation (MOD-05-001) | Done; logic verified by stand-in runner, UI and e2e tests written, NOT RUN |
| Subtotal, simulated shipping and tax, total | Done, labelled simulated (shipping ₹99 under ₹999, 18% GST) |
| Coupon codes with clear invalid, expired and below-minimum states (edge case 11) | Done: `SAVE10`, `WELCOME200`, `FREESHIP`, `SUMMER25` (expired) |
| Save for Later | Done |
| Out-of-stock item flagged in place, checkout blocked (edge case 1) | Done |
| Product no longer returned by the API flagged as unavailable with Remove (edge case 1) | Done |
| Price change shows old and new price and needs confirmation (edge case 10) | Done |
| API failure: last-known data with a retry banner | Done (cart and wishlist) |
| Duplicate add increments one line (edge case 8) | Done |
| Two tabs: no lost or duplicated lines (edge case 26) | Done: read-before-write plus storage-event sync |
| Wishlist add/remove from cards and the product page; current price and stock status; Move to Cart (MOD-09-001) | Done |
| Empty wishlist with a Browse Products action (edge case 12) | Done |
| Guest vs account (PRD 4.3): guest wishlist session-only, account data persisted, merge on sign-in | Done |
| Header cart and wishlist icons with counts | Done |
| Add to Cart and Buy Now on the product page (previously a notice) | Done; Buy Now goes to checkout |
| AC: MOD-05-001 | Logic run; component and e2e tests written, NOT RUN |
| AC: MOD-09-001 | Logic run; component and e2e tests written, NOT RUN |

Not built, with reasons:
- **Quick View and Product Comparison:** per your instruction I checked the PRD. They appear only in the section 5.2 text; no phase from 05 to 10 assigns them. Not built; still unassigned.
- **Cart and wishlist recommendation rails:** PHASE-07.
- **Checkout, payment and orders:** PHASE-06. `/checkout` remains a guarded placeholder.
- **Mobile product grid:** the PRD says 2 columns in 5.2 and single-column in 15, so it is not clear; per your instruction the 2-column layout is unchanged.

## Files
New: `src/types/cart.ts`, `src/utils/{cart,coupons,wishlist}.ts`, `src/lib/{cart-storage,wishlist-storage}.ts`, `src/store/{cart-store,wishlist-store}.ts`, `src/hooks/use-wishlist-toggle.ts`, `src/components/ui/favorite-button.tsx`, `src/features/cart/**`, `src/features/wishlist/**`, `src/features/products/hooks/use-catalog.ts`, `src/app/{cart,wishlist}/page.tsx`, `e2e/{cart,wishlist}.spec.ts`, and test files.
Modified: `src/lib/safe-storage.ts` (optional session storage), `src/services/products/{variants,index}.ts` (`getVariantStock`), `src/components/ui/quantity-stepper.tsx` (`onClamp`), `src/features/products/components/{product-card,product-detail-view,purchase-panel,price-range-filter}.tsx` and `index.ts`, `src/components/layout/site-header.tsx`, `src/app/providers.tsx`, `e2e/dummyjson-mock.ts` (live overrides), `e2e/product-detail.spec.ts` (one test), several tests, README and docs.
No new dependencies. `package.json` and `package-lock.json` unchanged.

## Quality checks (actual results)

| Check | Result |
|---|---|
| `tsc --noEmit` on the whole project | **Exit 0**, run here against your installed `node_modules` |
| `eslint .` (includes the layer-boundary rules) | **Exit 0**, no output, same setup |
| Stand-in runner (not Vitest) on 23 logic test files | **252 passed, 0 failed**: 155 earlier plus 97 new (coupons, cart rules, wishlist rules, storage, both stores). It used a minimal assertion shim, stubbed `zustand` and web storage, and the real source files. |
| Vitest | **NOT RUN here** (your node_modules hold Windows binaries). 458 test definitions in 56 files exist. |
| Playwright | **NOT RUN here**. 55 test definitions in 6 files (58 tests, because one definition generates 4 viewport tests). |
| `next build` | **NOT RUN here** |

Self-review of my own tests before delivery caught two real defects in the new UI, both fixed: the stepper reported a clamp before the quantity change, so the cart row erased its own "only N in stock" message; and the summary counted out-of-stock lines in "Subtotal (N items)".

## Known limitations and unverified areas
- Component, integration and e2e tests for this phase have never been executed. Most likely first-run failures: the e2e cross-tab and sign-in-merge tests (timing), the fake-timer race tests (they start fake timers after data loads), and the `next/navigation` mock in the purchase-panel and product-detail tests.
- The live DummyJSON API has still never been called by this code; the e2e tests mock it.
- The account cart is "persisted to the account" by local storage keyed by user id, not by a server; clearing browser data loses it.
- The cart checks stock and price against the cached catalogue (up to 5 minutes old) rather than per product at the moment of adding; the product page's own stock is used when adding.
- The wishlist's Move to Cart for a product with variants picks the first in-stock variant and quantity 1; the shopper changes size from the product page if needed.
- A few items remain open from earlier: the admin e2e test still does not assert the signed-in identity text on the admin page (weaker than the original), and `/checkout`, `/orders` are placeholders.
- Regression check against Phases 01-04: no earlier file was removed. Earlier tests that this phase's changes affect were updated: purchase-panel and product-detail-view tests (the cart is real now, plus a navigation mock), the product card and header tests (new heart and icons), and one Phase 04 e2e test (Add to Cart no longer shows a "not available yet" notice).

## Next official phase
PHASE-06 - Checkout and Orders. It starts only after your next `NEXT PHASE` command. Please run the project locally first and send me any failures; this phase adds a lot of unexecuted test code on top of your verified baseline.
