import { findSimilarTerms, levenshtein, stemWord, titleCase, tokenizeWords } from "./text";

describe("titleCase", () => {
  it("turns slugs into readable names", () => {
    expect(titleCase("mens-shoes")).toBe("Mens Shoes");
    expect(titleCase("home_decoration")).toBe("Home Decoration");
    expect(titleCase("laptops")).toBe("Laptops");
  });
});

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("findSimilarTerms", () => {
  const vocabulary = ["Smartphones", "Laptops", "Sunglasses", "Mens Shoes", "Womens Shoes"];

  it("corrects a misspelling", () => {
    expect(findSimilarTerms("smartphnes", vocabulary)).toEqual(["Smartphones"]);
    expect(findSimilarTerms("laptp", vocabulary)).toEqual(["Laptops"]);
  });

  it("matches terms that contain the input and individual words", () => {
    expect(findSimilarTerms("phones", vocabulary)).toEqual(["Smartphones"]);
    expect(findSimilarTerms("shoes", vocabulary)).toEqual(["Mens Shoes", "Womens Shoes"]);
  });

  it("returns nothing for unrelated, empty, or too-short input", () => {
    expect(findSimilarTerms("zzzzzz", vocabulary)).toEqual([]);
    expect(findSimilarTerms("", vocabulary)).toEqual([]);
    expect(findSimilarTerms("a", vocabulary)).toEqual([]);
  });

  it("never suggests the exact term and respects the limit", () => {
    expect(findSimilarTerms("laptops", vocabulary)).toEqual([]);
    expect(findSimilarTerms("shoes", vocabulary, 1)).toHaveLength(1);
  });
});

describe("stemWord and tokenizeWords", () => {
  it("treats plurals and singulars alike", () => {
    expect(stemWord("headphones")).toBe(stemWord("headphone"));
    expect(stemWord("watches")).toBe("watch");
    expect(stemWord("glasses")).toBe("glass");
    expect(stemWord("accessories")).toBe(stemWord("accessory"));
    expect(stemWord("shoes")).toBe(stemWord("shoe"));
    expect(stemWord("dress")).toBe("dress");
    expect(stemWord("bus")).toBe("bus");
  });

  it("drops apostrophes so men's and mens match", () => {
    expect(tokenizeWords("Men's Shoes")).toEqual(tokenizeWords("mens shoes"));
    expect(tokenizeWords("Men's Shoes")).toEqual(["men", "shoe"]);
  });
});
