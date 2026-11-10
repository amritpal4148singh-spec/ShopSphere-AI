import type { CartItem, CartSnapshot, NewCartItem } from "@/types/cart";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  addToCart,
  buildCartLines,
  computeTotals,
  confirmPrice,
  getCheckoutBlockers,
  getItemCount,
  getSubtotal,
  makeItemKey,
  mergeSnapshots,
  moveToCart,
  reconcileSnapshot,
  removeItem,
  removeSavedItem,
  saveForLater,
  setCoupon,
  setQuantity,
} from "./cart";

const empty: CartSnapshot = { items: [], saved: [], couponCode: null };

function input(overrides: Partial<NewCartItem> = {}): NewCartItem {
  return {
    productId: 1,
    variantId: "size-8",
    variantLabel: "Size: 8",
    quantity: 1,
    title: "Trail Runner",
    brand: "Nike",
    category: "mens-shoes",
    thumbnail: null,
    unitPrice: 1000,
    knownStock: 10,
    ...overrides,
  };
}

function line(overrides: Partial<CartItem> = {}): CartItem {
  return { ...input(), key: makeItemKey(1, "size-8"), addedAt: 1, ...overrides };
}

describe("makeItemKey", () => {
  it("combines product and variant", () => {
    expect(makeItemKey(7, "size-8")).toBe("7:size-8");
    expect(makeItemKey(7, null)).toBe("7:-");
  });
});

describe("addToCart", () => {
  it("adds a new line", () => {
    const { snapshot, outcome } = addToCart(empty, input({ quantity: 2 }), 5);
    expect(outcome).toEqual({ type: "added", quantity: 2 });
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]).toMatchObject({ key: "1:size-8", quantity: 2, addedAt: 5 });
  });

  it("increments the existing line instead of creating a duplicate row (PRD edge case 8)", () => {
    const first = addToCart(empty, input({ quantity: 2 })).snapshot;
    const second = addToCart(first, input({ quantity: 3 }));

    expect(second.snapshot.items).toHaveLength(1);
    expect(second.snapshot.items[0]?.quantity).toBe(5);
    expect(second.outcome).toEqual({ type: "incremented", quantity: 5 });
  });

  it("keeps different variants of the same product as separate lines", () => {
    const first = addToCart(empty, input()).snapshot;
    const second = addToCart(first, input({ variantId: "size-9", variantLabel: "Size: 9" })).snapshot;
    expect(second.items.map((item) => item.key)).toEqual(["1:size-8", "1:size-9"]);
  });

  it("limits a new line to the available stock and says so", () => {
    const { snapshot, outcome } = addToCart(empty, input({ quantity: 8, knownStock: 3 }));
    expect(snapshot.items[0]?.quantity).toBe(3);
    expect(outcome).toEqual({ type: "limited", quantity: 3, limit: 3 });
  });

  it("limits an increment to the available stock", () => {
    const first = addToCart(empty, input({ quantity: 2, knownStock: 3 })).snapshot;
    const second = addToCart(first, input({ quantity: 2, knownStock: 3 }));
    expect(second.snapshot.items[0]?.quantity).toBe(3);
    expect(second.outcome).toEqual({ type: "limited", quantity: 3, limit: 3 });
  });

  it("refuses an out-of-stock item and leaves the cart untouched", () => {
    const { snapshot, outcome } = addToCart(empty, input({ knownStock: 0 }));
    expect(outcome).toEqual({ type: "out-of-stock" });
    expect(snapshot).toBe(empty);
  });

  it("does not mutate the input snapshot", () => {
    const frozen: CartSnapshot = { items: [line()], saved: [], couponCode: null };
    addToCart(frozen, input());
    expect(frozen.items[0]?.quantity).toBe(1);
  });
});

