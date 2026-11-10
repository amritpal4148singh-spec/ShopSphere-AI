import { buildAssistantCatalog } from "@/test/assistant-catalog";
import { hasIntent, parseMessage } from "./parser";
import { buildTopics } from "./vocabulary";

const topics = buildTopics(buildAssistantCatalog());
const parse = (text: string) => parseMessage(text, topics);

describe("structured intent extraction (PRD 7.3)", () => {
  it("parses the PRD example: category, price ceiling and rating floor", () => {
    const parsed = parse("Show me smartphones under 30,000 rupees with good ratings");
    expect(parsed.topic?.id).toBe("smartphones");
    expect(parsed.maxPrice).toBe(30000);
    expect(parsed.minRating).toBe(4);
  });

  it("parses MOD-AI-001: category = headphones, maxPrice = 5000", () => {
    const parsed = parse("Show me headphones under 5000");
    expect(parsed.topic?.id).toBe("headphones");
    expect(parsed.maxPrice).toBe(5000);
    expect(parsed.minRating).toBeUndefined();
  });

  it("parses the ₹ sign and thousands separators", () => {
    expect(parse("headphones under ₹5,000").maxPrice).toBe(5000);
    expect(parse("laptops below Rs. 60,000").maxPrice).toBe(60000);
    expect(parse("laptops below INR 1,00,000").maxPrice).toBe(100000);
  });

  it("parses k and lakh suffixes", () => {
    expect(parse("phones under 30k").maxPrice).toBe(30000);
    expect(parse("laptops up to 1.5 lakh").maxPrice).toBe(150000);
  });

  it("parses ceilings, floors, ranges and approximate prices", () => {
    expect(parse("phones within 20000").maxPrice).toBe(20000);
    expect(parse("phones not more than 20000").maxPrice).toBe(20000);
    expect(parse("phones above 20000")).toMatchObject({ minPrice: 20000 });
    expect(parse("phones at least 20000").maxPrice).toBeUndefined();
    expect(parse("laptops between 40k and 80k")).toMatchObject({ minPrice: 40000, maxPrice: 80000 });
    expect(parse("laptops 80000 to 40000")).toMatchObject({ minPrice: 40000, maxPrice: 80000 });
    expect(parse("shoes above 2000 under 5000")).toMatchObject({ minPrice: 2000, maxPrice: 5000 });
    expect(parse("phones around 20000")).toMatchObject({ minPrice: 16000, maxPrice: 24000 });
  });

  it("treats a bare amount with a currency marker as a budget, and a bare number as nothing", () => {
    expect(parse("headphones 3000 rupees").maxPrice).toBe(3000);
    const model = parse("iphone 15");
    expect(model.maxPrice).toBeUndefined();
    expect(model.topic?.id).toBe("smartphones");
    expect(parse("iphone 15 under 50000").maxPrice).toBe(50000);
  });

  it("does not mistake a star rating for a price, or a price for a rating", () => {
    const parsed = parse("phones 4 stars and above under 30000");
    expect(parsed.minRating).toBe(4);
    expect(parsed.maxPrice).toBe(30000);
    expect(parse("phones rated 4.5").minRating).toBe(4.5);
    expect(parse("4 star phones")).toMatchObject({ minRating: 4 });
    expect(parse("phones rated 30000").minRating).toBeUndefined();
  });

  it("maps rating words to a floor", () => {
    expect(parse("phones with good ratings").minRating).toBe(4);
    expect(parse("highly rated phones").minRating).toBe(4);
    expect(parse("well reviewed laptops").minRating).toBe(4);
    expect(parse("top rated laptops").minRating).toBe(4.5);
    expect(parse("excellent ratings").minRating).toBe(4.5);
  });

  it("does not read 'top' in 'top rated' as the Tops category", () => {
    expect(parse("top rated laptops").topic?.id).toBe("laptops");
    expect(parse("top rated").topic).toBeNull();
  });
});

