import { DEMO_ACCOUNTS, SESSION_TTL_MS, createSession, persistSession } from "@/services/auth";
import { useAuthStore } from "./auth-store";

const customer = { email: DEMO_ACCOUNTS.customer.email, password: DEMO_ACCOUNTS.customer.password };

beforeEach(() => {
  useAuthStore.getState().logout();
  localStorage.clear();
  useAuthStore.setState({ status: "idle", session: null });
});

afterAll(() => {
  useAuthStore.getState().logout();
});

describe("useAuthStore", () => {
  it("starts idle", () => {
    expect(useAuthStore.getState().status).toBe("idle");
  });

  it("hydrates to unauthenticated when nothing is stored", () => {
    useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("logs in, and the session persists across a simulated refresh", async () => {
    await useAuthStore.getState().login(customer);
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().session?.user.email).toBe(customer.email);

    // Simulate a page refresh: in-memory state is lost, storage remains.
    useAuthStore.setState({ status: "idle", session: null });
    useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().session?.user.email).toBe(customer.email);
  });

  it("keeps the previous state when login fails", async () => {
    useAuthStore.getState().hydrate();
    await expect(useAuthStore.getState().login({ email: customer.email, password: "Wrong12345" })).rejects.toThrow();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("registers and signs in a new customer", async () => {
    await useAuthStore.getState().register({ name: "Asha Rao", email: "asha@example.com", password: "Password123" });
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().session?.user.role).toBe("customer");
  });

  it("logs out and clears the persisted session", async () => {
    await useAuthStore.getState().login(customer);
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().status).toBe("unauthenticated");

    useAuthStore.setState({ status: "idle", session: null });
    useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("hydrates an expired stored session as expired and keeps that notice on a repeat hydrate", () => {
    persistSession(
      createSession({ id: "u1", name: "Tester", email: "tester@example.com", role: "customer" }, Date.now() - SESSION_TTL_MS - 5_000),
    );

    useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().status).toBe("expired");

    useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().status).toBe("expired");
  });
});
