"use client";

import { useAuth } from "@/features/auth";
import { useProfileStore } from "@/store/profile-store";
import type { ProfileValues } from "@/utils/profile";

/** The profile the dashboard shows: what the customer saved, falling back to the account's own name and email. */
export function useProfile(): { ready: boolean; values: ProfileValues | null; hasSaved: boolean } {
  const { user } = useAuth();
  const status = useProfileStore((state) => state.status);
  const saved = useProfileStore((state) => state.saved);
  if (!user) return { ready: false, values: null, hasSaved: false };
  return {
    ready: status === "ready",
    hasSaved: saved !== null,
    values: { name: saved?.name ?? user.name, email: saved?.email ?? user.email, phone: saved?.phone ?? "", avatar: saved?.avatar ?? null },
  };
}
