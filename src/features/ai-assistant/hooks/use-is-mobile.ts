import { useEffect, useState } from "react";

const QUERY = "(max-width: 639px)";

/** Whether the viewport is below the `sm` breakpoint, where the assistant takes the whole screen (PRD 15). */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(QUERY);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}
