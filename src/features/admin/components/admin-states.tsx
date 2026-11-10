import { AlertTriangle, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/products";

export function AdminSkeleton({ label }: { label: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

/** A readable error with a way out (PRD 16): never the raw error object. A network failure is told apart from other failures. */
export function AdminError({ error, onRetry, what = "the product catalogue" }: { error: unknown; onRetry: () => void; what?: string }) {
  const offline = error instanceof ApiError && (error.kind === "network" || error.kind === "timeout");
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border bg-card shadow-surface border-destructive/50 p-6">
      <Icon aria-hidden="true" className="size-8 text-destructive" />
      <h2 className="section-title">{offline ? "You seem to be offline" : `We could not load ${what}`}</h2>
      <p className="max-w-md text-muted-foreground">
        {offline ? `The connection to the product service failed, so ${what} is not available right now.` : `Something went wrong while loading ${what}.`} Your local admin changes are safe.
      </p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card shadow-surface p-6">
      <h2 className="section-title">{title}</h2>
      {children ? <div className="mt-1 text-muted-foreground">{children}</div> : null}
    </div>
  );
}
