import { estimateDelivery, formatDeliveryDate, getTransitDays, isValidPincode, parseHandlingDays } from "./delivery";

describe("isValidPincode", () => {
  it("accepts six digits not starting with zero", () => {
    expect(isValidPincode("110001")).toBe(true);
    expect(isValidPincode(" 560001 ")).toBe(true);
  });

  it("rejects everything else", () => {
    for (const value of ["", "11000", "1100011", "012345", "abcdef", "11 0001", "11000a"]) {
      expect(isValidPincode(value)).toBe(false);
    }
  });
});

describe("parseHandlingDays", () => {
  it("reads the data source's shipping text", () => {
    expect(parseHandlingDays("Ships in 1-2 business days")).toBe(2);
    expect(parseHandlingDays("Ships in 3-5 business days")).toBe(5);
    expect(parseHandlingDays("Ships in 1 week")).toBe(7);
    expect(parseHandlingDays("Ships in 1 month")).toBe(30);
    expect(parseHandlingDays("Ships overnight")).toBe(1);
  });

  it("defaults to two days when the text is missing or unreadable", () => {
    expect(parseHandlingDays(null)).toBe(2);
    expect(parseHandlingDays("Ships when ready")).toBe(2);
  });
});

describe("getTransitDays", () => {
  it("derives a transit time from the first PIN digit", () => {
    expect(getTransitDays("110001")).toBe(2);
    expect(getTransitDays("310001")).toBe(4);
    expect(getTransitDays("410001")).toBe(1);
  });
});

describe("estimateDelivery", () => {
  const now = new Date(2026, 9, 14);

  it("adds handling and transit days, with a two-day window", () => {
    const estimate = estimateDelivery("110001", "Ships in 1-2 business days", now);
    expect(estimate).not.toBeNull();
    expect(estimate?.earliest.getDate()).toBe(18);
    expect(estimate?.latest.getDate()).toBe(20);
    expect(estimate?.earliest.getMonth()).toBe(9);
  });

  it("rolls over month ends", () => {
    const estimate = estimateDelivery("110001", "Ships in 1-2 business days", new Date(2026, 9, 29));
    expect(estimate?.earliest.getMonth()).toBe(10);
    expect(estimate?.earliest.getDate()).toBe(2);
  });

  it("returns null for an invalid PIN code and does not change the input date", () => {
    expect(estimateDelivery("123", null, now)).toBeNull();
    expect(now.getDate()).toBe(14);
  });
});

describe("formatDeliveryDate", () => {
  it("formats as a short weekday, day and month", () => {
    const text = formatDeliveryDate(new Date(2026, 9, 18));
    expect(text).toContain("18");
    expect(text).toContain("Oct");
    expect(text).toContain("Sun");
  });
});
