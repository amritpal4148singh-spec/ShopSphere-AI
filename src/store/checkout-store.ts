import { create } from "zustand";

import { checkoutStorage } from "@/lib/checkout-storage";
import type { CheckoutDraft, CheckoutStep } from "@/types/checkout";

/**
 * The in-progress checkout (Zustand), saved to local storage on every change so a refresh (PRD MOD-06-002) or a
 * session expiry (MOD-06-001) restores the same step with the data entered. One draft per signed-in customer.
 */
interface CheckoutState {
  status: "idle" | "ready";
  ownerId: string | null;
  draft: CheckoutDraft | null;
  switchOwner: (ownerId: string | null) => void;
  reload: () => void;
  /** Creates the draft only if there is none (e.g. first visit). */
  init: (draft: CheckoutDraft) => void;
  update: (patch: Partial<Omit<CheckoutDraft, "updatedAt">>) => void;
  goToStep: (step: CheckoutStep) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>()((set, get) => {
  function persist(draft: CheckoutDraft | null): void {
    const { ownerId } = get();
    if (ownerId === null) return;
    if (draft) checkoutStorage.save(ownerId, draft);
    else checkoutStorage.clear(ownerId);
  }

  return {
    status: "idle",
    ownerId: null,
    draft: null,

    switchOwner: (ownerId) => {
      const { status, ownerId: previous } = get();
      if (status === "ready" && previous === ownerId) return;
      set({ status: "ready", ownerId, draft: ownerId ? checkoutStorage.load(ownerId) : null });
    },

    reload: () => {
      const { status, ownerId } = get();
      if (status === "ready" && ownerId) set({ draft: checkoutStorage.load(ownerId) });
    },

    init: (draft) => {
      if (get().draft !== null || get().ownerId === null) return;
      persist(draft);
      set({ draft });
    },

    update: (patch) => {
      const current = get().draft;
      if (!current) return;
      const next: CheckoutDraft = { ...current, ...patch, updatedAt: Date.now() };
      next.maxStep = Math.max(next.maxStep, next.step) as CheckoutStep;
      persist(next);
      set({ draft: next });
    },

    goToStep: (step) => get().update({ step }),

    reset: () => {
      persist(null);
      set({ draft: null });
    },
  };
});
