# ShopSphere AI visual identity: Minimal Luxury

A presentation-only redesign. No route, API, store, hook, prop or business-logic behaviour changed. The one API addition is
an optional `layout` prop on `RecommendationRail` (default `"scroll"`, the previous behaviour). The colour system, with
exact HEX values, roles and the full contrast matrix, is in [COLOUR-SYSTEM.md](./COLOUR-SYSTEM.md).

## Direction

Warm ivory and cream surfaces, deep navy for brand and text, champagne gold as a rationed accent, warm neutral lines.
ShopSphere is a general marketplace, so the luxury is in restraint and proportion, not in fashion cues: product photography
stays the only saturated colour on the page.

- **Type.** Fraunces (variable serif with optical sizing) for headlines, titles, prices and the wordmark; Manrope for
  everything else. `.page-title` and `.section-title` apply it across every screen.
- **Signature.** The sphere-and-orbit mark: a navy sphere, a gold orbit, a gold satellite. It appears in the logo and again
  in the hero, where a navy arch frames the lead product and the other picks are round medallions on hairline gold orbits.
- **Colour roles.** Navy is structure and the primary action. Gold marks the shopping action (Add to Cart, Buy Now, Browse
  products, Checkout), one per view, so it stays an accent. Sale red is reserved for promotion.
- **Rhythm.** The homepage alternates ivory and sand shelves, with the second shelf (Trending) in navy, then a navy footer.

## Motion

CSS only, no new dependency, all disabled under `prefers-reduced-motion`: staggered hero entrance; pointer parallax on the
orbit stage (mouse only); scroll-driven reveals and hero drift; route fade-in; shimmer skeletons; drop-in mobile menu;
slide-up assistant (translate and fade only, so its measured size never changes mid-animation). Reveals are print-safe.

## Where things live

- `app/globals.css`: tokens, motion vocabulary, shared components.
- `app/home-view.tsx`, `features/recommendations/components/hero-showcase.tsx`: the hero. It reads the same Featured query
  as the rail, shows the engine's own reasons, holds its footprint while loading, and is decorative only if the catalogue
  cannot load.
- `components/ui/*`: Button (`cta` is champagne with a bronze edge, `cta-outline`), Input, Tabs, RadioCard, QuantityStepper.
- `features/products/components/product-card.tsx`: the single shared card.
