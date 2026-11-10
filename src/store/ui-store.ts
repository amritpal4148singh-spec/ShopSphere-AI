import { create } from "zustand";

/**
 * Global client UI state (Zustand). Server/cache data never lives here:
 * that belongs to TanStack Query (PRD section 9.1).
 */
interface UiState {
  isMobileNavOpen: boolean;
  toggleMobileNav: () => void;
  closeMobileNav: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  isMobileNavOpen: false,
  toggleMobileNav: () => set((state) => ({ isMobileNavOpen: !state.isMobileNavOpen })),
  closeMobileNav: () => set({ isMobileNavOpen: false }),
}));
