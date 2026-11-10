import { decodeToken, encodeToken, type TokenPayload } from "@/lib/mock-token";
import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";
import type { Session, User } from "@/types/auth";

export const SESSION_STORAGE_KEY = "shopsphere.auth.session";
export const SESSION_TTL_SECONDS = 30 * 60;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export type StoredSessionResult = { kind: "none" } | { kind: "expired" } | { kind: "valid"; session: Session };

export function createSession(user: User, nowMs: number = Date.now()): Session {
  const iat = Math.floor(nowMs / 1000);
  const payload: TokenPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    iat,
    exp: iat + SESSION_TTL_SECONDS,
  };
  return {
    token: encodeToken(payload),
    user,
    issuedAt: payload.iat * 1000,
    expiresAt: payload.exp * 1000,
  };
}

/** Only the token is persisted; the session is rebuilt from its claims, like a real JWT client. */
export function persistSession(session: Session): boolean {
  return safeSetItem(SESSION_STORAGE_KEY, session.token);
}

export function clearStoredSession(): void {
  safeRemoveItem(SESSION_STORAGE_KEY);
}

export function readStoredSession(nowMs: number = Date.now()): StoredSessionResult {
  const token = safeGetItem(SESSION_STORAGE_KEY);
  if (!token) return { kind: "none" };

  const payload = decodeToken(token);
  if (!payload) {
    clearStoredSession();
    return { kind: "none" };
  }
  if (payload.exp * 1000 <= nowMs) {
    clearStoredSession();
    return { kind: "expired" };
  }
  return {
    kind: "valid",
    session: {
      token,
      user: { id: payload.sub, name: payload.name, email: payload.email, role: payload.role },
      issuedAt: payload.iat * 1000,
      expiresAt: payload.exp * 1000,
    },
  };
}
