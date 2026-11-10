import { simulatePayment } from "./payment";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

const card = { method: "mock-card" as const, outcome: "approve" as const, acknowledged: true };

describe("simulatePayment", () => {
  it("approves an approved test payment with a TEST reference", async () => {
    const result = await simulatePayment(card, { delayMs: 0, random: () => 0.5 });
    expect(result).toEqual({ ok: true, reference: "TEST-50000000" });
  });

  it("declines a declined test payment with a clear, no-money-taken message", async () => {
    const result = await simulatePayment({ ...card, outcome: "decline" }, { delayMs: 0 });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("Mock Card");
    expect(result.ok === false && result.message).toContain("No money was taken");
  });

  it("declines a Mock UPI payment the same way", async () => {
    const result = await simulatePayment({ method: "mock-upi", outcome: "decline", acknowledged: true }, { delayMs: 0 });
    expect(result.ok === false && result.message).toContain("Mock UPI");
  });

  it("approves Cash on Delivery regardless of any leftover outcome", async () => {
    const result = await simulatePayment({ method: "mock-cod", outcome: "decline", acknowledged: true }, { delayMs: 0 });
    expect(result.ok).toBe(true);
  });

  it("fails safely when no method was chosen", async () => {
    const result = await simulatePayment({ method: null, outcome: null, acknowledged: true }, { delayMs: 0 });
    expect(result.ok).toBe(false);
  });

  it("never transmits anything: no network request is made (PRD 5.6)", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("{}");
    }) as typeof fetch;

    await simulatePayment(card, { delayMs: 0 });
    await simulatePayment({ ...card, outcome: "decline" }, { delayMs: 0 });

    expect(calls).toBe(0);
  });
});
