"use client";

import { AlertCircle } from "lucide-react";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { LocalBadge } from "@/components/ui/local-badge";
import { LIMITS, validateDraft } from "@/utils/admin-catalogue";
import type { CategoryRow, ProductDraft, ProductDraftErrors, ProductValues } from "@/types/admin";

interface ProductFormProps {
  initial: ProductDraft;
  categories: readonly CategoryRow[];
  submitLabel: string;
  onSubmit: (values: ProductValues) => void;
  /** Extra buttons next to the submit button (reset, delete...). */
  children?: ReactNode;
}

const FIELD_ORDER: Array<keyof ProductDraft> = ["title", "brand", "category", "price", "discountPercentage", "stock", "tags", "description"];

/** Create/edit form (PRD 8.2) with inline validation tied to each field (PRD 13, 14). Saving is a local simulation and says so. */
export function ProductForm({ initial, categories, submitLabel, onSubmit, children }: ProductFormProps) {
  const id = useId();
  const [draft, setDraft] = useState<ProductDraft>(initial);
  const [errors, setErrors] = useState<ProductDraftErrors>({});
  const formRef = useRef<HTMLFormElement>(null);

  function set(field: keyof ProductDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateDraft(draft, categories.map((category) => category.slug));
    if (!result.ok) {
      setErrors(result.errors);
      const first = FIELD_ORDER.find((field) => result.errors[field]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    onSubmit(result.values);
  }

  const categoryErrorId = `${id}-category-error`;
  const descriptionErrorId = `${id}-description-error`;

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate aria-label="Product details" className="max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField label="Title" name="title" value={draft.title} onChange={(event) => set("title", event.target.value)} error={errors.title} maxLength={LIMITS.title[1] + 20} />
        </div>
        <FormField label="Brand (optional)" name="brand" value={draft.brand} onChange={(event) => set("brand", event.target.value)} error={errors.brand} />
        <div className="space-y-1.5">
          <label htmlFor={`${id}-category`} className="text-sm font-medium">Category</label>
          <select
            id={`${id}-category`}
            name="category"
            value={draft.category}
            onChange={(event) => set("category", event.target.value)}
            aria-invalid={errors.category ? true : undefined}
            aria-describedby={errors.category ? categoryErrorId : undefined}
            className="h-10 w-full rounded-lg border border-input bg-card px-2 text-sm aria-invalid:border-destructive"
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>{category.name}</option>
            ))}
          </select>
          {errors.category ? (
            <p id={categoryErrorId} className="flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{errors.category}</span>
            </p>
          ) : null}
        </div>
        <FormField label="List price (INR)" name="price" inputMode="numeric" value={draft.price} onChange={(event) => set("price", event.target.value)} error={errors.price} />
        <FormField label="Discount (%)" name="discountPercentage" inputMode="decimal" value={draft.discountPercentage} onChange={(event) => set("discountPercentage", event.target.value)} error={errors.discountPercentage} />
        <FormField label="Stock (units)" name="stock" inputMode="numeric" value={draft.stock} onChange={(event) => set("stock", event.target.value)} error={errors.stock} />
        <FormField label="Tags (comma separated)" name="tags" value={draft.tags} onChange={(event) => set("tags", event.target.value)} error={errors.tags} hint="Up to 10 short tags" />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${id}-description`} className="text-sm font-medium">Description</label>
        <textarea
          id={`${id}-description`}
          name="description"
          rows={5}
          value={draft.description}
          onChange={(event) => set("description", event.target.value)}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? descriptionErrorId : undefined}
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm aria-invalid:border-destructive"
        />
        {errors.description ? (
          <p id={descriptionErrorId} className="flex items-start gap-1.5 text-sm text-destructive">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{errors.description}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit">{submitLabel}</Button>
        {children}
        <LocalBadge />
      </div>
    </form>
  );
}
