import { create } from "zustand";

import { clearStoredSession, loginUser, readStoredSession, registerUser } from "@/services/auth";
import type { AuthStatus, LoginInput, RegisterInput, Session } from "@/types/auth";

/**
 * Global client auth state (Zustand). Starts as "idle" on both server and first client render so
 * hydration matches; `hydrate()` then reads the persisted session in an effect.
 */
interface AuthState {
  status: AuthStatus;
  session: Session | null;
  hydrate: () => void;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  expireSession: () => void;
}

const MAX_TIMEOUT_MS = 2_147_483_647;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

function clearExpiryTimer(): void {
  if (expiryTimer !== undefined) {
    clearTimeout(expiryTimer);
    expiryTimer = undefined;
  }
}

export const useAuthStore = create<AuthState>()((set, get) => {
  function activate(session: Session): void {
    clearExpiryTimer();
    set({ status: "authenticated", session });
    const remaining = Math.min(Math.max(session.expiresAt - Date.now(), 0), MAX_TIMEOUT_MS);
    expiryTimer = setTimeout(() => get().expireSession(), remaining);
  }

  return {
    status: "idle",
    session: null,

    hydrate: () => {
      const result = readStoredSession(Date.now());
      if (result.kind === "valid") {
        activate(result.session);
        return;
      }
      clearExpiryTimer();
      // Keep the "expired" notice if a repeat hydrate (e.g. React strict mode) finds the token already cleared.
      const wasExpired = get().status === "expired";
      set({ status: result.kind === "expired" || wasExpired ? "expired" : "unauthenticated", session: null });
    },

    login: async (input) => {
      activate(await loginUser(input));
    },

    register: async (input) => {
      activate(await registerUser(input));
    },

    logout: () => {
      clearExpiryTimer();
      clearStoredSession();
      set({ status: "unauthenticated", session: null });
    },

    expireSession: () => {
      clearExpiryTimer();
      clearStoredSession();
      set({ status: "expired", session: null });
    },
  };
});
