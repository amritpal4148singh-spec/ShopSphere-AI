# Phase 09 report: Admin Dashboard and Reviews

Built on `ShopSphere-AI-Phase-08-Complete.zip`. Scope from the PRD (section 19.4): the admin dashboard (section 8.1 to 8.4) and the reviews module (5.10), with the pieces they depend on: 4.2 (Data Write Policy labelling), 4.3 (access matrix: administrators "Moderate" reviews), 5.4 (rating and review count on the product page), 10.2 and 10.3 (local mock JSON, `reviews.json`, `analytics.json`), 13 (validation, safe rendering), 14 and 15 (accessibility, responsive), 20 edge case 27 (deleting a product that orders reference).

## Verification (all run in this phase, with real dependencies)

| Check | Result |
|---|---|
| `tsc --noEmit` | Pass, no output |
| `eslint .` | Pass, no output |
| Vitest, whole project | 1,188 tests: 1,182 pass, **6 fail, the same 6 that fail on the untouched Phase 8 code** (I recorded the baseline names before changing anything and compared by name: **0 new failures**). Phase 8 had 991 tests; Phase 9 adds 197. |
| `next build` | Pass, 22 static pages generated, 10 admin routes (Phase 8 had 1). Run with Google Fonts **mocked** because the sandbox cannot reach Google (Next's `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`); the project's own font code is unchanged. |
| Playwright (Chromium 153 from the `@sparticuz/chromium` npm package, because the Playwright download is blocked here; production build) | 119 tests: **112 pass, 7 fail**. The 7 are exactly the pre-existing ones listed in PHASE-08-REPORT.md; **I also ran those specs on an untouched copy of the Phase 8 code in this sandbox and the same 7 fail there.** All 19 new tests pass (9 reviews, 10 admin). |
| Live DummyJSON | **Never called** (no network). E2E mocks it, as before. |
| Manual browser walkthrough | Not done (no display). Responsive behaviour was checked by automated 375px tests only. |

### Pre-existing failures (unchanged, not touched)
Unit: the 6 listed in PHASE-08-REPORT.md. E2E: `cart.spec.ts:141`, `checkout.spec.ts:210`, `orders.spec.ts:99`, and 4 in `product-detail.spec.ts:183`. I left them alone as instructed: they are not Phase 9 regressions. Say the word and I will fix them as their own piece of work.

## What was built

**Reviews (PRD 5.10, 5.4)**
- Product page section "Customer reviews": average and count, a 5-to-1 star distribution chart (text plus bar, so it never depends on seeing the bar), sort by most recent / highest / lowest / most helpful, "Show more" paging (5 at a time), helpful / not helpful voting (one vote each, can be changed or withdrawn), verified-purchase marker.
- Submission for signed-in customers: 1 to 5 stars (native radio buttons, so keyboard and screen readers work) plus text, 10 to 1,000 characters, inline errors tied to the fields, focus moved to the first problem. One review per customer per product, which the customer can edit or delete (with confirmation) on the same page. Guests are invited to sign in; administrators see moderation controls instead of a form (PRD 4.3).
- **Verified purchase** is derived from the author's local order history when they write or edit the review (any order that contains the product).
- Review text is rendered as plain text. A test submits `<img onerror>` and `<script>` strings and checks nothing executes.
- The rating line at the top of the product page is now the average of the reviews listed below it, with a link to them, and updates when a review is added, deleted or hidden.
- A write the browser refuses (private mode, full storage) shows a warning instead of failing silently.

**Admin dashboard (PRD 8)**
- `/admin` overview: total products, orders, customers; simulated revenue and simulated conversion rate (both tagged "Simulated"); top products (toggle between simulated sales and rating); low-stock alerts; recommendation click-through (tagged "Local Analytics").
- `/admin/products`: search, category and status filters, sort, 20 per page; add, edit (`/admin/products/new`, `/admin/products/[id]`), delete with confirmation, restore. `/admin/inventory`: stock levels, low/out-of-stock indicators, simulated stock adjustment. `/admin/categories`: create and rename; a product is assigned to a category in its edit form.
- `/admin/orders` and `/admin/orders/[orderId]`: orders of every customer on the device, filterable by status, customer, date range and order number; detail with items, customer, totals and tracking timeline; "Advance to <next stage>" simulates the next tracking step and writes it to that customer's own storage (an open customer tab updates too).
- `/admin/analytics`: impressions, clicks, click-through, simulated conversion for each of the nine strategies plus Featured, ordered by engagement; labelled "Local Analytics".
- `/admin/reviews`: moderation list (hide / restore), plus the same controls inline on product pages.
- Every admin write is labelled (PRD 4.2): a banner on every admin screen says changes are simulated and local, each write control sits next to a "Local simulation" badge, buttons say "(local)", and confirmations say "(local simulation)".

## Decisions and assumptions you should check

1. **Review sources.** A product's reviews are the union of (a) the 3 reviews DummyJSON returns with the product, (b) 21 sample reviews in `src/data/reviews.json` for products 8 to 14 and 20 (with verified flags and helpful counts; text is generic because I cannot check what those ids are in the live catalogue), and (c) reviews written on this device. The PRD only says "local mock JSON plus local persistence", so including (a) is my call; without it 190 of 194 products would show "no reviews".
2. **Rating consistency.** Product cards, filters and sorting still use the catalogue's own rating; the product page's rating line uses the review average. They can differ slightly (for example 4.6 on a card, 4.7 on the page). I chose this so a new review visibly changes the page. Existing tests that asserted the old behaviour were updated (`product-detail-view.test.tsx`, two lines).
3. **Admin edits are scoped to the admin screens**, as PRD 8.2 says ("simulated and scoped to local application state"). A changed price or a new product does not appear on the storefront. Making them propagate would touch every feature that reads the catalogue; I did not do that.
4. **Edge case 27.** Deleting a product that any order references **archives** it (status "archived", shown as such, restorable) with an explanation. Other products are removed locally; a "Removed locally" filter brings them back.
5. **Analytics rules** (my definitions; the PRD gives none): an impression is one product card shown in a rail, counted once per time the rail appears; a click is a click on the card's link (not the wishlist heart); a conversion is that product being added to the cart (also from "move to cart") within 24 hours, credited to the most recent clicked strategy, once. The numbers are per device, whoever shops on it. The assistant's cards are not tracked (not one of the nine strategies). The "Include simulated sample baseline" checkbox adds the seed counts from `src/data/analytics.json` (on by default so the screen is demonstrable); switch it off to see only real events.
6. **Simulated conversion rate** = orders divided by (260 simulated visits from `analytics.json` + product pages viewed on this device). It is a labelled simulation, not a measurement.
7. **Moderation** (hide / restore, never destroy) is from the access matrix (4.3); section 8 does not list it. Hidden reviews vanish from the list, the count and the average for shoppers. Reviews from the product API can only be hidden from the product page; they then also appear in the moderation list so they can be restored.
8. **Voting** is open to guests too (they share one device-level "guest" voter); nobody votes on their own review; administrators do not vote.

## Not built (still open)
- **"My reviews" panel in the user dashboard** (PRD 5.7): it is in the list of unassigned PRD items waiting for your decision (PROJECT-STATE.md). Customers can edit and delete their own review on the product page.
- Image editing for products, a customer-list screen, and bulk admin actions: not in PRD section 8's lists.

## Bugs found and fixed while testing
- The admin tables caused 352px of sideways scrolling at 375px width: the visually hidden button labels inside scrollable tables were not clipped. Fixed with `relative` on the table wrappers.
- The admin product search had the same accessible name as the site header search; renamed "Find a product".
- Deleting a locally created product from its edit page flashed "not found"; it now shows a removal confirmation.

## Files

**Created (source)**
- Types: `types/review.ts`, `types/analytics.ts`, `types/admin.ts`
- Pure logic: `utils/reviews.ts`, `utils/analytics.ts`, `utils/admin-catalogue.ts`, `utils/admin-orders.ts`, `utils/admin-metrics.ts`
- Storage: `lib/review-storage.ts`, `lib/analytics-storage.ts`, `lib/admin-storage.ts`
- Stores: `store/reviews-store.ts`, `store/analytics-store.ts`, `store/admin-catalogue-store.ts`, `store/admin-orders-store.ts`
- Data: `data/reviews.json`, `data/analytics.json`, `data/review-data.ts`, `data/analytics-data.ts`
- `features/reviews/` (product-reviews, review-item, review-form, star-rating, rating-distribution, reviews-sync, hook, index)
- `features/admin/` (shell, overview, products, product form, inventory, categories, orders list and detail, analytics, review moderation, shared states, hook, index)
- `components/ui/local-badge.tsx` (the "Local simulation" marker)
- Routes under `app/(protected)/admin/`: `products`, `products/new`, `products/[id]`, `inventory`, `categories`, `orders`, `orders/[orderId]`, `reviews`, `analytics`

**Modified**
- `types/product.ts`, `services/products/mappers.ts`: `ProductDetail.reviewCount` replaced by `reviews` (the API's review records, parsed defensively).
- `features/products/components/product-detail-view.tsx`: rating line from the review summary; review section added. `features/products/hooks/use-record-view.ts`: counts a product view for the simulated conversion rate.
- `features/recommendations/components/recommendation-rail.tsx`: impression and click tracking. `store/cart-store.ts`: reports add-to-cart (and move-to-cart) so conversions can be credited.
- `app/providers.tsx`: mounts `ReviewsSync`. `app/(protected)/admin/layout.tsx` and `page.tsx`: the placeholder became the shell and the overview.
- `features/orders/index.ts`: also exports the timeline, status badge and order sections so admin order detail looks like the customer's. `store/orders-store.ts`: `loadOrders` exported (no behaviour change). `lib/order-storage.ts`: `listOrderOwnerIds`. `lib/safe-storage.ts`: `safeKeysWithPrefix`. `services/auth/user-repository.ts`, `index.ts`: `listUsers` (customer count).
- Tests updated for the `reviewCount` to `reviews` change: `test/fixtures.ts`, `services/products/product-detail.test.ts`, `services/products/mappers.test.ts` (added tests), `features/products/components/product-detail-view.test.tsx`.

**Deleted:** `features/admin/.gitkeep` (the folder now has content).

**Tests created:** 16 unit test files (logic, storage, stores, components; plus new cases added to 4 existing test files) and `e2e/reviews.spec.ts`, `e2e/admin.spec.ts`; helper `test/session.ts`, `features/admin/components/admin-test-utils.tsx`.

No dependency was added or upgraded; `package.json` and `package-lock.json` are unchanged.
