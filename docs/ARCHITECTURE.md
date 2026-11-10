# Architecture (PRD sections 9 and 25)

Updated in: Phase 07.

## Stack

Mandated by the PRD (Appendix A.2): React + Next.js (App Router), Tailwind CSS, shadcn/ui, Zustand (global client state),
TanStack Query (server/cache state), REST (DummyJSON + local mock fixtures), Vitest, React Testing Library, Playwright,
Git/GitHub, a free-tier host. Language: **TypeScript** (PRD 9.4 allows exactly one of JS/TS; selected and approved).

Implementation choices not fixed by the PRD: Next.js 15.x, React 19, Tailwind CSS 4, Manrope via `next/font/google`.
Versions are declared as caret ranges in `package.json`; the first `npm install` resolves them and writes the lockfile.

## Folder structure (PRD 9.2)

```
src/
  app/            Next.js App Router routes, layout, providers
  components/     Shared UI primitives (ui/ = shadcn/ui) and layout shell
  features/       auth, products, search, cart, wishlist, checkout, orders,
                  recommendations, ai-assistant, admin  (self-contained domains)
  hooks/          Cross-feature reusable hooks
  services/       API clients, recommendation service, assistant service
  lib/            Framework-agnostic helpers and constants
  store/          Zustand stores
  types/          Shared TypeScript types
  utils/          Pure utility functions
  test/           Test setup
e2e/              Playwright specs
docs/             Project documentation
```

## Layer rules (PRD 9.3) and how they are enforced

| Layer | Must not | Enforcement (`eslint.config.mjs`) |
|---|---|---|
| `components/` | Fetch data or contain business logic | Importing `@/services` is a lint error |
| `services/`, `lib/`, `utils/` | Import React or Next.js | Importing `react`, `react-dom`, `next` is a lint error |
| `features/*` | Reach into another feature's internals | `@/features/<a>/<b>` imports are a lint error; use `@/features/<a>` (its public `index.ts`). Use relative imports inside a feature. |
| `store/` | Own server/cache data | Convention + review (Phase 02: `auth-store` and `ui-store` hold client state only) |
| `hooks/` | Duplicate service logic | Convention + review |

These rules are written but **not yet run** (see PROJECT-STATE.md).

## State management (PRD 9.1)

- Global client state: Zustand, in `src/store` (Phase 1: `ui-store` for mobile navigation).
- Server/cache state: TanStack Query. Defaults live in `src/lib/query-client.ts`; the provider is `src/app/providers.tsx`.
- Zustand needs no provider (stores are module-level hooks). The two are never mixed.

## Authentication (PRD section 11) - added in Phase 02

```
app/login, app/register          pages (read ?next= and sanitize it with utils/redirect)
app/(protected)/layout.tsx       <AuthGuard>        -> dashboard, orders, checkout (placeholders until their phases)
app/(protected)/admin/layout.tsx <AuthGuard requiredRole="admin">
features/auth                    LoginForm, RegisterForm, AuthGuard, AccountNavItems, AuthHydrator, useAuth
store/auth-store.ts              Zustand: status (idle | authenticated | unauthenticated | expired), session, actions, expiry timer
services/auth/*                  loginUser, registerUser, session persistence, password hashing, seed users (no React)
lib/mock-token.ts                JWT-shaped, unsigned mock token encode/decode
lib/safe-storage.ts              localStorage that never throws
utils/validation.ts, redirect.ts pure validators and open-redirect protection
```

