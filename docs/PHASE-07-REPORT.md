# Phase 07 report - Recommendation Engine

## Phase information
PRD section 19.3, PHASE-07. Continues from `ShopSphere-AI-Phase-06-Complete.zip`; the working tree was confirmed identical to it before changes began. Phases 5 and 6 have not yet been run on your machine (no results reported), so they remain unexecuted there.
Delivers the AI Recommendation System of PRD section 6. Full technical description: **docs/RECOMMENDATIONS.md**.

## PRD compliance

| PRD item | Status |
|---|---|
| Recommendation service architecture: hook -> service -> provider -> mock engine, in real folders (PRD 6.4) | Done. A unit test replaces the provider with a stand-in, proving the boundary |
| Nine strategies, each producing distinct, signal-appropriate output (PRD 6.3) | Done (source); logic verified by stand-in runner, including a test that all nine give pairwise-different results for the same shopper |
| Scoring model with documented weights: category, price, tags, rating, recently viewed, wishlist, cart (PRD 6.2) | Done: the seven PRD components plus brand affinity and popularity (two documented additions); weights add up to 1.00 (tested); documented in docs/RECOMMENDATIONS.md and shown on the dashboard |
| Signals: views, search history, wishlist, cart, purchases, price band, brand (PRD 6.1) | Done; viewing history is per device |
| Explainable results: signal-transparent headings, a reason on every card | Done |
| Wire rails into home, product page, cart and wishlist | Done (source) |
| Recommendation Preferences panel in the dashboard: signals shown, reset available | Done (`/dashboard`) |
| Landing page content for visitors (PRD 5.1) | Done as far as the rails need it: hero, category strip, rails |
| MOD-01-002 returning visitor: Recently Viewed, personalized rails reflect history | Logic verified; component and e2e tests written, NOT RUN |
| MOD-01-001 first-time visitor: Featured and Trending, personalized rails hidden or "Popular Right Now" | Same |
| Edge cases 16 (few or no candidates), 23 (out of stock), 24 (no history), 25 (little history) | Handled in the engine and rails; logic verified; UI tests written, NOT RUN |

Not built, with reasons:
- **Recently Viewed header dropdown** and **rails on category and search pages:** the PRD lists them only as "typical placements"; PHASE-07's task names homepage, product page, cart and wishlist.
- **`user-preferences.json` fixture:** derived signals are computed on demand rather than stored, so a reset is a real reset. Documented.
- **AI shopping assistant:** PHASE-08. **Profile, address management and other dashboard sections:** still unassigned (see docs/PROJECT-STATE.md).
- No click or view analytics for rails (PHASE-09 can add them).

## Changes to earlier code
- The Phase 04 placeholder rail was replaced. The product page now takes its rails as a `recommendations` slot from the route, so the products and recommendations features do not import each other.
- `ProductCard` has an optional `reason`; `lib/search-history.ts` now announces changes (so recommendations react to searches); the cart and wishlist views end with a rail; the dashboard page shows the preferences panel; `providers.tsx` adds `RecommendationSync`.
- Tests that mentioned the placeholders were updated: the product-detail view test, the product-detail e2e test and the home e2e test (home now uses the mocked API, because it loads the catalogue).

## Quality checks (actual results)

| Check | Result |
|---|---|
| `tsc --noEmit` on the whole project | **Exit 0**, run here against your installed `node_modules` |
| `eslint .` (includes the layer-boundary rules) | **Exit 0**, no output, same setup |
| Stand-in runner (not Vitest) on 39 logic test files | **453 passed, 0 failed**: 333 earlier plus 120 new (relations, popularity, signals, scoring, all strategies, service caching and provider swap, viewing history, search-history signal). It used a minimal assertion shim, stubbed `zustand`, web storage and window events, and the real source files. |
| Vitest | **NOT RUN here**. 794 test definitions in 87 files exist. |
| Playwright | **NOT RUN here**. 84 test definitions in 9 files (87 tests, since one definition generates 4 viewport tests). |
| `next build` | **NOT RUN here** |

Writing the engine tests first exposed two real behaviour problems in my own engine, both fixed:
- **Price-based rail:** it allowed products slightly outside the shopper's band while its heading and reason said "within your typical price range". It now requires the price to be strictly inside the band.
- **Cart-based rail:** for a phone in the cart it ranked another phone above phone accessories, because a same-category product looks "related". An add-on rail now treats same-category products as substitutes and offers complementary ones.
Two test mistakes were also corrected (a floating-point equality and an e2e viewed-count). Those were not product defects.

## Known limitations and unverified areas
- Component, integration and e2e tests for Phases 5, 6 and 7 have never been executed. Most likely first-run failures in this phase:
  - Timing in e2e: a view is recorded after the product page loads, and the tests wait 150 ms before navigating away. A slow machine may need a longer wait.
  - The rail tests that add activity with `act()` and expect a rail to appear.
  - The preferences-panel table inside a closed `<details>`, queried with `hidden: true`.
  - Every home or product page now loads the catalogue; with the live API that is the same cached request the rest of the app already uses.
- The recommendation weights, thresholds and the simulated popularity are reasoned defaults, not tuned on data. There is no machine learning.
- Rails do not log clicks, so nothing measures whether recommendations help.
- Viewing history is per device and not part of an account; a signed-out visitor's and a signed-in customer's views mix on one device.
- The live DummyJSON API has still never been called; the e2e tests mock it, and the e2e mock catalogue is small, so some rails (for example Frequently Bought Together) only appear when the test turns on its extra accessories.
- The admin e2e test still does not assert the signed-in identity text.

## Next official phase
PHASE-08 - AI Shopping Assistant. It starts only after your next `NEXT PHASE` command. Please run the project locally first and send me any failures: Phases 5 to 7 have added a great deal of test code that has never run on your machine.
