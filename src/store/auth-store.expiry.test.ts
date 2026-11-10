import { DEMO_ACCOUNTS, SESSION_TTL_MS } from "@/services/auth";
import { useAuthStore } from "./auth-store";

describe("useAuthStore session expiry timer", () => {
  afterEach(() => {
    vi.useRealTimers();
    useAuthStore.getState().logout();
    localStorage.clear();
  });

  it("expires the session automatically when its lifetime elapses", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    await useAuthStore.getState().login({ email: DEMO_ACCOUNTS.customer.email, password: DEMO_ACCOUNTS.customer.password });
    expect(useAuthStore.getState().status).toBe("authenticated");

    await vi.advanceTimersByTimeAsync(SESSION_TTL_MS + 1_000);

    expect(useAuthStore.getState().status).toBe("expired");
    expect(useAuthStore.getState().session).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
