"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types/auth";
import { useAuth } from "../hooks/use-auth";

function GuardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="page-title">You do not have access to this page</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        This area is only available to administrators. Sign in with an administrator account to continue.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go to the homepage</Link>
      </Button>
    </section>
  );
}

interface AuthGuardProps {
  children: ReactNode;
  /** When set, the signed-in user must have this role; otherwise an access-denied page is shown. */
  requiredRole?: UserRole;
}

/**
 * UI-level route protection (PRD sections 11.1 and 13). The session lives in browser storage, so this
 * is a usability gate, not a security boundary: a real backend must authorize every request.
 */
export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const needsLogin = status === "unauthenticated" || status === "expired";

  useEffect(() => {
    if (needsLogin) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [needsLogin, pathname, router]);

  if (status === "idle") return <GuardSkeleton label="Checking your session" />;
  if (needsLogin) return <GuardSkeleton label="Redirecting to sign in" />;
  if (requiredRole && user?.role !== requiredRole) return <AccessDenied />;

  return <>{children}</>;
}
