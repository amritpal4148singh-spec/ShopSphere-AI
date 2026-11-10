import { createRecommendationService, mockRecommendationEngine, EMPTY_RAW_SIGNALS } from "@/services/recommendations";
import { buildAssistantCatalog } from "@/test/assistant-catalog";
import { makeProduct } from "@/test/fixtures";
import { EMPTY_CONTEXT, type AssistantResponse, type ConversationContext } from "@/types/assistant";
import { createMockAssistantProvider } from "./mock-assistant";
import { createAssistantService } from "./service";

/**
 * Multi-turn regression tests for conversation context (PRD 7.2, 7.4). Each test plays a whole conversation and checks
 * what the assistant remembers after every turn.
 */
const laptop = (id: number, title: string, price: number, rating: number, extra = "") =>
  makeProduct({ id, title, category: "laptops", price, finalPrice: price, discountPercentage: 0, rating, brand: "Byte", tags: ["laptops"], description: `A laptop. ${extra}`.trim() });
const catalog = [
  ...buildAssistantCatalog(),
  laptop(301, "Office Laptop 14", 42000, 4.1),
  laptop(302, "Creator Laptop 15", 58000, 4.5),
  laptop(303, "Gaming Laptop Raptor", 55000, 4.4, "Built for gaming with a fast GPU."),
  laptop(304, "Flagship Laptop Max", 125000, 4.8),
];
const provider = createMockAssistantProvider(createRecommendationService(mockRecommendationEngine));
const service = createAssistantService(provider);

async function converse(turns: string[]): Promise<AssistantResponse[]> {
  let context: ConversationContext = EMPTY_CONTEXT;
  const replies: AssistantResponse[] = [];
  for (const text of turns) {
    const reply = await service.respond({ text, context, catalog, raw: EMPTY_RAW_SIGNALS });
    replies.push(reply);
    context = reply.context;
  }
  return replies;
}
const titles = (reply: AssistantResponse) => reply.items.map((item) => item.product.title);
const categories = (reply: AssistantResponse) => new Set(reply.items.map((item) => item.product.category));

describe("scenario 1: headphones, then 'more like the first one', then 'something cheaper'", () => {
  it("keeps the product type and budget through the whole conversation", async () => {
    const [first, similar, cheaper] = await converse(["I need headphones under ₹5,000", "More like the first one", "Something cheaper"]);

    expect(first!.intent).toEqual({ category: "headphones", maxPrice: 5000 });

    expect(similar!.kind).toBe("similar");
    expect(similar!.items.length).toBeGreaterThan(0);
    for (const item of similar!.items) {
      expect(item.product.tags).toContain("headphones");
      expect(item.product.finalPrice).toBeLessThanOrEqual(5000);
      expect(item.product.id).not.toBe(first!.items[0]!.product.id);
    }
    expect(similar!.context.intent).toEqual({ category: "headphones", maxPrice: 5000 });
    expect(similar!.filters.map((f) => f.id)).toEqual(expect.arrayContaining(["similar", "category", "price"]));

    expect(cheaper!.kind).toBe("results");
    expect(cheaper!.items.length).toBeGreaterThan(0);
    for (const item of cheaper!.items) {
      expect(item.product.tags).toContain("headphones");
      expect(item.product.finalPrice).toBeLessThan(5000);
    }
    expect(cheaper!.intent.maxPrice).toBeLessThan(5000);
    expect(titles(cheaper!).join(" ")).not.toMatch(/charger|cable|case/i);
  });

  it("applies the rating floor when asked after a similar turn", async () => {
    const replies = await converse(["Show me headphones under 5000", "more like the first one", "something with better ratings"]);
    const last = replies[2]!;
    expect(last.intent.category).toBe("headphones");
    expect(last.intent.maxPrice).toBe(5000);
    expect(last.intent.minRating).toBeGreaterThanOrEqual(4);
    for (const item of last.items) expect(item.product.rating).toBeGreaterThanOrEqual(4);
  });

  it("says so, and keeps the context, when nothing similar still fits the filters", async () => {
    const [first, , tight] = await converse(["Show me headphones under 1500", "more like the first one", "something cheaper"]);
    expect(first!.items.map((i) => i.product.id)).toEqual([101]);
    // Only one headphone fits the budget, so there is nothing similar: the reply explains and the filters survive.
    const replies = await converse(["Show me headphones under 1500", "more like the first one"]);
    expect(replies[1]!.kind).toBe("no-results");
    expect(replies[1]!.text).toMatch(/still fits your filters/);
    expect(replies[1]!.context.intent).toEqual({ category: "headphones", maxPrice: 1500 });
    expect(tight).toBeDefined();
  });
});

describe("'more like this' after a colour filter (existing e2e: assistant.spec.ts)", () => {
  it("still finds similar products: colour describes the seed, it does not limit the search", async () => {
    const [first, blue, similar] = await converse(["Show me headphones under 5000", "Show me headphones in blue", "Show me more like the first one"]);
    expect(first!.items.length).toBeGreaterThan(1);
    expect(blue!.items.length).toBeGreaterThan(0);
    expect(similar!.kind).toBe("similar");
    expect(similar!.items.length).toBeGreaterThan(0);
    for (const item of similar!.items) expect(item.product.tags).toContain("headphones");
    expect(similar!.context.intent).toMatchObject({ category: "headphones", maxPrice: 5000, colour: "blue" });
  });
});

