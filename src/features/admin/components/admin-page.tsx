import type { ReactNode } from "react";

/** Title, intro and (optionally) page-level actions of an admin screen. Every admin screen has exactly one h1. */
export function AdminPage({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
