# ShopSphere AI

A personalized, explainable e-commerce storefront built as a frontend-only Next.js application.
The product definition is the official PRD (ShopSphere AI PRD v1.0, "Approved for Implementation").
This snapshot implements every functional requirement of the PRD that can be built in the codebase (see **Status** for what was and was not verified).

Zero-cost stack: no paid APIs, keys, or services are used or required (PRD section 2).

## Status

Verified in a clean copy of this source (fresh `npm ci`, Node 22):

| Check | Result |
|---|---|
| `npm ci` | Passes (the lockfile is in sync) |
| `npm run typecheck` | Passes |
| `npm run lint` | No warnings or errors |
| `npm test` | 129 files, 1,321 tests, all pass (includes axe-core accessibility checks) |
| `npm run build` | Passes; every route compiles, policy pages are statically generated |
| `npm run test:e2e` | **Not run in the authoring environment**: the Playwright browser download is blocked there. Five new spec files (compare, quick view, account, footer, responsive) were added and are unexecuted. No existing spec was edited; the new UI was built to keep their selectors unambiguous (for example footer link names differ from header link names), which is also unverified until the suite runs. Run it locally before submitting (see docs/TESTING.md). |

Things that need your action and cannot be done from source: pushing to GitHub with branches and pull requests, deploying, screenshots at three breakpoints, the demo video, the presentation and the technical report (PRD section 22). See docs/TESTING.md for the exact commands.

`docs/PROJECT-STATE.md` and the `docs/PHASE-*-REPORT.md` files are the historical record of how each phase was built; their "not run" notes describe those earlier moments, not this snapshot.

## Requirements

- Node.js 20.9 or newer (`.nvmrc` pins 22)
- npm 10 or newer. `package-lock.json` is committed and in sync: use `npm ci` for a reproducible install

## Setup

