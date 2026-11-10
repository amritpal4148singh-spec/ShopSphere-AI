import { act, render } from "@testing-library/react";

import { checkoutStorage } from "@/lib/checkout-storage";
import { createSession } from "@/services/auth";
import { SEED_CUSTOMER_ID } from "@/data/seed-data";
import { useAddressStore } from "@/store/address-store";
import { useAuthStore } from "@/store/auth-store";
import { useCheckoutStore } from "@/store/checkout-store";
import { useOrdersStore } from "@/store/orders-store";
import { emptyDraft } from "@/utils/checkout";
import { CheckoutSync } from "./checkout-sync";

const user = { id: "u1", name: "Casey", email: "casey@example.test", role: "customer" as const };

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ status: "idle", session: null });
  useCheckoutStore.setState({ status: "idle", ownerId: null, draft: null });
  useOrdersStore.setState({ status: "idle", ownerId: null, orders: [] });
  useAddressStore.setState({ status: "idle", ownerId: null, addresses: [] });
});

describe("CheckoutSync", () => {
  it("waits for the session to be restored", () => {
    render(<CheckoutSync />);
    expect(useCheckoutStore.getState().status).toBe("idle");
    expect(useOrdersStore.getState().status).toBe("idle");
  });

  it("prepares checkout, orders and addresses for the signed-in customer", () => {
    render(<CheckoutSync />);
    act(() => useAuthStore.setState({ status: "authenticated", session: createSession(user) }));

    expect(useCheckoutStore.getState()).toMatchObject({ status: "ready", ownerId: "u1" });
    expect(useOrdersStore.getState()).toMatchObject({ status: "ready", ownerId: "u1" });
    expect(useAddressStore.getState()).toMatchObject({ status: "ready", ownerId: "u1" });
  });

  it("loads the demo customer's sample orders and address", () => {
    render(<CheckoutSync />);
    act(() => useAuthStore.setState({ status: "authenticated", session: createSession({ ...user, id: SEED_CUSTOMER_ID }) }));

    expect(useOrdersStore.getState().orders).toHaveLength(6);
    expect(useAddressStore.getState().addresses).toHaveLength(1);
  });

  it("restores a saved checkout draft when the customer signs in (PRD MOD-06-001)", () => {
    checkoutStorage.save("u1", { ...emptyDraft(), step: 5, maxStep: 5 });
    render(<CheckoutSync />);

    act(() => useAuthStore.setState({ status: "authenticated", session: createSession(user) }));

    expect(useCheckoutStore.getState().draft?.step).toBe(5);
  });

  it("keeps the draft in memory when the session expires", () => {
    render(<CheckoutSync />);
    act(() => useAuthStore.setState({ status: "authenticated", session: createSession(user) }));
    act(() => useCheckoutStore.getState().init(emptyDraft({ name: "Casey" })));

    act(() => useAuthStore.setState({ status: "expired", session: null }));

    expect(useCheckoutStore.getState().ownerId).toBe("u1");
    expect(useCheckoutStore.getState().draft?.customer.name).toBe("Casey");
  });

  it("leaves nothing for a visitor who is not signed in", () => {
    render(<CheckoutSync />);
    act(() => useAuthStore.setState({ status: "unauthenticated", session: null }));

    expect(useCheckoutStore.getState()).toMatchObject({ status: "ready", ownerId: null, draft: null });
    expect(useOrdersStore.getState().orders).toEqual([]);
  });

  it("reloads the draft when another tab changes it", () => {
    render(<CheckoutSync />);
    act(() => useAuthStore.setState({ status: "authenticated", session: createSession(user) }));

    checkoutStorage.save("u1", { ...emptyDraft(), step: 4, maxStep: 4 });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: checkoutStorage.key("u1") }));
    });

    expect(useCheckoutStore.getState().draft?.step).toBe(4);
  });
});
