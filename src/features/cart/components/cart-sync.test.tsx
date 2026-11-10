import { act, render } from "@testing-library/react";

import { cartStorageKey, loadCartSnapshot, saveCartSnapshot } from "@/lib/cart-storage";
import { createSession } from "@/services/auth";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";
import type { NewCartItem } from "@/types/cart";
import { CartSync } from "./cart-sync";

const input = (overrides: Partial<NewCartItem> = {}): NewCartItem => ({
  productId: 1,
  variantId: null,
  variantLabel: null,
  quantity: 1,
  title: "Lamp",
  brand: null,
  category: "x",
  thumbnail: null,
  unitPrice: 100,
  knownStock: 10,
  ...overrides,
});

const user = { id: "u1", name: "Casey", email: "casey@example.test", role: "customer" as const };

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ status: "idle", session: null });
  useCartStore.setState({ status: "idle", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
});

describe("CartSync", () => {
  it("waits for the session to be restored before choosing a cart", () => {
    render(<CartSync />);
    expect(useCartStore.getState().status).toBe("idle");
  });

  it("shows the guest cart for a visitor", () => {
    render(<CartSync />);
    act(() => useAuthStore.setState({ status: "unauthenticated", session: null }));

    expect(useCartStore.getState()).toMatchObject({ status: "ready", ownerId: null });
  });

  it("shows the customer's own cart after sign-in and merges the guest cart into it (PRD 4.3)", () => {
    render(<CartSync />);
    act(() => useAuthStore.setState({ status: "unauthenticated", session: null }));
    act(() => {
      useCartStore.getState().addItem(input({ productId: 1 }));
    });

    act(() => useAuthStore.setState({ status: "authenticated", session: createSession(user) }));

    expect(useCartStore.getState().ownerId).toBe("u1");
    expect(useCartStore.getState().items.map((item) => item.productId)).toEqual([1]);
    expect(loadCartSnapshot(null).items).toEqual([]);
  });

  it("loads the saved account cart when a signed-in session is restored on page load", () => {
    saveCartSnapshot("u1", { items: [{ ...input(), key: "7:-", productId: 7, addedAt: 1 }], saved: [], couponCode: null });
    render(<CartSync />);

    act(() => useAuthStore.setState({ status: "authenticated", session: createSession(user) }));

    expect(useCartStore.getState().items.map((item) => item.productId)).toEqual([7]);
  });

  it("keeps the account cart on screen when the session expires", () => {
    render(<CartSync />);
    act(() => useAuthStore.setState({ status: "authenticated", session: createSession(user) }));
    act(() => {
      useCartStore.getState().addItem(input());
    });

    act(() => useAuthStore.setState({ status: "expired", session: null }));

    expect(useCartStore.getState().ownerId).toBe("u1");
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("falls back to the guest cart on sign-out, leaving the account cart stored", () => {
    render(<CartSync />);
    act(() => useAuthStore.setState({ status: "authenticated", session: createSession(user) }));
    act(() => {
      useCartStore.getState().addItem(input());
    });

    act(() => useAuthStore.setState({ status: "unauthenticated", session: null }));

    expect(useCartStore.getState().ownerId).toBeNull();
    expect(useCartStore.getState().items).toEqual([]);
    expect(localStorage.getItem(cartStorageKey("u1"))).not.toBeNull();
  });

  it("reloads the cart when another tab changes it", () => {
    render(<CartSync />);
    act(() => useAuthStore.setState({ status: "unauthenticated", session: null }));

    saveCartSnapshot(null, { items: [{ ...input(), key: "3:-", productId: 3, addedAt: 1 }], saved: [], couponCode: null });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: cartStorageKey(null) }));
    });

    expect(useCartStore.getState().items.map((item) => item.productId)).toEqual([3]);
  });

  it("ignores storage changes that are not about the cart", () => {
    render(<CartSync />);
    act(() => useAuthStore.setState({ status: "unauthenticated", session: null }));
    act(() => {
      useCartStore.getState().addItem(input());
    });
    saveCartSnapshot(null, { items: [], saved: [], couponCode: null });

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "something.else" }));
    });

    expect(useCartStore.getState().items).toHaveLength(1);
  });
});
