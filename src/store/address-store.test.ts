import { SEED_ADDRESSES, SEED_CUSTOMER_ID } from "@/data/seed-data";
import { addressStorage } from "@/lib/checkout-storage";
import { useAddressStore } from "./address-store";

const fields = { line1: "12 Demo Street", line2: "", city: "Delhi", state: "Delhi", pincode: "110001" };

beforeEach(() => {
  useAddressStore.setState({ status: "idle", ownerId: null, addresses: [] });
  localStorage.clear();
});

describe("useAddressStore", () => {
  it("has no saved addresses for a visitor or a new customer", () => {
    useAddressStore.getState().switchOwner(null);
    expect(useAddressStore.getState().addresses).toEqual([]);
    useAddressStore.getState().switchOwner("new-user");
    expect(useAddressStore.getState().addresses).toEqual([]);
  });

  it("gives the demo customer a saved Home address", () => {
    useAddressStore.getState().switchOwner(SEED_CUSTOMER_ID);
    expect(useAddressStore.getState().addresses).toEqual(SEED_ADDRESSES.map((address, index) => ({ ...address, isDefault: index === 0 })));
  });

  it("saves a new address with a label and persists it", () => {
    useAddressStore.getState().switchOwner("u1");
    const saved = useAddressStore.getState().add(fields, "Office");

    expect(saved).toMatchObject({ label: "Office", line1: "12 Demo Street" });
    expect(addressStorage.load("u1")).toHaveLength(1);
  });

  it("does not save the same address twice, ignoring case and spacing", () => {
    useAddressStore.getState().switchOwner("u1");
    const first = useAddressStore.getState().add(fields);
    const second = useAddressStore.getState().add({ ...fields, line1: "  12 DEMO street ", city: "delhi" });

    expect(second?.id).toBe(first?.id);
    expect(useAddressStore.getState().addresses).toHaveLength(1);
  });

  it("does not save anything when nobody is signed in", () => {
    useAddressStore.getState().switchOwner(null);
    expect(useAddressStore.getState().add(fields)).toBeNull();
  });

  it("keeps each customer's addresses separate", () => {
    useAddressStore.getState().switchOwner("u1");
    useAddressStore.getState().add(fields);
    useAddressStore.getState().switchOwner("u2");
    expect(useAddressStore.getState().addresses).toEqual([]);
  });

  describe("address book actions (PRD 5.7)", () => {
    const other = { line1: "9 Lake View", line2: "", city: "Pune", state: "Maharashtra", pincode: "411001" };

    it("marks the first saved address as the default and keeps it first", () => {
      useAddressStore.getState().switchOwner("book");
      useAddressStore.getState().add(fields, "Home");
      useAddressStore.getState().add(other, "Office");
      expect(useAddressStore.getState().addresses.map((a) => [a.label, a.isDefault])).toEqual([["Home", true], ["Office", false]]);
    });

    it("edits, changes the default and deletes, persisting each step", () => {
      useAddressStore.getState().switchOwner("book2");
      useAddressStore.getState().add(fields, "Home");
      const office = useAddressStore.getState().add(other, "Office");
      const store = useAddressStore.getState();

      expect(store.update(office!.id, { ...other, city: "Mumbai" }, "Work")).toMatchObject({ ok: true });
      expect(addressStorage.load("book2")?.find((a) => a.id === office!.id)).toMatchObject({ city: "Mumbai", label: "Work" });

      store.setDefault(office!.id);
      expect(useAddressStore.getState().addresses[0]).toMatchObject({ id: office!.id, isDefault: true });

      store.remove(office!.id);
      expect(useAddressStore.getState().addresses).toHaveLength(1);
      expect(useAddressStore.getState().addresses[0]?.isDefault).toBe(true);
    });

    it("reports why an action failed", () => {
      useAddressStore.getState().switchOwner(null);
      expect(useAddressStore.getState().addChecked(fields)).toEqual({ ok: false, reason: "signed-out" });
      useAddressStore.getState().switchOwner("book3");
      expect(useAddressStore.getState().remove("nope")).toEqual({ ok: false, reason: "not-found" });
      expect(useAddressStore.getState().setDefault("nope")).toEqual({ ok: false, reason: "not-found" });
    });
  });
});
