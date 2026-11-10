"use client";

import { Button } from "@/components/ui/button";

/** Global error boundary. Never renders the raw error object or stack trace (PRD section 13). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="mx-auto w-full max-w-screen-2xl px-4 py-24 sm:px-6 lg:px-8">
      <h1 className="page-title">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted-foreground">An unexpected error occurred. Try again, or return to the homepage.</p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </section>
  );
}