describe("setQuantity (PRD MOD-05-001)", () => {
  const stocked: CartSnapshot = { ...empty, items: [line({ quantity: 1, knownStock: 3 })] };

  it("clamps a quantity above the stock, reports it, and the subtotal reflects the corrected quantity", () => {
    const { snapshot, outcome } = setQuantity(stocked, "1:size-8", 5, 3);

    expect(outcome).toEqual({ quantity: 3, limit: 3, clamped: true, requested: 5 });
    expect(snapshot.items[0]?.quantity).toBe(3);

    const lines = buildCartLines(snapshot.items, () => ({ stock: 3, price: 1000 }), true);
    expect(getSubtotal(lines)).toBe(3000);
  });

  it("accepts a quantity within the stock without flagging it", () => {
    const { snapshot, outcome } = setQuantity(stocked, "1:size-8", 2, 3);
    expect(outcome?.clamped).toBe(false);
    expect(snapshot.items[0]?.quantity).toBe(2);
  });

  it("never goes below one", () => {
    const { snapshot, outcome } = setQuantity(stocked, "1:size-8", 0, 3);
    expect(snapshot.items[0]?.quantity).toBe(1);
    expect(outcome?.clamped).toBe(true);
  });

  it("does nothing for a missing line", () => {
    const result = setQuantity(stocked, "9:none", 2, 3);
    expect(result.outcome).toBeNull();
    expect(result.snapshot).toBe(stocked);
  });

  it("keeps the line unchanged when there is no stock", () => {
    const result = setQuantity(stocked, "1:size-8", 2, 0);
    expect(result.snapshot).toBe(stocked);
    expect(result.outcome).toMatchObject({ limit: 0, clamped: true });
  });
});

describe("remove, save for later and move to cart", () => {
  const cart: CartSnapshot = { items: [line({ quantity: 2 })], saved: [], couponCode: null };

  it("removes lines", () => {
    expect(removeItem(cart, "1:size-8").items).toEqual([]);
    expect(removeSavedItem({ ...empty, saved: [line()] }, "1:size-8").saved).toEqual([]);
  });

  it("moves a line to saved without deleting it", () => {
    const next = saveForLater(cart, "1:size-8");
    expect(next.items).toEqual([]);
    expect(next.saved).toHaveLength(1);
    expect(next.saved[0]?.quantity).toBe(2);
  });

  it("merges into an existing saved line", () => {
    const withSaved: CartSnapshot = { ...cart, saved: [line({ quantity: 1 })] };
    const next = saveForLater(withSaved, "1:size-8");
    expect(next.saved).toHaveLength(1);
    expect(next.saved[0]?.quantity).toBe(3);
  });

  it("ignores saving a line that is not in the cart", () => {
    expect(saveForLater(cart, "9:none")).toBe(cart);
  });

  it("moves a saved line back to the cart", () => {
    const saved: CartSnapshot = { ...empty, saved: [line({ quantity: 2 })] };
    const { snapshot, outcome } = moveToCart(saved, "1:size-8", 10);
    expect(outcome).toEqual({ type: "moved", quantity: 2 });
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.saved).toEqual([]);
  });

  it("will not move an out-of-stock saved line, and keeps it saved", () => {
    const saved: CartSnapshot = { ...empty, saved: [line()] };
    const result = moveToCart(saved, "1:size-8", 0);
    expect(result.outcome).toEqual({ type: "out-of-stock" });
    expect(result.snapshot).toBe(saved);
  });

  it("limits the moved quantity to the stock", () => {
    const saved: CartSnapshot = { ...empty, saved: [line({ quantity: 5 })] };
    const { snapshot, outcome } = moveToCart(saved, "1:size-8", 2);
    expect(outcome).toEqual({ type: "limited", quantity: 2, limit: 2 });
    expect(snapshot.items[0]?.quantity).toBe(2);
  });

  it("merges into an existing cart line instead of duplicating it", () => {
    const both: CartSnapshot = { items: [line({ quantity: 2 })], saved: [line({ quantity: 1 })], couponCode: null };
    const { snapshot } = moveToCart(both, "1:size-8", 10);
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]?.quantity).toBe(3);
  });

  it("reports a missing saved line", () => {
    expect(moveToCart(empty, "1:size-8", 5).outcome).toEqual({ type: "missing" });
  });
});

