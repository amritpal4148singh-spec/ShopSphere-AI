# ShopSphere AI colour system: Minimal Luxury

Every colour is a token in `src/app/globals.css`, in two layers: a raw palette, and the semantic roles components use. Components never use hex values or raw palette names, so the palette is retuned in one place.

## Palette and roles

### Backgrounds

| Role | Token | HEX | Intended use |
|---|---|---|---|
| Primary background | `ivory` | `#F8F3E9` | The page. Warm ivory, never pure white, so product photography sits on a gently warm stage. |
| Elevated surface | `cream` | `#FFFCF6` | Cards, inputs, dialogs, the assistant panel. One step lighter than the page, so surfaces lift without heavy shadows. |
| Secondary background | `sand` | `#EFE6D3` | Bands, image panels, skeletons, secondary buttons, the `muted` role. |
| Secondary hover | `sand-deep` | `#E4D8BF` | Hover fill on sand surfaces. Carries navy text only (never muted text: 4.5:1 is borderline). |

### Text

| Role | Token | HEX | Intended use |
|---|---|---|---|
| Primary text | `text` | `#121C33` | Body, headings, prices, nav. Deep navy-black. |
| Secondary text | `text-secondary` | `#3D4559` | Form labels and supporting copy. |
| Muted text | `text-muted` | `#5A5F70` | Captions, struck-through prices, helper text. Valid on ivory, cream, sand, navy-tint. |
| Placeholder | `text-placeholder` | `#686C7B` | Input placeholders (5.1:1 on cream). |

### Brand

| Role | Token | HEX | Intended use |
|---|---|---|---|
| Primary brand | `navy` | `#14233F` | Primary buttons, selected states, links, focus ring, wordmark. Text colour of record. |
| Primary hover / pressed | `navy-hover` | `#0D1A31` | Primary button hover and pressed. |
| Dark surface | `navy-deep` | `#0B1629` | Footer, assistant header, the Trending shelf, label on gold buttons. |
| Panel on dark | `navy-soft` | `#1E3156` | Raised panels on navy surfaces. |
| Secondary brand | `harbour` | `#2C4270` | A softer navy for secondary emphasis and chart series. |
| Selected / hover tint | `navy-tint` | `#E7EAF2` | Selected tab, hovered row, ghost-button hover, icon chips. |

### Champagne gold

| Role | Token | HEX | Intended use |
|---|---|---|---|
| Champagne accent | `gold` | `#C9A96A` | Shopping-action button fill, hairlines, orbit rings, satellite, any mark on navy. |
| Gold hover / pressed | `gold-hover / gold-press` | `#D6B97C / #BF9C55` | Interaction states of the gold button (navy label stays 7.0:1 or better). |
| Gold on dark | `gold-light` | `#E3CD9B` | Gold text and icons on navy surfaces (11.6:1). |
| Gold as text on light | `gold-ink` | `#775A1E` | The ONLY gold allowed as text on light surfaces (5.8:1 on ivory). |
| Gold edge | `gold-edge` | `#957634` | Bronze outline on the gold button and active indicators; gives the button a 3:1+ boundary. |
| Gold tint | `gold-tint` | `#F3E9CF` | Quiet chip background for gold-ink labels. |
| Star rating | `star` | `#9A7425` | Star icons (3.5:1 on cream, graphic). |

### Lines

| Role | Token | HEX | Intended use |
|---|---|---|---|
| Border / divider | `hairline` | `#E2D8C3` | Card edges and dividers. Decorative: content never depends on them. |
| Control border | `border-control` | `#857D69` | Edges of inputs, selects, checkboxes, radios (3.7:1 on ivory). |
| Focus ring | `navy / gold` | `#14233F / #C9A96A` | Navy on light surfaces (14:1), champagne on navy surfaces (8:1). |

### Promotion and status

| Role | Token | HEX | Intended use |
|---|---|---|---|
| Sale / discount | `sale` | `#A6232B` | Discount badges and the saved-heart. White label 7.3:1. Reserved for promotion. |
| Error | `error / error-soft` | `#B3261E / #FBE9E7` | Validation and failure messages. |
| Success | `success / success-soft` | `#1B6B47 / #E3F1E8` | Confirmation and positive status. |
| Warning | `warning / warning-soft` | `#7A4B00 / #FBEFD0` | Cautions, low stock, local-simulation notes. |
| Information | `info / info-soft` | `#1F4E8C / #E4EDF8` | Neutral information. |

## Champagne gold: where it can and cannot be used

Champagne `#C9A96A` is **2.0:1 on ivory and 2.2:1 on cream. It fails WCAG AA for any text on light surfaces**, so:

**Allowed:** button fill carrying navy-deep text (8.1:1); hairlines, orbit rings and ornaments; icons and marks on navy surfaces (8.1:1); focus ring on navy surfaces; gold-light text on navy (11.6:1).

**Not allowed:** gold as body, label, price or link text on ivory, cream or sand. Use `gold-ink` (`#775A1E`, 5.8:1) when gold-coloured text is needed on a light surface. A gold fill with no edge on a light surface is also not allowed for a control (2.0:1 shape), which is why the gold button carries a bronze `gold-edge`.