Key behaviours and decisions:
- **Local mock store.** PRD 11.1 allows DummyJSON "and/or" a local store. Login validates against seed accounts plus registered users in `localStorage`; DummyJSON is not called from auth. Passwords are stored as salted SHA-256 digests, never plain text (a development-stage measure, not production hashing).
- **Session.** An unsigned JWT-shaped token (claims: sub, name, email, role, iat, exp) is the only thing persisted. The session is rebuilt from the token on load. TTL is 30 minutes; the store schedules automatic expiry, and a stored expired token produces the `expired` status and a notice on the login page. `buildAuthHeaders` produces the `Authorization: Bearer` header for the API client added later.
- **No hydration mismatch.** Status starts `idle` on server and first client render; `AuthHydrator` restores the session in an effect, and syncs sign-in/out between tabs through the `storage` event.
- **Guards.** `AuthGuard` shows a skeleton while `idle`, redirects to `/login?next=<path>` when unauthenticated or expired, and shows an access-denied page (not a redirect) when the role is wrong. Because the session lives in browser storage this is a usability gate, not a security boundary (PRD 13 asks for UI guarding plus graceful handling).
- **Field-specific login errors.** Unknown email marks the email field, wrong password marks the password field (PRD 20 case 19: no ambiguity about which field failed). A real backend would not disclose which one failed.
- **Registration** always creates a Customer; the Administrator exists only as a seed account.
- **Open redirect protection.** `?next=` accepts only in-app paths and never `/login` or `/register`.
- **Layering note.** `components/layout/site-header.tsx` composes `AccountNavItems` through the auth feature's public entry (`@/features/auth`). The layout shell sits above features, so this does not break the layer rules.
- **After sign-out** from a protected page, the guard sends the visitor to the login page; from a public page they stay where they are.

## Product discovery and search (PRD 5.2, 5.3) - added in Phase 03

```
app/products, app/category/[slug], app/search      thin pages, each wrapping the client view in <Suspense>
features/products   ProductDiscovery (container), ProductCard/Grid, FilterPanel, PriceRangeFilter, ActiveFilters,
                    SortSelect, discovery states, hooks: useProductSource, useCategories
features/search     SearchBar (ARIA combobox), SearchHome, hooks: useSuggestions, useRecentSearches
services/products   client (fetch, timeout, error kinds), mappers (defensive parsing), product-service (endpoints)
utils/discovery*    pure filtering, sorting, pagination, active-filter chips, URL <-> state parsing
hooks/use-debounced-value, lib/currency, lib/search-history, lib/popular-searches
```

Decisions:
- **Pagination, not infinite scroll** (PRD 5.2 leaves this to the implementer and requires it be documented here). Pages of 24 products, page number in the URL (`?page=`), "Previous / numbered / Next" controls. Chosen because it bounds the DOM (PRD 12), keeps URLs shareable, and is simple to test. Page changes use `router.push` (back button works); filter and sort changes use `router.replace`.
- **Client-side filtering over a cached catalogue.** DummyJSON cannot filter by price, rating, stock, brand or discount. Discovery therefore loads the catalogue once (`/products?limit=0&select=...`, about 200 items), caches it with TanStack Query (5-minute stale time) and filters, sorts and paginates in the browser. Search uses the API (`/products/search`) as the PRD specifies, then filters that result set the same way.
- **State lives in the URL.** `utils/discovery-params.ts` converts the query string to a `DiscoveryState` and back, never throws, swaps a reversed price range (PRD edge case 7) and caps the query at 100 characters (edge case 22).
- **Currency.** DummyJSON prices are USD; the PRD works in INR. A fixed `INR_PER_USD = 85` converts at the mapping boundary, so the rest of the app only sees rupees. Price filtering and sorting use the discounted price.
- **"On sale"** means a discount of 10 percent or more (PRD leaves the threshold open); the card badge and the filter use the same constant.
- **"Newest" sort** uses DummyJSON's `meta.createdAt`; products without it sort last. **"Relevance"** keeps the source order (the API's own order for search).
- **Failure handling (PRD 16, 20).** `ApiError` distinguishes network, timeout, HTTP and parse failures. A failed first load shows a full error with Retry, and a distinct "offline" variant for network failures. A failed refresh keeps the previously loaded products and shows a retry banner (edge case 3). Malformed responses are parsed defensively and, if unusable, shown as a readable error (edge case 21). Broken or missing images show a placeholder (edge case 20).
- **Search.** The combobox requests suggestions only after typing pauses for 350 ms (PRD MOD-03-001) and only for 2 or more characters. Empty submit fires nothing and shows recent and popular searches (edge case 5). Recent searches are kept in local storage (max 8, de-duplicated, with Clear). No-results states suggest close spellings from category names and popular searches (edge case 6).
- **Performance.** Cards are memoized; images use `next/image` with `sizes`; only 24 cards render at a time; the sliders commit to the URL 300 ms after they settle.
- **Not in this phase.** Wishlist toggle on cards (needs the Phase 05 wishlist), Quick View and Product Comparison (PRD 5.2 lists them but assigns them to no phase; see PROJECT-STATE.md).

