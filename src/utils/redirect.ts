const AUTH_PATHS = ["/login", "/register"];

/**
 * Returns `value` only if it is a safe, same-origin, in-app path; otherwise `fallback`.
 * Prevents open redirects through the `next` query parameter and login redirect loops.
 */
export function getSafeRedirectPath(value: string | string[] | null | undefined, fallback = "/"): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  if ([...candidate].some((char) => char.charCodeAt(0) < 32)) return fallback;

  const path = candidate.split(/[?#]/)[0] ?? "";
  if (AUTH_PATHS.includes(path)) return fallback;
  return candidate;
}