## Contrast matrix

Computed with the WCAG 2.x relative-luminance formula. Needs: 4.5:1 normal text, 3:1 large text and meaningful UI or graphics. Decorative pairs are reported but not required. Foregrounds with transparency (ivory at 72% and 78% on navy) were composited first.

| Foreground on background | Ratio | Needs | Result |
|---|---|---|---|
| **Text** | | | |
| Primary text on ivory (page) (`#121C33` on `#F8F3E9`) | 15.32:1 | 4.5:1 | Pass |
| Primary text on cream (cards) (`#121C33` on `#FFFCF6`) | 16.54:1 | 4.5:1 | Pass |
| Primary text on sand (bands) (`#121C33` on `#EFE6D3`) | 13.66:1 | 4.5:1 | Pass |
| Secondary text on ivory (`#3D4559` on `#F8F3E9`) | 8.65:1 | 4.5:1 | Pass |
| Secondary text on cream (`#3D4559` on `#FFFCF6`) | 9.35:1 | 4.5:1 | Pass |
| Muted text on ivory (`#5A5F70` on `#F8F3E9`) | 5.74:1 | 4.5:1 | Pass |
| Muted text on cream (`#5A5F70` on `#FFFCF6`) | 6.20:1 | 4.5:1 | Pass |
| Muted text on sand (`#5A5F70` on `#EFE6D3`) | 5.12:1 | 4.5:1 | Pass |
| Muted text on navy-tint (selected) (`#5A5F70` on `#E7EAF2`) | 5.28:1 | 4.5:1 | Pass |
| Input placeholder on cream (field) (`#686C7B` on `#FFFCF6`) | 5.10:1 | 4.5:1 | Pass |
| Brand navy as text/link on ivory (`#14233F` on `#F8F3E9`) | 14.15:1 | 4.5:1 | Pass |
| Brand navy as text/link on cream (`#14233F` on `#FFFCF6`) | 15.28:1 | 4.5:1 | Pass |
| Harbour (secondary brand) text on cream (`#2C4270` on `#FFFCF6`) | 9.67:1 | 4.5:1 | Pass |
| **Buttons** | | | |
| Primary btn: ivory text on navy (`#F8F3E9` on `#14233F`) | 14.15:1 | 4.5:1 | Pass |
| Primary btn hover: ivory on navy-hover (`#F8F3E9` on `#0D1A31`) | 15.70:1 | 4.5:1 | Pass |
| Secondary btn: navy text on sand (`#14233F` on `#EFE6D3`) | 12.62:1 | 4.5:1 | Pass |
| Secondary btn hover: navy text on sand-deep (`#14233F` on `#E4D8BF`) | 11.08:1 | 4.5:1 | Pass |
| Outline btn: navy text on ivory (`#14233F` on `#F8F3E9`) | 14.15:1 | 4.5:1 | Pass |
| Outline btn border (navy) vs ivory (`#14233F` on `#F8F3E9`) | 14.15:1 | 3.0:1 | Pass |
| Gold CTA: navy-deep text on gold (`#0B1629` on `#C9A96A`) | 8.07:1 | 4.5:1 | Pass |
| Gold CTA hover: navy-deep on gold-hover (`#0B1629` on `#D6B97C`) | 9.55:1 | 4.5:1 | Pass |
| Gold CTA pressed: navy-deep on gold-press (`#0B1629` on `#BF9C55`) | 6.98:1 | 4.5:1 | Pass |
| Gold CTA bronze edge vs ivory (shape) (`#957634` on `#F8F3E9`) | 3.86:1 | 3.0:1 | Pass |
| Gold CTA bronze edge vs cream (shape) (`#957634` on `#FFFCF6`) | 4.17:1 | 3.0:1 | Pass |
| Gold CTA bronze edge vs sand (shape) (`#957634` on `#EFE6D3`) | 3.44:1 | 3.0:1 | Pass |
| Gold fill vs ivory WITHOUT edge (why the edge exists) (`#C9A96A` on `#F8F3E9`) | 2.03:1 | n/a | decorative |
| Gold CTA vs navy-deep hero (shape) (`#C9A96A` on `#0B1629`) | 8.07:1 | 3.0:1 | Pass |
| **Navigation** | | | |
| Nav link (text) on ivory (`#121C33` on `#F8F3E9`) | 15.32:1 | 4.5:1 | Pass |
| Nav hover (navy) on ivory (`#14233F` on `#F8F3E9`) | 14.15:1 | 4.5:1 | Pass |
| Selected tab: navy on navy-tint (`#14233F` on `#E7EAF2`) | 13.00:1 | 4.5:1 | Pass |
| Nav underline indicator (navy) vs ivory (`#14233F` on `#F8F3E9`) | 14.15:1 | 3.0:1 | Pass |
| Footer text: ivory on navy-deep (`#F8F3E9` on `#0B1629`) | 16.35:1 | 4.5:1 | Pass |
| Footer secondary: ivory 72% on navy-deep (`#B6B5B3` on `#0B1629`) | 8.83:1 | 4.5:1 | Pass |
| Hero body: ivory 78% on navy-deep (`#C4C2BF` on `#0B1629`) | 10.18:1 | 4.5:1 | Pass |
| Gold-light on navy-deep (dark surfaces) (`#E3CD9B` on `#0B1629`) | 11.60:1 | 4.5:1 | Pass |
| **Prices & Promotions** | | | |
| Price (text) on cream card (`#121C33` on `#FFFCF6`) | 16.54:1 | 4.5:1 | Pass |
| Struck-through price (muted) on cream (`#5A5F70` on `#FFFCF6`) | 6.20:1 | 4.5:1 | Pass |
| Discount badge: white on sale (`#FFFFFF` on `#A6232B`) | 7.25:1 | 4.5:1 | Pass |
| Sale colour as text on cream (`#A6232B` on `#FFFCF6`) | 7.08:1 | 4.5:1 | Pass |
| Sale badge vs product-photo panel (ivory) (`#A6232B` on `#F8F3E9`) | 6.56:1 | 3.0:1 | Pass |
| Star rating gold vs cream (graphic) (`#9A7425` on `#FFFCF6`) | 4.19:1 | 3.0:1 | Pass |
| Star rating gold vs sand (graphic) (`#9A7425` on `#EFE6D3`) | 3.46:1 | 3.0:1 | Pass |
| Gold-ink label on gold-tint chip (`#775A1E` on `#F3E9CF`) | 5.32:1 | 4.5:1 | Pass |
| Sale text on sand (`#A6232B` on `#EFE6D3`) | 5.84:1 | 4.5:1 | Pass |
| White on sale hover (`#FFFFFF` on `#8F1C24`) | 8.90:1 | 4.5:1 | Pass |
| Gold-ink as text on ivory (`#775A1E` on `#F8F3E9`) | 5.81:1 | 4.5:1 | Pass |
| Gold-ink as text on sand (`#775A1E` on `#EFE6D3`) | 5.18:1 | 4.5:1 | Pass |
| Champagne gold as TEXT on ivory (expected FAIL) (`#C9A96A` on `#F8F3E9`) | 2.03:1 | 4.5:1 | Fail (by design: see gold rules) |
| Champagne gold as TEXT on cream (expected FAIL) (`#C9A96A` on `#FFFCF6`) | 2.19:1 | 4.5:1 | Fail (by design: see gold rules) |
| **Forms & Controls** | | | |
| Input text on cream (`#121C33` on `#FFFCF6`) | 16.54:1 | 4.5:1 | Pass |
| Form label on ivory (`#3D4559` on `#F8F3E9`) | 8.65:1 | 4.5:1 | Pass |
| Input border vs ivory (UI) (`#857D69` on `#F8F3E9`) | 3.70:1 | 3.0:1 | Pass |
| Input border vs cream (UI) (`#857D69` on `#FFFCF6`) | 3.99:1 | 3.0:1 | Pass |
| Focus ring (navy) vs ivory (`#14233F` on `#F8F3E9`) | 14.15:1 | 3.0:1 | Pass |
| Focus ring (gold) vs navy-deep (dark surfaces) (`#C9A96A` on `#0B1629`) | 8.07:1 | 3.0:1 | Pass |
| Checked radio/checkbox navy vs cream (`#14233F` on `#FFFCF6`) | 15.28:1 | 3.0:1 | Pass |
| Hairline divider vs ivory (decorative) (`#E2D8C3` on `#F8F3E9`) | 1.28:1 | n/a | decorative |
| Card hairline border vs ivory (decorative) (`#E2D8C3` on `#F8F3E9`) | 1.28:1 | n/a | decorative |
| **Messages** | | | |
| Error text on ivory (`#B3261E` on `#F8F3E9`) | 5.91:1 | 4.5:1 | Pass |
| Error text on error tint (`#B3261E` on `#FBE9E7`) | 5.58:1 | 4.5:1 | Pass |
| Success text on ivory (`#1B6B47` on `#F8F3E9`) | 5.86:1 | 4.5:1 | Pass |
| Success text on success tint (`#1B6B47` on `#E3F1E8`) | 5.56:1 | 4.5:1 | Pass |
| Warning text on warning tint (`#7A4B00` on `#FBEFD0`) | 6.48:1 | 4.5:1 | Pass |
| Warning text on ivory (`#7A4B00` on `#F8F3E9`) | 6.70:1 | 4.5:1 | Pass |
| Info text on info tint (`#1F4E8C` on `#E4EDF8`) | 7.03:1 | 4.5:1 | Pass |
| Info text on ivory (`#1F4E8C` on `#F8F3E9`) | 7.51:1 | 4.5:1 | Pass |

## Verification on the rendered application

Independent of the table above, axe-core's `color-contrast` rule was run against the production build on 18 screens (home, home with the assistant open, listing, product detail, cart, sign-in, register, wishlist, checkout, orders, dashboard, and all seven admin screens), at 1440px and 390px wide: **0 violations** (1,514 and 1,339 text elements checked). axe reports text it cannot resolve (for example over images) as "incomplete"; those were not manually reviewed.