describe("topics", () => {
  it.each([
    ["Show me smartphones", "smartphones"],
    ["I want a phone", "smartphones"],
    ["mobiles under 10000", "smartphones"],
    ["notebooks", "laptops"],
    ["wireless earbuds", "headphones"],
    ["a bluetooth headset", "headphones"],
    ["running shoes", "shoes"],
    ["men's shoes", "mens-shoes"],
    ["shoes for women", "womens-shoes"],
    ["watches", "watches"],
    ["phone chargers", "mobile-accessories"],
    ["mobile accessories", "mobile-accessories"],
    ["perfume", "fragrances"],
    ["groceries", "groceries"],
  ])("recognises %s as %s", (text, id) => {
    expect(parse(text).topic?.id).toBe(id);
  });

  it("prefers the longest phrase: 'mobile accessories' is not 'mobile'", () => {
    expect(parse("mobile accessories under 1000").topic?.id).toBe("mobile-accessories");
  });

  it("recognises a catalogue category the assistant was never told about", () => {
    const custom = buildTopics([{ category: "garden-tools" }]);
    expect(parseMessage("garden tools under 500", custom).topic?.id).toBe("garden-tools");
  });

  it("tolerates a slip in a longer word", () => {
    expect(parse("headphnes under 5000").topic?.id).toBe("headphones");
    expect(parse("smartphnes").topic?.id).toBe("smartphones");
  });

  it("does not correct reserved words into topics", () => {
    expect(parse("something cheaper").topic).toBeNull();
    expect(parse("show me similar ones").topic).toBeNull();
  });

  it("skips a topic that is being left behind", () => {
    expect(parse("headphones instead of phones").topic?.id).toBe("headphones");
    expect(parse("anything but not phones").topic).toBeNull();
  });
});

describe("refinement phrases (PRD 7.4)", () => {
  it("parses a request for better ratings (MOD-AI-002)", () => {
    const parsed = parse("show me something with better ratings");
    expect(parsed.ratingStep).toBe(true);
    expect(parsed.minRating).toBeUndefined();
    expect(parsed.topic).toBeNull();
  });

  it.each(["something better rated", "higher rated ones", "with higher ratings"])("parses '%s' as a rating step", (text) => {
    expect(parse(text).ratingStep).toBe(true);
  });

  it.each(["Show me something cheaper", "a less expensive one", "more affordable options", "lower priced please"])("parses '%s' as cheaper", (text) => {
    expect(parse(text).priceStep).toBe("cheaper");
  });

  it.each(["something more expensive", "pricier ones", "premium options"])("parses '%s' as pricier", (text) => {
    expect(parse(text).priceStep).toBe("pricier");
  });

  it.each([
    ["Only in blue", "blue"],
    ["in black please", "black"],
    ["grey ones", "grey"],
    ["gray ones", "grey"],
    ["golden", "gold"],
  ])("parses '%s' as colour %s", (text, colour) => {
    expect(parse(text).colour).toBe(colour);
  });

  it.each([
    ["Show me more like the second one", { kind: "ordinal", index: 2 }],
    ["something similar to the first", { kind: "ordinal", index: 1 }],
    ["more like the 3rd one", { kind: "ordinal", index: 3 }],
    ["like number 4", { kind: "ordinal", index: 4 }],
    ["similar to #5", { kind: "ordinal", index: 5 }],
    ["more like the last one", { kind: "last" }],
    ["more like this", { kind: "this" }],
    ["similar to that one", { kind: "this" }],
  ])("parses '%s' as a similarity request", (text, reference) => {
    expect(parse(text).similar).toEqual(reference);
  });

  it("does not read 'I like' as a similarity request", () => {
    expect(parse("I like headphones").similar).toBeUndefined();
  });

  it("recognises a switch of topic (never mind ... instead)", () => {
    const parsed = parse("Never mind, show me headphones instead");
    expect(parsed.topic?.id).toBe("headphones");
    expect(parsed.switchMarker).toBe(true);
  });

  it("recognises a start over", () => {
    expect(parse("start over").reset).toBe(true);
  });
});

describe("input that carries no shopping intent (PRD MOD-AI-003)", () => {
  it.each(["hmm not sure", "asdf qwerty", "what's the weather like", "", "   ", "?????", "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"])("finds no intent in %j", (text) => {
    const parsed = parse(text);
    expect(hasIntent(parsed)).toBe(false);
    expect(parsed.talk).toBeUndefined();
  });

  it.each([
    ["hi", "greeting"],
    ["Hello there!", "greeting"],
    ["good morning", "greeting"],
    ["what can you do?", "help"],
    ["are you a real person", "help"],
    ["Thanks!", "thanks"],
  ])("treats %j as small talk (%s), not as a failure", (text, talk) => {
    expect(parse(text).talk).toBe(talk);
  });

  it("does not take 'help' as small talk when it comes with a request", () => {
    const parsed = parse("help me find headphones");
    expect(parsed.topic?.id).toBe("headphones");
    expect(parsed.talk).toBeUndefined();
  });

  it("copes with very long and odd input without throwing", () => {
    expect(() => parse("phones ".repeat(500))).not.toThrow();
    expect(() => parse("₹₹₹ 99999999999999999999 under under ,,, 4.4.4 stars")).not.toThrow();
    expect(parse("phones under 99999999999").maxPrice).toBeUndefined();
  });
});
