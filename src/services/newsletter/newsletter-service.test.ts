import { NEWSLETTER_STORAGE_KEY, NewsletterError, isSubscribed, normalizeEmail, subscribeToNewsletter } from "./newsletter-service";

beforeEach(() => localStorage.clear());

describe("newsletter service (simulated)", () => {
  it("subscribes a valid address and remembers it, ignoring case and spacing", async () => {
    await expect(subscribeToNewsletter("  Uma@Example.com ", { delayMs: 0 })).resolves.toEqual({ status: "subscribed" });
    expect(JSON.parse(localStorage.getItem(NEWSLETTER_STORAGE_KEY)!)).toEqual(["uma@example.com"]);
    expect(isSubscribed("UMA@example.com")).toBe(true);
  });

  it("recognises a repeat signup without storing it twice", async () => {
    await subscribeToNewsletter("a@b.co", { delayMs: 0 });
    await expect(subscribeToNewsletter("A@B.co", { delayMs: 0 })).resolves.toEqual({ status: "already-subscribed" });
    expect(JSON.parse(localStorage.getItem(NEWSLETTER_STORAGE_KEY)!)).toHaveLength(1);
  });

  it("rejects an invalid address before doing any work", async () => {
    await expect(subscribeToNewsletter("not-an-email", { delayMs: 0 })).rejects.toMatchObject({ kind: "invalid" });
    await expect(subscribeToNewsletter("   ", { delayMs: 0 })).rejects.toBeInstanceOf(NewsletterError);
    expect(localStorage.getItem(NEWSLETTER_STORAGE_KEY)).toBeNull();
  });

  it("reports a storage failure instead of pretending it worked", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    await expect(subscribeToNewsletter("a@b.co", { delayMs: 0 })).rejects.toMatchObject({ kind: "storage" });
    spy.mockRestore();
  });

  it("recovers from corrupt stored data", async () => {
    localStorage.setItem(NEWSLETTER_STORAGE_KEY, "{oops");
    await expect(subscribeToNewsletter("a@b.co", { delayMs: 0 })).resolves.toEqual({ status: "subscribed" });
    expect(normalizeEmail(" X@Y.Z ")).toBe("x@y.z");
  });
});
