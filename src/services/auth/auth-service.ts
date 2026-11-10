import { hasErrors, normalizeEmail, validateLogin, validateRegistration } from "@/utils/validation";
import type { AuthErrorCode, LoginInput, RegisterInput, Session, StoredUser } from "@/types/auth";
import { generateSalt, hashPassword } from "./password";
import { createSession, persistSession } from "./session";
import { addRegisteredUser, findUserByEmail, toPublicUser } from "./user-repository";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
    this.code = code;
  }
}

/**
 * Validates against the local mock user store (PRD section 11.1 allows DummyJSON "and/or" a local store).
 * Distinct codes for unknown email vs wrong password let the UI mark the exact failing field (PRD section 20, case 19).
 * That is acceptable for a mock; a production backend would not reveal which one failed.
 */
export async function loginUser(input: LoginInput): Promise<Session> {
  if (hasErrors(validateLogin(input))) throw new AuthError("VALIDATION");

  const user = findUserByEmail(input.email);
  if (!user) throw new AuthError("ACCOUNT_NOT_FOUND");

  const hash = await hashPassword(input.password, user.salt);
  if (hash !== user.passwordHash) throw new AuthError("WRONG_PASSWORD");

  const session = createSession(toPublicUser(user));
  persistSession(session);
  return session;
}

/** Creates a local Customer account and signs it in. Registration can never create an Administrator. */
export async function registerUser(input: RegisterInput): Promise<Session> {
  const errors = validateRegistration({ ...input, confirmPassword: input.password });
  if (hasErrors(errors)) throw new AuthError("VALIDATION");

  if (findUserByEmail(input.email)) throw new AuthError("EMAIL_TAKEN");

  const salt = generateSalt();
  const user: StoredUser = {
    id: `user-${globalThis.crypto.randomUUID()}`,
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    role: "customer",
    salt,
    passwordHash: await hashPassword(input.password, salt),
    createdAt: new Date().toISOString(),
  };

  if (!addRegisteredUser(user)) throw new AuthError("STORAGE_UNAVAILABLE");

  const session = createSession(toPublicUser(user));
  persistSession(session);
  return session;
}
