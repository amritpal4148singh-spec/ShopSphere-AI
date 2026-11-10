import { addAddress, getDefaultAddress, MAX_SAVED_ADDRESSES, normalizeDefault, removeAddress, setDefaultAddress, sortAddresses, updateAddress } from "./addresses";
import type { AddressFields, SavedAddress } from "@/types/checkout";

const fields = (n: number): AddressFields => ({ line1: `${n} Main Road`, line2: "", city: "Pune", state: "Maharashtra", pincode: "411001" });
const book = (count: number): SavedAddress[] => {
  let list: SavedAddress[] = [];
  for (let i = 1; i <= count; i += 1) {
    const result = addAddress(list, fields(i), { id: `a${i}` });
    if ("error" in result) throw new Error(result.error);
    list = result.addresses;
  }
  return list;
};

describe("address book", () => {
  it("makes the first address the default and keeps later ones non-default", () => {
    const list = book(2);
    expect(list.map((a) => a.isDefault)).toEqual([true, false]);
    expect(getDefaultAddress(list)?.id).toBe("a1");
  });

  it("can add a new default, demoting the old one", () => {
    const result = addAddress(book(1), fields(9), { id: "a9", makeDefault: true });
    if ("error" in result) throw new Error("unexpected");
    expect(result.addresses.filter((a) => a.isDefault).map((a) => a.id)).toEqual(["a9"]);
  });

  it("does not duplicate an identical address (case and spacing insensitive)", () => {
    const list = book(1);
    const result = addAddress(list, { ...fields(1), line1: "  1 MAIN road " }, { id: "x" });
    if ("error" in result) throw new Error("unexpected");
    expect(result.addresses).toHaveLength(1);
    expect(result.address.id).toBe("a1");
  });

  it("refuses to grow past the limit", () => {
    const result = addAddress(book(MAX_SAVED_ADDRESSES), fields(99), { id: "z" });
    expect(result).toEqual({ error: "limit" });
  });

  it("trims fields and falls back to a default label", () => {
    const result = addAddress([], { ...fields(1), city: "  Pune  " }, { id: "a", label: "   " });
    if ("error" in result) throw new Error("unexpected");
    expect(result.address.city).toBe("Pune");
    expect(result.address.label).toBe("Address 1");
  });

  it("edits an address in place and rejects an edit that duplicates another", () => {
    const list = book(2);
    const edited = updateAddress(list, "a2", { ...fields(2), city: "Mumbai" }, "Office");
    if ("error" in edited) throw new Error("unexpected");
    expect(edited.addresses.find((a) => a.id === "a2")).toMatchObject({ city: "Mumbai", label: "Office" });
    expect(updateAddress(list, "a2", fields(1))).toEqual({ error: "duplicate" });
    expect(updateAddress(list, "nope", fields(3))).toEqual({ error: "not-found" });
  });

  it("moves the default when the default address is removed", () => {
    const result = removeAddress(book(3), "a1");
    if ("error" in result) throw new Error("unexpected");
    expect(result.addresses.map((a) => [a.id, a.isDefault])).toEqual([["a2", true], ["a3", false]]);
  });

  it("keeps the default when another address is removed, and empties cleanly", () => {
    const list = book(2);
    const result = removeAddress(list, "a2");
    if ("error" in result) throw new Error("unexpected");
    expect(result.addresses.map((a) => a.id)).toEqual(["a1"]);
    const empty = removeAddress(result.addresses, "a1");
    if ("error" in empty) throw new Error("unexpected");
    expect(empty.addresses).toEqual([]);
    expect(removeAddress([], "a1")).toEqual({ error: "not-found" });
  });

  it("sets exactly one default and sorts it first", () => {
    const result = setDefaultAddress(book(3), "a3");
    if ("error" in result) throw new Error("unexpected");
    expect(result.addresses.filter((a) => a.isDefault)).toHaveLength(1);
    expect(sortAddresses(result.addresses).map((a) => a.id)).toEqual(["a3", "a1", "a2"]);
    expect(setDefaultAddress([], "a3")).toEqual({ error: "not-found" });
  });

  it("repairs stored books with no default or several defaults", () => {
    const raw = book(3).map((a) => ({ ...a, isDefault: undefined }));
    expect(normalizeDefault(raw).filter((a) => a.isDefault)).toHaveLength(1);
    const many = book(3).map((a) => ({ ...a, isDefault: true }));
    expect(normalizeDefault(many).map((a) => a.isDefault)).toEqual([true, false, false]);
    expect(normalizeDefault([])).toEqual([]);
  });
});
