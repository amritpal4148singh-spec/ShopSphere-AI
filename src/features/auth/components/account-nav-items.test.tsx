import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createSession } from "@/services/auth";
import { useAuthStore } from "@/store/auth-store";
import type { User } from "@/types/auth";
import { AccountNavItems } from "./account-nav-items";

const customer: User = { id: "u1", name: "Casey Customer", email: "casey@example.test", role: "customer" };
const admin: User = { id: "u2", name: "Alex Admin", email: "alex@example.test", role: "admin" };

function renderNav(onNavigate?: () => void) {
  return render(
    <ul>
      <AccountNavItems onNavigate={onNavigate} />
    </ul>,
  );
}

beforeEach(() => {
  useAuthStore.getState().logout();
});

afterAll(() => {
  useAuthStore.getState().logout();
});

describe("AccountNavItems", () => {
  it("renders nothing until the session has been restored", () => {
    useAuthStore.setState({ status: "idle", session: null });
    renderNav();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("offers sign in and registration to visitors", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows account links but no admin entry point to a customer", () => {
    useAuthStore.setState({ status: "authenticated", session: createSession(customer) });
    renderNav();

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Orders" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("reveals the admin entry point to an administrator", () => {
    useAuthStore.setState({ status: "authenticated", session: createSession(admin) });
    renderNav();

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("signs out and notifies the parent", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    useAuthStore.setState({ status: "authenticated", session: createSession(customer) });
    renderNav(onNavigate);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
