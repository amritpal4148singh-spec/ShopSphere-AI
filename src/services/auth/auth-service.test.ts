import { AuthError, loginUser, registerUser } from "./auth-service";
import { hashPassword } from "./password";
import { DEMO_ACCOUNTS, SEED_USERS } from "./seed-users";
import {
  SESSION_STORAGE_KEY,
  SESSION_TTL_MS,
  createSession,
  persistSession,
  readStoredSession,
} from "./session";
import { USERS_STORAGE_KEY } from "./user-repository";

async function codeOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof AuthError ? error.code : "NOT_AUTH_ERROR";
  }
}

beforeEach(() => {
  localStorage.clear();
});

describe("seed accounts", () => {
  it("store hashes that match the documented demo passwords", async () => {
    for (const account of [DEMO_ACCOUNTS.customer, DEMO_ACCOUNTS.admin]) {
      const seed = SEED_USERS.find((user) => user.email === account.email);
      expect(seed).toBeDefined();
      expect(await hashPassword(account.password, seed!.salt)).toBe(seed!.passwordHash);
    }
  });
});

describe("loginUser", () => {
  it("signs in the demo customer and persists a session", async () => {
    const session = await loginUser({ email: DEMO_ACCOUNTS.customer.email, password: DEMO_ACCOUNTS.customer.password });

    expect(session.user.role).toBe("customer");
    expect(session.expiresAt - session.issuedAt).toBe(SESSION_TTL_MS);

    const stored = readStoredSession();
    expect(stored.kind).toBe("valid");
    if (stored.kind === "valid") expect(stored.session.user.email).toBe(DEMO_ACCOUNTS.customer.email);
  });

  it("signs in the demo administrator with the admin role", async () => {
    const session = await loginUser({ email: DEMO_ACCOUNTS.admin.email, password: DEMO_ACCOUNTS.admin.password });
    expect(session.user.role).toBe("admin");
  });

  it("matches the email case-insensitively and ignores surrounding whitespace", async () => {
    const session = await loginUser({ email: "  CUSTOMER@shopsphere.test ", password: DEMO_ACCOUNTS.customer.password });
    expect(session.user.id).toBe("user-seed-customer");
  });

  it("reports an unknown email and a wrong password as distinct failures", async () => {
    expect(await codeOf(loginUser({ email: "nobody@example.com", password: "Whatever123" }))).toBe("ACCOUNT_NOT_FOUND");
    expect(await codeOf(loginUser({ email: DEMO_ACCOUNTS.customer.email, password: "Wrong12345" }))).toBe("WRONG_PASSWORD");
  });

  it("rejects invalid input and does not create a session on failure", async () => {
    expect(await codeOf(loginUser({ email: "", password: "" }))).toBe("VALIDATION");
    expect(await codeOf(loginUser({ email: DEMO_ACCOUNTS.customer.email, password: "Wrong12345" }))).toBe("WRONG_PASSWORD");
    expect(readStoredSession().kind).toBe("none");
  });
});

describe("registerUser", () => {
  const input = { name: "  Asha Rao ", email: "Asha@Example.com", password: "Password123" };

  it("creates a customer account, signs it in, and allows a later login", async () => {
    const session = await registerUser(input);

    expect(session.user).toMatchObject({ name: "Asha Rao", email: "asha@example.com", role: "customer" });
    expect(readStoredSession().kind).toBe("valid");

    localStorage.removeItem(SESSION_STORAGE_KEY);
    const again = await loginUser({ email: "asha@example.com", password: "Password123" });
    expect(again.user.id).toBe(session.user.id);
  });

  it("never stores the password in plain text", async () => {
    await registerUser(input);
    expect(localStorage.getItem(USERS_STORAGE_KEY)).not.toContain("Password123");
  });

  it("rejects an email that is already registered, ignoring case", async () => {
    await registerUser(input);
    expect(await codeOf(registerUser({ ...input, email: "ASHA@example.com" }))).toBe("EMAIL_TAKEN");
  });

  it("rejects an email used by a seed account", async () => {
    expect(await codeOf(registerUser({ ...input, email: DEMO_ACCOUNTS.admin.email }))).toBe("EMAIL_TAKEN");
  });

  it("cannot be used to create an administrator", async () => {
    const session = await registerUser({ ...input, role: "admin" } as typeof input);
    expect(session.user.role).toBe("customer");
  });

  it("rejects invalid input", async () => {
    expect(await codeOf(registerUser({ name: "", email: "bad", password: "x" }))).toBe("VALIDATION");
  });

  it("recovers from corrupted stored users by treating them as empty", async () => {
    localStorage.setItem(USERS_STORAGE_KEY, "{not json");
    const session = await registerUser(input);
    expect(session.user.email).toBe("asha@example.com");
  });
});

describe("session storage", () => {
  const user = { id: "u1", name: "Tester", email: "tester@example.com", role: "customer" as const };

  it("treats a missing token as no session", () => {
    expect(readStoredSession().kind).toBe("none");
  });

  it("reports an expired token as expired and clears it", () => {
    const issuedAt = Date.now() - SESSION_TTL_MS - 5_000;
    persistSession(createSession(user, issuedAt));

    expect(readStoredSession(Date.now()).kind).toBe("expired");
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("discards a garbage token", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "garbage");
    expect(readStoredSession().kind).toBe("none");
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

});
