# AI Shopping Assistant (PRD section 7)

The assistant is a **rule-based mock**, not a language model. It reads keywords, numbers and patterns in a message, turns them into a structured filter, and has the recommendation service run that filter against the catalogue. It makes no network request of its own, uses no model and no API key, and the same message in the same conversation always gives the same answer. This is stated in the panel (a "Rule-based" badge, a footer note and an About text) and in this document, as PRD 7.1 requires.

## Where it lives

```
src/types/assistant.ts                  AssistantIntent, ConversationContext, AssistantResponse, ChatMessage
src/services/assistant/                 no React (PRD 9.3)
  parser.ts        message -> pieces of a structured intent (price, rating, colour, topic, similarity, markers)
  vocabulary.ts    topics: product types the assistant recognises, built from the catalogue
  plan.ts          pieces + conversation context -> a plan (search / similar / clarify / talk)
  mock-assistant.ts  the provider: executes the plan through the recommendation service
  messages.ts      every sentence the assistant says
  service.ts       sanitises input, calls the injected provider
  types.ts         AssistantProvider: the contract a language-model provider would implement
src/services/recommendations/
  filter.ts        the filter half of the new "assistant" strategy (shared, pure)
  strategies.ts    intentSearch(): the "assistant" strategy
src/lib/assistant-storage.ts            session-storage persistence with validation
src/store/assistant-store.ts            Zustand: panel open/closed, messages, context
src/features/ai-assistant/              hook, widget, lazy-loaded panel, message bubbles
```

Flow (PRD 6.4): component -> `useAssistant` -> `assistantService` -> `AssistantProvider` -> `recommendationService.recommend("assistant" | "similar", ...)` -> the recommendation provider. The assistant is a new entry point into the existing scoring and filtering, not a parallel implementation (PRD 7.3).

## What it understands

| Say | Becomes |
|---|---|
| "headphones under 5000", "under ₹5,000", "below Rs. 60,000", "up to 1.5 lakh", "30k" | `{ category: "headphones", maxPrice: 5000 }` |
| "above 2000", "at least 2000", "between 40k and 80k", "around 20000" | a price floor, a range, or plus or minus 20 percent |
| "good ratings", "highly rated" / "top rated", "excellent ratings" / "4 stars", "rated 4.5 and above" | `minRating` 4 / 4.5 / the number given |
| "something cheaper" / "more expensive" | relative to the products just shown (below) |
| "better ratings" | raises `minRating` one step and ranks by rating |
| "only in blue" | `colour: "blue"` |
| "more like the second one", "similar to #3", "like the last one", "more like this" | Similar Products strategy, anchored on a product shown earlier |
| "never mind, show me headphones instead", "start over" | topic change, reset |
| "hi", "what can you do?", "thanks" | small talk and help (the help text says it is rule-based) |

Product types come from a built-in vocabulary (smartphones, laptops, headphones, shoes, watches and so on, with synonyms and plural forms) **plus one topic per category found in the catalogue**, so a category the vocabulary was never told about still works. A near-miss spelling of a longer word is tolerated ("headphnes"). "Headphones" is not a DummyJSON category, so it is matched by keyword in product titles and tags; the other topics match by category.

## Conversation rules (PRD 7.4)

- **Same product type again** refines the filters in force. **A different product type** starts a new search.
- **A different product type introduced with a switch word** ("never mind", "instead", "actually", "what about") keeps the **price band** (a general preference) and drops rating and colour (they belonged to the old topic). The reply says that the price range was kept.
- **Cheaper:** the price limit becomes the median price of the products just shown, but at least 15 percent below the highest shown. **More expensive:** a price floor at the median (at least 15 percent above the lowest shown), keeping any ceiling. **Better ratings:** the minimum rating goes 4, 4.5, 4.8 (the cap), and results are ranked by rating.
- **Colour** matches a colour named in a product's title, description or tags, or offered by its simulated colour variants (in stock). If nothing matches, the assistant says so and keeps the earlier results to refine from.
- **"The second one"** means the second card of the latest answer, in the order shown (cards are labelled "Result N"). After a "more like ..." answer, later refinements narrow that product's category.
- A relative request with nothing shown yet, an unknown number ("the sixth one" after four results) and an ambiguous "this one" each get a specific clarifying answer.

