import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DEMO_ACCOUNTS } from "@/services/auth";
import { useAuthStore } from "@/store/auth-store";
import { LoginForm } from "./login-form";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/login",
}));

beforeEach(() => {
  router.replace.mockClear();
  localStorage.clear();
  useAuthStore.getState().logout();
});

afterAll(() => {
  useAuthStore.getState().logout();
});

describe("LoginForm", () => {
  it("shows an inline error for every empty field and focuses the first one", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/" />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter your email address.");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.");
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("marks the password field when the password is wrong", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/" />);

    await user.type(screen.getByLabelText("Email"), DEMO_ACCOUNTS.customer.email);
    await user.type(screen.getByLabelText("Password"), "Wrong12345");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(/Incorrect password/)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("marks the email field when no account exists", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/" />);

    await user.type(screen.getByLabelText("Email"), "nobody@example.com");
    await user.type(screen.getByLabelText("Password"), "Whatever123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(/No account found/)).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("signs in and redirects to the requested page", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/dashboard" />);

    await user.type(screen.getByLabelText("Email"), DEMO_ACCOUNTS.customer.email);
    await user.type(screen.getByLabelText("Password"), DEMO_ACCOUNTS.customer.password);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("redirects a visitor who is already signed in", async () => {
    await useAuthStore.getState().login({
      email: DEMO_ACCOUNTS.customer.email,
      password: DEMO_ACCOUNTS.customer.password,
    });
    render(<LoginForm nextPath="/orders" />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/orders"));
  });

  it("says checkout progress is saved when the session expired during checkout (PRD MOD-06-001)", () => {
    useAuthStore.setState({ status: "expired", session: null });
    render(<LoginForm nextPath="/checkout" />);

    expect(screen.getByRole("status")).toHaveTextContent("Your checkout progress is saved and will be restored.");
  });

  it("does not mention checkout progress for other expired sessions", () => {
    useAuthStore.setState({ status: "expired", session: null });
    render(<LoginForm nextPath="/dashboard" />);

    expect(screen.getByRole("status")).not.toHaveTextContent("checkout");
  });

  it("explains an expired session", () => {
    useAuthStore.setState({ status: "expired", session: null });
    render(<LoginForm nextPath="/" />);

    expect(screen.getByRole("status")).toHaveTextContent("Your session expired");
  });
});
