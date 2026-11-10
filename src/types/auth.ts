export type UserRole = "customer" | "admin";

/** The user as seen by the UI. Never contains credential material. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** A user record in the local mock user store (development-stage only, PRD section 11). */
export interface StoredUser extends User {
  salt: string;
  passwordHash: string;
  createdAt: string;
}

/** A JWT-shaped session. `issuedAt` and `expiresAt` are epoch milliseconds. */
export interface Session {
  token: string;
  user: User;
  issuedAt: number;
  expiresAt: number;
}

export type AuthStatus = "idle" | "authenticated" | "unauthenticated" | "expired";

export type AuthErrorCode =
  | "VALIDATION"
  | "ACCOUNT_NOT_FOUND"
  | "WRONG_PASSWORD"
  | "EMAIL_TAKEN"
  | "STORAGE_UNAVAILABLE";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}
