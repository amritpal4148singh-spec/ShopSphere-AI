import { COUPONS, evaluateCoupon, normalizeCouponCode } from "./coupons";

const now = new Date("2026-10-15T00:00:00.000Z");

describe("evaluateCoupon", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeCouponCode("  save10 ")).toBe("SAVE10");
    expect(evaluateCoupon(" save10 ", 1000, now).ok).toBe(true);
  });

  it("rejects an empty code and an unknown code with a clear message", () => {
    expect(evaluateCoupon("   ", 1000, now)).toMatchObject({ ok: false, reason: "empty", message: "Enter a coupon code." });
    expect(evaluateCoupon("NOPE", 1000, now)).toMatchObject({ ok: false, reason: "not-found" });
    const result = evaluateCoupon("nope", 1000, now);
    expect(result.ok === false && result.message).toBe('"NOPE" is not a valid coupon code.');
  });

  it("applies a percentage discount, rounded down and capped", () => {
    const small = evaluateCoupon("SAVE10", 999, now);
    expect(small.ok && small.discount).toBe(99);

    const large = evaluateCoupon("SAVE10", 50000, now);
    expect(large.ok && large.discount).toBe(1000);
  });

  it("applies a flat discount, never more than the subtotal", () => {
    const result = evaluateCoupon("WELCOME200", 1500, now);
    expect(result.ok && result.discount).toBe(200);
  });

  it("requires the minimum subtotal and says how much more is needed", () => {
    const result = evaluateCoupon("SAVE10", 400, now);
    expect(result).toMatchObject({ ok: false, reason: "min-subtotal" });
    expect(result.ok === false && result.message).toContain("₹500");
    expect(result.ok === false && result.message).toContain("Add ₹100 more");

    expect(evaluateCoupon("WELCOME200", 1499, now)).toMatchObject({ ok: false, reason: "min-subtotal" });
  });

  it("offers a free-shipping code with no money discount", () => {
    const result = evaluateCoupon("FREESHIP", 10, now);
    expect(result.ok && result.freeShipping).toBe(true);
    expect(result.ok && result.discount).toBe(0);
  });

  it("reports an expired code with its expiry date, and accepts it before that date", () => {
    const expired = evaluateCoupon("SUMMER25", 1000, now);
    expect(expired).toMatchObject({ ok: false, reason: "expired" });
    expect(expired.ok === false && expired.message).toContain("2024");

    const valid = evaluateCoupon("SUMMER25", 1000, new Date("2024-01-01T00:00:00.000Z"));
    expect(valid.ok && valid.discount).toBe(250);
  });

  it("only offers codes that are documented", () => {
    expect(COUPONS.map((coupon) => coupon.code)).toEqual(["SAVE10", "WELCOME200", "FREESHIP", "SUMMER25"]);
  });
});
