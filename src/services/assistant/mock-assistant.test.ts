import { createRecommendationService, mockRecommendationEngine, EMPTY_RAW_SIGNALS } from "@/services/recommendations";
import { buildAssistantCatalog } from "@/test/assistant-catalog";
import { rawActivity } from "@/test/catalog";
import { EMPTY_CONTEXT, type AssistantResponse, type ConversationContext } from "@/types/assistant";
import { createMockAssistantProvider } from "./mock-assistant";
import { createAssistantService, sanitizeMessage } from "./service";
import { MAX_MESSAGE_LENGTH, RESULT_LIMIT } from "./constants";
import { STARTER_PROMPTS } from "./messages";

const catalog = buildAssistantCatalog();
// A fresh service per test file keeps the cache from hiding behaviour.
const provider = createMockAssistantProvider(createRecommendationService(mockRecommendationEngine));
const service = createAssistantService(provider);

async function ask(text: string, context: ConversationContext = EMPTY_CONTEXT, raw = EMPTY_RAW_SIGNALS): Promise<AssistantResponse> {
  return service.respond({ text, context, catalog, raw });
}
const ids = (response: AssistantResponse) => response.items.map((item) => item.product.id);

describe("MOD-AI-001: combined structured intent", () => {
  it("parses category and price, shows matching cards, and states the filters in plain language", async () => {
    const response = await ask("Show me headphones under 5000");

    expect(response.kind).toBe("results");
    expect(response.intent).toEqual({ category: "headphones", maxPrice: 5000 });
    expect(ids(response).sort()).toEqual([101, 102, 103, 104]);
    for (const item of response.items) {
      expect(item.product.finalPrice).toBeLessThanOrEqual(5000);
      expect(item.reasons.length).toBeGreaterThan(0);
    }
    expect(response.text).toMatch(/headphones/);
    expect(response.text).toMatch(/priced up to ₹5,000/);
    expect(response.filters.map((filter) => filter.label)).toEqual(["Category: Headphones", "Price: up to ₹5,000"]);
    expect(response.totalMatches).toBe(4);
    expect(response.suggestions).toHaveLength(3);
  });

  it("remembers what it showed, in order, and the filters in force", async () => {
    const response = await ask("Show me headphones under 5000");
    expect(response.context.shownIds).toEqual(ids(response));
    expect(response.context.intent).toEqual({ category: "headphones", maxPrice: 5000 });
  });

  it("handles the PRD example: smartphones under 30,000 with good ratings", async () => {
    const response = await ask("Show me smartphones under 30,000 rupees with good ratings");
    expect(response.intent).toEqual({ category: "smartphones", maxPrice: 30000, minRating: 4 });
    expect(ids(response)).toEqual([10]);
    expect(response.text).toMatch(/rated 4\+ stars/);
  });

  it("shows only the top results and says how many matched", async () => {
    const response = await service.respond({ text: "mens shoes", context: EMPTY_CONTEXT, catalog, raw: EMPTY_RAW_SIGNALS, limit: 2 });
    expect(response.items).toHaveLength(2);
    expect(response.totalMatches).toBe(5);
    expect(response.text).toMatch(/top 2 of 5/);
  });

  it("never shows more than the display limit", async () => {
    expect((await ask("show me products")).items.length).toBeLessThanOrEqual(RESULT_LIMIT);
  });

  it("never offers an out-of-stock product", async () => {
    expect(ids(await ask("headphones"))).not.toContain(106);
  });
});

