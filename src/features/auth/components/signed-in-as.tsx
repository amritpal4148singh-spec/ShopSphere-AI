"use client";

import { useAuth } from "../hooks/use-auth";

export function SignedInAs() {
  const { user } = useAuth();
  if (!user) return null;

  return <p className="mt-3 text-muted-foreground">{`Signed in as ${user.name} (${user.role})`}</p>;
}
