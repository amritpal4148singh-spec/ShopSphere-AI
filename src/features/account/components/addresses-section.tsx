"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useAddressStore, type AddressActionResult } from "@/store/address-store";
import { MAX_LABEL_LENGTH, MAX_SAVED_ADDRESSES } from "@/utils/addresses";
import { validateAddress } from "@/utils/checkout";
import { hasErrors, type FieldErrors } from "@/utils/validation";
import type { AddressFields, SavedAddress } from "@/types/checkout";

const EMPTY: AddressFields = { line1: "", line2: "", city: "", state: "", pincode: "" };
type Field = keyof AddressFields;
const FIELD_ORDER: Field[] = ["line1", "line2", "city", "state", "pincode"];

interface FormState {
  /** null while adding a new address. */
  editingId: string | null;
  fields: AddressFields;
  label: string;
  makeDefault: boolean;
}

const failureText = (result: Extract<AddressActionResult, { ok: false }>): string =>
  result.reason === "limit"
    ? `You can save up to ${MAX_SAVED_ADDRESSES} addresses. Delete one to add another.`
    : result.reason === "duplicate"
      ? "You already saved this address."
      : result.reason === "signed-out"
        ? "Sign in again to manage addresses."
        : "That address no longer exists.";

const oneLine = (a: SavedAddress) => `${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.city}, ${a.state} ${a.pincode}`;

