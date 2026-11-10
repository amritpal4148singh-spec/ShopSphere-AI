import { buildAssistantCatalog } from "@/test/assistant-catalog";
import { parseMessage } from "./parser";
import { planTurn, type Plan } from "./plan";
import { buildTopics } from "./vocabulary";
import { EMPTY_CONTEXT, type ConversationContext } from "@/types/assistant";

const catalog = buildAssistantCatalog();
const topics = buildTopics(catalog);
const plan = (text: string, context: ConversationContext = EMPTY_CONTEXT): Plan => planTurn(parseMessage(text, topics), context, catalog);
const search = (text: string, context?: ConversationContext) => {
  const result = plan(text, context);
  if (result.type !== "search") throw new Error(`expected a search, got ${JSON.stringify(result)}`);
  return result;
};

/** The assistant has just shown headphones up to 5,000: ids 101, 102, 104, 103 (prices 1200, 2500, 3900, 4800). */
const afterHeadphones: ConversationContext = { intent: { category: "headphones", maxPrice: 5000 }, shownIds: [101, 102, 104, 103] };

describe("a first message", () => {
  it("becomes a structured intent", () => {
    expect(search("headphones under 5000").intent).toEqual({ category: "headphones", maxPrice: 5000 });
    expect(search("smartphones under 30000 with good ratings").intent).toEqual({ category: "smartphones", maxPrice: 30000, minRating: 4 });
  });

  it("asks which product when it only has constraints", () => {
    expect(plan("under 3000")).toEqual({ type: "clarify", reason: "missing-topic", detail: { priceText: "up to ₹3,000" } });
  });

  it("clarifies nonsense (MOD-AI-003)", () => {
    expect(plan("hmm not sure")).toEqual({ type: "clarify", reason: "unrecognized" });
  });

  it("does not run a relative request with nothing shown", () => {
    expect(plan("something cheaper")).toMatchObject({ type: "clarify", reason: "missing-topic" });
    expect(plan("something cheaper", { intent: { category: "headphones" }, shownIds: [] })).toMatchObject({ type: "clarify", reason: "nothing-shown" });
  });
});

describe("refinement in context (MOD-AI-002)", () => {
  it("keeps the category and the price ceiling, and raises the rating threshold", () => {
    const refined = search("show me something with better ratings", afterHeadphones);
    expect(refined.intent).toMatchObject({ category: "headphones", maxPrice: 5000, minRating: 4, sort: "rating" });
    expect(refined.step).toBe("better-rated");
    expect(refined.notes.join(" ")).toMatch(/raised the minimum rating to 4 stars/);
  });

  it("raises the threshold again on a second request, up to a cap", () => {
    const first = search("better ratings", afterHeadphones);
    const second = search("better ratings", { ...afterHeadphones, intent: first.intent });
    const third = search("better ratings", { ...afterHeadphones, intent: second.intent });
    const fourth = search("better ratings", { ...afterHeadphones, intent: third.intent });
    expect([first, second, third, fourth].map((p) => p.intent.minRating)).toEqual([4, 4.5, 4.8, 4.8]);
    expect(fourth.notes.join(" ")).toMatch(/already 4.8 stars/);
  });

  it("lowers the price limit to the middle of what was shown for 'cheaper'", () => {
    const refined = search("show me something cheaper", afterHeadphones);
    // Prices shown: 1200, 2500, 3900, 4800. Median 3200; 85% of the highest is 4080. The lower of the two wins.
    expect(refined.intent).toMatchObject({ category: "headphones", maxPrice: 3200 });
    expect(refined.step).toBe("cheaper");
  });

  it("drops the price by at least 15% when everything shown costs the same", () => {
    const flat: ConversationContext = { intent: { category: "headphones" }, shownIds: [101] };
    expect(search("cheaper", flat).intent.maxPrice).toBe(1020);
  });

  it("sets a price floor in the middle of what was shown for 'more expensive'", () => {
    const refined = search("something more expensive", afterHeadphones);
    expect(refined.intent).toMatchObject({ category: "headphones", maxPrice: 5000, minPrice: 3200 });
    expect(refined.step).toBe("pricier");
  });

  it("an explicit price replaces the old one, and a clashing bound is dropped", () => {
    expect(search("under 3000", afterHeadphones).intent).toEqual({ category: "headphones", maxPrice: 3000 });
    const floor = search("above 6000", afterHeadphones);
    expect(floor.intent).toEqual({ category: "headphones", minPrice: 6000 });
  });

  it("adds a colour on top of the existing intent", () => {
    expect(search("only in blue", afterHeadphones).intent).toEqual({ category: "headphones", maxPrice: 5000, colour: "blue" });
  });

  it("the same product type again refines instead of starting over", () => {
    expect(search("headphones in blue", afterHeadphones).intent).toEqual({ category: "headphones", maxPrice: 5000, colour: "blue" });
  });

  it("answers 'with better ratings' for a product type named in the same message", () => {
    expect(search("headphones with better ratings", afterHeadphones).intent).toMatchObject({ minRating: 4, maxPrice: 5000 });
  });
});

