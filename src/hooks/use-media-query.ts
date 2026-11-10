import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches. `serverValue` is what the server (and the first client render) assume, so
 * hydration agrees; the real answer follows immediately. Environments without matchMedia report `serverValue`.
 */
export function useMediaQuery(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : serverValue),
    () => serverValue,
  );
}
