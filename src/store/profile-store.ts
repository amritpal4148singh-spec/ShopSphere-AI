import { create } from "zustand";

import { profileStorage } from "@/lib/profile-storage";
import { cleanProfile, validateProfile, type ProfileValues } from "@/utils/profile";
import { hasErrors, type FieldErrors } from "@/utils/validation";

/**
 * The signed-in customer's editable profile (PRD 5.7), saved on this device. It is an overlay on the account:
 * until the customer saves something, the account's own name and email are used.
 */
interface ProfileState {
  status: "idle" | "ready";
  ownerId: string | null;
  /** What the customer saved, or null when they have not edited anything. */
  saved: ProfileValues | null;
  switchOwner: (ownerId: string | null) => void;
  reload: () => void;
  save: (values: ProfileValues) => { ok: true } | { ok: false; errors: FieldErrors<"name" | "email" | "phone"> } | { ok: false; reason: "signed-out" | "storage" };
}

function load(ownerId: string | null): ProfileValues | null {
  return ownerId === null ? null : profileStorage.load(ownerId);
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  status: "idle",
  ownerId: null,
  saved: null,

  switchOwner: (ownerId) => {
    const { status, ownerId: previous } = get();
    if (status === "ready" && previous === ownerId) return;
    set({ status: "ready", ownerId, saved: load(ownerId) });
  },

  reload: () => {
    const { status, ownerId } = get();
    if (status === "ready") set({ saved: load(ownerId) });
  },

  save: (values) => {
    const { ownerId } = get();
    if (ownerId === null) return { ok: false, reason: "signed-out" };
    const errors = validateProfile(values);
    if (hasErrors(errors)) return { ok: false, errors };
    const cleaned = cleanProfile(values);
    if (!profileStorage.save(ownerId, cleaned)) return { ok: false, reason: "storage" };
    set({ saved: cleaned });
    return { ok: true };
  },
}));