```bash
npm ci
npx playwright install chromium   # one-time browser download for e2e tests
cp .env.example .env.local        # optional; no secrets are needed
npm run dev                       # http://localhost:3000
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint (includes layer-boundary rules, see docs/ARCHITECTURE.md) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit and component tests (React Testing Library) |
| `npm run test:e2e` | Playwright end-to-end tests (starts the dev server automatically) |

## Verify locally

Run in this order and compare with the acceptance criteria in the phase reports in `docs/`:

```bash
npm ci && npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e
```

## Authentication (development stage)

Authentication is a mock that is structured like a JWT backend (PRD section 11). Accounts live in this browser only.

| Role | Email | Password |
|---|---|---|
| Customer | `customer@shopsphere.test` | `Customer123` |
| Administrator | `admin@shopsphere.test` | `Admin12345` |

- Register at `/register` (always creates a Customer), sign in at `/login`.
- Protected routes: `/dashboard`, `/orders`, `/checkout` (sign-in required) and `/admin` (Administrator only).
- The session is an unsigned JWT-shaped token in `localStorage` that expires after 30 minutes.
- These accounts and this mechanism are for local testing only. Never enter a real password.

## Product discovery and search (Phase 03)

| Route | Purpose |
|---|---|
| `/products` | All products with filters, sort and pagination |
| `/category/<slug>` | Category browsing page, for example `/category/mens-shoes` |
| `/search?q=<text>` | Search results (same grid, filters and sort); with no `q`, recent and popular searches |

- Every filter, the sort, the page and the search text live in the URL query string, so views are shareable and work with back/forward. Example: `/products?category=mens-shoes&category=womens-shoes&minPrice=2000&maxPrice=5000&rating=4&sort=price-asc`.
- Product data comes from DummyJSON (`/products`, `/products/search`, `/products/categories`). Prices are converted from USD to INR at a fixed rate (`INR_PER_USD` in `src/lib/currency.ts`).
- Product cards link to `/products/<id>` (the detail page, Phase 04).
- The end-to-end tests mock DummyJSON (`e2e/dummyjson-mock.ts`), so they do not need internet access to the API.
- Details and decisions: `docs/ARCHITECTURE.md` and `docs/API-INTEGRATION.md`.

## Product detail page (Phase 04)

Route: `/products/<id>`, for example `/products/1`.

- Image gallery with thumbnails and zoom on hover, price with discount, rating with review count, breadcrumb.
- **Variants are simulated.** DummyJSON has no variants, so size, colour or storage options and their stock are generated locally by fixed rules (`src/services/products/variants.ts`). Every third product has exactly one sold-out option, which shows the out-of-stock behaviour. Product 3 (a shoe) is a quick example.
- Stock-aware quantity, Add to Cart and Buy Now. The buttons enable and disable correctly, but the cart is built in PHASE-05, so for now they show a notice.
- Description and specification tabs, a simulated PIN-code delivery estimate (try `110001`), and three recommendation rails that are labelled placeholders until PHASE-07.
- A removed or invalid product shows a "no longer available" page.

## Cart and wishlist (Phase 05)

Routes: `/cart` and `/wishlist`. The header shows a cart icon and a wishlist icon with item counts.

- **Cart:** add from the product page (variant and quantity are respected), change quantity (limited to stock, with an inline message), remove, **Save for Later**, coupon codes, and a simulated shipping and tax summary. A product that goes out of stock, disappears, or changes price after being added is flagged in its row, and checkout is blocked until each flagged item is resolved. If live prices and stock cannot be loaded, the cart shows what it last knew with a Retry banner.
- **Buy Now** adds the item to the cart, then goes to checkout (a guest is asked to sign in first). The checkout itself is built in PHASE-06.
- **Wishlist:** a heart on every product card and on the product page. The wishlist page shows each item's current price and stock status and can move an item to the cart. A guest's wishlist lasts for the browser session only; a signed-in customer's is kept. Signing in merges the guest cart and wishlist into the account.
- **Demo coupon codes:** `SAVE10` (10% off, up to ₹1,000, minimum ₹500), `WELCOME200` (₹200 off orders over ₹1,500), `FREESHIP` (free shipping), `SUMMER25` (expired, to show the expired state).
- **Simulated pricing:** shipping is ₹99 below a ₹999 order and free above it; tax is 18% GST. Both are labelled as simulated on screen.
- Both are stored in this browser only (local storage), one cart per shopper (guest or signed-in account).

## Checkout and orders (Phase 06)

Routes: `/checkout` (six steps), `/checkout/confirmation/<orderId>`, `/orders` and `/orders/<orderId>`. All require sign-in.

- **Checkout steps:** Customer, Address, Delivery, Summary, Payment, Confirmation. Everything you enter is saved as you type, so a refresh returns to the same step with the same data, and if your session expires you are asked to sign in again and land back on the same step.
- **Payment is a test-mode simulation.** You choose Mock Card, Mock UPI or Mock Cash on Delivery and, for card and UPI, whether to simulate an approved or a declined payment. The page never asks for a card number, CVV, bank login or UPI PIN, and nothing is sent anywhere. Cash on Delivery is refused above ₹50,000 (a validation example).
- **Delivery methods (simulated):** Standard (free from ₹999, otherwise ₹99), Express (₹149) and Priority next-day (₹299), each with an estimated delivery window.
- **Saved addresses:** a registered customer can pick a saved address or enter a new one and choose to keep it. The demo customer has one saved address ("Home").
- **Orders and tracking:** each order has an ID like `SS-20261014-AB3XK` and six tracking stages (Order Placed, Confirmed, Packed, Shipped, Out for Delivery, Delivered). A new order advances on its own over about 12 minutes (simulated). The demo customer (`customer@shopsphere.test`) starts with six sample orders, one per status, that stay where they are (`SS-DEMO-0001` to `SS-DEMO-0006`). A new customer starts with an empty order history.
- Orders, checkout progress and saved addresses are stored in this browser only, one set per signed-in account.

## Recommendations (Phase 07)

Recommendation rails appear on the home page, product page, cart and wishlist, and the dashboard explains and resets what they are based on.

- **Home:** a first-time visitor sees Featured and Trending products. After browsing, Recently Viewed (most recent first), Recommended For You, Because You Browsed ..., In Your Price Range and wishlist-inspired rails appear. A rail with nothing to show hides itself.
- **Product page:** Similar Products, Frequently Bought Together, More in the category, and a personalized rail. **Cart:** Goes Well With Your Cart. **Wishlist:** Inspired By Your Wishlist.
- Every rail says what it is based on, and every card says why it is there. Out-of-stock products are never recommended.
- **Dashboard (`/dashboard`, sign-in required):** Recommendation preferences shows what you viewed, your typical price range, your interests, your searches and how much is known, explains how scores are made, and lets you clear your viewing history, search history, or both.
- The recommendation engine is a mock: rules and scores with simulated popularity and simulated "bought together" data, no machine learning, and nothing leaves your browser. Viewing history is kept per device.
- How it works, the score weights and each strategy: `docs/RECOMMENDATIONS.md`.

## AI Shopping Assistant (Phase 08)

A floating **Assistant** button on every page (not shown to administrators) opens a chat. Try: `Show me headphones under ₹5,000`, then `something with better ratings`, `something cheaper`, `only in blue` or `more like the second one`; `Never mind, show me laptops instead` changes topic and keeps the price range.

- It is a **rule-based mock, not a language model**: it finds a product type, price, rating and colour in your message and filters the catalogue with them, using the same scoring as the recommendation rails. Nothing you type leaves your browser. The chat says so.
- Answers show product cards with the filters applied and a reason for each card. If it cannot tell what you mean, it asks and suggests prompts. If products cannot be loaded, an inline error offers Retry.
- The conversation lasts for the browser session. On a phone the chat takes the whole screen.
- How it works and what it understands: `docs/ASSISTANT.md`.

## Reviews (Phase 09)

Every product page has **Customer reviews**: the average and a 5-to-1 star breakdown, sorting (most recent, highest, lowest, most helpful), helpful / not helpful voting and a **Verified purchase** marker. Signed-in customers can write one review per product (1 to 5 stars, 10 to 1,000 characters), then edit or delete it. Guests are asked to sign in; administrators moderate instead.

- Reviews come from the product API, the sample file `src/data/reviews.json` (products 8 to 14 and 20) and reviews you write. Yours are stored **in this browser only**.
- "Verified purchase" is worked out from your own order history on this device. Try it with the demo customer, who has sample orders: review product 3 (verified) and product 9 (not).

## Admin dashboard (Phase 09)

Sign in as the demo admin (`admin@shopsphere.test` / `Admin12345`) and open **Admin**. Sections: Overview, Products, Inventory, Categories, Orders, Reviews, Analytics.

- **Everything an administrator changes is a local simulation**: it is saved in this browser only, labelled "Local simulation" next to each action, and does not change the storefront.
- Deleting a product that an order already contains **archives** it instead, so order history stays intact.
- Revenue and conversion rate are **simulated**. Recommendation analytics are **Local Analytics**: events recorded in this browser, plus an optional simulated sample baseline (`src/data/analytics.json`) that you can switch off.
- Full details, decisions and known limits: `docs/PHASE-09-REPORT.md`.

## Account dashboard (PRD 5.7)

`/dashboard` (sign-in required) has seven sections: **Profile** (name, contact email, optional mobile number, avatar), **Addresses** (add, edit, delete, set default; the default is pre-selected at checkout), **Orders** and **Wishlist** (linked to their own pages), **Recently viewed** (the full history), **My reviews** (edit or delete the reviews you wrote; shows verified-purchase and moderation status) and **Recommendation preferences**.

- Everything is saved in this browser only. The contact email is separate from your sign-in email, which does not change.
- Avatar images are resized in the browser and never uploaded.

## Product comparison and Quick View (PRD 5.2)

- **Compare** button on every product card: choose 2 to 4 products, see them in a tray, open `/compare` for a side-by-side table (price, discount, rating, availability, brand, category, description, SKU, warranty, shipping, returns, tags). Rows that differ are marked, the best price, rating and discount are highlighted, and "Show differences only" filters the table. Missing data shows "Not specified". The selection lasts for the browser session.
- **Quick view** button on every card opens an accessible dialog (focus trap, Escape, focus returns to the button) with variants, stock-aware quantity and Add to Cart, using the same purchase logic and cart as the product page.

## Footer, policies and newsletter (PRD 5.1)

The footer has Shop, Account and Policies link groups and a newsletter form. The four policy pages (`/policies/shipping`, `returns`, `privacy`, `terms`) are **demonstration content** describing what this demo does; they are not legal terms. The newsletter is a **simulation**: it validates the address, shows progress, success or failure, remembers a repeat signup, and sends nothing anywhere.

## Recommendation score weights (PRD 6.2)

`score = sum(weight x component)`, every component normalised to 0..1, weights add up to 1.

| Component | Weight | Component | Weight |
|---|---|---|---|
| categoryMatch (w1) | 0.22 | wishlistRelation (w6) | 0.08 |
| priceSimilarity (w2) | 0.12 | cartRelation (w7) | 0.08 |
| tagOverlap (w3) | 0.14 | brandAffinity (extra) | 0.06 |
| normalizedRating (w4) | 0.10 | popularity (extra) | 0.04 |
| recentlyViewedRelation (w5) | 0.16 | | |

The values live in `src/services/recommendations/constants.ts`; `weights.test.ts` pins them to this table. Strategy-by-strategy detail is in `docs/RECOMMENDATIONS.md`.

## Testing

Unit and component tests (Vitest and React Testing Library), axe-core accessibility checks and Playwright end-to-end tests. What each covers, what was executed and the commands are in `docs/TESTING.md`. CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests and build, then the E2E suite.

## Build and deployment

```bash
npm ci && npm run build && npm run start     # production server on http://localhost:3000
```

The app needs no server-side secrets, so it deploys to any Next.js host. On Vercel: import the repository, keep the default build command (`npm run build`) and Node 22, and leave `NEXT_PUBLIC_API_BASE_URL` unset to use `https://dummyjson.com`. The build fetches the Fraunces and Manrope fonts from Google Fonts, so it needs internet access.

## Environment variables

See `.env.example`. Real values go in `.env.local` (git-ignored). No API keys of any kind belong in client code.

## Documentation

- `docs/TESTING.md` - testing documentation: coverage, what was executed, exact commands, known gaps
- `docs/PHASE-09-REPORT.md` - Phase 9 report: reviews and the admin dashboard, decisions, checks, limits
- `docs/ASSISTANT.md` - the shopping assistant: what it understands, conversation rules, how to replace the mock
- `docs/ARCHITECTURE.md` - folder structure, layers, state management, decisions
- `docs/PROJECT-STATE.md` - phase tracker, tech choices, verification results, next phase
- `docs/PHASE-01-REPORT.md` - Phase 1 compliance report
