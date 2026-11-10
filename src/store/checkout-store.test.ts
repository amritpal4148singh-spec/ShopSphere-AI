import { checkoutStorage } from "@/lib/checkout-storage";
import { emptyDraft } from "@/utils/checkout";
import { useCheckoutStore } from "./checkout-store";

function reset() {
  useCheckoutStore.setState({ status: "idle", ownerId: null, draft: null });
  localStorage.clear();
}

beforeEach(reset);

describe("useCheckoutStore", () => {
  it("has no draft before an owner is known, and for a visitor who is not signed in", () => {
    expect(useCheckoutStore.getState().draft).toBeNull();
    useCheckoutStore.getState().switchOwner(null);
    useCheckoutStore.getState().init(emptyDraft());
    expect(useCheckoutStore.getState().draft).toBeNull();
  });

  it("creates a draft once and persists it", () => {
    useCheckoutStore.getState().switchOwner("u1");
    useCheckoutStore.getState().init(emptyDraft({ name: "Asha" }));
    useCheckoutStore.getState().init(emptyDraft({ name: "Someone else" }));

    expect(useCheckoutStore.getState().draft?.customer.name).toBe("Asha");
    expect(checkoutStorage.load("u1")?.customer.name).toBe("Asha");
  });

  it("saves every change straight away, and tracks the furthest step", () => {
    useCheckoutStore.getState().switchOwner("u1");
    useCheckoutStore.getState().init(emptyDraft());

    useCheckoutStore.getState().update({ step: 3 });
    useCheckoutStore.getState().goToStep(2);

    expect(useCheckoutStore.getState().draft).toMatchObject({ step: 2, maxStep: 3 });
    expect(checkoutStorage.load("u1")).toMatchObject({ step: 2, maxStep: 3 });
  });

  it("restores progress and entered data after a refresh (PRD MOD-06-002)", () => {
    useCheckoutStore.getState().switchOwner("u1");
    useCheckoutStore.getState().init(emptyDraft());
    useCheckoutStore.getState().update({
      step: 2,
      customer: { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" },
      address: { line1: "12 Demo Street", line2: "", city: "Delhi", state: "Delhi", pincode: "11", savedAddressId: null, saveAddress: false },
    });

    // A refresh loses in-memory state; storage remains.
    useCheckoutStore.setState({ status: "idle", ownerId: null, draft: null });
    useCheckoutStore.getState().switchOwner("u1");

    const draft = useCheckoutStore.getState().draft;
    expect(draft?.step).toBe(2);
    expect(draft?.customer.phone).toBe("9876543210");
    expect(draft?.address.line1).toBe("12 Demo Street");
    expect(draft?.address.pincode).toBe("11");
  });

  it("keeps the saved draft when a session expires and the same customer signs back in (PRD MOD-06-001)", () => {
    useCheckoutStore.getState().switchOwner("u1");
    useCheckoutStore.getState().init(emptyDraft());
    useCheckoutStore.getState().update({ step: 5, payment: { method: "mock-card", outcome: "approve", acknowledged: true } });

    // Session expires: the page is left, the in-memory store is rebuilt after sign-in.
    useCheckoutStore.setState({ status: "idle", ownerId: null, draft: null });
    useCheckoutStore.getState().switchOwner("u1");

    expect(useCheckoutStore.getState().draft).toMatchObject({ step: 5, payment: { method: "mock-card", outcome: "approve" } });
  });

  it("does not show one customer's draft to another", () => {
    useCheckoutStore.getState().switchOwner("u1");
    useCheckoutStore.getState().init(emptyDraft({ name: "One" }));

    useCheckoutStore.getState().switchOwner("u2");

    expect(useCheckoutStore.getState().draft).toBeNull();
    expect(checkoutStorage.load("u1")?.customer.name).toBe("One");
  });

  it("clears the draft after an order is placed", () => {
    useCheckoutStore.getState().switchOwner("u1");
    useCheckoutStore.getState().init(emptyDraft());

    useCheckoutStore.getState().reset();

    expect(useCheckoutStore.getState().draft).toBeNull();
    expect(checkoutStorage.has("u1")).toBe(false);
  });

  it("reload picks up a change made in another tab", () => {
    useCheckoutStore.getState().switchOwner("u1");
    checkoutStorage.save("u1", { ...emptyDraft(), step: 4, maxStep: 4 });

    useCheckoutStore.getState().reload();

    expect(useCheckoutStore.getState().draft?.step).toBe(4);
  });

  it("ignores updates when there is no draft", () => {
    useCheckoutStore.getState().switchOwner("u1");
    useCheckoutStore.getState().update({ step: 3 });
    expect(useCheckoutStore.getState().draft).toBeNull();
  });
});