describe("a change of topic (PRD 7.4)", () => {
  const afterPhones: ConversationContext = { intent: { category: "smartphones", maxPrice: 30000, minRating: 4, colour: "blue" }, shownIds: [10] };

  it("'never mind ... instead' resets the topic filters but keeps the price band", () => {
    const changed = search("Never mind, show me headphones instead", afterPhones);
    expect(changed.intent).toEqual({ category: "headphones", maxPrice: 30000 });
    expect(changed.topicChanged).toBe(true);
    expect(changed.notes.join(" ")).toMatch(/kept your price range \(up to ₹30,000\)/);
  });

  it("keeps a price band that has both ends", () => {
    const banded: ConversationContext = { intent: { category: "smartphones", minPrice: 1000, maxPrice: 3000 }, shownIds: [] };
    expect(search("actually show me laptops", banded).intent).toEqual({ category: "laptops", minPrice: 1000, maxPrice: 3000 });
  });

  it("uses the new price when the message gives one", () => {
    expect(search("never mind, headphones under 2000 instead", afterPhones).intent).toEqual({ category: "headphones", maxPrice: 2000 });
  });

  it("a plain new request for another product type starts fresh", () => {
    expect(search("show me laptops", afterPhones).intent).toEqual({ category: "laptops" });
  });

  it("does not apply a relative request to a different topic", () => {
    expect(search("cheaper laptops", afterPhones).intent).toEqual({ category: "laptops" });
  });
});

describe("similarity requests (PRD 7.4)", () => {
  it("uses the referenced product as the seed", () => {
    const result = plan("Show me more like the second one", afterHeadphones);
    expect(result).toMatchObject({ type: "similar", position: 2 });
    expect(result.type === "similar" && result.seed.id).toBe(102);
  });

  it("understands 'the last one' and 'this one' when only one product was shown", () => {
    expect(plan("more like the last one", afterHeadphones)).toMatchObject({ type: "similar", position: 4 });
    expect(plan("more like this", { ...afterHeadphones, shownIds: [101] })).toMatchObject({ type: "similar", position: 1 });
  });

  it("asks which one when 'this one' is ambiguous", () => {
    expect(plan("more like this", afterHeadphones)).toMatchObject({ type: "clarify", reason: "which-one" });
  });

  it("explains when the number is beyond what was shown", () => {
    expect(plan("more like the fifth one", afterHeadphones)).toMatchObject({ type: "clarify", reason: "ordinal-out-of-range", detail: { shown: 4, asked: 5 } });
  });

  it("clarifies when nothing was shown", () => {
    expect(plan("more like the first one")).toMatchObject({ type: "clarify", reason: "nothing-shown" });
  });

  it("clarifies when the product is no longer in the catalogue", () => {
    expect(plan("more like the first one", { intent: {}, shownIds: [99999] })).toMatchObject({ type: "clarify", reason: "product-gone" });
  });
});

describe("small talk and reset", () => {
  it("answers a greeting, help and thanks without searching", () => {
    expect(plan("hi")).toEqual({ type: "talk", talk: "greeting" });
    expect(plan("what can you do")).toEqual({ type: "talk", talk: "help" });
    expect(plan("thanks")).toEqual({ type: "talk", talk: "thanks" });
  });

  it("start over resets", () => {
    expect(plan("start over", afterHeadphones)).toEqual({ type: "talk", talk: "reset" });
  });
});
