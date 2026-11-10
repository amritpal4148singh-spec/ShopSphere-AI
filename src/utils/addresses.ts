import type { AddressFields, SavedAddress } from "@/types/checkout";

/** Pure address-book rules (PRD 5.7). The store persists the result; nothing here touches storage or React. */

export const MAX_SAVED_ADDRESSES = 10;
export const MAX_LABEL_LENGTH = 30;

export type AddressBookError = "limit" | "not-found";

const joinParts = (a: AddressFields) =>
  [a.line1, a.line2, a.city, a.state, a.pincode].map((part) => part.trim().toLowerCase()).join("|");

export function sameAddress(a: AddressFields, b: AddressFields): boolean {
  return joinParts(a) === joinParts(b);
}

/** Exactly one default when the book is not empty; the first address wins if none (or several) are marked. */
export function normalizeDefault(addresses: readonly SavedAddress[]): SavedAddress[] {
  if (addresses.length === 0) return [];
  const firstDefault = addresses.findIndex((address) => address.isDefault === true);
  const chosen = firstDefault === -1 ? 0 : firstDefault;
  return addresses.map((address, index) => ({ ...address, isDefault: index === chosen }));
}

/** The default address first, then the rest in their saved order. */
export function sortAddresses(addresses: readonly SavedAddress[]): SavedAddress[] {
  const list = normalizeDefault(addresses);
  return [...list.filter((a) => a.isDefault), ...list.filter((a) => !a.isDefault)];
}

export function getDefaultAddress(addresses: readonly SavedAddress[]): SavedAddress | null {
  return normalizeDefault(addresses).find((address) => address.isDefault) ?? null;
}

function clean(fields: AddressFields): AddressFields {
  return {
    line1: fields.line1.trim(),
    line2: fields.line2.trim(),
    city: fields.city.trim(),
    state: fields.state.trim(),
    pincode: fields.pincode.trim(),
  };
}

export function cleanLabel(label: string | undefined, fallback: string): string {
  const trimmed = (label ?? "").trim().slice(0, MAX_LABEL_LENGTH);
  return trimmed === "" ? fallback : trimmed;
}

export interface AddOptions {
  id: string;
  label?: string;
  makeDefault?: boolean;
}

/** Adds an address. An identical one is returned instead of duplicated. The first address becomes the default. */
export function addAddress(
  addresses: readonly SavedAddress[],
  fields: AddressFields,
  options: AddOptions,
): { addresses: SavedAddress[]; address: SavedAddress } | { error: AddressBookError } {
  const existing = addresses.find((address) => sameAddress(address, fields));
  if (existing) return { addresses: normalizeDefault(addresses), address: existing };
  if (addresses.length >= MAX_SAVED_ADDRESSES) return { error: "limit" };

  const address: SavedAddress = {
    id: options.id,
    label: cleanLabel(options.label, `Address ${addresses.length + 1}`),
    ...clean(fields),
    isDefault: addresses.length === 0 || options.makeDefault === true,
  };
  const next = options.makeDefault === true ? addresses.map((a) => ({ ...a, isDefault: false })) : [...addresses];
  return { addresses: normalizeDefault([...next, address]), address };
}

/** Replaces the fields and label of one address. Another address with the same fields is not allowed to appear. */
export function updateAddress(
  addresses: readonly SavedAddress[],
  id: string,
  fields: AddressFields,
  label?: string,
): { addresses: SavedAddress[] } | { error: AddressBookError | "duplicate" } {
  const current = addresses.find((address) => address.id === id);
  if (!current) return { error: "not-found" };
  if (addresses.some((address) => address.id !== id && sameAddress(address, fields))) return { error: "duplicate" };
  const next = addresses.map((address) =>
    address.id === id ? { ...address, ...clean(fields), label: cleanLabel(label, current.label) } : address,
  );
  return { addresses: normalizeDefault(next) };
}

/** Removes an address. If it was the default, the first remaining address becomes the default. */
export function removeAddress(addresses: readonly SavedAddress[], id: string): { addresses: SavedAddress[] } | { error: "not-found" } {
  if (!addresses.some((address) => address.id === id)) return { error: "not-found" };
  const remaining = addresses.filter((address) => address.id !== id);
  const hadDefault = addresses.find((address) => address.id === id)?.isDefault === true;
  return { addresses: normalizeDefault(hadDefault ? remaining.map((a) => ({ ...a, isDefault: false })) : remaining) };
}

export function setDefaultAddress(addresses: readonly SavedAddress[], id: string): { addresses: SavedAddress[] } | { error: "not-found" } {
  if (!addresses.some((address) => address.id === id)) return { error: "not-found" };
  return { addresses: normalizeDefault(addresses.map((address) => ({ ...address, isDefault: address.id === id }))) };
}