describe("MOD-AI-002: refinement in context", () => {
  it("keeps headphones and ₹5,000, raises the rating threshold, and re-ranks, without being told the category again", async () => {
    const first = await ask("Show me headphones under 5000");
    const refined = await ask("show me something with better ratings", first.context);

    expect(refined.kind).toBe("results");
    expect(refined.intent).toMatchObject({ category: "headphones", maxPrice: 5000, minRating: 4, sort: "rating" });
    expect(refined.text).toMatch(/raised the minimum rating to 4 stars/);
    expect(ids(refined)).toEqual([103, 102, 104]);
    for (const item of refined.items) {
      expect(item.product.rating).toBeGreaterThanOrEqual(4);
      expect(item.product.finalPrice).toBeLessThanOrEqual(5000);
    }
    expect(refined.filters.map((filter) => filter.label)).toContain("Rating: 4+ stars");
  });

  it("says so when no product meets a higher rating, and keeps the earlier results to refine from", async () => {
    const first = await ask("Show me headphones under 5000");
    const second = await ask("better ratings", first.context);
    const third = await ask("better ratings", second.context);
    const fourth = await ask("better ratings", third.context);

    expect([second, third].map((answer) => answer.intent.minRating)).toEqual([4, 4.5]);
    expect(ids(third)).toEqual([103]);
    expect(fourth.kind).toBe("no-results");
    expect(fourth.items).toEqual([]);
    expect(fourth.text).toMatch(/No headphones .* are rated 4.8\+ stars. The ones I showed are already the best rated/);
    expect(fourth.context).toEqual(third.context);
  });

  it("goes cheaper relative to what was shown", async () => {
    const first = await ask("Show me headphones under 5000");
    const cheaper = await ask("Show me something cheaper", first.context);
    expect(cheaper.kind).toBe("results");
    expect(cheaper.text).toMatch(/lowered the price limit/);
    const limit = cheaper.intent.maxPrice as number;
    expect(limit).toBeLessThan(5000);
    expect(ids(cheaper).length).toBeGreaterThan(0);
    for (const item of cheaper.items) expect(item.product.finalPrice).toBeLessThanOrEqual(limit);
  });

  it("goes more expensive, within the same ceiling", async () => {
    const first = await ask("Show me headphones under 5000");
    const dearer = await ask("something more expensive", first.context);
    expect(dearer.kind).toBe("results");
    const floor = dearer.intent.minPrice as number;
    for (const item of dearer.items) {
      expect(item.product.finalPrice).toBeGreaterThanOrEqual(floor);
      expect(item.product.finalPrice).toBeLessThanOrEqual(5000);
    }
  });

  it("applies a colour on top of the existing intent", async () => {
    const first = await ask("Show me headphones under 5000");
    const blue = await ask("Only in blue", first.context);
    expect(blue.kind).toBe("results");
    expect(ids(blue)).toEqual([104]);
    expect(blue.items[0]?.reasons[0]).toBe("Available in Blue");
  });

  it("does not silently drop a colour nothing comes in: it says so and keeps the context", async () => {
    const first = await ask("Show me headphones under 5000");
    const none = await ask("only in red", first.context);
    expect(none.kind).toBe("no-results");
    expect(none.items).toEqual([]);
    expect(none.text).toMatch(/None of the headphones .* come in red/);
    expect(none.context).toEqual(first.context);
    expect(none.suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it("carries on from the kept context after a no-result answer", async () => {
    const first = await ask("Show me headphones under 5000");
    const none = await ask("only in red", first.context);
    const next = await ask("something cheaper", none.context);
    expect(next.kind).toBe("results");
  });
});

describe("similarity requests", () => {
  it("shows products like the referenced one, using the Similar Products strategy", async () => {
    const first = await ask("Show me headphones under 5000");
    const seedId = first.context.shownIds[1] as number;
    const similar = await ask("Show me more like the second one", first.context);

    expect(similar.kind).toBe("similar");
    expect(ids(similar)).not.toContain(seedId);
    expect(similar.items.length).toBeGreaterThan(0);
    expect(similar.text).toMatch(/like .* \(result 2\)/);
    expect(similar.filters[0]?.id).toBe("similar");
    expect(similar.items[0]?.reasons.join(" ")).toMatch(/Same category|Shares tags|Similar price/);
  });

  it("makes the similar results the new context, keeping the topic and budget in force", async () => {
    const first = await ask("Show me headphones under 5000");
    const similar = await ask("more like the first one", first.context);
    expect(similar.context.shownIds).toEqual(ids(similar));
    expect(similar.context.intent).toEqual({ category: "headphones", maxPrice: 5000 });
  });

  it("explains when there is nothing to refer to", async () => {
    const response = await ask("more like the second one");
    expect(response.kind).toBe("clarify");
    expect(response.text).toMatch(/haven't shown you any products yet/);
  });

  it("explains when the number is out of range", async () => {
    const first = await ask("Show me headphones under 5000");
    const response = await ask("more like the sixth one", first.context);
    expect(response.kind).toBe("clarify");
    expect(response.text).toMatch(/only showed 4 products/);
    expect(response.items).toEqual([]);
  });
});

describe("a change of topic", () => {
  it("'never mind, show me headphones instead' resets the topic and keeps the price band", async () => {
    const phones = await ask("Show me smartphones under 30000 with good ratings");
    const headphones = await ask("Never mind, show me headphones instead", phones.context);

    expect(headphones.intent).toEqual({ category: "headphones", maxPrice: 30000 });
    expect(headphones.text).toMatch(/kept your price range \(up to ₹30,000\)/);
    expect(headphones.filters.map((filter) => filter.label)).toEqual(["Category: Headphones", "Price: up to ₹30,000"]);
    expect(ids(headphones).every((id) => id >= 101)).toBe(true);
  });
});

describe("MOD-AI-003: unparseable input", () => {
  it("responds with a clarifying message and 2-3 suggested prompts, and no products", async () => {
    const response = await ask("hmm not sure");
    expect(response.kind).toBe("clarify");
    expect(response.items).toEqual([]);
    expect(response.totalMatches).toBe(0);
    expect(response.text).toMatch(/not sure what you're looking for/);
    expect(response.suggestions.length).toBeGreaterThanOrEqual(2);
    expect(response.suggestions.length).toBeLessThanOrEqual(3);
    expect(response.suggestions).toEqual([...STARTER_PROMPTS]);
  });

  it("leaves the conversation context untouched", async () => {
    const first = await ask("Show me headphones under 5000");
    const response = await ask("asdf qwerty", first.context);
    expect(response.context).toEqual(first.context);
  });

  it("asks which kind of product when only a price is given, with prompts that include it", async () => {
    const response = await ask("under 3000");
    expect(response.kind).toBe("clarify");
    expect(response.text).toMatch(/Which kind of product do you want up to ₹3,000/);
    expect(response.suggestions).toEqual(["Headphones up to ₹3,000", "Smartphones up to ₹3,000", "Shoes up to ₹3,000"]);
  });

  it("every suggested prompt can be understood by the assistant", async () => {
    for (const prompt of [...STARTER_PROMPTS, "Headphones up to ₹3,000"]) {
      expect((await ask(prompt)).kind).toBe("results");
    }
  });

  it("greets, helps and thanks without searching, and the help text says it is rule-based", async () => {
    expect((await ask("hello")).kind).toBe("help");
    const help = await ask("what can you do?");
    expect(help.kind).toBe("help");
    expect(help.text).toMatch(/rule-based, not a language model/);
    expect(help.items).toEqual([]);
    expect((await ask("thanks")).text).toMatch(/welcome/);
  });

  it("start over clears the context", async () => {
    const first = await ask("Show me headphones under 5000");
    const reset = await ask("start over", first.context);
    expect(reset.context).toEqual(EMPTY_CONTEXT);
  });
});

describe("when nothing matches", () => {
  it("explains and offers the cheapest price that exists", async () => {
    const response = await ask("headphones under 500");
    expect(response.kind).toBe("no-results");
    expect(response.items).toEqual([]);
    expect(response.text).toMatch(/couldn't find headphones priced up to ₹500\. The cheapest headphones I have cost ₹1,200/);
    expect(response.suggestions[0]).toBe("Show me headphones");
    expect(response.suggestions[1]).toBe("Headphones under ₹1,500");
  });

  it("says when a product type does not exist at all", async () => {
    const response = await ask("cars under 500");
    expect(response.kind).toBe("no-results");
    expect(response.text).toMatch(/couldn't find any vehicles/);
  });

  it("does not return unrelated products", async () => {
    const response = await ask("headphones above 90000");
    expect(response.items).toEqual([]);
  });
});

describe("personalisation", () => {
  it("lets the shopper's activity change the order, with a reason on the card", async () => {
    const raw = rawActivity(catalog, { viewed: [12, 13], wishlist: [13] });
    const cold = await ask("accessories", EMPTY_CONTEXT);
    const warm = await ask("mobile accessories", EMPTY_CONTEXT, raw);
    expect(warm.items.length).toBeGreaterThan(0);
    expect(cold.kind).not.toBe("results");
    expect(warm.items[0]?.reasons.length).toBeGreaterThan(0);
  });
});

describe("the assistant is an entry point to the recommendation service (PRD 7.3, 6.4)", () => {
  it("runs the structured filter through the recommendation provider", async () => {
    const requests: Array<{ strategy: string; filter?: unknown }> = [];
    const spy = createRecommendationService({
      id: "spy",
      async recommend(request) {
        requests.push({ strategy: request.strategy, filter: request.filter });
        return mockRecommendationEngine.recommend(request);
      },
    });
    const answer = await createMockAssistantProvider(spy).respond({ text: "headphones under 5000", context: EMPTY_CONTEXT, catalog, raw: EMPTY_RAW_SIGNALS });

    expect(answer.kind).toBe("results");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.strategy).toBe("assistant");
    expect(requests[0]?.filter).toMatchObject({ maxPrice: 5000, keywords: expect.arrayContaining(["headphone"]) });
  });

  it("is replaceable: the service answers with whatever provider it is given", async () => {
    const stand: AssistantResponse = { kind: "help", text: "from another provider", filters: [], items: [], totalMatches: 0, suggestions: [], context: EMPTY_CONTEXT, intent: {} };
    const other = createAssistantService({ id: "llm-stand-in", respond: async () => stand });
    expect(other.providerId).toBe("llm-stand-in");
    expect((await other.respond({ text: "hello", context: EMPTY_CONTEXT, catalog, raw: EMPTY_RAW_SIGNALS })).text).toBe("from another provider");
  });

  it("makes no network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await ask("Show me headphones under 5000");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("input handling", () => {
  it("collapses whitespace and cuts overlong input", () => {
    expect(sanitizeMessage("  show   me\n\tphones ")).toBe("show me phones");
    expect(sanitizeMessage("a".repeat(1000))).toHaveLength(MAX_MESSAGE_LENGTH);
  });

  it("an empty message is a clarification, not an error", async () => {
    expect((await ask("   ")).kind).toBe("clarify");
  });

  it("an extremely long message is handled", async () => {
    const response = await ask(`headphones under 5000 ${"please ".repeat(300)}`);
    expect(response.kind).toBe("results");
  });

  it("is deterministic: the same message and context always give the same answer", async () => {
    const first = await ask("Show me headphones under 5000");
    expect(await ask("Show me headphones under 5000")).toEqual(first);
  });
});