describe("coupon, price confirmation and merging", () => {
  it("stores and clears the coupon code", () => {
    expect(setCoupon(empty, "SAVE10").couponCode).toBe("SAVE10");
    expect(setCoupon({ ...empty, couponCode: "SAVE10" }, null).couponCode).toBeNull();
  });

  it("accepts a new unit price for a line", () => {
    const next = confirmPrice({ ...empty, items: [line({ unitPrice: 1000 })] }, "1:size-8", 1200);
    expect(next.items[0]?.unitPrice).toBe(1200);
  });

  it("merges two carts: quantities add up, capped by known stock, coupon preferring the base", () => {
    const base: CartSnapshot = { items: [line({ quantity: 2, knownStock: 3 })], saved: [], couponCode: "SAVE10" };
    const incoming: CartSnapshot = {
      items: [line({ quantity: 2, knownStock: 3 }), line({ key: "2:-", productId: 2, variantId: null, quantity: 1 })],
      saved: [line({ key: "3:-", productId: 3, variantId: null })],
      couponCode: "FREESHIP",
    };
    const merged = mergeSnapshots(base, incoming);

    expect(merged.items.map((item) => [item.key, item.quantity])).toEqual([
      ["1:size-8", 3],
      ["2:-", 1],
    ]);
    expect(merged.saved).toHaveLength(1);
    expect(merged.couponCode).toBe("SAVE10");
    expect(mergeSnapshots({ ...empty }, incoming).couponCode).toBe("FREESHIP");
  });
});

describe("reconcileSnapshot", () => {
  const cart: CartSnapshot = { items: [line({ quantity: 5, knownStock: 10, unitPrice: 1000 })], saved: [line({ key: "2:-", productId: 2, variantId: null, knownStock: 4 })], couponCode: null };

  it("reduces a quantity above the live stock and says so (never silently)", () => {
    const result = reconcileSnapshot(cart, (item) => (item.productId === 1 ? { stock: 3, price: 1000 } : null));
    expect(result.changed).toBe(true);
    expect(result.snapshot.items[0]).toMatchObject({ quantity: 3, knownStock: 3 });
    expect(result.notices["1:size-8"]).toContain("reduced to 3");
  });

  it("refreshes last-known stock without touching the confirmed price", () => {
    const result = reconcileSnapshot(cart, () => ({ stock: 20, price: 1500 }));
    expect(result.snapshot.items[0]).toMatchObject({ knownStock: 20, unitPrice: 1000, quantity: 5 });
    expect(result.notices).toEqual({});
  });

  it("keeps the quantity of an out-of-stock line so it can be restored later", () => {
    const result = reconcileSnapshot(cart, () => ({ stock: 0, price: 1000 }));
    expect(result.snapshot.items[0]).toMatchObject({ quantity: 5, knownStock: 0 });
    expect(Object.keys(result.notices)).toHaveLength(0);
  });

  it("updates saved lines' known stock", () => {
    const result = reconcileSnapshot(cart, (item) => (item.productId === 2 ? { stock: 9, price: 10 } : null));
    expect(result.snapshot.saved[0]?.knownStock).toBe(9);
  });

  it("returns the same snapshot when nothing changed or nothing is known", () => {
    const same = reconcileSnapshot(cart, (item) => ({ stock: item.knownStock, price: item.unitPrice }));
    expect(same.changed).toBe(false);
    expect(same.snapshot).toBe(cart);

    const unknown = reconcileSnapshot(cart, () => null);
    expect(unknown.changed).toBe(false);
  });
});

describe("buildCartLines", () => {
  const item = line({ quantity: 2, unitPrice: 1000, knownStock: 5 });

  it("marks a healthy line ok with its total", () => {
    const [built] = buildCartLines([item], () => ({ stock: 5, price: 1000 }), true);
    expect(built).toMatchObject({ status: "ok", quantity: 2, lineTotal: 2000, priceChange: null, stale: false });
  });

  it("flags an out-of-stock line in place (PRD 5.5)", () => {
    const [built] = buildCartLines([item], () => ({ stock: 0, price: 1000 }), true);
    expect(built).toMatchObject({ status: "out-of-stock", lineTotal: 0, quantity: 2 });
  });

  it("flags a product the API no longer returns as unavailable, not dropped (PRD 5.5)", () => {
    const built = buildCartLines([item], () => null, true);
    expect(built).toHaveLength(1);
    expect(built[0]?.status).toBe("unavailable");
  });

  it("shows old and new price when the price changed, and uses the new price", () => {
    const [built] = buildCartLines([item], () => ({ stock: 5, price: 1200 }), true);
    expect(built?.priceChange).toEqual({ from: 1000, to: 1200 });
    expect(built?.unitPrice).toBe(1200);
    expect(built?.lineTotal).toBe(2400);
  });

  it("shows the quantity the stock allows when stock fell below it", () => {
    const [built] = buildCartLines([item], () => ({ stock: 1, price: 1000 }), true);
    expect(built).toMatchObject({ quantity: 1, lineTotal: 1000 });
  });

  it("falls back to last-known data, marked stale, when live data is unavailable (PRD 5.5)", () => {
    const [built] = buildCartLines([item], null, false);
    expect(built).toMatchObject({ status: "ok", stale: true, unitPrice: 1000, availableStock: 5, lineTotal: 2000 });
  });

  it("treats a stale line with no known stock as out of stock", () => {
    const [built] = buildCartLines([{ ...item, knownStock: 0 }], null, false);
    expect(built?.status).toBe("out-of-stock");
  });
});

