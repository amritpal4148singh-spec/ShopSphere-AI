# Changes in this snapshot

Relative to the "minimal luxury" ZIP that was audited. Nothing was removed. Existing behaviour was preserved: the full pre-existing test suite still passes, with three deliberate test edits listed below.

## Summary

| Area | Change |
|---|---|
| Product comparison | New: store, card toggle, tray, `/compare` page |
| Quick View | New accessible dialog, loaded on demand, reusing the product page's purchase panel |
| Footer, policies, newsletter | Sitemap and policy link groups, four demonstration policy pages, simulated newsletter form |
| Account dashboard | Profile, address management (edit, delete, default), full recently viewed, My reviews |
| Checkout | The default saved address is pre-selected once |
| Assistant | "More like this" keeps the topic and budget; use-case words are matched or acknowledged; a carried price range that leaves nothing is dropped with an explanation |
| Recommendations | Named wrapper functions over `recommend()`; derived-preferences helper and `user-preferences.json` fixture |
| Performance | Assistant loaded with `next/dynamic`; Quick View loaded on first use; Core Web Vitals notes |
| Responsive | Filters open as a bottom sheet below 1024px; phone cart shortcut |
| Accessibility | `role="img"` on four star-rating labels that axe flagged; axe-core tests; token-contrast test |
| Dependencies | `package-lock.json` regenerated so `npm ci` works; `axe-core` added as a dev dependency |
| Removed code | The unused `buildAuthHeaders` helper (and its one test) |
| CI | `.github/workflows/ci.yml` |

## Existing tests that were edited, and why

- `src/store/address-store.test.ts`: the seeded address now carries `isDefault: true`.
- `src/services/assistant/mock-assistant.test.ts`: the test "makes the similar results the new context" asserted the old context drift (category `mobile-accessories`); it now asserts the topic and budget are kept.
- `src/services/auth/auth-service.test.ts` and `src/services/recommendations/service.test.ts`: the first lost the test for the removed helper; the second gained new tests.

## Files

### Modified (32)
- `README.md`
- `docs/API-INTEGRATION.md`
- `docs/ARCHITECTURE.md`
- `docs/ASSISTANT.md`
- `package-lock.json`
- `package.json`
- `src/app/(protected)/dashboard/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/components/layout/site-footer.tsx`
- `src/features/ai-assistant/index.ts`
- `src/features/cart/index.ts`
- `src/features/checkout/components/address-step.tsx`
- `src/features/products/components/product-card.tsx`
- `src/features/products/components/product-detail-view.tsx`
- `src/features/products/components/product-discovery.tsx`
- `src/features/reviews/index.ts`
- `src/services/assistant/messages.ts`
- `src/services/assistant/mock-assistant.test.ts`
- `src/services/assistant/mock-assistant.ts`
- `src/services/assistant/parser.ts`
- `src/services/assistant/plan.ts`
- `src/services/auth/auth-service.test.ts`
- `src/services/auth/index.ts`
- `src/services/auth/session.ts`
- `src/services/recommendations/service.test.ts`
- `src/services/recommendations/service.ts`
- `src/store/address-store.test.ts`
- `src/store/address-store.ts`
- `src/types/assistant.ts`
- `src/types/checkout.ts`

### Added (60)
- `.github/workflows/ci.yml`
- `docs/TESTING.md`
- `e2e/account.spec.ts`
- `e2e/compare.spec.ts`
- `e2e/footer.spec.ts`
- `e2e/quick-view.spec.ts`
- `e2e/responsive.spec.ts`
- `src/app/compare/page.tsx`
- `src/app/policies/[slug]/page.tsx`
- `src/components/layout/site-footer.test.tsx`
- `src/components/ui/compare-toggle.tsx`
- `src/components/ui/dialog.test.tsx`
- `src/components/ui/dialog.tsx`
- `src/data/user-preferences.json`
- `src/features/account/components/accessibility.test.tsx`
- `src/features/account/components/account-sections.test.tsx`
- `src/features/account/components/account-sync.tsx`
- `src/features/account/components/addresses-section.tsx`
- `src/features/account/components/avatar.tsx`
- `src/features/account/components/dashboard-view.tsx`
- `src/features/account/components/my-reviews-section.tsx`
- `src/features/account/components/profile-section.tsx`
- `src/features/account/components/recently-viewed-section.tsx`
- `src/features/account/hooks/use-profile.ts`
- `src/features/account/index.ts`
- `src/features/ai-assistant/components/lazy-assistant-widget.tsx`
- `src/features/cart/components/mobile-cart-button.tsx`
- `src/features/compare/components/compare-sync.tsx`
- `src/features/compare/components/compare-tray.tsx`
- `src/features/compare/components/compare-view.tsx`
- `src/features/compare/components/compare.test.tsx`
- `src/features/compare/index.ts`
- `src/features/newsletter/components/newsletter-form.tsx`
- `src/features/newsletter/index.ts`
- `src/features/products/components/quick-view-dialog.tsx`
- `src/features/products/components/quick-view.test.tsx`
- `src/hooks/use-compare-toggle.ts`
- `src/hooks/use-media-query.ts`
- `src/lib/avatar.ts`
- `src/lib/compare-storage.ts`
- `src/lib/policies.ts`
- `src/lib/profile-storage.ts`
- `src/services/assistant/mock-assistant.context.test.ts`
- `src/services/newsletter/newsletter-service.test.ts`
- `src/services/newsletter/newsletter-service.ts`
- `src/services/recommendations/preferences.test.ts`
- `src/services/recommendations/preferences.ts`
- `src/services/recommendations/weights.test.ts`
- `src/store/compare-store.test.ts`
- `src/store/compare-store.ts`
- `src/store/profile-store.test.ts`
- `src/store/profile-store.ts`
- `src/test/axe.ts`
- `src/test/contrast.test.ts`
- `src/utils/addresses.test.ts`
- `src/utils/addresses.ts`
- `src/utils/compare.test.ts`
- `src/utils/compare.ts`
- `src/utils/profile.test.ts`
- `src/utils/profile.ts`
