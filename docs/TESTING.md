# Testing (PRD section 17)

This document says what is tested, what was actually executed, and what was not. Nothing here claims a test passed unless it was run.

## Commands

| Command | What it runs |
|---|---|
| `npm run typecheck` | `tsc --noEmit` (strict TypeScript) |
| `npm run lint` | ESLint, including the layer-boundary rules in `docs/ARCHITECTURE.md` |
| `npm test` | Vitest: unit tests, component tests (React Testing Library) and axe-core accessibility checks |
| `npm run build` | Next.js production build |
| `npm run test:e2e` | Playwright end-to-end tests. It starts `npm run start`, so run `npm run build` first. |

Local run, in order: `npm ci && npm run typecheck && npm run lint && npm test && npm run build && npx playwright install chromium && npm run test:e2e`.

## Executed in the authoring environment (fresh `npm ci`, Node 22)

| Check | Result |
|---|---|
| `npm ci` | Passes |
| `npm run typecheck` | Passes |
| `npm run lint` | No warnings or errors |
| `npm test` | 129 files, 1,321 tests, all pass |
| `npm run build` | Passes, with one environment workaround: the sandbox cannot reach Google Fonts, so the build was run with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` pointing at a stand-in font response (a Next.js feature for tests). The app source was not changed. On a networked machine, or in CI, no workaround is needed. |
| `npm run test:e2e` | **Not executable in the authoring environment** (the Playwright browser download is blocked). It was run on the owner's machine: first run 135 passed, 9 failed, 1 flaky. The causes and fixes are listed below. The suite has not been re-run since those fixes. |

### First E2E run (owner's machine) and what it found

| Failure | Root cause | Fix |
|---|---|---|
| `assistant.spec.ts` starter prompt, "more like the first one" after "in blue" | **App regression.** "More like this" required similar products to also match the colour filter, so one blue headset left nothing similar | `services/assistant/mock-assistant.ts`: colour and use case no longer limit "more like this" (topic, budget and rating floor still do). Regression test added |
| `compare.spec.ts` x5 | The owner's compare spec expects UI the first version did not have: visible "N products selected" text, "Select at least 2 products" guidance, and "Compare now" as a **button** | `features/compare/components/compare-tray.tsx`, `compare-view.tsx`; clicking the toggle at the 4-product limit now registers the refusal so the tray explains it |
| `account.spec.ts` My reviews | Spec race: navigated to the dashboard before the review save finished | Spec now waits for the save confirmation, like `reviews.spec.ts` |
| `account.spec.ts` Recently viewed (flaky) | Spec race: a product view is recorded after the product loads, and the spec moved on before that | Spec waits for each product heading |
| `responsive.spec.ts` filter sheet | Spec used `.check()`, which asserts instantly, but the checkbox follows the URL, which updates a moment later | Click, then wait for `toBeChecked` |
| `responsive.spec.ts` grid columns | Wrong selector (found no cards) | Uses the card title headings |

### What to expect from the E2E suite

The suite has the original specs (auth, search and discovery, product detail, cart, wishlist, checkout, orders, recommendations, assistant, reviews, admin) plus five new files: `compare.spec.ts`, `quick-view.spec.ts`, `account.spec.ts`, `footer.spec.ts` and `responsive.spec.ts`. The new files are unexecuted and may need small selector fixes on first run. Existing specs were not edited. Three places where new UI could have collided with their selectors were avoided on purpose: footer link names differ from header link names, the newsletter input label does not contain the word "Email" (the sign-in helper uses `getByLabel("Email")`), and the mobile cart shortcut is named "Shopping bag", not "Cart".

## What is covered

| Area | Tests |
|---|---|
| Recommendation scoring, the nine strategies, signals, service, weights | `services/recommendations/*.test.ts` (scoring, strategies, signals, service incl. named wrappers, preferences fixture, exact weights) |
| Assistant: parsing, planning, answers | `services/assistant/*.test.ts`, including `mock-assistant.context.test.ts` with multi-turn regressions for the three scenarios in the brief (see `docs/ASSISTANT.md`) |
| Cart, checkout, orders, reviews, admin rules | `utils/*.test.ts` and `store/*.test.ts` |
| Address book (add, edit, delete, default, limit, duplicates) | `utils/addresses.test.ts`, `store/address-store.test.ts` |
| Profile (validation, avatar rules, persistence, tampered storage) | `utils/profile.test.ts`, `store/profile-store.test.ts` |
| Comparison (2 to 4, duplicates, persistence, table rows, missing data) | `utils/compare.test.ts`, `store/compare-store.test.ts`, `features/compare/components/compare.test.tsx` |
| Quick View and dialog (focus trap, Escape, focus return, stock, variants, error and 404 states) | `components/ui/dialog.test.tsx`, `features/products/components/quick-view.test.tsx` |
| Dashboard sections (profile form, address manager, my reviews, recently viewed) | `features/account/components/account-sections.test.tsx` |
| Footer, policy content, newsletter (validation, loading, success, repeat, failure, double submit) | `components/layout/site-footer.test.tsx`, `services/newsletter/newsletter-service.test.ts` |
| Accessibility | `features/account/components/accessibility.test.tsx` (axe-core on footer, profile, addresses, reviews, product card, Quick View, dialog, comparison table) and `test/contrast.test.ts` (token contrast from `globals.css`) |
| Browser journeys and breakpoints | `e2e/*.spec.ts` (unexecuted here; see above) |

## Known gaps

- **E2E not executed here.** This is the main open item. Run it locally and in CI.
- axe-core runs in jsdom, which has no layout engine, so the colour-contrast and target-size rules are off there. Contrast is covered by `test/contrast.test.ts` on the design tokens; real-browser axe checks (for example `@axe-core/playwright`) are not set up.
- Responsive behaviour was checked by tests that assert structure and by `e2e/responsive.spec.ts` (unexecuted). Nobody has looked at rendered screens at 375, 640, 768, 1024, 1280, 1440 and 1920 pixels from this environment.
- Custom hooks are covered through the components that use them rather than with `renderHook` tests, apart from `use-debounced-value` and `use-raw-signals`.
- GitHub history, branch and pull-request practice, a live deployment and the media deliverables (screenshots, demo video, presentation, technical report) cannot be produced or verified from source.
