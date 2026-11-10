import { render, screen, waitFor } from "@testing-library/react";

import { createSession } from "@/services/auth";
import { useAuthStore } from "@/store/auth-store";
import type { User } from "@/types/auth";
import { AuthGuard } from "./auth-guard";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/dashboard",
}));

const customer: User = { id: "u1", name: "Casey Customer", email: "casey@example.test", role: "customer" };
const admin: User = { id: "u2", name: "Alex Admin", email: "alex@example.test", role: "admin" };

function signInAs(user: User) {
  useAuthStore.setState({ status: "authenticated", session: createSession(user) });
}

beforeEach(() => {
  router.replace.mockClear();
  useAuthStore.getState().logout();
});

afterAll(() => {
  useAuthStore.getState().logout();
});

describe("AuthGuard", () => {
  it("shows a loading skeleton and no content while the session is being restored", () => {
    useAuthStore.setState({ status: "idle", session: null });
    render(
      <AuthGuard>
        <p>Secret</p>
      </AuthGuard>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Checking your session");
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated visitor to login, remembering the page", async () => {
    useAuthStore.setState({ status: "unauthenticated", session: null });
    render(
      <AuthGuard>
        <p>Secret</p>
      </AuthGuard>,
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fdashboard"));
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("redirects an expired session to login as well", async () => {
    useAuthStore.setState({ status: "expired", session: null });
    render(
      <AuthGuard>
        <p>Secret</p>
      </AuthGuard>,
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fdashboard"));
  });

  it("renders the content for a signed-in user", () => {
    signInAs(customer);
    render(
      <AuthGuard>
        <p>Secret</p>
      </AuthGuard>,
    );

    expect(screen.getByText("Secret")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("denies access when the required role is missing", () => {
    signInAs(customer);
    render(
      <AuthGuard requiredRole="admin">
        <p>Admin only</p>
      </AuthGuard>,
    );

    expect(screen.getByRole("heading", { name: "You do not have access to this page" })).toBeInTheDocument();
    expect(screen.queryByText("Admin only")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("allows an administrator into an admin-only area", () => {
    signInAs(admin);
    render(
      <AuthGuard requiredRole="admin">
        <p>Admin only</p>
      </AuthGuard>,
    );

    expect(screen.getByText("Admin only")).toBeInTheDocument();
  });
});