/** Addresses (PRD 5.7): add, edit, delete, mark default. Saved addresses appear in checkout, with the default first. */
export function AddressesSection() {
  const status = useAddressStore((state) => state.status);
  const addresses = useAddressStore((state) => state.addresses);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refs = { line1: useRef<HTMLInputElement>(null), line2: useRef<HTMLInputElement>(null), city: useRef<HTMLInputElement>(null), state: useRef<HTMLInputElement>(null), pincode: useRef<HTMLInputElement>(null) };
  const headingId = useId();
  const addButtonRef = useRef<HTMLButtonElement>(null);

  function openAdd() {
    setNotice(null);
    setErrors({});
    setFormError(null);
    setConfirmId(null);
    setForm({ editingId: null, fields: EMPTY, label: "", makeDefault: addresses.length === 0 });
  }

  function openEdit(address: SavedAddress) {
    setNotice(null);
    setErrors({});
    setFormError(null);
    setConfirmId(null);
    setForm({ editingId: address.id, fields: { line1: address.line1, line2: address.line2, city: address.city, state: address.state, pincode: address.pincode }, label: address.label, makeDefault: address.isDefault === true });
  }

  function closeForm() {
    setForm(null);
    setErrors({});
    setFormError(null);
    queueMicrotask(() => addButtonRef.current?.focus());
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const found = validateAddress(form.fields);
    setErrors(found);
    if (hasErrors(found)) {
      setFormError(null);
      const first = FIELD_ORDER.find((field) => found[field]);
      if (first) refs[first].current?.focus();
      return;
    }
    const store = useAddressStore.getState();
    const result = form.editingId
      ? store.update(form.editingId, form.fields, form.label)
      : store.addChecked(form.fields, form.label, form.makeDefault);
    if (!result.ok) {
      setFormError(failureText(result));
      return;
    }
    if (form.editingId && form.makeDefault) store.setDefault(form.editingId);
    setNotice(form.editingId ? "Address updated." : "Address saved.");
    closeForm();
  }

  function remove(id: string) {
    const result = useAddressStore.getState().remove(id);
    setConfirmId(null);
    setNotice(result.ok ? "Address deleted." : failureText(result));
  }

  function makeDefault(id: string) {
    const result = useAddressStore.getState().setDefault(id);
    setNotice(result.ok ? "Default address updated." : failureText(result));
  }

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card p-4 shadow-surface sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="section-title">
            Addresses
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Your default address is pre-selected at checkout.</p>
        </div>
        {form === null ? (
          <Button ref={addButtonRef} type="button" size="sm" variant="outline" onClick={openAdd} disabled={addresses.length >= MAX_SAVED_ADDRESSES}>
            <Plus aria-hidden="true" className="size-4" /> Add address
          </Button>
        ) : null}
      </div>

      <p role="status" className={notice ? "mt-3 text-sm font-medium text-success" : "sr-only"}>
        {notice}
      </p>

      {status !== "ready" ? (
        <div aria-busy="true" className="mt-4 h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      ) : addresses.length === 0 && form === null ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-dashed p-5">
          <MapPin aria-hidden="true" className="size-6 text-muted-foreground" />
          <p className="font-medium">No saved addresses yet</p>
          <p className="text-sm text-muted-foreground">Add one now to check out faster next time.</p>
          <Button type="button" onClick={openAdd}>
            Add your first address
          </Button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-col gap-3 rounded-lg border bg-background p-4" data-testid="saved-address">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{address.label}</p>
                {address.isDefault ? <span className="rounded-full border border-gold-edge bg-secondary px-2 py-0.5 text-xs font-semibold text-gold-ink">Default</span> : null}
              </div>
              <address className="text-sm not-italic text-muted-foreground">{oneLine(address)}</address>

              {confirmId === address.id ? (
                <div role="alertdialog" aria-label={`Delete ${address.label}?`} className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3 text-sm">
                  <span className="mr-auto font-medium">Delete this address?</span>
                  <Button type="button" size="sm" variant="destructive" onClick={() => remove(address.id)}>
                    Delete
                  </Button>
                  <Button type="button" size="sm" variant="outline" autoFocus onClick={() => setConfirmId(null)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openEdit(address)} aria-label={`Edit ${address.label}`}>
                    <Pencil aria-hidden="true" className="size-3.5" /> Edit
                  </Button>
                  {!address.isDefault ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => makeDefault(address.id)} aria-label={`Make ${address.label} the default address`}>
                      <Star aria-hidden="true" className="size-3.5" /> Make default
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmId(address.id)} aria-label={`Delete ${address.label}`}>
                    <Trash2 aria-hidden="true" className="size-3.5" /> Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {form ? (
        <form noValidate onSubmit={submit} aria-labelledby={`${headingId}-form`} className="mt-5 grid gap-4 rounded-lg border bg-background p-4 sm:grid-cols-2">
          <h3 id={`${headingId}-form`} className="font-semibold sm:col-span-2">
            {form.editingId ? "Edit address" : "New address"}
          </h3>
          <div className="sm:col-span-2">
            <FormField label="Label (optional)" name="label" maxLength={MAX_LABEL_LENGTH} value={form.label} hint="For example Home or Office." onChange={(event) => setForm({ ...form, label: event.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <FormField ref={refs.line1} label="Street address" name="line1" autoComplete="address-line1" value={form.fields.line1} error={errors.line1} onChange={(event) => setForm({ ...form, fields: { ...form.fields, line1: event.target.value } })} />
          </div>
          <div className="sm:col-span-2">
            <FormField ref={refs.line2} label="Apartment, landmark (optional)" name="line2" autoComplete="address-line2" value={form.fields.line2} error={errors.line2} onChange={(event) => setForm({ ...form, fields: { ...form.fields, line2: event.target.value } })} />
          </div>
          <FormField ref={refs.city} label="City" name="city" autoComplete="address-level2" value={form.fields.city} error={errors.city} onChange={(event) => setForm({ ...form, fields: { ...form.fields, city: event.target.value } })} />
          <FormField ref={refs.state} label="State" name="state" autoComplete="address-level1" value={form.fields.state} error={errors.state} onChange={(event) => setForm({ ...form, fields: { ...form.fields, state: event.target.value } })} />
          <FormField ref={refs.pincode} label="PIN code" name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.fields.pincode} error={errors.pincode} onChange={(event) => setForm({ ...form, fields: { ...form.fields, pincode: event.target.value } })} />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={form.makeDefault} disabled={form.editingId !== null && addresses.find((a) => a.id === form.editingId)?.isDefault === true} onChange={(event) => setForm({ ...form, makeDefault: event.target.checked })} />
            Use as my default address
          </label>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">
              {formError}
            </p>
          ) : null}
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit">{form.editingId ? "Save changes" : "Save address"}</Button>
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
