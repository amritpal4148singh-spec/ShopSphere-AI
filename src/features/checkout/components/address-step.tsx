"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { RadioCard } from "@/components/ui/radio-card";
import { hasErrors } from "@/utils/validation";
import { getDefaultAddress } from "@/utils/addresses";
import { validateAddress } from "@/utils/checkout";
import type { AddressFields, CheckoutDraft, SavedAddress } from "@/types/checkout";

type AddressDraft = CheckoutDraft["address"];

interface AddressStepProps {
  address: AddressDraft;
  savedAddresses: SavedAddress[];
  onChange: (address: AddressDraft) => void;
  onBack: () => void;
  onNext: () => void;
}

const FIELD_ORDER: Array<keyof AddressFields> = ["line1", "line2", "city", "state", "pincode"];
const NEW_ADDRESS = "new";

/**
 * Step 2: where to deliver. A registered customer can pick a saved address (PRD 5.6) or enter a new one and
 * choose to keep it for next time.
 */
export function AddressStep({ address, savedAddresses, onChange, onBack, onNext }: AddressStepProps) {
  const [errors, setErrors] = useState<Partial<Record<keyof AddressFields, string>>>({});
  const refs = {
    line1: useRef<HTMLInputElement>(null),
    line2: useRef<HTMLInputElement>(null),
    city: useRef<HTMLInputElement>(null),
    state: useRef<HTMLInputElement>(null),
    pincode: useRef<HTMLInputElement>(null),
  };

  const usingSaved = address.savedAddressId !== null;

  // The customer's default address is pre-selected once, when the step opens with nothing entered yet (PRD 5.7).
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current) return;
    const blank = [address.line1, address.line2, address.city, address.state, address.pincode].every((part) => part.trim() === "");
    if (!blank || address.savedAddressId !== null) {
      preselected.current = true;
      return;
    }
    const preferred = getDefaultAddress(savedAddresses);
    if (!preferred) return;
    preselected.current = true;
    onChange({ line1: preferred.line1, line2: preferred.line2, city: preferred.city, state: preferred.state, pincode: preferred.pincode, savedAddressId: preferred.id, saveAddress: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses]);

  function chooseSaved(saved: SavedAddress) {
    setErrors({});
    onChange({ line1: saved.line1, line2: saved.line2, city: saved.city, state: saved.state, pincode: saved.pincode, savedAddressId: saved.id, saveAddress: false });
  }

  function chooseNew() {
    onChange({ line1: "", line2: "", city: "", state: "", pincode: "", savedAddressId: null, saveAddress: false });
  }

  function setField(field: keyof AddressFields, value: string) {
    // Editing a saved address turns it into a new one, so the saved address itself is never changed.
    onChange({ ...address, [field]: value, savedAddressId: null });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateAddress(address);
    setErrors(found);
    if (hasErrors(found)) {
      const first = FIELD_ORDER.find((field) => found[field]);
      if (first) refs[first].current?.focus();
      return;
    }
    onNext();
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4" aria-labelledby="step-address">
      <h2 id="step-address" className="section-title">
        Delivery address
      </h2>

      {savedAddresses.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Saved addresses</legend>
          {savedAddresses.map((saved) => (
            <RadioCard
              key={saved.id}
              name="saved-address"
              value={saved.id}
              checked={address.savedAddressId === saved.id}
              onChange={() => chooseSaved(saved)}
              title={saved.label}
              description={`${saved.line1}${saved.line2 ? `, ${saved.line2}` : ""}, ${saved.city}, ${saved.state} ${saved.pincode}`}
            />
          ))}
          <RadioCard name="saved-address" value={NEW_ADDRESS} checked={!usingSaved} onChange={chooseNew} title="Use a new address" />
        </fieldset>
      ) : null}

      <FormField ref={refs.line1} label="Street address" name="line1" autoComplete="address-line1" value={address.line1} error={errors.line1} onChange={(event) => setField("line1", event.target.value)} />
      <FormField ref={refs.line2} label="Apartment, landmark (optional)" name="line2" autoComplete="address-line2" value={address.line2} error={errors.line2} onChange={(event) => setField("line2", event.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField ref={refs.city} label="City" name="city" autoComplete="address-level2" value={address.city} error={errors.city} onChange={(event) => setField("city", event.target.value)} />
        <FormField ref={refs.state} label="State" name="state" autoComplete="address-level1" value={address.state} error={errors.state} onChange={(event) => setField("state", event.target.value)} />
      </div>
      <FormField
        ref={refs.pincode}
        label="PIN code"
        name="pincode"
        inputMode="numeric"
        maxLength={6}
        autoComplete="postal-code"
        value={address.pincode}
        error={errors.pincode}
        onChange={(event) => setField("pincode", event.target.value.replace(/[^0-9]/g, ""))}
      />

      {!usingSaved ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={address.saveAddress} onChange={(event) => onChange({ ...address, saveAddress: event.target.checked })} />
          Save this address for next time
        </label>
      ) : null}

      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Continue to delivery</Button>
      </div>
    </form>
  );
}
