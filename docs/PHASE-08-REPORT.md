# Phase 08 report: AI Shopping Assistant

Built on `ShopSphere-AI-Phase-07-Complete.zip`. Scope from the PRD: section 7 (MOD-AI-001 to 003), the assistant entry point of 5.1, the access matrix of 4.3, 16.1 (assistant failure), 12 (lazy-loaded panel), 14 and 15 (accessibility, responsive).

## Verification (all run in this phase, with real dependencies)

| Check | Result |
|---|---|
| `tsc --noEmit` | Pass, no output |
| `eslint .` | Pass, no output |
| Vitest, whole project | 991 tests: 985 pass, **6 fail, all 6 also fail on the untouched Phase 7 code** (below). Phase 7 had 799 tests; Phase 8 adds 192. **No new failure.** |
| `next build` | Pass, 15 routes. Needed a one-line fix to two hook files first (below). Run here with Google Fonts **mocked** because the sandbox cannot reach Google; the project's own font code is unchanged. |
| Playwright (Chromium 153 from an npm package, because the Playwright download is blocked here; run against the production build) | 100 tests: **93 pass, 7 fail, all 7 also fail on the untouched Phase 7 code**. All 13 new assistant tests pass. |
| Live DummyJSON | **Never called** (no network). E2E mocks it. |

### Pre-existing failures (identical on the Phase 7 ZIP; not touched)

Unit (Phase 5 to 7 tests): `home-view.test.tsx` (history-cleared fallback cannot find "Trending Now"), `order-detail-view.test.tsx` (address text; tracking advancing), `orders-view.test.tsx` and `wishlist-view.test.tsx` (ambiguous text matchers: several elements match), `recommendation-preferences.test.tsx` (price-range text).
E2E: `cart.spec.ts:141` (a substring selector also matches a second element), `checkout.spec.ts:210`, `orders.spec.ts:99` (the sign-in helper cannot find "Sign out" at 375 px), and 4 in `product-detail.spec.ts:183` (a Phase 03 assertion for a "Related products" heading that Phase 07's rails replaced).
Several look like test defects; the home-view and tracking ones may be product issues. They deserve their own look and were deliberately left alone.

### Defect found in Phase 7 and fixed

`next build` **fails on the Phase 7 ZIP**: `features/cart/hooks/use-cart-data.ts` uses React hooks, is exported through the cart barrel and imported by the server page `/cart`, and had no `"use client"` directive. (Phase 7's report listed the build as NOT RUN.) Fix: the directive, nothing else. `use-raw-signals.ts` needed the same because Phase 8 exports it for the assistant.

## What was built

- **Structured intent extraction** (MOD-AI-001): category, price ceiling, floor, range, rating floor, colour, similarity reference. `₹`, `Rs.`, `INR`, thousands separators, `k` and lakh suffixes.
- **Contextual refinement** (MOD-AI-002): cheaper, more expensive, better ratings, colour, "more like the second one", topic change keeping the price band.
- **Graceful fallback** (MOD-AI-003): a clarifying answer with 2 to 3 suggested prompts, never unrelated products.
- **Chat UI** (PRD 7.2): floating entry point, side panel or full-screen modal, distinct user and assistant bubbles, inline product cards with reasons, typing indicator, starter prompts, follow-up prompts, inline error with Retry, rule-based disclosure.
- **A new `assistant` recommendation strategy** so the assistant runs through the existing service, cache and provider (PRD 7.3). A replaceable `AssistantProvider` (PRD 7.6).

Details: `docs/ASSISTANT.md`.

## Files

Created
- `src/types/assistant.ts`
- `src/services/assistant/` : `constants.ts`, `vocabulary.ts`, `parser.ts`, `plan.ts`, `messages.ts`, `mock-assistant.ts`, `service.ts`, `types.ts`, `index.ts`, and tests `parser.test.ts`, `plan.test.ts`, `mock-assistant.test.ts`
- `src/services/recommendations/filter.ts`, `filter.test.ts`, `intent-search.test.ts`
- `src/lib/assistant-storage.ts` (+ test), `src/store/assistant-store.ts` (+ test)
- `src/features/ai-assistant/` : `constants.ts`, `hooks/use-assistant.ts`, `hooks/use-is-mobile.ts`, `components/assistant-widget.tsx`, `assistant-panel.tsx`, `message-bubble.tsx`, `assistant-widget.test.tsx`; `index.ts` now exports `AssistantWidget`
- `src/test/assistant-catalog.ts`, `e2e/assistant.spec.ts`
- `docs/ASSISTANT.md`, `docs/PHASE-08-REPORT.md`

Modified
- `src/app/layout.tsx`: mounts `<AssistantWidget />`.
- `src/services/recommendations/`: `types.ts` (`"assistant"` strategy id, `ProductFilter`, `filter` on requests, `matched` on results), `strategies.ts` (`intentSearch`; the personalized strategy's signal list moved into a shared helper, behaviour unchanged, its tests pass), `mock-engine.ts`, `service.ts` (the filter is part of the cache key), `index.ts`.
- `src/utils/text.ts` (+ tests): `stemWord`, `tokenizeWords`.
- `src/features/recommendations/index.ts`: exports `useRawSignals`. `hooks/use-raw-signals.ts` and `src/features/cart/hooks/use-cart-data.ts`: `"use client"` added (above).
- `e2e/dummyjson-mock.ts`: optional headphones (`audio: true`), off by default so existing tests are unchanged.
- `docs/PROJECT-STATE.md`, `docs/ARCHITECTURE.md`, `docs/RECOMMENDATIONS.md`, `README.md`.

Deleted: `src/features/ai-assistant/.gitkeep` (the folder now has content).

## Decisions made where the PRD is silent (change any of them on request)

- "Good ratings" means 4 stars and up (the PRD's example); "excellent / top rated" 4.5; "better ratings" steps 4, 4.5, 4.8.
- "Cheaper" uses the median of the products shown (PRD allows a percentage or the median), at least 15 percent below the highest shown.
- A new product type after a switch word keeps the price band; without a switch word it starts fresh.
- The entry point is a floating button on every page, hidden for administrators (PRD 4.3 lists the assistant as N/A for them).
- The chat is kept for the browser session only, last 40 messages.
- Answers show 6 cards.
- The typing indicator shows for at least 350 ms (zero in tests).

## Not verified

- The real DummyJSON catalogue. "Headphones" is matched by title and tag keywords because DummyJSON has no such category; I believe the live catalogue has AirPods and earphones under mobile accessories, but this was never checked against the live API.
- A screen reader and a real phone. Accessibility was checked through roles, names, focus behaviour and layout assertions, not with assistive technology.
- Anything in Safari or Firefox (Chromium only).
