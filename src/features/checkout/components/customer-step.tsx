"use client";

import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { hasErrors } from "@/utils/validation";
import { validateCustomer } from "@/utils/checkout";
import type { CustomerInfo } from "@/types/checkout";

interface CustomerStepProps {
  customer: CustomerInfo;
  onChange: (customer: CustomerInfo) => void;
  onNext: () => void;
}

const ORDER: Array<keyof CustomerInfo> = ["name", "email", "phone"];

/** Step 1: who the order is for. Changes are saved as you type, so a refresh keeps them (PRD MOD-06-002). */
export function CustomerStep({ customer, onChange, onNext }: CustomerStepProps) {
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});
  const refs = { name: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), phone: useRef<HTMLInputElement>(null) };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateCustomer(customer);
    setErrors(found);
    if (hasErrors(found)) {
      const first = ORDER.find((field) => found[field]);
      if (first) refs[first].current?.focus();
      return;
    }
    onNext();
  }

  const set = (field: keyof CustomerInfo, value: string) => onChange({ ...customer, [field]: value });

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4" aria-labelledby="step-customer">
      <h2 id="step-customer" className="section-title">
        Your details
      </h2>
      <FormField ref={refs.name} label="Full name" name="name" autoComplete="name" value={customer.name} error={errors.name} onChange={(event) => set("name", event.target.value)} />
      <FormField ref={refs.email} label="Email" name="email" type="email" autoComplete="email" value={customer.email} error={errors.email} onChange={(event) => set("email", event.target.value)} />
      <FormField
        ref={refs.phone}
        label="Mobile number"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        hint="10 digits. We use it only for delivery updates."
        value={customer.phone}
        error={errors.phone}
        onChange={(event) => set("phone", event.target.value)}
      />
      <div className="flex justify-end">
        <Button type="submit">Continue to address</Button>
      </div>
    </form>
  );
}