## Product detail page (PRD 5.4) - added in Phase 04

```
app/products/[id]/page.tsx      thin page -> <ProductDetailView productId>
features/products               ProductDetailView (container), ProductGallery, VariantSelector, PurchasePanel,
                                DeliveryEstimator, ProductSpecs, product-detail states; hook: useProduct
features/recommendations        RecommendationRail (placeholder), strategy constants (public API)
components/ui                   Tabs, QuantityStepper (generic, reused by the cart in PHASE-05)
services/products               fetchProduct, mapProductDetail, variants (simulated)
utils/purchase, utils/delivery  pure stock/quantity rules and the delivery estimate
```

Decisions:
- **Simulated variants (PRD 10.3).** DummyJSON has no variants. `getVariantGroup` maps a category to one variant dimension (shoe sizes, apparel sizes, colours, storage, volumes) and splits the product's real stock across the options with a deterministic hash, so the options always add up to the product's stock. Every third product has one sold-out option (so PRD MOD-04-001 is demonstrable). One dimension per product keeps stock accounting exact; the PRD only asks for "size/color where the dataset supports it".
- **Sold-out options stay selectable.** They are shown struck through and announced as "(out of stock)", so the shopper can see why Add to Cart is disabled (MOD-04-001: "in-stock variants remain selectable").
- **Add to Cart and Buy Now** are enabled or disabled from the real stock rules now. The cart does not exist until PHASE-05, so activating them shows a clear notice and changes nothing. PHASE-05 replaces the notice with the cart action.
- **Quantity** is bounded to the selected variant's stock (or the product's stock). Typed values are clamped on blur or Enter; switching to a variant with less stock re-clamps.
- **Zoom on hover** (PRD allows zoom-on-hover or a lightbox). It is CSS only and applies only on devices that support hover, so touch screens are unaffected. A lightbox was not built.
- **Delivery estimate** is simulated: handling time parsed from the data source's shipping text ("Ships in 1-2 business days") plus transit days from the first PIN digit, shown as a two-day window and labelled as simulated. Validated as 6 digits not starting with 0.
- **Specifications** omit weight and dimensions because DummyJSON gives no units for them.
- **Reviews.** The page shows the average rating and the review count the API reports. The review list, submission and sorting belong to PHASE-09 and are not built.
- **Rails.** Related, Similar and Frequently Bought Together are in the page as labelled placeholders (PHASE-04's task). The fourth PDP rail, "Recommended", is personalized and arrives with PHASE-07. Once real, a rail with no candidates must hide itself (edge case 16).
- **Removed product.** A 404 is not retried and shows a "no longer available" page (edge case 2); an invalid id (not a positive integer) shows the same page without calling the API. Other failures show the offline/timeout/parse error with Retry, and a failed refresh keeps the product on screen with a retry banner (edge case 3).
- **Grid columns.** PRD 5.2 says 2 columns on mobile while PRD 15 says single-column on mobile. The product grid keeps 2 columns (5.2); this is recorded in PROJECT-STATE.md.

## Cart and wishlist (PRD 5.5, 5.9, 4.3) - added in Phase 05

```
app/cart, app/wishlist          thin pages -> CartView / WishlistView
features/cart                   CartView, CartLine, CartSummary, CouponForm, SavedItems, CartSync, CartLink; hook useCartData
features/wishlist               WishlistView, WishlistSync, WishlistLink; hook useWishlistData
store/cart-store, wishlist-store  Zustand state + owner-scoped persistence
utils/cart, utils/wishlist, utils/coupons   pure rules: reducers, totals, line status, coupons
lib/cart-storage, lib/wishlist-storage      validated load/save per owner
components/ui/favorite-button   presentational heart; hooks/use-wishlist-toggle wires it to the store
```

Decisions:
- **Owners (PRD 4.3).** One cart per shopper: the guest (this device) or a signed-in customer ("persisted to the account", simulated with local storage keyed by user id). A guest wishlist uses session storage only; a customer's uses local storage. `CartSync` and `WishlistSync` follow the auth state. On sign-in the guest cart and wishlist are merged into the account (quantities add up but never exceed known stock) and the guest copy is cleared; on sign-out the guest view returns and the account data stays stored. An expired session keeps showing the account cart until the next sign-in.
- **Two tabs (edge case 26).** Every cart mutation first re-reads the persisted cart, applies the change, and writes it back, so one tab never overwrites another's changes with stale data. A `storage` event reloads the cart in the other tab, so the header count updates without a refresh. Stored data is validated on load: corrupt or duplicated lines are dropped.
- **Live data from one cached request.** Prices and stock are checked against the cached catalogue (`useCatalog`, the same request discovery uses) instead of one request per cart line. A product missing from the catalogue is "no longer available" (edge case 1). Variant stock uses the same simulated variant rules as the product page.
- **Line statuses.** `ok`, `out-of-stock` and `unavailable` are shown in place. Only `ok` lines count towards the subtotal and the summary's item count. Checkout is blocked while any line is not ok or has an unconfirmed price change, and the summary lists exactly what to fix.
- **Price changes (edge case 10).** A line keeps the unit price the shopper last accepted. If the live price differs, the row shows old and new price and the totals use the new price, but checkout stays blocked until the shopper presses "Accept new price". Stock reconciliation never changes the accepted price.
- **Stock limits (MOD-05-001).** Quantities are clamped to stock. A typed quantity above stock is corrected, and the row explains it ("You asked for 9, but only 3 are in stock"). If live stock falls below a line's quantity, the quantity is reduced with a dismissible notice, never silently.
- **Fallback when the API is down.** Each line stores its last-known title, image, price and stock, so the cart and wishlist still render with a Retry banner.
- **Coupons.** A fixed set of mock codes (see README). Invalid, expired and below-minimum codes show an inline reason (edge case 11). A stored code that stops qualifying is shown with its reason and gives no discount.
- **Simulated totals.** Shipping and tax constants live in `utils/cart.ts` (`SHIPPING_FEE`, `FREE_SHIPPING_THRESHOLD`, `TAX_RATE`).
- **Buy Now** adds the item and navigates to `/checkout`; the existing route guard sends a guest to sign in first.
- **Avoiding feature cycles.** Cart and wishlist features read the catalogue through the products feature's public API; the products feature (cards, product page) reaches the cart and wishlist only through `store/` and a shared hook, never through the other features.
- **Not in this phase.** Quick View and Product Comparison (PRD 5.2) are assigned to no phase and were not built; the cart and wishlist recommendation rails belong to PHASE-07. The mobile product grid stays at 2 columns (PRD 5.2 says 2; PRD 15 says single-column; the conflict is recorded in PROJECT-STATE.md).

## Checkout and orders (PRD 5.6, 5.8) - added in Phase 06

```
app/(protected)/checkout, checkout/confirmation/[orderId], orders, orders/[orderId]   thin pages
features/checkout   CheckoutView, StepIndicator, Customer/Address/Delivery/Summary/Payment steps, OrderSummaryPanel, CheckoutSync
features/orders     OrdersView, OrderDetailView, OrderTimeline, OrderConfirmation, order sections
store/              checkout-store (draft), orders-store, address-store (Zustand, owner-scoped persistence)
utils/checkout, utils/orders, utils/seed-orders   pure rules: validation, delivery fees, totals, order building, tracking
services/checkout/payment   the payment simulation (no network, no card data)
lib/owner-storage, checkout-storage, order-storage   validated per-user JSON persistence
data/seed-orders.json, data/seed-data   sample orders (one per status) and one saved address for the demo customer
components/ui/radio-card    shared option card used by delivery, payment and saved addresses
```

Decisions:
- **Everything is saved as you go (MOD-06-001, MOD-06-002).** `checkout-store` writes the draft (step, furthest step, customer, address, delivery, payment choice) to storage on every change, keyed by user id. A refresh reloads it. When a session expires, the route guard sends the customer to sign in with `next=/checkout`, the draft is untouched, and after sign-in the same step and data are restored. A restored draft can never show a step whose earlier steps are incomplete. The login page says progress is saved when the sign-in is for `/checkout`.
- **Checkout reads the live cart.** It uses the same `useCartData` as the cart page. If the cart has out-of-stock, removed or re-priced items, checkout does not start and lists what to fix. If live data cannot be loaded, a notice says so and checkout proceeds with the prices shown.
- **Totals.** `computeCheckoutTotals` reuses the cart's discount and tax and replaces shipping with the chosen method's cost. Standard delivery keeps the cart's shipping rule exactly (tested against `computeTotals`), so the cart and checkout never disagree. Tax is charged on the discounted subtotal, not on shipping.
- **Payment simulation (PRD 5.6).** The payment step collects a method and a simulated result only. There is no field that could hold card, CVV, bank or UPI PIN data, which a unit test and an end-to-end test check. `simulatePayment` makes no network request (also tested). A declined payment keeps the cart, the draft and all earlier steps, and offers "Try payment again" (edge case 14).
- **Placing an order.** Validates the payment choice, re-checks the cart, runs the simulation, builds the order from the lines actually in the cart, saves it, empties the cart (items saved for later are kept), clears the draft and goes to the confirmation page. Pressing the button twice places one order. The confirmation page reads the saved order, so a refresh shows it again.
- **Orders and tracking (PRD 5.8).** An order stores its stage history. New orders have `autoProgress`: their stage is derived from elapsed time (Confirmed after 30 s, Packed 2 min, Shipped 5 min, Out for Delivery 8 min, Delivered 12 min), so the timeline can be watched in a demo. Sample orders have `autoProgress` off and stay at their status. The timeline always lists all six stages: completed with timestamps, one current, the rest "Upcoming", with text as well as icons.
- **Sample data (PRD 10.3).** `data/seed-orders.json` describes six orders, one per tracking status. They are created once for the demo customer (`user-seed-customer`) with times relative to first use. Other customers start with no orders (edge case 13).
- **Saved addresses.** Checkout lists a customer's saved addresses and can save a new one. Editing and deleting addresses belongs to the user dashboard (PRD 5.7), which is not built yet.
- **Order IDs** use `SS-YYYYMMDD-XXXXX` with a five-character code that avoids look-alike characters.
- **Owner model.** Checkout, orders and addresses exist only for a signed-in customer; there is no guest checkout. `CheckoutSync` follows the auth state like the cart and wishlist syncs do, and keeps the draft when a session merely expires.

## Recommendation engine (PRD 6) - added in Phase 07

Full description, score weights and strategy table: **docs/RECOMMENDATIONS.md**.

```
services/recommendations   types (provider contract), constants (weights), signals, relations, popularity, scoring, strategies,
                           mock-engine (the provider), service (assembles signals, caches), mock-data
features/recommendations   RecommendationRail, ProductPageRecommendations, RecommendationPreferences, RecommendationSync; hooks useRecommendations, useRawSignals
store/viewed-store, lib/viewed-storage   device-level viewing history (a signal)
lib/search-history   now announces changes, so recommendations react to searches
data/recommendations.json   simulated co-purchase pairs, category popularity, Featured rule
app/home-view.tsx   the landing page that composes the rails
```

Decisions:
- **Real layering (PRD 6.4):** hook -> service -> provider interface -> mock engine, each in its own module. The provider is injected into the service, and a test replaces it, so the boundary is not only on paper.
- **No feature cycle.** The product page used to import the Phase 4 placeholder rail; it now takes `recommendations` as a slot from its route (`app/products/[id]/page.tsx`). The cart and wishlist features import the recommendations feature; the recommendations feature reads stores, never other features' internals.
- **Signals are plain data.** The hook collects views, searches, wishlist, cart and orders into `RawSignals`; the framework-agnostic service derives affinities, price band and confidence. Nothing in `services/` imports React.
- **Out-of-stock handling in the engine,** not the UI, so every consumer gets it (PRD edge case 23). Rails hide when empty or when the catalogue fails (edge case 16).
- **Add-on rail logic:** the cart rail treats same-category products as substitutes, not add-ons, so a phone in the cart is offered accessories rather than another phone. The price-based rail only offers products strictly inside the shopper's band, because its heading says so.
- **Viewing history is per device** (PRD 5.1: "same device"), so it is stored under a single key, not per account. Wishlist, cart and orders keep their per-account storage.
- **Caching:** results are cached in the service by a fingerprint of the activity plus the catalogue's stock and prices; failures are not cached. TanStack Query caches the catalogue request itself.
- **Not in this phase:** the Recently Viewed header dropdown and rails on category and search pages (PRD lists them only as typical placements; PHASE-07's task is homepage, product page, cart and wishlist), the AI shopping assistant (built in PHASE-08), and the rest of the dashboard.

## AI shopping assistant (PRD 7) - added in Phase 08

- `services/assistant` (no React): parser, vocabulary, conversation planner, the rule-based mock provider behind the `AssistantProvider` contract, and the service. `features/ai-assistant`: the hook, the lazy-loaded panel and the launcher. `store/assistant-store.ts` (Zustand) holds the conversation, kept in session storage.
- The assistant runs through the recommendation service via a new `"assistant"` strategy (a structured `ProductFilter`), so it shares scoring, caching and the provider boundary instead of duplicating them. The filter is part of the service's cache key.
- Mounted once in `app/layout.tsx`; hidden for administrators. Full detail: `docs/ASSISTANT.md`.

## shadcn/ui

`components.json` is committed (style: new-york, Tailwind v4 CSS variables, aliases to `@/components`, `@/lib/utils`).
The Phase 1 `Button` was written by hand to match the shadcn/ui new-york source because the shadcn CLI needs network access.
Further components are added when a feature needs them.

## Design tokens (PRD leaves visual style open)

Direction: polished, premium, minimal, accessible. Cool near-white surface, deep ink text, one deep-teal accent, neutral greys.
Tokens are CSS variables in `src/app/globals.css`. Global visible focus ring, skip link, reduced-motion support.
Dark mode is not implemented yet.

## Decisions log

| Decision | Status |
|---|---|
| TypeScript for the whole project | Approved (Phase 1) |
| Product list navigation | Pagination (24 per page, URL-synced). Decided and built in Phase 03; see the discovery section above. |
| Next.js, Tailwind and library versions | Caret ranges; resolved at first install |
| Deployment host | Decided in PHASE-10 (free tier; re-check terms first) |
| Assistant execution | Through the recommendation service (`assistant` strategy), not a parallel filter (PRD 7.3). Phase 08. |
| Assistant provider | Rule-based mock behind `AssistantProvider`; replaceable by a language-model provider (PRD 7.6). Phase 08. |

## Reviews and admin dashboard (PRD 5.10, 8) - added in Phase 09

| Piece | Where |
|---|---|
| Review rules (validation, merging three sources, sorting, votes, moderation) | `utils/reviews.ts` (pure, immutable reducers like `utils/cart.ts`) |
| Review persistence | `lib/review-storage.ts` (one device-level key, defensive parse) and `store/reviews-store.ts` (re-reads storage before every write) |
| Review UI | `features/reviews/` (public API: `ProductReviews`, `ReviewsSync`, `StarDisplay`, `useReviewSummary`) |
| Admin catalogue overlay | `utils/admin-catalogue.ts`, `lib/admin-storage.ts`, `store/admin-catalogue-store.ts`; applied on top of the cached catalogue query in `features/admin/hooks/use-admin-products.ts` |
| Admin orders | `store/admin-orders-store.ts` reads every customer's stored orders and writes an advanced order back to that customer's own storage; rules in `utils/admin-orders.ts` |
| Recommendation analytics | `utils/analytics.ts`, `lib/analytics-storage.ts`, `store/analytics-store.ts`; recorded by `RecommendationRail`, `cart-store` and `useRecordView`, read by the admin overview and analytics screens |
| Admin UI | `features/admin/` (public API: `AdminShell` and one view per route); routes under `app/(protected)/admin/`, each its own code-split chunk |

Decisions: admin changes are an overlay that never reaches the storefront (PRD 8.2); every admin write shows `LocalBadge` (PRD 4.2); reviews, analytics and the admin overlay are device-level (like the viewing history), orders stay per customer.

## Account, comparison, Quick View, footer (PRD 5.1, 5.2, 5.7)

| Piece | Where |
|---|---|
| Address book rules (add, edit, delete, default, limit 10, duplicates) | `utils/addresses.ts` (pure); persisted by `store/address-store.ts`, which re-reads storage before each write. `SavedAddress.isDefault` is new and optional, so older saved data still loads. Checkout pre-selects the default once. |
| Profile (name, contact email, phone, avatar) | `utils/profile.ts`, `lib/profile-storage.ts` (field-by-field defensive read, data-URL check), `lib/avatar.ts` (browser resize), `store/profile-store.ts`. An overlay on the account: the sign-in identity does not change. |
| Dashboard UI | `features/account/` (public API: `DashboardView`, `AccountSync`, `useProfile`); `app/(protected)/dashboard/page.tsx` stays a server component |
| Comparison | `utils/compare.ts` (rules and table rows), `lib/compare-storage.ts` (sessionStorage), `store/compare-store.ts`; the card control is `components/ui/compare-toggle.tsx` plus `hooks/use-compare-toggle.ts` (the same split as the wishlist heart), and the tray, table and `/compare` route live in `features/compare/` |
| Dialog primitive | `components/ui/dialog.tsx`: role="dialog", aria-modal, focus trap, Escape, scroll lock, focus return. Used by Quick View and the mobile filter sheet |
| Quick View | `features/products/components/quick-view-dialog.tsx`, loaded with `next/dynamic` from `ProductCard`; reuses `useProduct` and `PurchasePanel` |
| Footer, policies, newsletter | `components/layout/site-footer.tsx`, `lib/policies.ts` and `app/policies/[slug]`, `features/newsletter/` with `services/newsletter/` (a simulation; layer rules keep `components/` away from services, which is why the form is a feature) |

Interpretations of the PRD where it is silent, so you can disagree knowingly: the comparison list lasts for the browser session (like a guest wishlist); the policy pages are the four common ones (shipping, returns, privacy, terms) because the PRD only says "policy pages"; the profile's email is a contact email, because the sign-in email is the account's identity; a carried-over price range is dropped with an explanation when it leaves nothing for the new topic (PRD 7.4 says "if appropriate").

## Performance and Core Web Vitals (PRD 12)

What is in place and why:

- **Route-level code splitting** from the App Router (see the build table in the CI log).
- **Dynamic imports** for non-critical UI: the assistant (`LazyAssistantWidget`, loaded after hydration with `ssr: false`) and Quick View (loaded on first click). The admin area is its own set of routes, so its code is not part of storefront pages.
- **Images** go through `next/image` with `sizes` (`ProductImage`); above-the-fold hero images are prioritised, the rest lazy-load. Reserving the image box with `aspect-*` classes prevents layout shift, which protects **CLS**.
- **LCP**: the hero's main image is marked `priority`, and the catalogue is fetched once and cached (TanStack Query with a stale time), so later pages reuse it. Honest trade-off: the home page content is a client component fed by that catalogue request, so LCP on a cold first visit depends on the DummyJSON response time.
- **INP**: search is debounced (350 ms), long lists are paginated (24 per page), `ProductCard` is memoized, and expensive derivations use `useMemo`.
- **Loading states** are skeletons that match the final layout instead of spinners that move content.

Trade-offs, stated plainly: the whole catalogue (about 194 products) is loaded because DummyJSON cannot filter by price, rating, brand or stock (see `docs/API-INTEGRATION.md`); this makes filtering instant but puts a fixed cost on the first visit. The shared JavaScript is about 102 kB and the storefront routes load about 190 to 200 kB in total. Moving the assistant out of the first bundle did not change that headline number much, because most of the weight is shared framework and state code. These figures come from the build output and were not measured with Lighthouse in a real browser.