describe("scenario 2: laptop, then budget, then 'only for gaming'", () => {
  it("keeps the laptop and budget and applies the gaming use-case where products match", async () => {
    const [first, budget, gaming] = await converse(["I need a laptop.", "Under ₹60,000.", "Only for gaming."]);

    expect(first!.intent.category).toBe("laptops");
    expect(budget!.intent).toEqual({ category: "laptops", maxPrice: 60000 });
    expect(titles(budget!)).not.toContain("Flagship Laptop Max");

    expect(gaming!.kind).toBe("results");
    expect(gaming!.intent).toEqual({ category: "laptops", maxPrice: 60000, useCase: "gaming" });
    expect(titles(gaming!)).toEqual(["Gaming Laptop Raptor"]);
    expect(gaming!.filters.map((f) => f.label)).toEqual(expect.arrayContaining(["Price: up to ₹60,000", "For: gaming"]));
    expect(gaming!.text).toMatch(/matched "gaming"/);
  });

  it("acknowledges an unsupported use-case instead of silently dropping the context", async () => {
    const replies = await converse(["I need a laptop", "under 60000", "only for travel"]);
    const travel = replies[2]!;

    expect(travel.kind).toBe("results");
    expect(travel.text).toMatch(/can't filter by use case/);
    expect(travel.text).toContain('"travel"');
    expect(categories(travel)).toEqual(new Set(["laptops"]));
    for (const item of travel.items) expect(item.product.finalPrice).toBeLessThanOrEqual(60000);
    // The use-case is not left in force, so the next turn is not stuck on it.
    expect(travel.context.intent).toEqual({ category: "laptops", maxPrice: 60000 });
  });

  it("asks for a product type when a use-case arrives with no topic in the conversation", async () => {
    const [reply] = await converse(["only for gaming"]);
    expect(reply!.kind).toBe("clarify");
  });

  it("still lets the shopper refine afterwards", async () => {
    const replies = await converse(["laptops", "under 60000", "only for gaming", "something cheaper"]);
    const last = replies[3]!;
    expect(last.intent.category).toBe("laptops");
    expect(last.intent.maxPrice).toBeLessThan(60000);
  });
});

describe("scenario 3: a change of topic", () => {
  it("recognises 'never mind, show me smartphones' as a new topic and drops headphone-only filters", async () => {
    const [, , switched] = await converse(["Headphones under ₹5,000", "something with better ratings", "Never mind, show me smartphones"]);

    expect(switched!.intent.category).toBe("smartphones");
    expect(switched!.intent.minRating).toBeUndefined();
    expect(switched!.intent.sort).toBeUndefined();
    expect(switched!.intent.useCase).toBeUndefined();
    for (const item of switched!.items) expect(item.product.category).toBe("smartphones");
  });

  it("keeps only the general price preference when it still fits, and says so", async () => {
    const [, switched] = await converse(["Laptops under ₹60,000", "never mind, show me headphones instead"]);
    expect(switched!.intent).toEqual({ category: "headphones", maxPrice: 60000 });
    expect(switched!.text).toMatch(/kept your price range/);
  });

  it("drops a carried price range that leaves nothing, and explains, instead of answering 'no results'", async () => {
    const [, switched] = await converse(["Headphones under ₹5,000", "never mind, show me laptops instead"]);
    expect(switched!.kind).toBe("results");
    expect(switched!.intent).toEqual({ category: "laptops" });
    expect(switched!.text).toMatch(/dropped that price range/);
    expect(switched!.items.length).toBeGreaterThan(0);
  });

  it("starts fresh when the new topic has its own budget", async () => {
    const [, switched] = await converse(["Headphones under ₹5,000", "show me laptops under 60000"]);
    expect(switched!.intent).toEqual({ category: "laptops", maxPrice: 60000 });
  });

  it("does not treat a use-case word in a new-topic message as a use-case filter", async () => {
    const [, switched] = await converse(["laptops under 60000", "headphones for running"]);
    expect(switched!.intent.category).toBe("headphones");
    expect(switched!.intent.useCase).toBeUndefined();
  });
});

describe("reference resolution", () => {
  it("resolves 'the second one', 'the last one' and 'more like this' against what was shown", async () => {
    const [first, second] = await converse(["laptops under 60000", "more like the second one"]);
    const shown = first!.items.map((item) => item.product.id);
    expect(second!.kind).toBe("similar");
    expect(second!.filters[0]!.label).toContain(first!.items[1]!.product.title);
    expect(shown.length).toBeGreaterThan(1);
    const [, last] = await converse(["laptops under 60000", "more like the last one"]);
    expect(last!.filters[0]!.label).toContain(first!.items[first!.items.length - 1]!.product.title);
  });

  it("asks which one when 'this' is ambiguous", async () => {
    const [, ambiguous] = await converse(["laptops", "more like this"]);
    expect(ambiguous!.kind).toBe("clarify");
  });
});
