import { cartStorageKey, loadCartSnapshot, saveCartSnapshot } from "@/lib/cart-storage";
import type { NewCartItem } from "@/types/cart";
import { useCartStore } from "./cart-store";

const input = (overrides: Partial<NewCartItem> = {}): NewCartItem => ({
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
});

function resetStore() {
  useCartStore.setState({ status: "idle", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
  localStorage.clear();
}

beforeEach(resetStore);

describe("useCartStore", () => {
  it("is idle and refuses changes until the owner is known", () => {
    expect(useCartStore.getState().status).toBe("idle");
    expect(useCartStore.getState().addItem(input())).toEqual({ type: "not-ready" });
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("adds items and persists them to the guest cart", () => {
    useCartStore.getState().switchOwner(null);
    const outcome = useCartStore.getState().addItem(input({ quantity: 2 }));

    expect(outcome).toEqual({ type: "added", quantity: 2 });
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(loadCartSnapshot(null).items[0]?.quantity).toBe(2);
  });

  it("increments a duplicate instead of adding a second row (PRD edge case 8)", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input());
    useCartStore.getState().addItem(input());

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
  });

  it("restores the cart after a simulated page reload", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input({ quantity: 3 }));

    resetStoreKeepingStorage();
    useCartStore.getState().switchOwner(null);

    expect(useCartStore.getState().items[0]?.quantity).toBe(3);
  });

  it("does not lose or duplicate lines when another tab changed the cart meanwhile (PRD edge case 26)", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input({ productId: 1 }));

    // "Another tab" adds product 2 straight into storage while this tab still holds only product 1.
    const stored = loadCartSnapshot(null);
    saveCartSnapshot(null, { ...stored, items: [...stored.items, { ...stored.items[0]!, key: "2:size-8", productId: 2, addedAt: 2 }] });

    useCartStore.getState().addItem(input({ productId: 3 }));

    const keys = loadCartSnapshot(null).items.map((item) => item.key).sort();
    expect(keys).toEqual(["1:size-8", "2:size-8", "3:size-8"]);
    expect(useCartStore.getState().items).toHaveLength(3);
  });

  it("reload() picks up another tab's change", () => {
    useCartStore.getState().switchOwner(null);
    saveCartSnapshot(null, { items: [], saved: [], couponCode: "SAVE10" });

    useCartStore.getState().reload();

    expect(useCartStore.getState().couponCode).toBe("SAVE10");
  });

  it("clamps a quantity change to the stock and reports it (PRD MOD-05-001)", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input({ knownStock: 3 }));

    const outcome = useCartStore.getState().setQuantity("1:size-8", 5, 3);

    expect(outcome).toEqual({ quantity: 3, limit: 3, clamped: true, requested: 5 });
    expect(loadCartSnapshot(null).items[0]?.quantity).toBe(3);
  });

  it("saves for later, then moves back to the cart", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input({ quantity: 2 }));

    useCartStore.getState().saveForLater("1:size-8");
    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().saved).toHaveLength(1);

    expect(useCartStore.getState().moveToCart("1:size-8", 10)).toEqual({ type: "moved", quantity: 2 });
    expect(useCartStore.getState().saved).toEqual([]);
    expect(loadCartSnapshot(null).items).toHaveLength(1);
  });

  it("refuses to move an out-of-stock saved item", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input());
    useCartStore.getState().saveForLater("1:size-8");

    expect(useCartStore.getState().moveToCart("1:size-8", 0)).toEqual({ type: "out-of-stock" });
    expect(useCartStore.getState().saved).toHaveLength(1);
  });

  it("removes lines and their notices", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input({ quantity: 5 }));
    useCartStore.getState().reconcile(() => ({ stock: 2, price: 1000 }));
    expect(useCartStore.getState().notices["1:size-8"]).toContain("reduced to 2");

    useCartStore.getState().removeItem("1:size-8");

    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().notices).toEqual({});
  });

  it("reconcile lowers the quantity and records a notice that can be dismissed", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input({ quantity: 5 }));

    useCartStore.getState().reconcile(() => ({ stock: 2, price: 1000 }));
    expect(useCartStore.getState().items[0]?.quantity).toBe(2);

    useCartStore.getState().dismissNotice("1:size-8");
    expect(useCartStore.getState().notices).toEqual({});
  });

  it("stores and clears a coupon, and confirms a changed price", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input());

    useCartStore.getState().applyCoupon("SAVE10");
    useCartStore.getState().confirmPrice("1:size-8", 1300);

    expect(loadCartSnapshot(null).couponCode).toBe("SAVE10");
    expect(loadCartSnapshot(null).items[0]?.unitPrice).toBe(1300);

    useCartStore.getState().applyCoupon(null);
    expect(useCartStore.getState().couponCode).toBeNull();
  });

  it("merges the guest cart into the account cart on sign-in and clears the guest cart", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input({ productId: 1 }));

    saveCartSnapshot("u1", { items: [{ ...loadCartSnapshot(null).items[0]!, key: "9:-", productId: 9, variantId: null }], saved: [], couponCode: null });
    useCartStore.getState().switchOwner("u1");

    const keys = useCartStore.getState().items.map((item) => item.key).sort();
    expect(keys).toEqual(["1:size-8", "9:-"]);
    expect(loadCartSnapshot("u1").items).toHaveLength(2);
    expect(loadCartSnapshot(null).items).toEqual([]);
  });

  it("keeps the account cart stored when the user signs out, and shows the guest cart", () => {
    useCartStore.getState().switchOwner("u1");
    useCartStore.getState().addItem(input());

    useCartStore.getState().switchOwner(null);

    expect(useCartStore.getState().items).toEqual([]);
    expect(loadCartSnapshot("u1").items).toHaveLength(1);
    expect(localStorage.getItem(cartStorageKey("u1"))).not.toBeNull();
  });

  it("clears the cart and its coupon after an order, but keeps items saved for later", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input({ productId: 1 }));
    useCartStore.getState().addItem(input({ productId: 2 }));
    useCartStore.getState().saveForLater("2:size-8");
    useCartStore.getState().applyCoupon("SAVE10");

    useCartStore.getState().clear();

    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().couponCode).toBeNull();
    expect(useCartStore.getState().saved).toHaveLength(1);
    expect(loadCartSnapshot(null).items).toEqual([]);
  });

  it("does nothing when switching to the owner that is already active", () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(input());
    const before = useCartStore.getState().items;

    useCartStore.getState().switchOwner(null);

    expect(useCartStore.getState().items).toBe(before);
  });
});

function resetStoreKeepingStorage() {
  useCartStore.setState({ status: "idle", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
}