## Results

Each answer shows up to 6 product cards (the normal `ProductCard`, so wishlist hearts, links and stock display work), the filters applied as chips and in a sentence, and the reason for each card ("Within your ₹5,000 budget", "Rated 4.7 out of 5 (you asked for 4+)", "Available in Blue", or a personal reason once there is activity). Ranking is rating and popularity, blended with the personalised score as evidence builds (up to half the weight). Out-of-stock products are never offered. When nothing matches the assistant says why, offers the cheapest price that exists, keeps the earlier context, and never fills the gap with unrelated products.

## The chat

A floating "Assistant" button on every page (bottom right, within thumb reach on a phone). Guests and customers have it; administrators do not (PRD 4.3). From the `sm` breakpoint (640 px) the panel is a side panel and the page stays usable; below it the panel is a full-screen modal dialog that keeps focus inside. Focus moves to the message box on open and back to the button on close; Escape closes. Messages are in a polite live region with a hidden speaker label ("You said:" / "Assistant:"); a typing indicator shows while an answer is prepared; starter prompts greet a first-time user; follow-up prompts follow the latest answer. The conversation is kept in session storage (it survives navigation and reload, not a new tab). The panel code is loaded only when first opened (PRD 12).

**Failure (PRD 16.1):** if the catalogue cannot be loaded or the service throws, an inline error bubble with Retry is added, the history stays, and Retry re-runs the same message without repeating it. An answer that arrives after "New chat" is discarded.

## Replacing the mock

Implement `AssistantProvider` (`respond(request): Promise<AssistantResponse>`) and pass it to `createAssistantService`. The hook, store and components do not change. `mock-assistant.test.ts` proves the swap with a stand-in provider.

## Known limits

- It understands the patterns above, not free conversation. Anything else gets a clarifying answer with suggested prompts.
- English only. Colours and product types outside the vocabulary and the catalogue's categories are not recognised.
- Prices in a message are rupees (the app's currency). "Around X" means plus or minus 20 percent.
- After "more like ...", refinements narrow by category, not by similarity.
- Chat history keeps the last 40 messages and stores product snapshots, so a price in an old bubble can differ from the live price on its product page.
- No voice, no order or account queries, no cart actions from the chat (not in the PRD's Phase 8 scope).

## Conversation context rules, as fixed and tested

The assistant keeps one structured intent (`category`, price band, minimum rating, colour, use case, sort) plus the ids it last showed. Three behaviours, each covered by `services/assistant/mock-assistant.context.test.ts`:

1. **"More like the first one" keeps the conversation's constraints.** The similar products must still be the same kind of product and inside the budget in force, and the intent is unchanged afterwards. So "headphones under 5,000", "more like the first one", "something cheaper" gives cheaper headphones, not chargers. If nothing similar still fits, the reply says so and keeps the filters.
2. **A use case ("only for gaming") is matched, or the assistant says it cannot.** It is not a catalogue filter, so the assistant looks for the word in product titles, descriptions and tags. Matches are shown and the reply says how it matched. If there are none, the reply says it cannot filter by use case, shows the products that still fit the other filters, and does not leave the use case in force. It is only read on refinement turns that name no product type ("headphones for running" is a new search, not a use case).
3. **A change of topic resets topic-specific filters and keeps only the price band.** Rating floors, sort order, colour and use case are dropped. The price band is kept "if appropriate" (PRD 7.4); when it leaves nothing for the new topic, the assistant drops it and says so instead of answering "no results".

Known limits: the use-case match is a plain word-stem search, so "gaming" also matches "game" and "gamers"; there are no synonyms, and nothing understands negation ("not for gaming").