describe("subtotal, count and checkout blockers", () => {
  const items = [
    line({ key: "1:-", productId: 1, variantId: null, quantity: 2, unitPrice: 500, title: "A" }),
    line({ key: "2:-", productId: 2, variantId: null, quantity: 1, unitPrice: 800, title: "B" }),
    line({ key: "3:-", productId: 3, variantId: null, quantity: 1, unitPrice: 300, title: "C" }),
    line({ key: "4:-", productId: 4, variantId: null, quantity: 1, unitPrice: 100, title: "D" }),
  ];
  const live: Record<number, { stock: number; price: number } | null> = {
    1: { stock: 5, price: 500 },
    2: { stock: 0, price: 800 },
    3: null,
    4: { stock: 5, price: 150 },
  };
  const lines = buildCartLines(items, (item) => live[item.productId] ?? null, true);

  it("counts only purchasable lines in the subtotal", () => {
    expect(getSubtotal(lines)).toBe(500 * 2 + 150);
  });

  it("counts every unit in the cart for the header badge", () => {
    expect(getItemCount(items)).toBe(5);
  });

  it("lists every line that blocks checkout, with the reason", () => {
    expect(getCheckoutBlockers(lines)).toEqual([
      { key: "2:-", title: "B", reason: "out-of-stock" },
      { key: "3:-", title: "C", reason: "unavailable" },
      { key: "4:-", title: "D", reason: "price-changed" },
    ]);
  });

  it("has no blockers for a healthy cart", () => {
    expect(getCheckoutBlockers(buildCartLines([items[0]!], () => ({ stock: 5, price: 500 }), true))).toEqual([]);
  });
});

describe("computeTotals (simulated shipping and tax)", () => {
  it("is all zero for an empty cart", () => {
    expect(computeTotals(0, null)).toMatchObject({ subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 });
  });

  it("charges shipping below the free-shipping threshold, plus 18% tax", () => {
    const totals = computeTotals(500, null);
    expect(totals).toMatchObject({ shipping: SHIPPING_FEE, tax: 90, total: 500 + SHIPPING_FEE + 90, freeShipping: false });
  });

  it("ships free at or above the threshold", () => {
    const totals = computeTotals(FREE_SHIPPING_THRESHOLD, null);
    expect(totals.shipping).toBe(0);
    expect(totals.freeShipping).toBe(true);
  });

  it("applies a valid coupon before shipping and tax", () => {
    const totals = computeTotals(1000, "SAVE10");
    expect(totals).toMatchObject({ discount: 100, shipping: SHIPPING_FEE, tax: 162, total: 900 + SHIPPING_FEE + 162 });
  });

  it("lets a free-shipping coupon waive the fee", () => {
    expect(computeTotals(500, "FREESHIP").shipping).toBe(0);
  });

  it("ignores a coupon that is not valid for this cart but keeps its result for the message", () => {
    const totals = computeTotals(200, "SAVE10");
    expect(totals.discount).toBe(0);
    expect(totals.coupon).toMatchObject({ ok: false, reason: "min-subtotal" });
  });

  it("reports an unknown stored coupon without discounting", () => {
    const totals = computeTotals(2000, "BOGUS");
    expect(totals.discount).toBe(0);
    expect(totals.coupon).toMatchObject({ ok: false, reason: "not-found" });
  });
});
