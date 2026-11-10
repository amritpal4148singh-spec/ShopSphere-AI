"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { REVIEW_MAX_LENGTH, REVIEW_MIN_LENGTH, validateReview } from "@/utils/reviews";
import { StarInput } from "./star-rating";

interface ReviewFormProps {
  mode: "new" | "edit";
  initial?: { rating: number; body: string };
  /** Whether this review will be marked as a verified purchase, so the customer knows before submitting. */
  verified: boolean;
  onSubmit: (values: { rating: number; body: string }) => void;
  onCancel?: () => void;
}

/** Rating plus written review with the character policy of PRD 5.10, validated inline with errors tied to their fields (PRD 13, 14). */
export function ReviewForm({ mode, initial, verified, onSubmit, onCancel }: ReviewFormProps) {
  const id = useId();
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [body, setBody] = useState(initial?.body ?? "");
  const [errors, setErrors] = useState<{ rating?: string; body?: string }>({});
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const ratingRef = useRef<HTMLDivElement>(null);

  const bodyErrorId = `${id}-body-error`;
  const countId = `${id}-count`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateReview({ rating, body });
    if (!result.ok) {
      setErrors(result.errors);
      if (result.errors.rating) ratingRef.current?.querySelector("input")?.focus();
      else bodyRef.current?.focus();
      return;
    }
    setErrors({});
    onSubmit(result.value);
    if (mode === "new") {
      setRating(null);
      setBody("");
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-labelledby={`${id}-heading`} className="space-y-4 rounded-xl border bg-card shadow-surface p-4">
      <h3 id={`${id}-heading`} className="section-title">
        {mode === "new" ? "Write a review" : "Edit your review"}
      </h3>

      <div ref={ratingRef}>
        <StarInput
          value={rating}
          error={errors.rating}
          onChange={(value) => {
            setRating(value);
            setErrors((current) => ({ ...current, rating: undefined }));
          }}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${id}-body`} className="text-sm font-medium">
          Your review
        </label>
        <textarea
          id={`${id}-body`}
          ref={bodyRef}
          value={body}
          rows={5}
          onChange={(event) => {
            setBody(event.target.value);
            setErrors((current) => ({ ...current, body: undefined }));
          }}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? `${countId} ${bodyErrorId}` : countId}
          className="w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground aria-invalid:border-destructive"
          placeholder="What did you like or dislike? How did you use it?"
        />
        <p id={countId} className="text-xs text-muted-foreground">
          {`${body.trim().length} / ${REVIEW_MAX_LENGTH} characters (at least ${REVIEW_MIN_LENGTH})`}
        </p>
        {errors.body ? (
          <p id={bodyErrorId} className="text-sm text-destructive">
            {errors.body}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {verified
          ? "This will be marked as a verified purchase because the product is in your order history. "
          : "This will not be marked as a verified purchase because the product is not in your order history. "}
        Reviews are saved in this browser only.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">{mode === "new" ? "Submit review" : "Save changes"}</Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
