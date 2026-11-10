import { safeGetItem, safeSetItem } from "@/lib/safe-storage";
import { normalizeEmail } from "@/utils/validation";
import type { StoredUser, User } from "@/types/auth";
import { SEED_USERS } from "./seed-users";

export const USERS_STORAGE_KEY = "shopsphere.auth.users";

function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.email === "string" &&
    (v.role === "customer" || v.role === "admin") &&
    typeof v.salt === "string" &&
    typeof v.passwordHash === "string" &&
    typeof v.createdAt === "string"
  );
}

/** Registered (non-seed) users from local storage. Corrupt or unexpected data yields an empty list. */
export function loadRegisteredUsers(): StoredUser[] {
  const raw = safeGetItem(USERS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredUser) : [];
  } catch {
    return [];
  }
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const target = normalizeEmail(email);
  return [...SEED_USERS, ...loadRegisteredUsers()].find((user) => normalizeEmail(user.email) === target);
}

/** Returns false when the user could not be persisted (storage unavailable). */
export function addRegisteredUser(user: StoredUser): boolean {
  return safeSetItem(USERS_STORAGE_KEY, JSON.stringify([...loadRegisteredUsers(), user]));
}

export function toPublicUser(user: StoredUser): User {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Every account in the local user store (seed accounts plus registered ones), without credential material. */
export function listUsers(): User[] {
  return [...SEED_USERS, ...loadRegisteredUsers()].map(toPublicUser);
}
