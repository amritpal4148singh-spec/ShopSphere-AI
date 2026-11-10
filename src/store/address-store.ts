import { create } from "zustand";

import { addressStorage } from "@/lib/checkout-storage";
import { SEED_ADDRESSES, SEED_CUSTOMER_ID } from "@/data/seed-data";
import { addAddress, normalizeDefault, removeAddress, setDefaultAddress, sortAddresses, updateAddress } from "@/utils/addresses";
import type { AddressFields, SavedAddress } from "@/types/checkout";

/**
 * Saved shipping addresses of a registered customer (PRD 5.6, 5.7). Checkout reads and adds them; the dashboard
 * adds, edits, deletes and marks the default. The rules live in `utils/addresses`; this store persists the result.
 */
export type AddressActionResult = { ok: true; address: SavedAddress | null } | { ok: false; reason: "signed-out" | "limit" | "not-found" | "duplicate" };

interface AddressState {
  status: "idle" | "ready";
  ownerId: string | null;
  addresses: SavedAddress[];
  switchOwner: (ownerId: string | null) => void;
  reload: () => void;
  /** Saves an address unless an identical one exists. Returns the saved (or existing) address. */
  add: (fields: AddressFields, label?: string, makeDefault?: boolean) => SavedAddress | null;
  /** Like `add`, but says why it failed. Used by the dashboard form. */
  addChecked: (fields: AddressFields, label?: string, makeDefault?: boolean) => AddressActionResult;
  update: (id: string, fields: AddressFields, label?: string) => AddressActionResult;
  remove: (id: string) => AddressActionResult;
  setDefault: (id: string) => AddressActionResult;
}

function loadAddresses(ownerId: string | null): SavedAddress[] {
  if (ownerId === null) return [];
  if (ownerId === SEED_CUSTOMER_ID && !addressStorage.has(ownerId)) addressStorage.save(ownerId, [...SEED_ADDRESSES]);
  return sortAddresses(addressStorage.load(ownerId) ?? []);
}

export const useAddressStore = create<AddressState>()((set, get) => {
  /** Re-reads the latest saved copy first, so a second tab's change is never overwritten. */
  const latest = (ownerId: string): SavedAddress[] => normalizeDefault(addressStorage.load(ownerId) ?? []);
  const commit = (ownerId: string, list: SavedAddress[]): void => {
    const sorted = sortAddresses(list);
    addressStorage.save(ownerId, sorted);
    set({ addresses: sorted });
  };

  return {
    status: "idle",
    ownerId: null,
    addresses: [],

    switchOwner: (ownerId) => {
      const { status, ownerId: previous } = get();
      if (status === "ready" && previous === ownerId) return;
      set({ status: "ready", ownerId, addresses: loadAddresses(ownerId) });
    },

    reload: () => {
      const { status, ownerId } = get();
      if (status === "ready") set({ addresses: loadAddresses(ownerId) });
    },

    addChecked: (fields, label, makeDefault) => {
      const { ownerId } = get();
      if (ownerId === null) return { ok: false, reason: "signed-out" };
      const current = latest(ownerId);
      const result = addAddress(current, fields, { id: `addr-${globalThis.crypto.randomUUID()}`, label, makeDefault });
      if ("error" in result) return { ok: false, reason: result.error };
      commit(ownerId, result.addresses);
      return { ok: true, address: result.address };
    },

    add: (fields, label, makeDefault) => {
      const result = get().addChecked(fields, label, makeDefault);
      return result.ok ? result.address : null;
    },

    update: (id, fields, label) => {
      const { ownerId } = get();
      if (ownerId === null) return { ok: false, reason: "signed-out" };
      const result = updateAddress(latest(ownerId), id, fields, label);
      if ("error" in result) return { ok: false, reason: result.error };
      commit(ownerId, result.addresses);
      return { ok: true, address: result.addresses.find((address) => address.id === id) ?? null };
    },

    remove: (id) => {
      const { ownerId } = get();
      if (ownerId === null) return { ok: false, reason: "signed-out" };
      const result = removeAddress(latest(ownerId), id);
      if ("error" in result) return { ok: false, reason: result.error };
      commit(ownerId, result.addresses);
      return { ok: true, address: null };
    },

    setDefault: (id) => {
      const { ownerId } = get();
      if (ownerId === null) return { ok: false, reason: "signed-out" };
      const result = setDefaultAddress(latest(ownerId), id);
      if ("error" in result) return { ok: false, reason: result.error };
      commit(ownerId, result.addresses);
      return { ok: true, address: result.addresses.find((address) => address.id === id) ?? null };
    },
  };
});
