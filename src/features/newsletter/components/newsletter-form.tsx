"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { NewsletterError, subscribeToNewsletter } from "@/services/newsletter/newsletter-service";
import { validateEmail } from "@/utils/validation";

type State = { phase: "idle" } | { phase: "submitting" } | { phase: "success"; already: boolean } | { phase: "failure"; message: string };

/** Newsletter signup (PRD 5.1). A simulation: it validates, shows loading, success and failure, and stores nothing off this device. */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<State>({ phase: "idle" });
  const submitting = useRef(false);
  const inputId = useId();
  const errorId = useId();
  const hintId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return; // a double click or Enter key must not send twice
    const problem = validateEmail(email);
    setError(problem);
    if (problem) {
      setState({ phase: "idle" });
      return;
    }
    submitting.current = true;
    setState({ phase: "submitting" });
    try {
      const result = await subscribeToNewsletter(email);
      setState({ phase: "success", already: result.status === "already-subscribed" });
      setEmail("");
    } catch (caught) {
      setState({ phase: "failure", message: caught instanceof NewsletterError ? caught.message : "Something went wrong. Please try again." });
    } finally {
      submitting.current = false;
    }
  }

  const submittingNow = state.phase === "submitting";

  return (
    <form noValidate onSubmit={handleSubmit} aria-labelledby={`${inputId}-title`} className="space-y-3">
      <h2 id={`${inputId}-title`} className="text-sm font-semibold uppercase tracking-wide text-primary-foreground">
        Newsletter
      </h2>
      <p id={hintId} className="text-sm text-primary-foreground/75">
        Get new arrivals in your inbox. Demo only: no emails are sent and your address stays on this device.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor={inputId} className="sr-only">
            Address for newsletter updates
          </label>
          <input
            id={inputId}
            type="email"
            name="newsletter-email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (state.phase !== "submitting") setState({ phase: "idle" });
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${hintId}` : hintId}
            disabled={submittingNow}
            className="h-10 w-full rounded-md border border-primary-foreground/30 bg-primary-foreground/10 px-3 text-sm text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" variant="cta" disabled={submittingNow} aria-busy={submittingNow}>
          {submittingNow ? "Subscribing…" : "Subscribe"}
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive-on-dark">
          {error}
        </p>
      ) : null}
      <p role="status" className={state.phase === "success" || state.phase === "failure" ? "text-sm font-medium" : "sr-only"}>
        {state.phase === "success" ? (state.already ? "You are already subscribed with that address." : "Thanks! You are subscribed (demo).") : null}
        {state.phase === "failure" ? state.message : null}
      </p>
    </form>
  );
}
